import { NextResponse } from 'next/server'
import { getProviderClient } from '@/lib/ai-connector'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

import { createLogger } from '@/lib/logger'

const log = createLogger('compare-ai-text-diff')

// POST /api/compare/ai-text-diff — универсальное ИИ-сравнение двух произвольных
// текстов должностных инструкций (архивная, сгенерированная версия, согласованная и т.д.).
// Принимает: { text1, text2, title1, title2, context }
// Возвращает: { aiSummary, diff }
// Не требует наличия записей в БД — работает чисто по тексту, что позволяет
// сравнивать разные типы ДИ и разные версии между собой.
export async function POST(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const { text1, text2, title1, title2, context } = body as {
      text1?: string
      text2?: string
      title1?: string
      title2?: string
      context?: string
    }

    if (!text1 || !text2) {
      return NextResponse.json(
        { error: 'Тексты обеих ДИ обязательны для сравнения' },
        { status: 400 },
      )
    }

    const label1 = title1 || 'Версия 1'
    const label2 = title2 || 'Версия 2'

    // Приводим к читаемому виду: если содержимое — JSON с секциями, разворачиваем.
    const norm1 = normalizeContent(text1)
    const norm2 = normalizeContent(text2)

    const systemPrompt = `Ты — эксперт по анализу должностных инструкций. Твоя задача — сравнить два текста должностных инструкций и выявить все различия.

Проанализируй различия и структурируй ответ в следующем формате:

## Добавленные разделы
(перечисли разделы/пункты, которые появились во втором тексте)

## Удалённые разделы
(перечисли разделы/пункты, которые были удалены во втором тексте)

## Изменённые разделы
(перечисли разделы/пункты, которые были изменены, с описанием сути изменений)

## Ключевые изменения
(перечисли наиболее значимые изменения, которые могут повлиять на суть должностной инструкции)

Если в какой-то категории нет изменений, напиши "Нет изменений".
Отвечай на русском языке. Будь конкретным и точным.`

    const userPrompt = `Сравни два текста должностных инструкций${context ? ` (контекст: ${context})` : ''}.

--- ТЕКСТ 1 (${label1}) ---
${norm1}

--- ТЕКСТ 2 (${label2}) ---
${norm2}

Проведи детальный анализ различий между этими текстами.`

    // Попытка ИИ-анализа; при отсутствии провайдера — graceful fallback на текстовый diff.
    let aiSummary: string | null = null
    try {
      const client = await getProviderClient()
      const result = await client.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
      aiSummary = result.content || null
    } catch {
      // ИИ-провайдер не настроен или недоступен — отдаём только текстовый diff.
      aiSummary = null
    }

    const diff = computeSimpleDiff(norm1.split('\n'), norm2.split('\n'))

    return NextResponse.json({
      aiSummary,
      diff,
      label1,
      label2,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('ai-text-diff error:', { error })
    return NextResponse.json(
      { error: 'Ошибка ИИ-сравнения текстов' },
      { status: 500 },
    )
  }
}

// Разворачивает JSON-секции в читаемый текст; при неудаче возвращает исходную строку.
function normalizeContent(content: string): string {
  try {
    const p = JSON.parse(content)
    const parts: string[] = []
    if (p.title) parts.push(`# ${p.title}`)
    if (Array.isArray(p.sections)) {
      for (const s of p.sections) {
        parts.push(`\n## ${s.title}`)
        if (s.content) parts.push(s.content)
      }
    }
    return parts.join('\n')
  } catch {
    return content
  }
}

// Простой построчный diff: same / added / removed / modified.
interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified'
  line1?: string
  line2?: string
}

function computeSimpleDiff(lines1: string[], lines2: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const maxLen = Math.max(lines1.length, lines2.length)
  for (let i = 0; i < maxLen; i++) {
    const a = i < lines1.length ? lines1[i] : undefined
    const b = i < lines2.length ? lines2[i] : undefined
    if (a !== undefined && b !== undefined) {
      result.push(a === b ? { type: 'same', line1: a, line2: b } : { type: 'modified', line1: a, line2: b })
    } else if (a !== undefined) {
      result.push({ type: 'removed', line1: a })
    } else if (b !== undefined) {
      result.push({ type: 'added', line2: b })
    }
  }
  return result
}
