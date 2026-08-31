// Тесты роута смены пароля (Фаза 3, шаг 3.5).
// Проверяем: auth-gate, Zod-валидацию (слабый пароль → 400),
// rate-limit (brute-force → 429).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Мокаем внешние зависимости роута.
const mockRequireAuth = vi.fn()
const mockVerifyPassword = vi.fn()
const mockHashPassword = vi.fn()
const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()

vi.mock('@/lib/auth/session', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))
vi.mock('@/lib/auth/password', () => ({
  verifyPassword: (...args: unknown[]) => mockVerifyPassword(...args),
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}))
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const db = {
        user: {
          findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
          update: (...args: unknown[]) => mockUserUpdate(...args),
        },
      }
      return fn(db)
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))
vi.mock('@/lib/auth/auth-options', () => ({
  invalidateUserStatusCache: vi.fn(),
}))

import { POST } from './route'
import { resetRateLimiter } from '@/lib/rate-limit'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.resetModules()
    resetRateLimiter()
    mockRequireAuth.mockReset()
    mockVerifyPassword.mockReset()
    mockHashPassword.mockReset()
    mockUserFindUnique.mockReset()
    mockUserUpdate.mockReset()
    // По умолчанию — аутентифицированный пользователь.
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockUserFindUnique.mockResolvedValue({ passwordHash: 'scrypt:16384:8:1:ab:cd' })
    mockVerifyPassword.mockResolvedValue(true)
    mockHashPassword.mockResolvedValue('scrypt:16384:8:1:ef:01')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('требует аутентификацию (401 без сессии)', async () => {
    mockRequireAuth.mockResolvedValue(null)
    const res = await POST(makeRequest({ currentPassword: 'Old12345', newPassword: 'New12345' }) as never)
    expect(res.status).toBe(401)
  })

  it('отклоняет слабый пароль (<8 символов) → 400', async () => {
    const res = await POST(makeRequest({ currentPassword: 'Old12345', newPassword: 'Ab1' }) as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('отклоняет пароль без цифры → 400', async () => {
    const res = await POST(makeRequest({ currentPassword: 'Old12345', newPassword: 'OnlyLetters' }) as never)
    expect(res.status).toBe(400)
  })

  it('отклоняет новый пароль, совпадающий с текущим → 400', async () => {
    const res = await POST(makeRequest({ currentPassword: 'Same1234', newPassword: 'Same1234' }) as never)
    expect(res.status).toBe(400)
  })

  it('успешно меняет пароль с валидными данными', async () => {
    const res = await POST(makeRequest({ currentPassword: 'Old12345', newPassword: 'New12345' }) as never)
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('отклоняет при неверном текущем пароле → 400', async () => {
    mockVerifyPassword.mockResolvedValue(false)
    const res = await POST(makeRequest({ currentPassword: 'Wrong1234', newPassword: 'New12345' }) as never)
    expect(res.status).toBe(400)
  })

  it('блокирует brute-force после 5 попыток → 429', async () => {
    mockVerifyPassword.mockResolvedValue(false)
    // Первые 5 запросов — исчерпывают лимит (каждый с неверным паролем → 400).
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({ currentPassword: `Wrong${i}234`, newPassword: 'New12345' }) as never)
      expect(res.status).toBe(400)
    }
    // 6-я попытка — rate-limited.
    const res = await POST(makeRequest({ currentPassword: 'Wrong6234', newPassword: 'New12345' }) as never)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('rate_limited')
  })
})
