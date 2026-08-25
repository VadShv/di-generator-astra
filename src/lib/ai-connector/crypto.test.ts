import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { encryptApiKey, decryptApiKey, maskApiKey } from './crypto'

let originalAllowDevKey: string | undefined

beforeAll(() => {
  originalAllowDevKey = process.env.AI_PROVIDER_ALLOW_DEV_KEY
  process.env.AI_PROVIDER_ALLOW_DEV_KEY = 'true'
})

afterAll(() => {
  if (originalAllowDevKey !== undefined) {
    process.env.AI_PROVIDER_ALLOW_DEV_KEY = originalAllowDevKey
  } else {
    delete process.env.AI_PROVIDER_ALLOW_DEV_KEY
  }
})

describe('encryptApiKey / decryptApiKey', () => {
  it('шифрует и расшифровывает ключ корректно', () => {
    const original = 'sk-test-12345-abcdef'
    const encrypted = encryptApiKey(original)
    expect(encrypted).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
    const decrypted = decryptApiKey(encrypted)
    expect(decrypted).toBe(original)
  })

  it('возвращает пустую строку при шифровании пустого', () => {
    expect(encryptApiKey('')).toBe('')
  })

  it('возвращает null при расшифровке null/undefined/пустой', () => {
    expect(decryptApiKey(null)).toBeNull()
    expect(decryptApiKey(undefined)).toBeNull()
    expect(decryptApiKey('')).toBeNull()
  })

  it('расшифровывает legacy-ключ без v1:', () => {
    const legacy = 'plain-api-key'
    const decrypted = decryptApiKey(legacy)
    expect(decrypted).toBe(legacy)
  })

  it('бросает ошибку при некорректном формате зашифрованного', () => {
    expect(() => decryptApiKey('v1:invalid')).toThrow('Некорректный формат')
    expect(() => decryptApiKey('v1:a:b')).toThrow('Некорректный формат')
  })

  it('даёт разный ciphertext при каждом шифровании (IV случайный)', () => {
    const key = 'same-key'
    const e1 = encryptApiKey(key)
    const e2 = encryptApiKey(key)
    expect(e1).not.toBe(e2)
    expect(decryptApiKey(e1)).toBe(key)
    expect(decryptApiKey(e2)).toBe(key)
  })
})

describe('maskApiKey', () => {
  it('маскирует длинный ключ', () => {
    const key = 'sk-abcdefghijklmnopqrstuvwxyz'
    const masked = maskApiKey(key)
    expect(masked.startsWith('sk-a')).toBe(true)
    expect(masked.endsWith('wxyz')).toBe(true)
    expect(masked).toContain('•')
  })

  it('маскирует короткий ключ полностью', () => {
    expect(maskApiKey('short')).toBe('•'.repeat(5))
  })

  it('возвращает — для null', () => {
    expect(maskApiKey(null)).toBe('—')
  })

  it('возвращает — для пустой строки', () => {
    expect(maskApiKey('')).toBe('—')
  })

  it('оставляет ровно 4 символа по краям', () => {
    const key = '1234567890123456'
    const masked = maskApiKey(key)
    expect(masked.slice(0, 4)).toBe('1234')
    expect(masked.slice(-4)).toBe('3456')
    expect(masked.length).toBe(key.length)
  })
})
