// Текстовая аналитика ДИ — чистый client-side, без AI.
// Подсчёт символов/слов/предложений, анализ сложных предложений, маркеры воды.

// Словарь water-фраз — типичные бессмысленные формулировки в российских ДИ
export const WATER_PHRASES = [
  'в пределах своей компетенции',
  'в установленном порядке',
  'в случае необходимости',
  'в соответствии с действующим законодательством',
  'иные обязанности',
  'осуществление иных функций',
  'и другие',
  'в том числе но не ограничиваясь',
  'в рамках своей работы',
  'по поручению руководителя',
  'выполнение иных',
  'другие обязанности',
  'прочие функции',
  'иные функции',
  'осуществляет иные',
  'выполняет другие',
  'а также другие',
  'иные мероприятия',
  'в установленном настоящим',
  'другие мероприятия',
  'иные работы',
  'прочие работы',
  'иные поручения',
]

export interface WaterPhraseMatch {
  phrase: string
  count: number
  positions: number[] // индексы вхождений в текст
}

export interface TextStats {
  characters: number
  charactersNoSpaces: number
  letters: number
  words: number
  sentences: number
  complexSentences: number
  avgSentenceLength: number
  waterPhrases: WaterPhraseMatch[]
  waterPercentage: number
  longestSentence: { words: number; text: string }
}

const COMPLEX_SENTENCE_THRESHOLD = 25 // слов

export function analyzeText(text: string): TextStats {
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const letters = (text.match(/[а-яёА-ЯЁa-zA-Z]/g) || []).length

  // Разделение на предложения
  const sentenceMatches = text.match(/[^.!?]+[.!?]+/g) || [text]
  const sentences = sentenceMatches.map((s) => s.trim()).filter((s) => s.length > 0)

  // Подсчёт слов
  const words = (text.match(/[а-яёА-ЯЁa-zA-Z]+(?:-[а-яёА-ЯЁa-zA-Z]+)*/g) || []).length

  // Анализ сложных предложений
  let complexSentences = 0
  let longestSentence = { words: 0, text: '' }
  for (const sentence of sentences) {
    const sentenceWords = (sentence.match(/[а-яёА-ЯЁa-zA-Z]+(?:-[а-яёА-ЯЁa-zA-Z]+)*/g) || []).length
    if (sentenceWords > longestSentence.words) {
      longestSentence = { words: sentenceWords, text: sentence.slice(0, 200) }
    }
    if (sentenceWords > COMPLEX_SENTENCE_THRESHOLD) {
      complexSentences++
    }
  }

  const avgSentenceLength = sentences.length > 0 ? Math.round(words / sentences.length) : 0

  // Поиск water-фраз
  const waterPhrases: WaterPhraseMatch[] = []
  let waterChars = 0
  const lowerText = text.toLowerCase()
  for (const phrase of WATER_PHRASES) {
    const lowerPhrase = phrase.toLowerCase()
    const positions: number[] = []
    let idx = lowerText.indexOf(lowerPhrase)
    while (idx !== -1) {
      positions.push(idx)
      idx = lowerText.indexOf(lowerPhrase, idx + 1)
    }
    if (positions.length > 0) {
      waterPhrases.push({ phrase, count: positions.length, positions })
      waterChars += phrase.length * positions.length
    }
  }

  const waterPercentage = characters > 0 ? Math.round((waterChars / characters) * 100) : 0

  return {
    characters,
    charactersNoSpaces,
    letters,
    words,
    sentences: sentences.length,
    complexSentences,
    avgSentenceLength,
    waterPhrases: waterPhrases.sort((a, b) => b.count - a.count),
    waterPercentage,
    longestSentence,
  }
}

export function analyzeSections(sections: { sectionTitle: string; sectionContent: string }[]): {
  section: string
  stats: TextStats
}[] {
  return sections.map((s) => ({
    section: s.sectionTitle,
    stats: analyzeText(s.sectionContent),
  }))
}
