#!/usr/bin/env bun
// Создание/обновление пользователя-администратора (Фаза 5: Auth).
// Использование: bun scripts/create-admin.ts <email> <password> [name]
// Если пользователь с таким email существует — пароль обновляется.
import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/auth/password'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const password = process.argv[3]
  const name = process.argv[4] || 'Администратор'

  if (!email || !password) {
    console.error('Использование: bun scripts/create-admin.ts <email> <password> [name]')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Пароль должен быть не короче 8 символов')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, role: 'admin', isActive: true, name },
    create: { email, name, role: 'admin', passwordHash, isActive: true },
  })

  console.log(`✅ Администратор: ${user.email} (id: ${user.id})`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error('Ошибка:', e)
  process.exit(1)
})
