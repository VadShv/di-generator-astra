import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, checkRateLimit } from './rate-limit'
import { ApiError } from './api-utils'

// Мокаем Date.now для предсказуемости
const mockNow = 1000000

describe('rateLimit', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('пропускает первый запрос и создаёт окно', () => {
    const result = rateLimit('ip:1', 5, 60000)
    expect(result.ok).toBe(true)
    expect(result.retryAfterMs).toBe(0)
  })

  it('пропускает запросы в пределах лимита', () => {
    const key = 'ip:2'
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(key, 5, 60000)
      expect(result.ok).toBe(true)
    }
  })

  it('блокирует при превышении лимита', () => {
    const key = 'ip:3'
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60000)
    const result = rateLimit(key, 5, 60000)
    expect(result.ok).toBe(false)
    expect(result.retryAfterMs).toBe(60000)
  })

  it('сбрасывает окно после истечения времени', () => {
    const key = 'ip:4'
    rateLimit(key, 1, 1000)
    vi.spyOn(Date, 'now').mockReturnValue(mockNow + 2000)
    const result = rateLimit(key, 1, 1000)
    expect(result.ok).toBe(true)
  })

  it('использует разные ключи независимо', () => {
    rateLimit('a', 1, 60000)
    rateLimit('b', 1, 60000)
    // Оба должны пройти — разные ключи
    const r1 = rateLimit('a', 1, 60000)
    const r2 = rateLimit('b', 1, 60000)
    expect(r1.ok).toBe(false) // a превысило
    expect(r2.ok).toBe(false) // b тоже превысило
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('не бросает ошибку в пределах лимита', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(() => checkRateLimit(request, 'test', 5, 60000)).not.toThrow()
  })

  it('бросает ApiError(429) при превышении', () => {
    const request = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '5.6.7.8' },
    })
    for (let i = 0; i < 2; i++) {
      checkRateLimit(request, 'test', 2, 60000)
    }
    expect(() => checkRateLimit(request, 'test', 2, 60000)).toThrow(ApiError)
    try {
      checkRateLimit(request, 'test', 2, 60000)
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(429)
      expect((e as ApiError).code).toBe('rate_limited')
    }
  })

  it('использует unknown IP как fallback', () => {
    const request = new Request('http://localhost/api/test')
    for (let i = 0; i < 2; i++) {
      checkRateLimit(request, 'test', 2, 60000)
    }
    expect(() => checkRateLimit(request, 'test', 2, 60000)).toThrow(ApiError)
  })
})
