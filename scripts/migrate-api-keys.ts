#!/usr/bin/env bun
// Миграция API-ключей ИИ-провайдеров: шифрует открытые (legacy) ключи.
// Запуск: bun scripts/migrate-api-keys.ts
// Безопасен для повторного запуска — пропускает уже зашифрованные ключи (с префиксом v1:).
import { db } from '../src/lib/db'
import { encryptApiKey } from '../src/lib/ai-connector/crypto'

async function main() {
  const providers = await db.aIProvider.findMany({
    select: { id: true, name: true, apiKeyEncrypted: true },
  })

  const legacy = providers.filter(
    (p) => p.apiKeyEncrypted && !p.apiKeyEncrypted.startsWith('v1:')
  )

  if (legacy.length === 0) {
    console.log('Все API-ключи уже зашифрованы. Миграция не требуется.')
    await db.$disconnect()
    return
  }

  console.log(`Найдено ${legacy.length} провайдеров с открытыми (legacy) API-ключами.`)

  for (const p of legacy) {
    const encrypted = encryptApiKey(p.apiKeyEncrypted!)
    await db.aIProvider.update({
      where: { id: p.id },
      data: { apiKeyEncrypted: encrypted },
    })
    console.log(`  ✓ ${p.name} (${p.id}) — ключ зашифрован`)
  }

  console.log(`\nГотово. Зашифровано ${legacy.length} ключей.`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error('Ошибка миграции:', e)
  process.exit(1)
})
