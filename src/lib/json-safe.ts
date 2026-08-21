// Безопасный парсинг JSON из ответов ИИ (Фаза 1).
// ИИ часто оборачивает JSON в markdown-блок ```json ... ``` или добавляет лишний текст.
// Здесь — единое место для устойчивого извлечения JSON.

/**
 * Извлечь JSON-объект из произвольного текста ответа модели.
 * 1. Пробует распарсить весь текст как JSON.
 * 2. Иначе ищет блок ```json ... ``` или ``` ... ```.
 * 3. Иначе ищет первую { ... } подстроку.
 *
 * @returns распарсенный объект или null, если JSON не найден.
 */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()

  // 1) Прямой парсинг.
  try {
    return JSON.parse(trimmed) as T
  } catch {
    // продолжаем
  }

  // 2) Markdown-блок ```json ... ``` или ``` ... ```.
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim()) as T
    } catch {
      // продолжаем
    }
  }

  // 3) Первая сбалансированная { ... } или [ ... ] подстрока.
  const obj = extractBalanced(trimmed, '{', '}')
  if (obj) {
    try {
      return JSON.parse(obj) as T
    } catch {
      // продолжаем
    }
  }
  const arr = extractBalanced(trimmed, '[', ']')
  if (arr) {
    try {
      return JSON.parse(arr) as T
    } catch {
      // продолжаем
    }
  }

  return null
}

/** Найти первую сбалансированную подстроку между open и close. */
function extractBalanced(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open)
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }
  return null
}

/**
 * Парсинг JSON с fallback-значением.
 * Если JSON не извлечён — возвращает fallback и (опц.) записывает сырой текст в onParseFail.
 */
export function parseJsonOr<T>(text: string, fallback: T, onParseFail?: (raw: string) => void): T {
  const parsed = parseJsonLoose<T>(text)
  if (parsed === null) {
    onParseFail?.(text)
    return fallback
  }
  return parsed
}
