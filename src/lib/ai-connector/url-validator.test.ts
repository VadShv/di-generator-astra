// Тесты валидации URL провайдеров (SSRF-защита, Фаза 1, шаг 1.1).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Мокаем dns-резолв, чтобы тесты были детерминированными (без сетевых запросов).
const lookupMock = vi.fn()
vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}))

describe('validateProviderUrlSync', () => {
  let validateProviderUrlSync: typeof import('./url-validator').validateProviderUrlSync

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('./url-validator')
    validateProviderUrlSync = mod.validateProviderUrlSync
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('валидные URL', () => {
    it('принимает https URL в production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(() => validateProviderUrlSync('https://api.openai.com')).not.toThrow()
      expect(() => validateProviderUrlSync('https://api.cloud.ru/v1')).not.toThrow()
    })

    it('принимает http и https в dev', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(() => validateProviderUrlSync('https://api.openai.com')).not.toThrow()
      expect(() => validateProviderUrlSync('http://example.com')).not.toThrow()
    })

    it('разрешает localhost в dev', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(() => validateProviderUrlSync('http://localhost:11434')).not.toThrow()
      expect(() => validateProviderUrlSync('http://127.0.0.1:8080')).not.toThrow()
      expect(() => validateProviderUrlSync('http://[::1]:8080')).not.toThrow()
    })

    it('разрешает публичные IP', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(() => validateProviderUrlSync('https://8.8.8.8')).not.toThrow()
      expect(() => validateProviderUrlSync('https://1.1.1.1/v1')).not.toThrow()
    })
  })

  describe('невалидные URL', () => {
    it('бросает при отсутствии URL', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(() => validateProviderUrlSync('')).toThrow()
      expect(() => validateProviderUrlSync('   ')).toThrow()
    })

    it('бросает при некорректном URL', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(() => validateProviderUrlSync('not-a-url')).toThrow()
      expect(() => validateProviderUrlSync('://no-scheme')).toThrow()
    })

    it('бросает при недопустимой схеме', () => {
      vi.stubEnv('NODE_ENV', 'development')
      expect(() => validateProviderUrlSync('ftp://example.com')).toThrow(/Недопустимая схема/)
      expect(() => validateProviderUrlSync('file:///etc/passwd')).toThrow(/Недопустимая схема/)
    })

    it('блокирует http в production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(() => validateProviderUrlSync('http://api.openai.com')).toThrow(/только https/)
    })

    it('разрешает http в production при allowInsecureHttp', () => {
      vi.stubEnv('NODE_ENV', 'production')
      expect(() =>
        validateProviderUrlSync('http://api.openai.com', { allowInsecureHttp: true })
      ).not.toThrow()
    })
  })

  describe('приватные/служебные IP', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('блокирует cloud metadata endpoint', () => {
      expect(() => validateProviderUrlSync('https://169.254.169.254')).toThrow(
        /приватном\/служебном диапазоне/
      )
    })

    it('блокирует localhost в production', () => {
      expect(() => validateProviderUrlSync('https://localhost')).toThrow(/loopback/)
      expect(() => validateProviderUrlSync('https://127.0.0.1')).toThrow(
        /приватном\/служебном диапазоне/
      )
    })

    it('блокирует приватные IPv4 диапазоны', () => {
      expect(() => validateProviderUrlSync('https://10.0.0.1')).toThrow()
      expect(() => validateProviderUrlSync('https://172.16.0.1')).toThrow()
      expect(() => validateProviderUrlSync('https://192.168.1.1')).toThrow()
      expect(() => validateProviderUrlSync('https://10.255.255.255')).toThrow()
    })

    it('блокирует IPv6 loopback и ULA', () => {
      expect(() => validateProviderUrlSync('https://[::1]')).toThrow()
      expect(() => validateProviderUrlSync('https://[fc00::1]')).toThrow()
      expect(() => validateProviderUrlSync('https://[fe80::1]')).toThrow()
    })

    it('блокирует metadata.google.internal', () => {
      expect(() => validateProviderUrlSync('https://metadata.google.internal')).toThrow(
        /заблокирован/
      )
    })
  })
})

describe('validateProviderUrl (async с DNS)', () => {
  let validateProviderUrl: typeof import('./url-validator').validateProviderUrl
  let UrlValidationError: typeof import('./url-validator').UrlValidationError

  beforeEach(async () => {
    vi.resetModules()
    lookupMock.mockReset()
    const mod = await import('./url-validator')
    validateProviderUrl = mod.validateProviderUrl
    UrlValidationError = mod.UrlValidationError
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('принимает публичный домен с резолвом в публичный IP', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    lookupMock.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])
    await expect(validateProviderUrl('https://api.example.com')).resolves.toBeUndefined()
  })

  it('блокирует домен, резолвящийся в приватный IP (DNS rebinding)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    lookupMock.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.5', family: 4 }, // приватный
    ])
    await expect(validateProviderUrl('https://evil.example.com')).rejects.toThrow(
      /приватный адрес/
    )
  })

  it('разрешает localhost в dev без резолва', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await expect(validateProviderUrl('http://localhost:11434')).resolves.toBeUndefined()
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('бросает для IP-адреса, проверяемого синхронно', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(validateProviderUrl('https://169.254.169.254')).rejects.toThrow(
      UrlValidationError
    )
  })

  it('бросает при невозможности резолва', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(
      validateProviderUrl('https://nonexistent.example.com')
    ).rejects.toThrow(UrlValidationError)
  })
})
