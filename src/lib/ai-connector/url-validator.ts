// Валидация URL ИИ-провайдеров для защиты от SSRF (Фаза 1, шаг 1.1).
//
// Уязвимость: baseUrl провайдера не валидировался — можно указать
// http://localhost, http://169.254.169.254 (cloud metadata) или любой
// внутренний адрес, и сервер отправит туда запрос с Authorization: Bearer.
//
// Защита:
//   - Только http/https схемы.
//   - В production — только https (кроме явно разрешённого allowInsecureHttp).
//   - Блокировка приватных/служебных IP-диапазонов и имён хостов,
//     резолвящихся в приватные IP (защита от DNS rebinding).
//   - В dev разрешён loopback (127.0.0.1, ::1, localhost) для локальных LLM (Ollama).

import { isIP } from 'node:net'
import * as dns from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'

/** Публично известные имена хостов, которые блокируются всегда. */
const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata',
  'metadata.aws.internal',
])

export interface ValidateUrlOptions {
  /** Разрешить http (не только https). По умолчанию true в dev, false в production. */
  allowInsecureHttp?: boolean
}

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlValidationError'
  }
}

/**
 * Проверить, попадает ли IPv4-адрес в приватный/служебный диапазон.
 * @returns true, если адрес приватный/служебный (должен быть заблокирован).
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false
  }
  const [a, b] = parts

  // 0.0.0.0/8 — "this network"
  if (a === 0) return true
  // 10.0.0.0/8 — private
  if (a === 10) return true
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true
  // 127.0.0.0/8 — loopback
  if (a === 127) return true
  // 169.254.0.0/16 — link-local (включает cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true
  // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0) return true
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && b >= 18 && b <= 19) return true
  // 198.51.100.0/24 — documentation
  if (a === 198 && b === 51) return true
  // 203.0.113.0/24 — documentation
  if (a === 203 && b === 0) return true
  // 224.0.0.0/4 — multicast
  if (a >= 224) return true

  return false
}

/**
 * Проверить, попадает ли IPv6-адрес в приватный/служебный диапазон.
 * @returns true, если адрес приватный/служебный (должен быть заблокирован).
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  // ::1 — loopback
  if (lower === '::1') return true
  // fc00::/7 — unique local address (ULA)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  // fe80::/10 — link-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true
  }
  // :: — неопределённый адрес
  if (lower === '::') return true
  return false
}

/**
 * Проверить, является ли IP-адрес приватным/служебным.
 */
function isPrivateIP(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return isPrivateIPv4(ip)
  if (family === 6) return isPrivateIPv6(ip)
  return false
}

/**
 * Проверить, является ли хост loopback (для dev-разрешения локальных LLM).
 */
function isLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === 'localhost') return true
  if (lower === '127.0.0.1' || lower === '::1') return true
  if (lower.endsWith('.localhost')) return true
  // 127.0.0.0/8
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true
  return false
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Синхронная валидация URL: проверка схемы, имени хоста и IP-паттернов.
 * НЕ выполняет DNS-резолв (используйте validateProviderUrl для полной проверки).
 *
 * @param baseUrl — URL для проверки
 * @param opts — опции
 * @throws UrlValidationError при невалидном URL
 */
export function validateProviderUrlSync(baseUrl: string, opts?: ValidateUrlOptions): void {
  if (!baseUrl || baseUrl.trim().length === 0) {
    throw new UrlValidationError('baseUrl не задан')
  }

  let parsed: URL
  try {
    parsed = new URL(baseUrl.trim())
  } catch {
    throw new UrlValidationError(`Некорректный URL: ${baseUrl}`)
  }

  // Проверка схемы.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlValidationError(
      `Недопустимая схема ${parsed.protocol}. Разрешены только http и https.`
    )
  }

  const isHttps = parsed.protocol === 'https:'
  const allowHttp = opts?.allowInsecureHttp ?? !isProduction()
  if (!isHttps && !allowHttp) {
    throw new UrlValidationError(
      'В production разрешён только https. Укажите https:// URL.'
    )
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '') // убрать скобки IPv6

  // Заблокированные имена хостов (metadata endpoints и т.п.).
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new UrlValidationError(`Хост ${hostname} заблокирован (служебный/metadata endpoint).`)
  }

  // Если хост — IP-адрес, проверяем диапазоны.
  const ipFamily = isIP(hostname)
  if (ipFamily > 0) {
    if (isPrivateIP(hostname)) {
      // В dev разрешаем loopback IP для локальных LLM.
      if (!isProduction() && isLoopbackHost(hostname)) return
      throw new UrlValidationError(
        `IP-адрес ${hostname} находится в приватном/служебном диапазоне и заблокирован.`
      )
    }
    return
  }

  // Доменное имя: проверяем loopback для dev.
  if (!isProduction() && isLoopbackHost(hostname)) return

  // В production блокируем loopback-домены (localhost и т.п.).
  if (isProduction() && isLoopbackHost(hostname)) {
    throw new UrlValidationError(
      `Хост ${hostname} — loopback и заблокирован в production.`
    )
  }

  // Блокируем очевидно приватные имена (без DNS-резолва — для быстрой проверки).
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    if (isProduction()) {
      throw new UrlValidationError(
        `Хост ${hostname} использует локальный домен и заблокирован в production.`
      )
    }
  }
}

/**
 * Полная асинхронная валидация URL: синхронная проверка + DNS-резолв.
 * Резолвит хост и проверяет ВСЕ резолвленные IP-адреса против приватных диапазонов
 * (защита от DNS rebinding).
 *
 * @param baseUrl — URL для проверки
 * @param opts — опции
 * @throws UrlValidationError при невалидном URL или приватном IP в резолве
 */
export async function validateProviderUrl(
  baseUrl: string,
  opts?: ValidateUrlOptions
): Promise<void> {
  // Сначала синхронная проверка (схема, формат, базовые блокировки).
  validateProviderUrlSync(baseUrl, opts)

  const parsed = new URL(baseUrl.trim())
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')

  // Если хост — IP-адрес, DNS-резолв не нужен (уже проверен в sync).
  if (isIP(hostname) > 0) return

  // Loopback в dev — разрешён без резолва.
  if (!isProduction() && isLoopbackHost(hostname)) return

  // DNS-резолв: проверяем все IP-адреса.
  let addresses: LookupAddress[]
  try {
    addresses = await dns.lookup(hostname, { all: true, family: 0 })
  } catch {
    throw new UrlValidationError(`Не удалось разрешить домен ${hostname}.`)
  }

  if (addresses.length === 0) {
    throw new UrlValidationError(`Домен ${hostname} не имеет IP-адресов.`)
  }

  for (const addr of addresses) {
    if (isPrivateIP(addr.address)) {
      // В dev разрешаем loopback.
      if (!isProduction() && isLoopbackHost(addr.address)) continue
      throw new UrlValidationError(
        `Домен ${hostname} резолвится в приватный адрес ${addr.address} — ` +
          'возможен SSRF/DNS rebinding. Используйте публичный endpoint.'
      )
    }
  }
}
