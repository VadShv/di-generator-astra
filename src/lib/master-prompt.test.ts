import { describe, it, expect } from 'vitest'
import {
  extractVariables,
  renderPrompt,
  estimateTokens,
  buildContextFromPosition,
  type PromptContext,
} from '@/lib/master-prompt'

describe('extractVariables', () => {
  it('извлекает переменные в формате {{...}}', () => {
    expect(extractVariables('Текст {{должность}} и {{подразделение}}')).toEqual([
      'должность',
      'подразделение',
    ])
  })

  it('дедуплицирует повторяющиеся переменные', () => {
    expect(extractVariables('{{x}} {{x}} {{y}}')).toEqual(['x', 'y'])
  })

  it('нормализует пробелы внутри {{ }}', () => {
    expect(extractVariables('{{  должность  }}')).toEqual(['должность'])
  })

  it('возвращает пустой массив если переменных нет', () => {
    expect(extractVariables('обычный текст без переменных')).toEqual([])
  })

  it('возвращает пустой массив для пустой строки', () => {
    expect(extractVariables('')).toEqual([])
  })
})

describe('renderPrompt', () => {
  it('подставляет известные переменные', () => {
    const ctx: PromptContext = { position: 'Бухгалтер', department: 'Бухгалтерия' }
    expect(renderPrompt('{{position}} в {{department}}', ctx)).toBe('Бухгалтер в Бухгалтерия')
  })

  it('подставляет кириллические ключи', () => {
    const ctx: PromptContext = { должность: 'Аналитик', подразделение: 'Отдел аналитики' }
    expect(renderPrompt('{{должность}} — {{подразделение}}', ctx)).toBe(
      'Аналитик — Отдел аналитики'
    )
  })

  it('оставляет неизвестные переменные как есть', () => {
    const ctx: PromptContext = { position: 'Тест' }
    expect(renderPrompt('{{position}} {{unknown}}', ctx)).toBe('Тест {{unknown}}')
  })

  it('заменяет null на пустую строку', () => {
    const ctx: PromptContext = { position: null }
    expect(renderPrompt('[{{position}}]', ctx)).toBe('[]')
  })

  it('преобразует числовые значения в строки', () => {
    const ctx: PromptContext = { count: 42 }
    expect(renderPrompt('{{count}} шт', ctx)).toBe('42 шт')
  })

  it('не меняет текст без переменных', () => {
    expect(renderPrompt('без переменных', {})).toBe('без переменных')
  })
})

describe('estimateTokens', () => {
  it('возвращает 0 для пустой строки', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('оценивает ~4 символа на токен', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('округляет вверх', () => {
    expect(estimateTokens('abcde')).toBe(2)
  })
})

describe('buildContextFromPosition', () => {
  it('строит контекст из полной позиции', () => {
    const ctx = buildContextFromPosition({
      title: 'Инженер',
      code: 'ING-001',
      grade: 'линейная',
      functions: 'Разработка',
      department: { name: 'ИТ-отдел', company: { name: 'ООО Астра' } },
      businessFunction: { name: 'Разработка ПО' },
    })
    expect(ctx.position).toBe('Инженер')
    expect(ctx.должность).toBe('Инженер')
    expect(ctx.подразделение).toBe('ИТ-отдел')
    expect(ctx.юр_лицо).toBe('ООО Астра')
    expect(ctx.квалификация).toBe('линейная')
    expect(ctx.код_должности).toBe('ING-001')
    expect(ctx.бизнес_функция).toBe('Разработка ПО')
  })

  it('возвращает null для отсутствующих связей', () => {
    const ctx = buildContextFromPosition({
      title: 'Менеджер',
      code: 'M-1',
      grade: null,
      department: null,
      businessFunction: null,
    })
    expect(ctx.подразделение).toBeNull()
    expect(ctx.юр_лицо).toBeNull()
    expect(ctx.квалификация).toBeNull()
    expect(ctx.бизнес_функция).toBeNull()
    expect(ctx.position).toBe('Менеджер')
  })
})
