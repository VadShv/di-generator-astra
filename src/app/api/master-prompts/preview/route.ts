import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  renderPrompt,
  extractVariables,
  estimateTokens,
  buildContextFromPosition,
  type PromptContext,
} from '@/lib/master-prompt'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

import { previewMasterPromptSchema } from '@/lib/validation/schemas'

const log = createLogger('master-prompts-preview')

// POST /api/master-prompts/preview — предпросмотр рендера промпта с подставленными
// переменными без обращения к ИИ-модели (Фаза 4/5).
// Тело: { masterPromptId?, content?, positionId?, variables?: Record<string,string> }
// Если передан content (а не masterPromptId) — рендерим переданный текст
// (для live-предпросмотра в редакторе).
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await parseBody(request, previewMasterPromptSchema)
    const { masterPromptId, content, positionId, variables } = body

    // Определяем исходный текст промпта.
    let rawContent: string
    let promptName: string | null = null

    if (typeof content === 'string' && content.trim()) {
      rawContent = content
    } else if (masterPromptId && typeof masterPromptId === 'string') {
      const prompt = await db.masterPrompt.findUnique({ where: { id: masterPromptId } })
      if (!prompt) {
        return NextResponse.json({ error: 'Мастер-промпт не найден' }, { status: 404 })
      }
      rawContent = prompt.content
      promptName = prompt.name
    } else {
      return NextResponse.json({ error: 'Требуется content или masterPromptId' }, { status: 400 })
    }

    // Строим контекст переменных.
    let context: PromptContext = {}
    if (positionId) {
      const position = await db.position.findUnique({
        where: { id: positionId },
        include: {
          department: { include: { company: true } },
          businessFunction: true,
        },
      })
      if (position) {
        context = buildContextFromPosition(position)
      }
    }
    if (variables && typeof variables === 'object') {
      for (const [key, value] of Object.entries(variables)) {
        context[key] = value
      }
    }

    const renderedContent = renderPrompt(rawContent, context)
    if (renderedContent.length > 200_000) {
      return NextResponse.json({ error: 'Размер отрендеренного промпта превышает лимит (200 000 символов)' }, { status: 413 })
    }
    const detectedVariables = extractVariables(rawContent)
    // Незаполненные переменные остаются в виде {{...}} после рендера.
    const unfilledVariables = extractVariables(renderedContent)

    return NextResponse.json({
      promptName,
      rawContent,
      renderedContent,
      detectedVariables,
      unfilledVariables,
      estimatedTokens: estimateTokens(renderedContent),
      context,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('MasterPrompts preview error:', { error })
    return NextResponse.json({ error: 'Ошибка предпросмотра промпта' }, { status: 500 })
  }
}
