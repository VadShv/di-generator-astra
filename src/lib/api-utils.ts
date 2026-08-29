// Утилиты для API Route Handlers (Фаза 1).
// Единая обработка ошибок и валидация тел запросов.
// Zod v4 совместимость.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import type { AppLogger } from './logger'
import { createLogger } from './logger'
import { isSentryEnabled } from './sentry'
import {
  AIProviderError,
  providerErrorStatus,
  sanitizeProviderMessage,
} from './ai-connector/errors'

const defaultLogger = createLogger('api')

function captureSentry(error: unknown, extra?: Record<string, unknown>) {
  if (!isSentryEnabled()) return
  import('@sentry/node').then((Sentry) => {
    Sentry.captureException(error, { extra })
  }).catch(() => {})
}

/** Стандартизованная ошибка API. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Преобразовать произвольную ошибку в стандартизованный JSON-ответ. */
export function errorResponse(
  error: unknown,
  logger: AppLogger = defaultLogger,
  scope?: string
): NextResponse {
  if (error instanceof ApiError) {
    logger.error(`${scope ?? 'request'}: ${error.message}`, { code: error.code, status: error.status })
    return NextResponse.json(
      { error: error.message, code: error.code ?? null },
      { status: error.status }
    )
  }

  // Ошибки ИИ-провайдера: клиенту — generic-сообщение, детали — в логи/Sentry.
  if (error instanceof AIProviderError) {
    const status = providerErrorStatus(error.code)
    const safeMessage = sanitizeProviderMessage(error.code)
    logger.error(`${scope ?? 'request'}: provider error`, {
      code: error.code,
      status: error.status,
      retryable: error.retryable,
      detail: error.message, // полные детали только в логи
    })
    captureSentry(error, {
      scope,
      providerCode: error.code,
      providerStatus: error.status,
      detail: error.message,
    })
    return NextResponse.json(
      { error: safeMessage, code: 'ai_provider_error' },
      { status }
    )
  }

  if (error instanceof ZodError) {
    // Zod v4: используем .issues вместо .errors
    const issues = (error as unknown as { issues?: Array<{ path: PropertyKey[]; message: string }> }).issues ?? []
    const message = issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
    logger.warn(`${scope ?? 'request'}: validation failed`, { message })
    return NextResponse.json({ error: message, code: 'validation_error' }, { status: 400 })
  }

  const message = error instanceof Error ? error.message : String(error)
  logger.error(`${scope ?? 'request'}: unexpected`, { message })
  captureSentry(error, { scope, message })
  return NextResponse.json(
    { error: message, code: 'internal_error' },
    { status: 500 }
  )
}

/**
 * Высокоуровневая обёртка для POST/GET хендлеров.
 * Логирует ошибки, возвращает единый JSON-формат.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
  scope?: string
): (...args: TArgs) => Promise<NextResponse> {
  const log = scope ? createLogger(scope) : defaultLogger
  return async (...args: TArgs) => {
    try {
      return await handler(...args)
    } catch (error) {
      return errorResponse(error, log, scope)
    }
  }
}

interface SafeParseLike<T> {
  success: boolean
  error?: ZodError
  data?: T
}

/**
 * Распарсить и провалидировать JSON-тело запроса через zod-схему.
 * Бросает ApiError(400) при невалидном теле.
 */
export async function parseBody<T>(
  request: Request,
  schema: { safeParse: (data: unknown) => SafeParseLike<T> }
): Promise<T> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw new ApiError('Тело запроса должно быть валидным JSON', 400, 'invalid_json')
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    throw result.error
  }
  // data гарантированно есть при success=true
  return result.data as T
}
