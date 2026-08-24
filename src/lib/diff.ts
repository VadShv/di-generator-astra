// Простой пословный diff на основе LCS (наибольшая общая подпоследовательность).
// Без внешних зависимостей, чистый TypeScript.

export interface DiffSegment {
  type: 'same' | 'add' | 'remove'
  text: string
}

// Разбивает текст на токены: слова (с пунктуацией) и пробельные промежутки.
// Пробельные токены сохраняются, чтобы при рендере не терялись переносы строк и отступы.
function tokenize(text: string): string[] {
  if (!text) return []
  return text.split(/(\s+)/).filter((t) => t.length > 0)
}

// Сливает подряд идущие сегменты одного типа — меньше узлов при рендере.
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const result: DiffSegment[] = []
  for (const seg of segments) {
    const last = result[result.length - 1]
    if (last && last.type === seg.type) {
      last.text += seg.text
    } else {
      result.push({ type: seg.type, text: seg.text })
    }
  }
  return result
}

/**
 * Пословный diff двух текстов.
 * Возвращает массив сегментов с меткой типа:
 *  - 'same'   — неизменный фрагмент
 *  - 'add'    — добавленный фрагмент (есть только в новом тексте)
 *  - 'remove' — удалённый фрагмент (есть только в старом тексте)
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const m = a.length
  const n = b.length

  if (m === 0 && n === 0) return []
  if (m === 0) return mergeSegments(b.map((text) => ({ type: 'add' as const, text })))
  if (n === 0) return mergeSegments(a.map((text) => ({ type: 'remove' as const, text })))

  // Защита от чрезмерного расхода памяти: если произведение слишком велико,
  // отказываемся от LCS и помечаем старый текст как удалённый, новый — как добавленный.
  if (m * n > 5_000_000) {
    return mergeSegments([
      ...a.map((text) => ({ type: 'remove' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ])
  }

  // DP-таблица LCS.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  // Обратный проход: собираем сегменты.
  const segments: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      segments.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'remove', text: a[i] })
      i++
    } else {
      segments.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < m) {
    segments.push({ type: 'remove', text: a[i] })
    i++
  }
  while (j < n) {
    segments.push({ type: 'add', text: b[j] })
    j++
  }

  return mergeSegments(segments)
}
