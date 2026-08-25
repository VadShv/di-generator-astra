import { describe, it, expect, vi } from 'vitest'
import { withRetry, isRetryableError } from './retry'
import { AIProviderError } from './errors'

describe('withRetry', () => {
  it('возвращает результат при успехе с первой попытки', async () => {
    const result = await withRetry(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('ретраит ретряемую ошибку и возвращает результат', async () => {
    let attempts = 0
    const fn = async () => {
      attempts++
      if (attempts < 3) throw new AIProviderError('fail', 'network', undefined, true)
      return 'success'
    }
    const result = await withRetry(fn, { maxRetries: 3, initialBackoffMs: 10 })
    expect(result).toBe('success')
    expect(attempts).toBe(3)
  })

  it('пробрасывает неретряемую AIProviderError сразу', async () => {
    const fn = async () => {
      throw new AIProviderError('auth fail', 'auth', 401, false)
    }
    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('auth fail')
  })

  it('оборачивает обычную Error в AIProviderError после исчерпания попыток', async () => {
    const fn = async () => {
      throw new Error('plain error')
    }
    await expect(
      withRetry(fn, { maxRetries: 2, initialBackoffMs: 5 })
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof AIProviderError && err.code === 'unknown' && err.retryable === false
    })
  })

  it('ретраит TypeError как network', async () => {
    let attempts = 0
    const fn = async () => {
      attempts++
      if (attempts < 2) throw new TypeError('fetch failed')
      return 'ok'
    }
    const result = await withRetry(fn, { maxRetries: 2, initialBackoffMs: 5 })
    expect(result).toBe('ok')
  })

  it('ретраит AbortError как timeout', async () => {
    let attempts = 0
    const fn = async () => {
      attempts++
      if (attempts < 2) {
        const err = new Error('aborted')
        err.name = 'AbortError'
        throw err
      }
      return 'ok'
    }
    const result = await withRetry(fn, { maxRetries: 2, initialBackoffMs: 5 })
    expect(result).toBe('ok')
  })

  it('не ретраит после исчерпания maxRetries', async () => {
    let attempts = 0
    const fn = async () => {
      attempts++
      throw new AIProviderError('server down', 'server_error', 503, true)
    }
    await expect(
      withRetry(fn, { maxRetries: 2, initialBackoffMs: 5 })
    ).rejects.toThrow('server down')
    expect(attempts).toBe(3) // initial + 2 retries
  })

  it('использует экспоненциальный backoff', async () => {
    const sleeps: number[] = []
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler, ms?: number) => {
      if (typeof cb === 'function') {
        sleeps.push(ms ?? 0)
        cb()
      }
      return 0 as unknown as ReturnType<typeof setTimeout>
    })

    let attempts = 0
    const fn = async () => {
      attempts++
      if (attempts < 3) throw new AIProviderError('retry', 'rate_limit', 429, true)
      return 'ok'
    }

    await withRetry(fn, { maxRetries: 3, initialBackoffMs: 100, backoffMultiplier: 2, backoffMaxMs: 1000 })
    expect(sleeps).toEqual([100, 200])
    vi.restoreAllMocks()
  })
})

describe('isRetryableError', () => {
  it('возвращает true для retryable AIProviderError', () => {
    expect(isRetryableError(new AIProviderError('x', 'network', undefined, true))).toBe(true)
  })

  it('возвращает false для неретряемой AIProviderError', () => {
    expect(isRetryableError(new AIProviderError('x', 'auth', 401, false))).toBe(false)
  })

  it('возвращает false для обычной Error', () => {
    expect(isRetryableError(new Error('plain'))).toBe(false)
  })

  it('возвращает false для null', () => {
    expect(isRetryableError(null)).toBe(false)
  })
})
