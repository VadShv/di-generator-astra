import { describe, it, expect } from 'vitest'
import {
  aiImproveSchema,
  magicWandPresetSchema,
  idSchema,
  nonEmptyString,
  createCompanySchema,
  updateCompanySchema,
  deleteCompanySchema,
  createArchiveDISchema,
  updateArchiveDISchema,
  deleteArchiveDISchema,
  diUploadSaveSchema,
  staffingImportSchema,
  changePasswordSchema,
} from './schemas'

describe('createCompanySchema', () => {
  it('пропускает валидные данные компании', () => {
    const r = createCompanySchema.parse({ name: 'ООО Ромашка', code: 'ROM' })
    expect(r.name).toBe('ООО Ромашка')
    expect(r.code).toBe('ROM')
  })

  it('пропускает ИНН/ОГРН/КПП с правильным форматом', () => {
    const r = createCompanySchema.parse({
      name: 'ООО Ромашка', code: 'ROM', inn: '1234567890', ogrn: '1234567890123', kpp: '123456789',
    })
    expect(r.inn).toBe('1234567890')
  })

  it('отклоняет невалидный ИНН', () => {
    expect(() => createCompanySchema.parse({ name: 'X', code: 'Y', inn: 'abc' })).toThrow()
  })

  it('отклоняет пустое имя', () => {
    expect(() => createCompanySchema.parse({ name: '', code: 'Y' })).toThrow()
  })
})

describe('updateCompanySchema', () => {
  it('требует id и хотя бы одно поле', () => {
    expect(() => updateCompanySchema.parse({ id: 'cuid' })).toThrow()
  })

  it('пропускает id + name', () => {
    const r = updateCompanySchema.parse({ id: 'cuid', name: 'Новое имя' })
    expect(r.name).toBe('Новое имя')
  })
})

describe('deleteCompanySchema', () => {
  it('требует id', () => {
    expect(() => deleteCompanySchema.parse({})).toThrow()
    expect(deleteCompanySchema.parse({ id: 'x' }).id).toBe('x')
  })
})

describe('createArchiveDISchema', () => {
  it('пропускает title + content', () => {
    const r = createArchiveDISchema.parse({ title: 'ДИ', content: 'Текст инструкции' })
    expect(r.title).toBe('ДИ')
  })

  it('отклоняет пустой content', () => {
    expect(() => createArchiveDISchema.parse({ title: 'ДИ', content: '   ' })).toThrow()
  })
})

describe('updateArchiveDISchema', () => {
  it('требует id + поле', () => {
    expect(() => updateArchiveDISchema.parse({ id: 'x' })).toThrow()
  })

  it('пропускает id + nullable positionId', () => {
    const r = updateArchiveDISchema.parse({ id: 'x', positionId: null })
    expect(r.positionId).toBeNull()
  })
})

describe('diUploadSaveSchema', () => {
  it('пропускает полный валидный payload', () => {
    const r = diUploadSaveSchema.parse({
      fileName: 'doc.pdf', rawText: 'текст', positionId: 'pos1',
      sections: [{ title: 's1', content: 'c1' }],
    })
    expect(r.positionId).toBe('pos1')
    expect(r.sections).toHaveLength(1)
  })

  it('требует positionId', () => {
    expect(() => diUploadSaveSchema.parse({ fileName: 'x', rawText: 'y' })).toThrow()
  })

  it('отклоняет отрицательный headcount-like огромный rawText', () => {
    expect(() => diUploadSaveSchema.parse({ fileName: 'x', rawText: 'a'.repeat(6 * 1024 * 1024), positionId: 'p' })).toThrow()
  })
})

describe('staffingImportSchema', () => {
  it('пропускает валидные строки', () => {
    const r = staffingImportSchema.parse({
      rows: [{ departmentName: 'Отдел', positionTitle: 'Должность', headcount: 2, rowNumber: 1 }],
    })
    expect(r.rows).toHaveLength(1)
  })

  it('требует хотя бы одну строку', () => {
    expect(() => staffingImportSchema.parse({ rows: [] })).toThrow()
  })

  it('отклоняет неположительный headcount', () => {
    expect(() => staffingImportSchema.parse({
      rows: [{ departmentName: 'О', positionTitle: 'Д', headcount: 0, rowNumber: 1 }],
    })).toThrow()
  })
})

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
describe('changePasswordSchema', () => {
  it('пропускает сильный пароль, отличный от текущего', () => {
    const r = changePasswordSchema.parse({ currentPassword: 'Old12345', newPassword: 'New12345' })
    expect(r.newPassword).toBe('New12345')
  })

  it('отклоняет короткий пароль (<8)', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'Old12345', newPassword: 'Ab1' })).toThrow()
  })

  it('отклоняет пароль без цифры', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'Old12345', newPassword: 'OnlyLetters' })).toThrow()
  })

  it('отклоняет пароль без буквы', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'Old12345', newPassword: '12345678' })).toThrow()
  })

  it('отклоняет новый пароль, совпадающий с текущим', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'Same1234', newPassword: 'Same1234' })).toThrow()
  })

  it('отклоняет пустой текущий пароль', () => {
    expect(() => changePasswordSchema.parse({ currentPassword: '', newPassword: 'New12345' })).toThrow()
  })
})
