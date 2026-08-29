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
 * Generic-сообщение для клиента: детали провайдера (URL, текст ответа,
 * статус) не должны утекать наружу. Полные детали логируются вызывающим кодом.
 */
export const PROVIDER_ERROR_GENERIC = 'Ошибка ИИ-провайдера'

/**
 * Сопоставить код ошибки провайдера с HTTP-статусом для ответа клиенту.
 * Внутренние детали провайдера не транслируются напрямую в статус клиента —
 * используется обобщённый 502, кроме rate_limit (429) и timeout (504).
 */
export function providerErrorStatus(code: AIErrorCode): number {
  switch (code) {
    case 'rate_limit':
      return 429
    case 'timeout':
      return 504
    default:
      return 502
  }
}

/**
 * Безопасное для клиента сообщение об ошибке провайдера.
 * Не содержит деталей (message провайдера, URL, тело ответа).
 */
export function sanitizeProviderMessage(code: AIErrorCode): string {
  switch (code) {
    case 'rate_limit':
      return 'Слишком много запросов к ИИ-провайдеру. Повторите позже.'
    case 'timeout':
      return 'Превышено время ожидания ответа от ИИ-провайдера.'
    case 'auth':
      return 'Ошибка авторизации ИИ-провайдера.'
    case 'network':
      return 'Сетевая ошибка при обращении к ИИ-провайдеру.'
    case 'empty_response':
      return 'ИИ-провайдер вернул пустой ответ.'
    default:
      return PROVIDER_ERROR_GENERIC
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
