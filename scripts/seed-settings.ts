#!/usr/bin/env bun
// Заполнение системных настроек значениями по умолчанию.
// Использование: bun scripts/seed-settings.ts
// Idempotent: upsert — безопасно запускать повторно.
import { db } from '../src/lib/db'

const DEFAULT_SETTINGS: Record<string, string> = {
  massGenLimit: '50',
  fileUploadLimit: '10', // МБ
}

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.systemSettings.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
    console.log(`✅ ${key} = ${value}`)
  }
  console.log('Системные настройки инициализированы')
  await db.$disconnect()
}

main().catch((e) => {
  console.error('Ошибка:', e)
  process.exit(1)
})
