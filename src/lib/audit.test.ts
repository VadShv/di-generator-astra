// Тесты аудита: устойчивость + доверенный IP (Фаза 4, шаг 4.2).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetAppSession = vi.fn()
const mockGetClientIp = vi.fn()
const mockAuditCreate = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerInfo = vi.fn()

vi.mock('@/lib/auth/session', () => ({
  getAppSession: (...args: unknown[]) => mockGetAppSession(...args),
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))
vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}))
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { logAudit } from './audit'

// Дождаться выполнения fire-and-forget промисов (микротаски + таймеры).
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function makeRequest(ipHeader?: Record<string, string>): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: ipHeader,
  })
}

describe('logAudit — IP и устойчивость', () => {
  beforeEach(() => {
    mockGetAppSession.mockReset()
    mockGetClientIp.mockReset()
    mockAuditCreate.mockReset()
    mockLoggerWarn.mockReset()
    mockLoggerInfo.mockReset()
    mockGetAppSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.c' } })
    mockGetClientIp.mockReturnValue('1.2.3.4')
    mockAuditCreate.mockResolvedValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('записывает действие с IP из getClientIp', async () => {
    const req = makeRequest({ 'x-real-ip': '1.2.3.4' })
    logAudit('create', req, 'company', 'c1')
    await flush()

    expect(mockGetClientIp).toHaveBeenCalledWith(req)
    expect(mockAuditCreate).toHaveBeenCalledOnce()
    const data = mockAuditCreate.mock.calls[0][0].data
    expect(data.ip).toBe('1.2.3.4')
    expect(data.action).toBe('create')
    expect(data.method).toBe('POST')
    expect(data.userId).toBe('u1')
  })

  it('сохраняет null IP при unknown (нет заголовков)', async () => {
    mockGetClientIp.mockReturnValue('unknown')
    const req = makeRequest()
    logAudit('read', req)
    await flush()

    const data = mockAuditCreate.mock.calls[0][0].data
    expect(data.ip).toBeNull()
  })

  it('логирует warn при ошибке записи в БД (не глотает silently)', async () => {
    mockAuditCreate.mockRejectedValue(new Error('DB down'))
    const req = makeRequest()
    logAudit('delete', req, 'company', 'c1')
    await flush()

    expect(mockAuditCreate).toHaveBeenCalledOnce()
    expect(mockLoggerWarn).toHaveBeenCalledOnce()
    const [message, meta] = mockLoggerWarn.mock.calls[0]
    expect(message).toMatch(/аудит/i)
    expect(meta).toMatchObject({
      action: 'delete',
      path: '/api/test',
      error: 'DB down',
    })
  })

  it('не пробрасывает ошибку БД наружу (fire-and-forget)', async () => {
    mockAuditCreate.mockRejectedValue(new Error('DB down'))
    const req = makeRequest()
    // Не должно бросить синхронно.
    expect(() => logAudit('update', req)).not.toThrow()
    await flush()
  })

  it('передаёт metadata как JSON-строку', async () => {
    const req = makeRequest()
    logAudit('create', req, 'company', 'c1', { count: 5, label: 'тест' })
    await flush()

    const data = mockAuditCreate.mock.calls[0][0].data
    expect(data.metadata).toBe(JSON.stringify({ count: 5, label: 'тест' }))
  })

  it('работает без сессии (userId/email null)', async () => {
    mockGetAppSession.mockResolvedValue(null)
    const req = makeRequest()
    logAudit('read', req)
    await flush()

    const data = mockAuditCreate.mock.calls[0][0].data
    expect(data.userId).toBeNull()
    expect(data.userEmail).toBeNull()
  })
})
