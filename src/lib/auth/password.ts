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
// Минимально допустимое N в хранимом хеше. Меньшие значения уязвимы к
// брутфорсу — хеш с N < MIN_N считается невалидным (защита от подмены параметров).
const MIN_N = 1 << 14 // 16384

// Фиктивные значения для выравнивания тайминга при невалидном формате хеша:
// выполняем «настоящую» работу scrypt, чтобы время ответа было близко к
// валидному хешу с неверным паролем (защита от time-based атак).
const DUMMY_SALT = Buffer.alloc(16, 0)
const DUMMY_EXPECTED = Buffer.alloc(KEYLEN, 0)

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
 *
 * Защита (Фаза 3):
 *   - Параметры N/r/p фиксируются в коде (DEFAULT_*), а не берутся из строки
 *     хеша — атакующий с доступом к хранилищу не может подсунуть слабые параметры.
 *   - N из хеша валидируется на >= MIN_N; меньшие значения → хеш невалиден.
 *   - При невалидном формате/параметрах выполняется dummy-scrypt, чтобы
 *     выровнять тайминг с валидным хешем + неверным паролем.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const passwordBuf = Buffer.from(password)

  // Разбор хеша и валидация параметров.
  const parts = stored.split(':')
  const parsedOk =
    parts.length === 6 &&
    parts[0] === 'scrypt' &&
    Number.isFinite(Number(parts[1])) &&
    Number.isFinite(Number(parts[2])) &&
    Number.isFinite(Number(parts[3]))

  if (!parsedOk) {
    // Невалидный формат: выравниваем тайминг dummy-операцией scrypt.
    const derived = await scrypt(passwordBuf, DUMMY_SALT, KEYLEN, {
      N: DEFAULT_N,
      r: DEFAULT_R,
      p: DEFAULT_P,
    })
    return timingSafeEqual(derived, DUMMY_EXPECTED) // всегда false
  }

  const storedN = Number(parts[1])
  const salt = Buffer.from(parts[4], 'hex')
  const expected = Buffer.from(parts[5], 'hex')

  // Параметры фиксируем в коде: игнорируем r/p из строки, N валидируем.
  // Слишком короткий salt/expected или слабый N → невалидный хеш.
  const paramsValid = storedN >= MIN_N && salt.length > 0 && expected.length > 0

  if (!paramsValid) {
    // Выравниваем тайминг dummy-операцией.
    const derived = await scrypt(passwordBuf, DUMMY_SALT, KEYLEN, {
      N: DEFAULT_N,
      r: DEFAULT_R,
      p: DEFAULT_P,
    })
    return timingSafeEqual(derived, DUMMY_EXPECTED) // всегда false
  }

  try {
    // Используем фиксированные параметры из кода, не из строки хеша.
    // keylen = expected.length для совместимости с существующими хешами.
    const derived = await scrypt(passwordBuf, salt, expected.length, {
      N: DEFAULT_N,
      r: DEFAULT_R,
      p: DEFAULT_P,
    })
    // timingSafeEqual требует равной длины буферов.
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
