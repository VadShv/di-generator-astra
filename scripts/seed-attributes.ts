#!/usr/bin/env bun
// Seed: типовые признаки должности.
// Запуск: bun scripts/seed-attributes.ts
// Безопасен для повторного запуска — пропускает существующие по коду.
import { db } from '../src/lib/db'

const SEED_ATTRIBUTES = [
  {
    name: 'Товарно-материальная ответственность',
    code: 'material_responsibility',
    description: 'Должность предполагает работу с материальными ценностями',
    promptAddition: 'Включи в должностную инструкцию раздел о материальной ответственности: договор о полной индивидуальной материальной ответственности, перечень вверенных материальных ценностей, порядок инвентаризации, ответственность за ущерб в соответствии с гл. 39 ТК РФ.',
    category: 'responsibility',
  },
  {
    name: 'Обработка персональных данных',
    code: 'personal_data',
    description: 'Должность предполагает работу с персональными данными',
    promptAddition: 'Включи в должностную инструкцию обязанности по работе с персональными данными: соблюдение ФЗ-152 «О персональных данных», ответственность за разглашение ПДн, порядок получения согласия субъекта ПДн, меры защиты ПДн, порядок уничтожения ПДн по истечении срока хранения.',
    category: 'compliance',
  },
  {
    name: 'Ответственность за охрану труда',
    code: 'occupational_safety',
    description: 'Должность предполагает ответственность за охрану труда',
    promptAddition: 'Включи в должностную инструкцию обязанности по охране труда: соблюдение требований ТК РФ (гл. 34), прохождение инструктажей и обучения по охране труда, использование средств индивидуальной защиты, ответственность за нарушение требований охраны труда, порядок расследования несчастных случаев.',
    category: 'compliance',
  },
]

async function main() {
  let created = 0
  let skipped = 0

  for (const attr of SEED_ATTRIBUTES) {
    const existing = await db.positionAttribute.findUnique({ where: { code: attr.code } })
    if (existing) {
      console.log(`  → ${attr.name} (${attr.code}) — уже существует, пропуск`)
      skipped++
      continue
    }

    await db.positionAttribute.create({ data: attr })
    console.log(`  ✓ ${attr.name} (${attr.code}) — создан`)
    created++
  }

  console.log(`\nГотово. Создано: ${created}, пропущено: ${skipped}`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error('Ошибка:', e)
  process.exit(1)
})
