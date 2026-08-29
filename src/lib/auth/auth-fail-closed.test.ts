// Тесты fail-closed логики аутентификации и авторизации (Фаза 1, шаг 1.2).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('hasAccessSafe (fail-closed)', () => {
  let hasAccessSafe: typeof import('@/lib/auth/permissions').hasAccessSafe

  beforeEach(async () => {
    const mod = await import('@/lib/auth/permissions')
    hasAccessSafe = mod.hasAccessSafe
  })

  it('разрешает полный доступ для admin без матрицы прав', () => {
    expect(hasAccessSafe(null, 'ai-providers', 'write', 'admin', false)).toBe(true)
    expect(hasAccessSafe(undefined, 'users', 'read', 'admin', false)).toBe(true)
  })

  it('разрешает доступ при отключённой аутентификации (dev)', () => {
    expect(hasAccessSafe(null, 'ai-providers', 'write', undefined, true)).toBe(true)
    expect(hasAccessSafe(undefined, 'generation', 'read', undefined, true)).toBe(true)
  })

  it('fail-closed: deny когда auth включена, но permissions отсутствуют и это не admin', () => {
    expect(hasAccessSafe(null, 'ai-providers', 'read', 'user', false)).toBe(false)
    expect(hasAccessSafe(null, 'generation', 'read', 'kdp', false)).toBe(false)
    expect(hasAccessSafe(undefined, 'tracking', 'write', undefined, false)).toBe(false)
  })

  it('уважает матрицу прав при наличии permissions', async () => {
    const { KDP_PRESET, USER_PRESET } = await import('@/lib/auth/permissions')
    // KDP: generation — write
    expect(hasAccessSafe(KDP_PRESET, 'generation', 'write', 'kdp', false)).toBe(true)
    // KDP: ai-providers — read only
    expect(hasAccessSafe(KDP_PRESET, 'ai-providers', 'write', 'kdp', false)).toBe(false)
    expect(hasAccessSafe(KDP_PRESET, 'ai-providers', 'read', 'kdp', false)).toBe(true)
    // USER: master-prompts — none
    expect(hasAccessSafe(USER_PRESET, 'master-prompts', 'read', 'user', false)).toBe(false)
    expect(hasAccessSafe(USER_PRESET, 'master-prompts', 'none', 'user', false)).toBe(false)
  })

  it('deny при tab === "none" в матрице', async () => {
    const { USER_PRESET } = await import('@/lib/auth/permissions')
    expect(hasAccessSafe(USER_PRESET, 'dictionaries', 'read', 'user', false)).toBe(false)
  })
})

describe('assertAuthConfigured (fail-closed в production)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('бросает ошибку в production без AUTH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    // Пустая строка = секрета нет (falsy). vi.stubEnv надёжно переопределяет
    // даже загруженный из .env и откатывает в afterEach.
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    await expect(import('@/lib/auth/auth-options')).rejects.toThrow(/AUTH_SECRET/)
  })

  it('не бросает в production с AUTH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'test-secret-1234567890abcdef1234567890')
    await expect(import('@/lib/auth/auth-options')).resolves.toBeDefined()
  })

  it('в dev без AUTH_SECRET модуль грузится, auth отключен (открытый режим)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    // В dev без секрета модуль загружается без ошибки (fail-open для dev).
    // isAuthEnabled() = false → requireAuth() возвращает null (открытый доступ).
    const mod = await import('@/lib/auth/auth-options')
    expect(mod.isAuthEnabled()).toBe(false)
  })
})
