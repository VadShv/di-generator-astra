import { describe, it, expect, vi, beforeEach } from 'vitest'
import { serializeDiVersion, createInitialVersion } from './version'

// Мокаем db
vi.mock('@/lib/db', () => ({
  db: {
    dIVersion: {
      create: vi.fn().mockResolvedValue({ id: 'ver-1' }),
    },
  },
}))

import { db } from '@/lib/db'

describe('serializeDiVersion', () => {
  it('сериализует title и sections в JSON', () => {
    const result = serializeDiVersion('ДИ — Инженер', [
      { title: 'Общие положения', content: 'Текст 1' },
      { title: 'Обязанности', content: 'Текст 2' },
    ])
    const parsed = JSON.parse(result)
    expect(parsed.title).toBe('ДИ — Инженер')
    expect(parsed.sections).toHaveLength(2)
    expect(parsed.sections[0]).toEqual({ title: 'Общие положения', content: 'Текст 1' })
    expect(parsed.sections[1]).toEqual({ title: 'Обязанности', content: 'Текст 2' })
  })

  it('работает с пустыми секциями', () => {
    const result = serializeDiVersion('Пустая ДИ', [])
    const parsed = JSON.parse(result)
    expect(parsed.sections).toEqual([])
  })

  it('сериализует кириллические символы корректно', () => {
    const result = serializeDiVersion('ДИ — Тест', [
      { title: 'Раздел', content: 'Содержимое с эмодзи 🚀' },
    ])
    expect(result).toContain('Содержимое с эмодзи 🚀')
  })
})

describe('createInitialVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('создаёт версию с дефолтными параметрами', async () => {
    await createInitialVersion('di-123', 'ДИ — Инженер', [
      { title: 'Общие положения', content: 'Текст' },
    ])

    expect(db.dIVersion.create).toHaveBeenCalledTimes(1)
    const callArg = (db.dIVersion.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArg.data.generatedDIId).toBe('di-123')
    expect(callArg.data.version).toBe(1)
    expect(callArg.data.isOriginal).toBe(true)
    expect(callArg.data.uploadedBy).toBe('ai-generate')
    expect(callArg.data.changeDescription).toBe('Начальная AI-генерация')

    const content = JSON.parse(callArg.data.content)
    expect(content.title).toBe('ДИ — Инженер')
    expect(content.sections).toHaveLength(1)
  })

  it('принимает кастомные uploadedBy и changeDescription', async () => {
    await createInitialVersion('di-456', 'ДИ — Менеджер', [], 'admin', 'Ручное создание')

    const callArg = (db.dIVersion.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArg.data.uploadedBy).toBe('admin')
    expect(callArg.data.changeDescription).toBe('Ручное создание')
  })

  it('сериализирует несколько секций', async () => {
    await createInitialVersion('di-789', 'ДИ — Тест', [
      { title: 'A', content: 'a' },
      { title: 'B', content: 'b' },
      { title: 'C', content: 'c' },
    ])

    const callArg = (db.dIVersion.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const content = JSON.parse(callArg.data.content)
    expect(content.sections).toHaveLength(3)
    expect(content.sections[2]).toEqual({ title: 'C', content: 'c' })
  })
})
