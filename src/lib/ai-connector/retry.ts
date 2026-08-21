// Общий механизм retry с экспоненциальным backoff для ИИ-провайдеров (Фаза 4).
// Используется провайдерами, которые не наследуются от OpenAICompatibleProvider
// (yandex-cloud, zai), чтобы получить те же гарантии устойчивости.

import { AIProviderError, classifyError, isRetryable, type AIErrorCode } from './errors'

export interface RetryOptions {
  maxRetries?: number
  initialBackoffMs?: number
  backoffMultiplier?: number
  backoffMaxMs?: number
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  backoffMultiplier: 2,
  backoffMaxMs: 8000,
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Классифицировать произвольную ошибку в AIErrorCode. */
function classifyThrown(e: unknown): { code: AIErrorCode; status?: number } {
  if (e instanceof AIProviderError) return { code: e.code, status: e.status }
  if (e instanceof Error) {
    if (e.name === 'AbortError') return { code: 'timeout' }
    if (e instanceof TypeError) return { code: 'network' }
  }
  return { code: 'unknown' }
}

/**
 * Выполнить fn с retry и экспоненциальным backoff.
 * Ретраит только ретряемые ошибки (timeout, rate_limit, network, server_error).
 * Ошибки, не являющиеся AIProviderError, оборачиваются в AIProviderError.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts?: RetryOptions): Promise<T> {
  const o = { ...DEFAULT_RETRY, ...opts }
  let lastError: unknown = null
  for (let attempt = 0; attempt <= o.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      // Непосредственно непертряемые ошибки AIProviderError — пробрасываем сразу.
      if (e instanceof AIProviderError && !e.retryable) throw e
      const { code, status } = classifyThrown(e)
      if (!isRetryable(code) || attempt >= o.maxRetries) {
        if (e instanceof AIProviderError) throw e
        throw new AIProviderError(
          e instanceof Error ? e.message : String(e),
          code,
          status,
          false
        )
      }
      lastError = e
      await sleep(Math.min(o.initialBackoffMs * o.backoffMultiplier ** attempt, o.backoffMaxMs))
    }
  }
  if (lastError instanceof AIProviderError) throw lastError
  throw new AIProviderError(
    'Не удалось выполнить запрос после всех попыток',
    'unknown',
    undefined,
    false
  )
}

/** Удобная проверка: является ли ошибка ретряемой AIProviderError. */
export function isRetryableError(e: unknown): boolean {
  return e instanceof AIProviderError && e.retryable === true
}

// Реэкспорт для удобства импорта из одного места.
export { classifyError, isRetryable, AIProviderError } from './errors'
export { Semaphore, getDefaultConcurrency } from './semaphore'
