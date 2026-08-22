// In-memory rate limiter (sliding window).
// Достаточно для single-instance архитектуры.
// При horizontal scaling — заменить на Redis-backed (upstash/ratelimit).

import { ApiError } from './api-utils'

const windows = new Map<string, { count: number; resetAt: number }>()

interface RateLimitResult {
  ok: boolean
  retryAfterMs: number
}

/**
 * Проверить лимит для ключа.
 * @param key — уникальный идентификатор (scope + IP или userId)
 * @param limit — максимум запросов в окне
 * @param windowMs — размер окна в мс
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
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

/**
 * Проверить rate limit для API-роута. Бросает ApiError(429) при превышении.
 * @param request — объект Request для извлечения IP
 * @param scope — имя scope (например, 'ai-generate')
 * @param limit — максимум запросов в окно (по умолчанию 20)
 * @param windowMs — размер окна в мс (по умолчанию 60 000 = 1 мин)
 */
export function checkRateLimit(
  request: Request,
  scope: string,
  limit = 20,
  windowMs = 60_000
): void {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  const { ok, retryAfterMs } = rateLimit(`${scope}:${ip}`, limit, windowMs)
  if (!ok) {
    throw new ApiError(
      `Слишком много запросов. Повторите через ${Math.ceil(retryAfterMs / 1000)}с.`,
      429,
      'rate_limited'
    )
  }
}
