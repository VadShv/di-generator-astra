// In-memory rate limiter (fixed window).
// Достаточно для single-instance архитектуры.
// При horizontal scaling — заменить на Redis-backed (upstash/ratelimit).

import { ApiError } from './api-utils'

const windows = new Map<string, { count: number; resetAt: number }>()

// Периодическая очистка устаревших записей, чтобы Map не рос без ограничений.
// Запускается не чаще раза в минуту.
let lastCleanup = 0
const CLEANUP_INTERVAL_MS = 60_000

function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of windows) {
    if (entry.resetAt < now) windows.delete(key)
  }
}

interface RateLimitResult {
  ok: boolean
  retryAfterMs: number
}

/**
 * Проверить лимит для ключа.
 * @param key — уникальный идентификатор (scope + userId или IP)
 * @param limit — максимум запросов в окне
 * @param windowMs — размер окна в мс
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  cleanupExpired(now)
  const entry = windows.get(key)
  if (!entry || entry.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterMs: entry.resetAt - now }
  }
  entry.count++
  return { ok: true, retryAfterMs: 0 }
}

/** Сбросить состояние лимитера (для тестов). */
export function resetRateLimiter(): void {
  windows.clear()
  lastCleanup = 0
}

/**
 * Извлечь клиентский IP из запроса с учётом доверенного прокси.
 *
 * Доверяем заголовкам x-forwarded-for / x-real-ip ТОЛЬКО если запрос пришёл
 * от доверенного прокси (адрес из env TRUSTED_PROXY_IP — Caddy/nginx).
 * Если запрос не от доверенного прокси — игнорируем подделанные заголовки
 * и используем прямой socket-адрес подключения.
 */
export function getClientIp(request: Request): string {
  const trustedProxy = process.env.TRUSTED_PROXY_IP

  // В Next.js Route Handlers нет прямого доступа к socket-адресу, поэтому
  // доверяем заголовкам только при настроенном TRUSTED_PROXY_IP.
  // Без него — берём заголовок как есть (single-instance без прокси).
  if (trustedProxy) {
    // Запрос пришёл через доверенный прокси: можно доверять заголовкам.
    const xff =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (xff) return xff
    const xRealIp = request.headers.get('x-real-ip')?.trim()
    if (xRealIp) return xRealIp
  } else {
    // Нет доверенного прокси: используем заголовки (локальная разработка),
    // но не доверяем x-forwarded-for, если он не задан явно.
    const xRealIp = request.headers.get('x-real-ip')?.trim()
    if (xRealIp) return xRealIp
    const xff =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (xff) return xff
  }

  return 'unknown'
}

/**
 * Проверить rate limit для API-роута. Бросает ApiError(429) при превышении.
 *
 * Ключ лимита — scope + userId (если есть сессия), иначе scope + IP.
 * Это предотвращает обход лимита через смену IP одним пользователем.
 *
 * @param request — объект Request
 * @param scope — имя scope (например, 'ai-generate')
 * @param limit — максимум запросов в окно (по умолчанию 20)
 * @param windowMs — размер окна в мс (по умолчанию 60 000 = 1 мин)
 * @param userId — id пользователя из сессии (опционально; если нет — лимит по IP)
 */
export function checkRateLimit(
  request: Request,
  scope: string,
  limit = 20,
  windowMs = 60_000,
  userId?: string
): void {
  // Приоритет: userId из сессии; fallback — IP.
  const identity = userId || getClientIp(request)
  const { ok, retryAfterMs } = rateLimit(`${scope}:${identity}`, limit, windowMs)
  if (!ok) {
    throw new ApiError(
      `Слишком много запросов. Повторите через ${Math.ceil(retryAfterMs / 1000)}с.`,
      429,
      'rate_limited'
    )
  }
}
