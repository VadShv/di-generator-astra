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

  it('fail-closed: бросает в staging без AUTH_SECRET и без ALLOW_OPEN_ACCESS', async () => {
    vi.stubEnv('NODE_ENV', 'staging')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ALLOW_OPEN_ACCESS', '')
    await expect(import('@/lib/auth/auth-options')).rejects.toThrow(/AUTH_SECRET/)
  })

  it('fail-closed: бросает при пустом NODE_ENV без AUTH_SECRET', async () => {
    vi.stubEnv('NODE_ENV', '')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ALLOW_OPEN_ACCESS', '')
    await expect(import('@/lib/auth/auth-options')).rejects.toThrow(/AUTH_SECRET/)
  })

  it('ALLOW_OPEN_ACCESS=true разрешает запуск без AUTH_SECRET вне production', async () => {
    vi.stubEnv('NODE_ENV', 'staging')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ALLOW_OPEN_ACCESS', 'true')
    const mod = await import('@/lib/auth/auth-options')
    expect(mod.isAuthEnabled()).toBe(false)
  })

  it('fail-closed: ALLOW_OPEN_ACCESS не спасает в production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('ALLOW_OPEN_ACCESS', 'true')
    await expect(import('@/lib/auth/auth-options')).rejects.toThrow(/AUTH_SECRET/)
  })
})

describe('Cookie security flags (Фаза 3, шаг 3.2)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('в production: secure=true, httpOnly=true, sameSite=lax для sessionToken', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'test-secret-1234567890abcdef1234567890')
    const mod = await import('@/lib/auth/auth-options')
    const opts = mod.authOptions
    expect(opts.useSecureCookies).toBe(true)
    const sessionToken = opts.cookies!.sessionToken!
    expect(sessionToken.options.httpOnly).toBe(true)
    expect(sessionToken.options.secure).toBe(true)
    expect(sessionToken.options.sameSite).toBe('lax')
  })

  it('в dev: secure=false (нет TLS), httpOnly и sameSite сохраняются', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('AUTH_SECRET', 'dev-secret-1234567890abcdef1234567890')
    const mod = await import('@/lib/auth/auth-options')
    const opts = mod.authOptions
    expect(opts.useSecureCookies).toBe(false)
    const sessionToken = opts.cookies!.sessionToken!
    // httpOnly и sameSite обязательны всегда; secure только в prod.
    expect(sessionToken.options.httpOnly).toBe(true)
    expect(sessionToken.options.secure).toBe(false)
    expect(sessionToken.options.sameSite).toBe('lax')
  })

  it('все cookie-типы имеют защищённые флаги в production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('AUTH_SECRET', 'test-secret-1234567890abcdef1234567890')
    const mod = await import('@/lib/auth/auth-options')
    const cookies = mod.authOptions.cookies!
    for (const key of ['sessionToken', 'csrfToken', 'callbackUrl', 'pkceCodeVerifier']) {
      const c = cookies[key as keyof typeof cookies]!
      expect(c.options.httpOnly, `${key} httpOnly`).toBe(true)
      expect(c.options.secure, `${key} secure`).toBe(true)
      expect(c.options.sameSite, `${key} sameSite`).toBe('lax')
    }
  })
})
