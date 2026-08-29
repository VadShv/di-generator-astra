// Тесты санитизации ошибок ИИ-провайдера (Фаза 2, шаг 2.1).
// Проверяем, что детали ошибки (message, status, URL, тело ответа)
// не утекают клиенту, а в логи/Sentry попадают полные данные.

import { describe, it, expect, vi } from 'vitest'
import { NextResponse } from 'next/server'
import {
  AIProviderError,
  sanitizeProviderMessage,
  providerErrorStatus,
  PROVIDER_ERROR_GENERIC,
} from './ai-connector/errors'
import { ApiError, errorResponse } from './api-utils'

// Мокаем Sentry, чтобы captureSentry не падал.
vi.mock('./sentry', () => ({
  isSentryEnabled: () => false,
}))

// Мокаем next/server, чтобы NextResponse.json возвращал обычный объект.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      ({
        status: init?.status ?? 200,
        json: async () => body,
      }) as unknown as NextResponse,
  },
}))

describe('sanitizeProviderMessage', () => {
  it('возвращает generic для unknown/bad_request/server_error', () => {
    expect(sanitizeProviderMessage('unknown')).toBe(PROVIDER_ERROR_GENERIC)
    expect(sanitizeProviderMessage('bad_request')).toBe(PROVIDER_ERROR_GENERIC)
    expect(sanitizeProviderMessage('server_error')).toBe(PROVIDER_ERROR_GENERIC)
  })

  it('возвращает человекочитаемое сообщение для rate_limit', () => {
    const msg = sanitizeProviderMessage('rate_limit')
    expect(msg).toContain('запросов')
    expect(msg).not.toContain('429')
  })

  it('не содержит технических деталей', () => {
    const codes = [
      'timeout',
      'rate_limit',
      'auth',
      'network',
      'bad_request',
      'server_error',
      'empty_response',
      'unknown',
    ] as const
    for (const code of codes) {
      const msg = sanitizeProviderMessage(code)
      expect(msg).not.toMatch(/http|localhost|169\.254|bearer|api[_-]?key/i)
    }
  })
})

describe('providerErrorStatus', () => {
  it('возвращает 429 для rate_limit', () => {
    expect(providerErrorStatus('rate_limit')).toBe(429)
  })

  it('возвращает 504 для timeout', () => {
    expect(providerErrorStatus('timeout')).toBe(504)
  })

  it('возвращает 502 для остальных кодов', () => {
    expect(providerErrorStatus('auth')).toBe(502)
    expect(providerErrorStatus('network')).toBe(502)
    expect(providerErrorStatus('bad_request')).toBe(502)
    expect(providerErrorStatus('server_error')).toBe(502)
    expect(providerErrorStatus('empty_response')).toBe(502)
    expect(providerErrorStatus('unknown')).toBe(502)
  })
})

describe('errorResponse — санитизация AIProviderError', () => {
  it('возвращает generic-сообщение, скрывая детали провайдера', async () => {
    // Ошибка с чувствительными деталями (URL, тело ответа, заголовок auth).
    const sensitiveDetail =
      'YandexGPT HTTP 401: request to https://internal.corp/api failed with body {"error":"Bearer sk-xxx-secret"}'
    const error = new AIProviderError(sensitiveDetail, 'auth', 401, false)

    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
    const res = errorResponse(error, logger as never, 'ai-generate')
    const body = await res.json()

    // Клиенту — generic, без чувствительных деталей.
    expect(body.error).toBe(sanitizeProviderMessage('auth'))
    expect(body.error).not.toContain('internal.corp')
    expect(body.error).not.toContain('sk-xxx-secret')
    expect(body.error).not.toContain('Bearer')
    expect(body.code).toBe('ai_provider_error')
    expect(res.status).toBe(502)
  })

  it('rate_limit отдаёт 429 и generic-сообщение', async () => {
    const error = new AIProviderError(
      'Provider returned 429: rate limit exceeded for key sk-live-xxx',
      'rate_limit',
      429,
      true,
    )
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
    const res = errorResponse(error, logger as never)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toBe(sanitizeProviderMessage('rate_limit'))
    expect(body.error).not.toContain('sk-live-xxx')
  })

  it('timeout отдаёт 504', async () => {
    const error = new AIProviderError('abort after 15000ms to http://10.0.0.5', 'timeout')
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
    const res = errorResponse(error, logger as never)
    const body = await res.json()

    expect(res.status).toBe(504)
    expect(body.error).toBe(sanitizeProviderMessage('timeout'))
    expect(body.error).not.toContain('10.0.0.5')
  })

  it('логирует полные детали ошибки', () => {
    const detail = 'YandexGPT HTTP 500: internal error with trace id abc-123'
    const error = new AIProviderError(detail, 'server_error', 500, true)
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }

    errorResponse(error, logger as never, 'test-conn')

    expect(logger.error).toHaveBeenCalled()
    const logged = logger.error.mock.calls[0]
    // Полные детали должны быть в логах.
    expect(JSON.stringify(logged)).toContain(detail)
    expect(JSON.stringify(logged)).toContain('server_error')
    expect(JSON.stringify(logged)).toContain('test-conn')
  })

  it('ApiError по-прежнему отдаёт своё сообщение (не санитизируется)', async () => {
    const error = new ApiError('Недостаточно прав', 403, 'forbidden')
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
    const res = errorResponse(error, logger as never)
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Недостаточно прав')
  })
})
