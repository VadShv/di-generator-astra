// Тесты хеширования/проверки паролей scrypt (Фаза 3, шаг 3.1).
import { describe, it, expect } from 'vitest'

import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('hashPassword', () => {
  it('возвращает строку формата scrypt:N:r:p:saltHex:hashHex', async () => {
    const hash = await hashPassword('Secret123!')
    const parts = hash.split(':')
    expect(parts).toHaveLength(6)
    expect(parts[0]).toBe('scrypt')
    // Параметры фиксируются в коде: N=16384, r=8, p=1.
    expect(parts[1]).toBe('16384')
    expect(parts[2]).toBe('8')
    expect(parts[3]).toBe('1')
    // salt и hash — hex-строки ненулевой длины.
    expect(parts[4].length).toBeGreaterThan(0)
    expect(parts[5].length).toBeGreaterThan(0)
  })

  it('генерирует разные salt для одинаковых паролей', async () => {
    const a = await hashPassword('SamePassword1')
    const b = await hashPassword('SamePassword1')
    expect(a).not.toBe(b)
    expect(a.split(':')[4]).not.toBe(b.split(':')[4])
  })
})

describe('verifyPassword', () => {
  it('подтверждает корректный пароль', async () => {
    const hash = await hashPassword('CorrectPass1')
    await expect(verifyPassword('CorrectPass1', hash)).resolves.toBe(true)
  })

  it('отклоняет неверный пароль', async () => {
    const hash = await hashPassword('CorrectPass1')
    await expect(verifyPassword('WrongPass1', hash)).resolves.toBe(false)
  })

  it('отклоняет пустой пароль против непустого хеша', async () => {
    const hash = await hashPassword('RealPassword1')
    await expect(verifyPassword('', hash)).resolves.toBe(false)
  })

  it('отклоняет хеш с N < MIN_N (16384)', async () => {
    // Хеш с заведомо слабым N=1024 — должен быть признан невалидным.
    const weakHash = 'scrypt:1024:8:1:' + 'ab'.repeat(16) + ':' + 'cd'.repeat(64)
    await expect(verifyPassword('anypassword', weakHash)).resolves.toBe(false)
  })

  it('отклоняет невалидный формат: не 6 частей', async () => {
    await expect(verifyPassword('x', 'scrypt:16384:8:1:salt')).resolves.toBe(false)
  })

  it('отклоняет невалидный формат: неверный префикс', async () => {
    await expect(
      verifyPassword('x', 'bcrypt:16384:8:1:' + 'ab'.repeat(16) + ':' + 'cd'.repeat(64)),
    ).resolves.toBe(false)
  })

  it('отклоняет невалидный формат: нечисловые параметры', async () => {
    await expect(
      verifyPassword('x', 'scrypt:abc:def:1:' + 'ab'.repeat(16) + ':' + 'cd'.repeat(64)),
    ).resolves.toBe(false)
  })

  it('отклоняет пустую строку как хеш', async () => {
    await expect(verifyPassword('x', '')).resolves.toBe(false)
  })

  it('игнорирует параметры r/p из строки хеша (фиксация в коде)', async () => {
    // Параметры r/p фиксируются в коде и НЕ читаются из строки хеша при
    // вычислении. Поэтому подмена r/p в строке не влияет на результат:
    // верный пароль подтверждается, т.к. и хеширование, и проверка
    // используют одни и те же кодовые DEFAULT_R/DEFAULT_P. Атакующий с
    // доступом к хранилищу не может изменить параметры вычисления.
    const hash = await hashPassword('FixedParams1')
    const parts = hash.split(':')
    const tampered = `scrypt:${parts[1]}:4:2:${parts[4]}:${parts[5]}`
    await expect(verifyPassword('FixedParams1', tampered)).resolves.toBe(true)
    // Неверный пароль всё равно отклоняется при подменённых r/p.
    await expect(verifyPassword('WrongPass1', tampered)).resolves.toBe(false)
  })

  it('выравнивает тайминг: невалидный формат ≈ валидный + неверный пароль', async () => {
    const validHash = await hashPassword('TimingTest1')

    // Замер: валидный хеш + неверный пароль (выполняет полный scrypt).
    const t1Start = performance.now()
    await verifyPassword('WrongPassword1', validHash)
    const t1 = performance.now() - t1Start

    // Замер: невалидный формат хеша (dummy scrypt).
    const t2Start = performance.now()
    await verifyPassword('WrongPassword1', 'scrypt:bad')
    const t2 = performance.now() - t2Start

    // Допускаем разброс до 3x: dummy-операция должна быть сопоставима по
    // времени с реальной, а не возвращаться мгновенно.
    const ratio = t1 / t2
    expect(ratio).toBeGreaterThan(0.33)
    expect(ratio).toBeLessThan(3.0)
  })
})
