// Шифрование API-ключей ИИ-провайдеров (Фаза 2)
// Использует AES-256-GCM из node:crypto. Ключ берётся из AI_PROVIDER_ENCRYPTION_KEY.
// Формат зашифрованного значения: "v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>".

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 бит — рекомендация для GCM

/**
 * Получить 32-байтовый ключ из AI_PROVIDER_ENCRYPTION_KEY.
 * Ключ нормализуется через SHA-256, чтобы принимать строки любой длины.
 * В проде ключ должен задаваться через секреты окружения (не в коде).
 */
function getKey(): Buffer {
  const raw = process.env.AI_PROVIDER_ENCRYPTION_KEY
  if (!raw || raw.length === 0) {
    // В dev-окружении fallback на стандартный ключ (с предупреждением).
    // Это позволяет работать без .env, но НЕ безопасно для прода.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AI_PROVIDER_ENCRYPTION_KEY не задан. Установите переменную окружения для production.'
      )
    }
    console.warn(
      '[ai-connector] AI_PROVIDER_ENCRYPTION_KEY не задан — используется небезопасный dev-ключ. Не используйте в production!'
    )
    return createHash('sha256').update('di-generator-dev-encryption-key-change-me').digest()
  }
  return createHash('sha256').update(raw).digest()
}

/** Зашифровать API-ключ. Возвращает строку формата v1:iv:authTag:ciphertext (hex). */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

/** Расшифровать API-ключ. Принимает формат v1:iv:authTag:ciphertext. */
export function decryptApiKey(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  // Обратная совместимость: если ключ хранится в открытом виде (без префикса v1:),
  // возвращаем как есть. Это позволяет мигрировать старые данные.
  if (!encrypted.startsWith('v1:')) {
    return encrypted
  }
  const parts = encrypted.split(':')
  if (parts.length !== 4) {
    throw new Error('Некорректный формат зашифрованного ключа')
  }
  const [, ivHex, authTagHex, ciphertextHex] = parts
  const key = getKey()
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}

/** Маска API-ключа для отображения в UI (скрывает середину). */
export function maskApiKey(key: string | null): string {
  if (!key) return '—'
  if (key.length <= 8) return '•'.repeat(key.length)
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
}
