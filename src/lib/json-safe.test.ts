import { describe, it, expect, vi } from 'vitest'
import { parseJsonLoose, parseJsonOr } from '@/lib/json-safe'

describe('parseJsonLoose', () => {
  it('парсит чистый JSON-объект', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  it('парсит JSON-массив', () => {
    expect(parseJsonLoose('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('игнорирует пробелы вокруг', () => {
    expect(parseJsonLoose('  \n{"a":1}\n  ')).toEqual({ a: 1 })
  })

  it('извлекает JSON из markdown-блока ```json', () => {
    const text = 'Вот результат:\n```json\n{"score": 85}\n```\nКонец.'
    expect(parseJsonLoose(text)).toEqual({ score: 85 })
  })

  it('извлекает JSON из markdown-блока без указания языка', () => {
    const text = '```\n{"x": true}\n```'
    expect(parseJsonLoose(text)).toEqual({ x: true })
  })

  it('извлекает первый сбалансированный объект из текста', () => {
    const text = 'Результат аудита: {"overallScore": 90, "items": []} — готово'
    expect(parseJsonLoose(text)).toEqual({ overallScore: 90, items: [] })
  })

  it('извлекает первый сбалансированный массив из текста', () => {
    const text = 'Список: [1, 2, 3] завершён'
    expect(parseJsonLoose(text)).toEqual([1, 2, 3])
  })

  it('корректно обрабатывает вложенные фигурные скобки в строках', () => {
    const text = '{"msg": "текст с } скобкой внутри"}'
    expect(parseJsonLoose(text)).toEqual({ msg: 'текст с } скобкой внутри' })
  })

  it('возвращает null для пустой строки', () => {
    expect(parseJsonLoose('')).toBeNull()
    expect(parseJsonLoose('   ')).toBeNull()
  })

  it('возвращает null для текста без JSON', () => {
    expect(parseJsonLoose('просто текст без json')).toBeNull()
  })

  it('возвращает null для несбалансированных скобок', () => {
    expect(parseJsonLoose('{ некорректный json')).toBeNull()
  })

  it('выбирает первую сбалансированную подстроку, а не последнюю', () => {
    const text = '{"first": 1} какой-то текст {"second": 2}'
    expect(parseJsonLoose(text)).toEqual({ first: 1 })
  })

  it('обрабатывает экранированные кавычки в строках', () => {
    const text = '{"msg": "он сказал \\"привет\\""}'
    expect(parseJsonLoose(text)).toEqual({ msg: 'он сказал "привет"' })
  })
})

describe('parseJsonOr', () => {
  it('возвращает распарсенный объект при успехе', () => {
    expect(parseJsonOr('{"a":1}', { fallback: true })).toEqual({ a: 1 })
  })

  it('возвращает fallback при неудаче', () => {
    expect(parseJsonOr('не json', { fallback: true })).toEqual({ fallback: true })
  })

  it('вызывает onParseFail с сырым текстом при неудаче', () => {
    const spy = vi.fn()
    parseJsonOr('битый', 'fb', spy)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('битый')
  })

  it('не вызывает onParseFail при успехе', () => {
    const spy = vi.fn()
    parseJsonOr('{"ok":true}', 'fb', spy)
    expect(spy).not.toHaveBeenCalled()
  })
})
