import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('объединяет классы в строку', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('обрабатывает условные классы', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('обрабатывает undefined и null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('ресолвит конфликты Tailwind (twMerge)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
  })

  it('работает с объектами', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('работает с массивами', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('возвращает пустую строку без аргументов', () => {
    expect(cn()).toBe('')
  })
})
