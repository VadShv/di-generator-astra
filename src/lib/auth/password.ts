// Хеширование паролей на основе Node crypto.scrypt (Фаза 5).
// Не требует внешних зависимостей (bcrypt/bcryptjs).
// Формат хранения: "scrypt:N:r:p: saltHex:hashHex"
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCb) as (
  password: Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>

// Параметры scrypt. N=2^14 (16384) — баланс безопасности/скорости, совместимый с Bun.
const DEFAULT_N = 1 << 14
const DEFAULT_R = 8
const DEFAULT_P = 1
const KEYLEN = 64

/**
 * Зашифровать пароль в строку "scrypt:N:r:p:saltHex:hashHex".
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(Buffer.from(password), salt, KEYLEN, {
    N: DEFAULT_N,
    r: DEFAULT_R,
    p: DEFAULT_P,
  })
  return `scrypt:${DEFAULT_N}:${DEFAULT_R}:${DEFAULT_P}:${salt.toString('hex')}:${derived.toString('hex')}`
}

/**
 * Проверить пароль против сохранённого хеша.
 * Использует timingSafeEqual для защиты от time-based атак.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'hex')
  const expected = Buffer.from(parts[5], 'hex')
  if (!Number.isFinite(N) || salt.length === 0 || expected.length === 0) return false
  try {
    const derived = await scrypt(Buffer.from(password), salt, expected.length, { N, r, p })
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
