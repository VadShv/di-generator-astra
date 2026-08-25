import { describe, it, expect } from 'vitest'
import { analyzeText, analyzeSections, WATER_PHRASES } from './text-analysis'

describe('analyzeText', () => {
  it('возвращает нули для пустого текста', () => {
    const stats = analyzeText('')
    expect(stats.characters).toBe(0)
    expect(stats.words).toBe(0)
    expect(stats.sentences).toBe(0)
    expect(stats.waterPhrases).toEqual([])
    expect(stats.waterPercentage).toBe(0)
    expect(stats.avgSentenceLength).toBe(0)
  })

  it('считает символы, слова и предложения', () => {
    const stats = analyzeText('Первое предложение. Второе предложение!')
    expect(stats.characters).toBe(39)
    expect(stats.words).toBe(4)
    expect(stats.sentences).toBe(2)
    expect(stats.avgSentenceLength).toBe(2)
  })

  it('считает буквы без пробелов', () => {
    const stats = analyzeText('А Б')
    expect(stats.characters).toBe(3)
    expect(stats.charactersNoSpaces).toBe(2)
    expect(stats.letters).toBe(2)
  })

  it('находит water-фразы', () => {
    const text = 'Сотрудник выполняет обязанности в пределах своей компетенции и иные обязанности.'
    const stats = analyzeText(text)
    expect(stats.waterPhrases.length).toBeGreaterThan(0)
    const phrases = stats.waterPhrases.map((w) => w.phrase)
    expect(phrases).toContain('в пределах своей компетенции')
    expect(phrases).toContain('иные обязанности')
  })

  it('считает waterPercentage корректно', () => {
    // "в пределах своей компетенции" = 32 символа
    const text = 'в пределах своей компетенции'
    const stats = analyzeText(text)
    expect(stats.waterPercentage).toBe(100)
  })

  it('находит сложные предложения (>25 слов)', () => {
    const longSentence = 'Слово '.repeat(30).trim() + '.'
    const stats = analyzeText(longSentence)
    expect(stats.complexSentences).toBe(1)
    expect(stats.longestSentence.words).toBe(30)
  })

  it('считает слова через дефис как одно', () => {
    const stats = analyzeText('какое-то слово')
    expect(stats.words).toBe(2)
  })

  it('считает слова на латинице', () => {
    const stats = analyzeText('Hello world')
    expect(stats.words).toBe(2)
  })
})

describe('analyzeSections', () => {
  it('анализирует массив секций', () => {
    const sections = [
      { sectionTitle: 'Общие', sectionContent: 'Два слова.' },
      { sectionTitle: 'Обязанности', sectionContent: 'Три слова здесь.' },
    ]
    const result = analyzeSections(sections)
    expect(result).toHaveLength(2)
    expect(result[0].section).toBe('Общие')
    expect(result[0].stats.words).toBe(2)
    expect(result[1].stats.words).toBe(3)
  })
})

describe('WATER_PHRASES', () => {
  it('содержит типичные водяные фразы', () => {
    expect(WATER_PHRASES.length).toBeGreaterThan(10)
    expect(WATER_PHRASES).toContain('в пределах своей компетенции')
    expect(WATER_PHRASES).toContain('в установленном порядке')
  })
})
