import { describe, it, expect } from 'vitest'
import {
  aiImproveSchema,
  magicWandPresetSchema,
  idSchema,
  nonEmptyString,
} from './schemas'

describe('magicWandPresetSchema', () => {
  it('пропускает валидные пресеты', () => {
    expect(magicWandPresetSchema.parse('detail')).toBe('detail')
    expect(magicWandPresetSchema.parse('shorten')).toBe('shorten')
    expect(magicWandPresetSchema.parse('formalize')).toBe('formalize')
    expect(magicWandPresetSchema.parse('simplify')).toBe('simplify')
    expect(magicWandPresetSchema.parse('kpi')).toBe('kpi')
    expect(magicWandPresetSchema.parse('style')).toBe('style')
  })

  it('бросает ошибку на невалидный пресет', () => {
    expect(() => magicWandPresetSchema.parse('invalid')).toThrow()
    expect(() => magicWandPresetSchema.parse('')).toThrow()
  })
})

describe('aiImproveSchema', () => {
  it('пропускает sectionId + instruction', () => {
    const result = aiImproveSchema.parse({
      sectionId: 'cuid123',
      instruction: 'Сделай формальнее',
    })
    expect(result.sectionId).toBe('cuid123')
    expect(result.instruction).toBe('Сделай формальнее')
    expect(result.preset).toBeUndefined()
  })

  it('пропускает sectionId + preset (Magic Wand)', () => {
    const result = aiImproveSchema.parse({
      sectionId: 'cuid123',
      preset: 'detail',
    })
    expect(result.sectionId).toBe('cuid123')
    expect(result.preset).toBe('detail')
    expect(result.instruction).toBeUndefined()
  })

  it('пропускает sectionId + preset + instruction', () => {
    const result = aiImproveSchema.parse({
      sectionId: 'cuid123',
      preset: 'kpi',
      instruction: 'Добавь дедлайны',
    })
    expect(result.preset).toBe('kpi')
    expect(result.instruction).toBe('Добавь дедлайны')
  })

  it('бросает ошибку без instruction и preset', () => {
    expect(() =>
      aiImproveSchema.parse({ sectionId: 'cuid123' })
    ).toThrow(/Требуется либо instruction, либо preset/)
  })

  it('бросает ошибку на пустой sectionId', () => {
    expect(() =>
      aiImproveSchema.parse({ sectionId: '   ', instruction: 'test' })
    ).toThrow()
  })

  it('триммит instruction', () => {
    const result = aiImproveSchema.parse({
      sectionId: 'cuid123',
      instruction: '  test  ',
    })
    expect(result.instruction).toBe('test')
  })
})

describe('idSchema', () => {
  it('пропускает непустую строку', () => {
    expect(idSchema.parse('abc')).toBe('abc')
  })

  it('бросает ошибку на пустую строку', () => {
    expect(() => idSchema.parse('')).toThrow()
  })

  it('бросает ошибку на пробелы', () => {
    expect(() => idSchema.parse('   ')).toThrow()
  })
})

describe('nonEmptyString', () => {
  it('триммит и проверяет минимум 1 символ', () => {
    expect(nonEmptyString.parse('hello')).toBe('hello')
    expect(nonEmptyString.parse('  hello  ')).toBe('hello')
  })

  it('бросает ошибку на пустую строку после тримма', () => {
    expect(() => nonEmptyString.parse('   ')).toThrow()
  })
})
