import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
 import { getProviderClient } from '@/lib/ai-connector'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { ApiError, errorResponse } from '@/lib/api-utils'

import { createLogger } from '@/lib/logger'

const log = createLogger('compare-ai-diff')

// POST /api/compare/ai-diff - AI-powered comparison of two versions
export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    checkRateLimit(request, 'ai-diff', 10, 60_000, session?.user?.id)
    const body = await request.json()
    const { version1Id, version2Id } = body

    if (!version1Id || !version2Id) {
      return NextResponse.json(
        { error: 'ID обеих версий обязательны' },
        { status: 400 }
      )
    }

    // Get both versions
    const [version1, version2] = await Promise.all([
      db.dIVersion.findUnique({
        where: { id: version1Id },
        include: {
          generatedDI: {
            include: {
              position: true,
            },
          },
        },
      }),
      db.dIVersion.findUnique({
        where: { id: version2Id },
        include: {
          generatedDI: {
            include: {
              position: true,
            },
          },
        },
      }),
    ])

    if (!version1 || !version2) {
      return NextResponse.json(
        { error: 'Одна или обе версии не найдены' },
        { status: 404 }
      )
    }

    // Parse content - try JSON first, fallback to raw text
    let text1: string
    let text2: string

    try {
      const parsed1 = JSON.parse(version1.content)
      text1 = formatSectionsToText(parsed1)
    } catch {
      text1 = version1.content
    }

    try {
      const parsed2 = JSON.parse(version2.content)
      text2 = formatSectionsToText(parsed2)
    } catch {
      text2 = version2.content
    }

    // Use AI to compare versions
    const systemPrompt = `Ты — эксперт по анализу должностных инструкций. Твоя задача — сравнить две версии должностной инструкции и выявить все различия.

Проанализируй различия и структурируй ответ в следующем формате:

## Добавленные разделы
(перечисли разделы/пункты, которые появились в новой версии)

## Удалённые разделы
(перечисли разделы/пункты, которые были удалены)

## Изменённые разделы
(перечисли разделы/пункты, которые были изменены, с описанием сути изменений)

## Ключевые изменения
(перечисли наиболее значимые изменения, которые могут повлиять на суть должностной инструкции)

Если в какой-то категории нет изменений, напиши "Нет изменений".
Отвечай на русском языке. Будь конкретным и точным.`

    const userPrompt = `Сравни две версии должностной инструкции для должности "${version1.generatedDI.position.title}".

--- ВЕРСИЯ 1 (Оригинал, версия ${version1.version}) ---
${text1}

--- ВЕРСИЯ 2 (Редакция, версия ${version2.version}) ---
${text2}

Проведи детальный анализ различий между этими версиями.`

    const client = await getProviderClient()
    const result = await client.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const aiSummary = result.content || 'Не удалось сгенерировать сравнение'

    // Also do a simple line-by-line diff
    const lines1 = text1.split('\n')
    const lines2 = text2.split('\n')
    const diff = computeSimpleDiff(lines1, lines2)

    // Save diff summary to version2
    await db.dIVersion.update({
      where: { id: version2Id },
      data: { diffSummary: aiSummary },
    })

    return NextResponse.json({
      aiSummary,
      diff,
      version1: {
        id: version1.id,
        version: version1.version,
        isOriginal: version1.isOriginal,
        createdAt: version1.createdAt,
      },
      version2: {
        id: version2.id,
        version: version2.version,
        isOriginal: version2.isOriginal,
        createdAt: version2.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('AI-diff POST error:', { error })
    return NextResponse.json({ error: 'Ошибка ИИ-сравнения версий' }, { status: 500 })
  }
}

function formatSectionsToText(parsed: { title?: string; status?: string; sections?: Array<{ title: string; content: string; order: number }> }): string {
  const parts: string[] = []
  if (parsed.title) parts.push(`# ${parsed.title}`)
  if (parsed.status) parts.push(`Статус: ${parsed.status}`)
  if (parsed.sections) {
    for (const section of parsed.sections) {
      parts.push(`\n## ${section.title}`)
      parts.push(section.content)
    }
  }
  return parts.join('\n')
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified'
  line1?: string
  line2?: string
}

function computeSimpleDiff(lines1: string[], lines2: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const maxLen = Math.max(lines1.length, lines2.length)

  for (let i = 0; i < maxLen; i++) {
    const l1 = i < lines1.length ? lines1[i] : undefined
    const l2 = i < lines2.length ? lines2[i] : undefined

    if (l1 !== undefined && l2 !== undefined) {
      if (l1 === l2) {
        result.push({ type: 'same', line1: l1, line2: l2 })
      } else {
        result.push({ type: 'modified', line1: l1, line2: l2 })
      }
    } else if (l1 !== undefined) {
      result.push({ type: 'removed', line1: l1 })
    } else if (l2 !== undefined) {
      result.push({ type: 'added', line2: l2 })
    }
  }

  return result
}
