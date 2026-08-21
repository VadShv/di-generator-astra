// Структурированные ошибки ИИ-коннектора (Фаза 4).
// Позволяют роутам корректно реагировать на разные классы сбоев провайдера.

export type AIErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'network'
  | 'bad_request'
  | 'server_error'
  | 'empty_response'
  | 'unknown'

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
    public readonly status?: number,
    public readonly retryable?: boolean
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}

/**
 * Классифицировать ошибку HTTP-запроса к провайдеру.
 * @param status HTTP-статус ответа (если есть)
 * @param isAbort был ли abort (таймаут)
 * @param isNetwork сетевая ошибка (нет ответа)
 */
export function classifyError(status?: number, isAbort = false, isNetwork = false): AIErrorCode {
  if (isAbort) return 'timeout'
  if (isNetwork) return 'network'
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'rate_limit'
  if (status && status >= 400 && status < 500) return 'bad_request'
  if (status && status >= 500) return 'server_error'
  return 'unknown'
}

/** Является ли ошибка ретряемой (стоит повторить запрос). */
export function isRetryable(code: AIErrorCode): boolean {
  return code === 'timeout' || code === 'rate_limit' || code === 'network' || code === 'server_error'
}
