import { describe, it, expect } from 'vitest'
import {
  buildPositionContext,
  buildArchiveContext,
  buildSectionUserPrompt,
  type PositionForContext,
  type ArchiveDIRef,
} from '@/lib/di/prompts'

describe('buildPositionContext', () => {
  it('строит контекст с базовыми полями', () => {
    const pos: PositionForContext = {
      title: 'Бухгалтер',
      code: 'B-001',
      grade: 'линейная',
      department: { name: 'Бухгалтерия', company: { name: 'ООО Ромашка' } },
      businessFunction: { name: 'Учёт' },
      project: { name: 'Проект А' },
    }
    const ctx = buildPositionContext(pos)
    expect(ctx).toContain('Должность: Бухгалтер')
    expect(ctx).toContain('Код должности: B-001')
    expect(ctx).toContain('Подразделение: Бухгалтерия')
    expect(ctx).toContain('Грейд: линейная')
    expect(ctx).toContain('Бизнес-функция: Учёт')
    expect(ctx).toContain('Проект: Проект А')
  })

  it('подставляет «Не указано» для отсутствующих полей', () => {
    const pos: PositionForContext = {
      title: 'Тест',
      code: 'T-1',
      grade: null,
      department: null,
      businessFunction: null,
      project: null,
    }
    const ctx = buildPositionContext(pos)
    expect(ctx).toContain('Подразделение: Не указано')
    expect(ctx).toContain('Грейд: Не указан')
    expect(ctx).toContain('Бизнес-функция: Не указана')
    expect(ctx).toContain('Проект: Не указан')
  })

  it('добавляет headcount если задан', () => {
    const ctx = buildPositionContext({
      title: 'П',
      code: 'C',
      grade: null,
      headcount: 5,
    })
    expect(ctx).toContain('Количество штатных единиц: 5')
  })

  it('добавляет functions если заданы', () => {
    const ctx = buildPositionContext({
      title: 'П',
      code: 'C',
      grade: null,
      functions: 'Работа с клиентами',
    })
    expect(ctx).toContain('Выполняемые функции: Работа с клиентами')
  })

  it('не добавляет headcount/functions если не заданы', () => {
    const ctx = buildPositionContext({
      title: 'П',
      code: 'C',
      grade: null,
    })
    expect(ctx).not.toContain('Количество штатных единиц')
    expect(ctx).not.toContain('Выполняемые функции')
  })
})

describe('buildArchiveContext', () => {
  it('возвращает заглушку для пустого массива', () => {
    expect(buildArchiveContext([])).toBe('Архивные ДИ для данной должности отсутствуют.')
  })

  it('форматирует одну архивную ДИ', () => {
    const dis: ArchiveDIRef[] = [{ title: 'ДИ 2023', content: 'Текст инструкции' }]
    const ctx = buildArchiveContext(dis)
    expect(ctx).toContain('Архивная ДИ #1: ДИ 2023')
    expect(ctx).toContain('Текст инструкции')
  })

  it('форматирует несколько архивных ДИ с разделителем', () => {
    const dis: ArchiveDIRef[] = [
      { title: 'ДИ А', content: 'А' },
      { title: 'ДИ Б', content: 'Б' },
    ]
    const ctx = buildArchiveContext(dis)
    expect(ctx).toContain('#1: ДИ А')
    expect(ctx).toContain('#2: ДИ Б')
    expect(ctx).toContain('\n\n')
  })
})

describe('buildSectionUserPrompt', () => {
  it('строит базовый промпт с заголовком секции', () => {
    const prompt = buildSectionUserPrompt({ title: 'Общие положения' })
    expect(prompt).toContain('Сгенерируй содержание секции "Общие положения"')
    expect(prompt).toContain('Сгенерируй подробное, профессиональное содержание')
  })

  it('добавляет руководство если есть', () => {
    const prompt = buildSectionUserPrompt({
      title: 'Должностные обязанности',
      promptGuidance: 'Опиши 5-7 обязанностей',
    })
    expect(prompt).toContain('Руководство для генерации: Опиши 5-7 обязанностей')
  })

  it('добавляет шаблон если есть', () => {
    const prompt = buildSectionUserPrompt({
      title: 'Права',
      content: 'Право на отпуск',
    })
    expect(prompt).toContain('Примерное содержание/шаблон: Право на отпуск')
  })

  it('не добавляет руководство/шаблон если их нет', () => {
    const prompt = buildSectionUserPrompt({ title: 'Ответственность' })
    expect(prompt).not.toContain('Руководство для генерации')
    expect(prompt).not.toContain('Примерное содержание/шаблон')
  })
})
