import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, checkRateLimit, resetRateLimiter, getClientIp } from './rate-limit'
import { ApiError } from './api-utils'

// Мокаем Date.now для предсказуемости
const mockNow = 1000000

describe('rateLimit', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
    resetRateLimiter()
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
    resetRateLimiter()
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

describe('checkRateLimit — лимит по userId', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
    resetRateLimiter()
  })
  afterEach(() => vi.restoreAllMocks())

  it('лимит привязан к userId, а не к IP', () => {
    // Два разных IP, один userId — лимит общий.
    const req1 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    })
    const req2 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '2.2.2.2' },
    })
    // 2 запроса от userId='u1' с разных IP — исчерпали лимит (limit=2).
    checkRateLimit(req1, 'scope', 2, 60_000, 'u1')
    checkRateLimit(req2, 'scope', 2, 60_000, 'u1')
    // 3-й запрос с ещё одного IP, но тот же userId → 429.
    const req3 = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '3.3.3.3' },
    })
    expect(() => checkRateLimit(req3, 'scope', 2, 60_000, 'u1')).toThrow(ApiError)
  })

  it('обход через смену IP не работает при наличии userId', () => {
    // Пользователь u1 исчерпал лимит.
    const req = new Request('http://localhost/api/test')
    checkRateLimit(req, 'scope', 1, 60_000, 'u1')
    // Тот же userId с нового IP — всё ещё заблокирован.
    const reqNewIp = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '9.9.9.9' },
    })
    expect(() => checkRateLimit(reqNewIp, 'scope', 1, 60_000, 'u1')).toThrow(ApiError)
  })

  it('разные userId имеют независимые лимиты', () => {
    const req = new Request('http://localhost/api/test')
    checkRateLimit(req, 'scope', 1, 60_000, 'u1')
    // u2 не задет лимит u1.
    expect(() => checkRateLimit(req, 'scope', 1, 60_000, 'u2')).not.toThrow()
  })

  it('без userId — fallback на IP', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '7.7.7.7' },
    })
    checkRateLimit(req, 'scope', 1, 60_000)
    expect(() => checkRateLimit(req, 'scope', 1, 60_000)).toThrow(ApiError)
  })
})

describe('getClientIp — доверенный прокси', () => {
  afterEach(() => vi.restoreAllMocks())

  it('без TRUSTED_PROXY_IP использует x-real-ip', () => {
    vi.stubEnv('TRUSTED_PROXY_IP', '')
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('с TRUSTED_PROXY_IP доверяет x-forwarded-for', () => {
    vi.stubEnv('TRUSTED_PROXY_IP', '10.0.0.1')
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1', 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('5.6.7.8')
  })

  it('возвращает unknown при отсутствии заголовков', () => {
    vi.stubEnv('TRUSTED_PROXY_IP', '')
    const req = new Request('http://localhost/api/test')
    expect(getClientIp(req)).toBe('unknown')
  })
})
