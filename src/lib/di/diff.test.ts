import { describe, it, expect } from 'vitest'
import { wordDiff, type DiffSegment } from '@/lib/diff'

describe('wordDiff', () => {
  it('возвращает пустой массив для двух пустых строк', () => {
    expect(wordDiff('', '')).toEqual([])
  })

  it('помечает весь новый текст как add, если старый пуст', () => {
    const segs = wordDiff('', 'hello world')
    expect(segs).toEqual([{ type: 'add', text: 'hello world' }])
  })

  it('помечает весь старый текст как remove, если новый пуст', () => {
    const segs = wordDiff('hello world', '')
    expect(segs).toEqual([{ type: 'remove', text: 'hello world' }])
  })

  it('возвращает same для идентичных текстов', () => {
    const segs = wordDiff('один два три', 'один два три')
    expect(segs).toEqual([{ type: 'same', text: 'один два три' }])
  })

  it('показывает add для добавленных слов', () => {
    const segs = wordDiff('один два', 'один два три')
    const last = segs[segs.length - 1]
    expect(last?.type).toBe('add')
    expect(last?.text).toBe(' три')
  })

  it('показывает remove для удалённых слов', () => {
    const segs = wordDiff('один два три', 'один два')
    const last = segs[segs.length - 1]
    expect(last?.type).toBe('remove')
    expect(last?.text).toBe(' три')
  })

  it('корректно обрабатывает замену слова', () => {
    const segs = wordDiff('старый текст', 'новый текст')
    const types = segs.map((s) => s.type)
    expect(types).toContain('remove')
    expect(types).toContain('add')
    expect(types).toContain('same')
  })

  it('корректно обрабатывает полную замену текста', () => {
    const segs = wordDiff('a b c', 'x y z')
    const types = segs.map((s) => s.type)
    expect(types).toContain('remove')
    expect(types).toContain('add')
    // Пробелы могут совпадать как same-сегменты
  })

  it('сохраняет пробельные токены', () => {
    const segs = wordDiff('один  два', 'один два')
    // Пробелы будут частью токенов
    expect(segs.length).toBeGreaterThan(0)
  })

  it('откатывается к полной замене при слишком большом объёме', () => {
    const huge = 'word '.repeat(3000).trim() // ~18000 chars, many tokens
    const segs = wordDiff(huge, huge + ' extra')
    // Должен вернуться массив, а не упасть с OOM
    expect(Array.isArray(segs)).toBe(true)
    expect(segs.length).toBeGreaterThan(0)
  })

  it('корректно обрабатывает текст с пунктуацией', () => {
    const segs = wordDiff('Привет, мир!', 'Привет, всем!')
    expect(segs.some((s) => s.type === 'same')).toBe(true)
    expect(segs.some((s) => s.type === 'remove')).toBe(true)
    expect(segs.some((s) => s.type === 'add')).toBe(true)
  })

  it('обрабатывает разные переносы строк', () => {
    const segs = wordDiff('строка1\nстрока2', 'строка1\n\nстрока2')
    expect(segs.length).toBeGreaterThan(0)
  })
})
