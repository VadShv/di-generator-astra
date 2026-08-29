// Тесты определения типа файла по magic bytes и санитизации имён (Фаза 3, шаг 3.3).
import { describe, it, expect } from 'vitest'

import {
  detectFileType,
  validateFileType,
  sanitizeFileName,
} from '@/lib/file-type'

function buf(bytes: number[]): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.length)
  const view = new Uint8Array(ab)
  bytes.forEach((b, i) => (view[i] = b))
  return ab
}

describe('detectFileType', () => {
  it('распознаёт PDF по сигнатуре %PDF', () => {
    expect(detectFileType(buf([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]))).toBe('pdf')
  })

  it('распознаёт ZIP (DOCX/XLSX) по сигнатуре PK', () => {
    expect(detectFileType(buf([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]))).toBe('zip')
  })

  it('распознаёт пустой ZIP-архив', () => {
    expect(detectFileType(buf([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00]))).toBe('zip')
  })

  it('возвращает unknown для произвольных данных', () => {
    expect(detectFileType(buf([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))).toBe('unknown')
  })

  it('возвращает unknown для слишком короткого буфера', () => {
    expect(detectFileType(buf([0x25, 0x50]))).toBe('unknown')
  })
})

describe('validateFileType', () => {
  it('подтверждает .pdf с PDF-сигнатурой', () => {
    const pdf = buf([0x25, 0x50, 0x44, 0x46, ...Array(60).fill(0x20)])
    expect(validateFileType(pdf, 'pdf')).toBe(true)
  })

  it('отклоняет .pdf с ZIP-сигнатурой (подмена расширения)', () => {
    const zip = buf([0x50, 0x4b, 0x03, 0x04, ...Array(60).fill(0x00)])
    expect(validateFileType(zip, 'pdf')).toBe(false)
  })

  it('подтверждает .docx с ZIP-сигнатурой', () => {
    const zip = buf([0x50, 0x4b, 0x03, 0x04, ...Array(60).fill(0x00)])
    expect(validateFileType(zip, 'docx')).toBe(true)
  })

  it('подтверждает .xlsx с ZIP-сигнатурой', () => {
    const zip = buf([0x50, 0x4b, 0x03, 0x04, ...Array(60).fill(0x00)])
    expect(validateFileType(zip, 'xlsx')).toBe(true)
  })

  it('отклоняет .docx с PDF-сигнатурой (подмена расширения)', () => {
    const pdf = buf([0x25, 0x50, 0x44, 0x46, ...Array(60).fill(0x20)])
    expect(validateFileType(pdf, 'docx')).toBe(false)
  })

  it('подтверждает legacy .xls (OLE2 Compound Document)', () => {
    const ole2 = buf([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Array(56).fill(0x00)])
    expect(validateFileType(ole2, 'xls')).toBe(true)
  })

  it('отклоняет неизвестное расширение', () => {
    const pdf = buf([0x25, 0x50, 0x44, 0x46, ...Array(60).fill(0x20)])
    expect(validateFileType(pdf, 'exe')).toBe(false)
  })
})

describe('sanitizeFileName', () => {
  it('убирает path traversal (../)', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toBe('passwd')
  })

  it('убирает path traversal через backslash', () => {
    expect(sanitizeFileName('..\\..\\windows\\system32\\file.pdf')).toBe('file.pdf')
  })

  it('убирает управляющие символы', () => {
    expect(sanitizeFileName('file\x00name.pdf')).toBe('filename.pdf')
  })

  it('убирает небезопасные FS-символы', () => {
    expect(sanitizeFileName('file<>:"|?*.pdf')).toBe('file.pdf')
  })

  it('сохраняет обычное имя файла', () => {
    expect(sanitizeFileName('Должностная_инструкция.pdf')).toBe('Должностная_инструкция.pdf')
  })

  it('ограничивает длину имени', () => {
    const long = 'a'.repeat(300) + '.pdf'
    const result = sanitizeFileName(long)
    expect(result.length).toBeLessThanOrEqual(200)
  })

  it('возвращает дефолт для пустого имени', () => {
    expect(sanitizeFileName('')).toBe('document')
    expect(sanitizeFileName('///')).toBe('document')
  })

  it('берёт только basename из пути', () => {
    expect(sanitizeFileName('uploads/documents/ДИ.pdf')).toBe('ДИ.pdf')
  })
})
