// Тесты IDOR-защиты в роуте уведомлений (Фаза 5, шаг 5.2).
// Проверяем: чужое уведомление → 404, своё → успех, markAll → только свои.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetAppSession = vi.fn()
const mockNotificationUpdateMany = vi.fn()

vi.mock('@/lib/auth/session', () => ({
  getAppSession: (...args: unknown[]) => mockGetAppSession(...args),
}))
vi.mock('@/lib/db', () => ({
  db: {
    notification: {
      updateMany: (...args: unknown[]) => mockNotificationUpdateMany(...args),
    },
  },
}))

import { PUT } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/notifications', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const SESSION = {
  user: { id: 'user-a', email: 'a@test.com', role: 'user' },
}

describe('PUT /api/notifications — IDOR-защита', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetAppSession.mockReset()
    mockNotificationUpdateMany.mockReset()
    mockGetAppSession.mockResolvedValue(SESSION)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('обновляет только своё уведомление (filter by userId)', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 })
    const res = await PUT(makeRequest({ id: 'notif-1' }) as never)
    expect(res.status).toBe(200)

    const callArgs = mockNotificationUpdateMany.mock.calls[0][0]
    expect(callArgs.where.id).toBe('notif-1')
    expect(callArgs.where.OR).toEqual([
      { userId: 'user-a' },
      { userId: null },
    ])
  })

  it('возвращает 404 для чужого уведомления (count=0)', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 })
    const res = await PUT(makeRequest({ id: 'foreign-notif' }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/не найдено/)
  })

  it('markAll обновляет только уведомления текущего пользователя', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 })
    const res = await PUT(makeRequest({ markAll: true }) as never)
    expect(res.status).toBe(200)

    const callArgs = mockNotificationUpdateMany.mock.calls[0][0]
    expect(callArgs.where.OR).toEqual([
      { userId: 'user-a' },
      { userId: null },
    ])
  })

  it('требует аутентификации (401 без сессии)', async () => {
    mockGetAppSession.mockResolvedValue(null)
    const res = await PUT(makeRequest({ id: 'notif-1' }) as never)
    expect(res.status).toBe(401)
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled()
  })
})
