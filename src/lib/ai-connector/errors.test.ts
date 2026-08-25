import { describe, it, expect } from 'vitest'
import { AIProviderError, classifyError, isRetryable } from './errors'
import type { AIErrorCode } from './errors'

describe('AIProviderError', () => {
  it('создаёт ошибку с кодом, статусом и флагом retryable', () => {
    const err = new AIProviderError('Rate limited', 'rate_limit', 429, true)
    expect(err.message).toBe('Rate limited')
    expect(err.code).toBe('rate_limit')
    expect(err.status).toBe(429)
    expect(err.retryable).toBe(true)
    expect(err.name).toBe('AIProviderError')
  })

  it('создаёт ошибку без статуса и retryable', () => {
    const err = new AIProviderError('Unknown fail', 'unknown')
    expect(err.status).toBeUndefined()
    expect(err.retryable).toBeUndefined()
  })

  it('является экземпляром Error', () => {
    const err = new AIProviderError('test', 'timeout')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('classifyError', () => {
  it('возвращает timeout при isAbort=true', () => {
    expect(classifyError(200, true, false)).toBe('timeout')
  })

  it('возвращает network при isNetwork=true', () => {
    expect(classifyError(200, false, true)).toBe('network')
  })

  it('возвращает auth для 401', () => {
    expect(classifyError(401)).toBe('auth')
  })

  it('возвращает auth для 403', () => {
    expect(classifyError(403)).toBe('auth')
  })

  it('возвращает rate_limit для 429', () => {
    expect(classifyError(429)).toBe('rate_limit')
  })

  it('возвращает bad_request для 400-499', () => {
    expect(classifyError(400)).toBe('bad_request')
    expect(classifyError(404)).toBe('bad_request')
    expect(classifyError(422)).toBe('bad_request')
  })

  it('возвращает server_error для 500+', () => {
    expect(classifyError(500)).toBe('server_error')
    expect(classifyError(502)).toBe('server_error')
    expect(classifyError(503)).toBe('server_error')
  })

  it('возвращает unknown без статуса', () => {
    expect(classifyError()).toBe('unknown')
    expect(classifyError(undefined, false, false)).toBe('unknown')
  })

  it('приоритет: abort > network > status', () => {
    expect(classifyError(429, true, true)).toBe('timeout')
    expect(classifyError(429, false, true)).toBe('network')
  })
})

describe('isRetryable', () => {
  const retryableCodes: AIErrorCode[] = ['timeout', 'rate_limit', 'network', 'server_error']
  const nonRetryableCodes: AIErrorCode[] = ['auth', 'bad_request', 'empty_response', 'unknown']

  it.each(retryableCodes)('возвращает true для %s', (code) => {
    expect(isRetryable(code)).toBe(true)
  })

  it.each(nonRetryableCodes)('возвращает false для %s', (code) => {
    expect(isRetryable(code)).toBe(false)
  })
})
