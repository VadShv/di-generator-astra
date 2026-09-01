import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  PROMPT_CATEGORIES,
  type PromptCategory,
  resolveMasterPromptWithDetails,
} from '@/lib/master-prompt'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

import { resolveMasterPromptSchema } from '@/lib/validation/schemas'

const log = createLogger('master-prompts-resolve')

// POST /api/master-prompts/resolve — resolve the best-matching active prompt
// for a given position using the UNIFIED scoring algorithm (same one used by
// generate-di routes). Returns prompt + resolution details for the UI.
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await parseBody(request, resolveMasterPromptSchema)
    const { positionId, category } = body

    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json({ error: 'ID должности обязателен' }, { status: 400 })
    }

    const position = await db.position.findUnique({
      where: { id: positionId },
      include: {
        department: { include: { company: true } },
        businessFunction: true,
      },
    })

    if (!position) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    // Optional category filter (generation/audit/improvement/ai_culture).
    const validCategory: PromptCategory | null =
      typeof category === 'string' && category in PROMPT_CATEGORIES
        ? (category as PromptCategory)
        : null

    // Build criteria from position — matches what generate-di routes pass.
    const criteria = {
      positionId: position.id,
      companyId: position.department?.companyId || null,
      departmentId: position.departmentId,
      businessFunctionId: position.businessFunctionId,
      grade: position.grade,
      functionType: position.functions || null,
    }

    if (validCategory) {
      const result = await resolveMasterPromptWithDetails(validCategory, criteria)
      if (!result) {
        return NextResponse.json({ prompt: null, resolution: null })
      }
      return NextResponse.json({
        prompt: result.prompt,
        resolution: {
          score: result.resolution.score,
          matchDetails: result.resolution.matchDetails,
          position: {
            id: position.id,
            title: position.title,
            departmentId: position.departmentId,
            departmentName: position.department?.name,
            businessFunctionId: position.businessFunctionId,
            businessFunctionName: position.businessFunction?.name,
            grade: position.grade,
            functions: position.functions,
          },
          evaluatedPrompts: result.resolution.evaluatedPrompts,
        },
      })
    }

    // No category specified — try generation first, then return first match.
    const result = await resolveMasterPromptWithDetails('generation', criteria)
    if (!result) {
      return NextResponse.json({ prompt: null, resolution: null })
    }
    return NextResponse.json({
      prompt: result.prompt,
      resolution: {
        score: result.resolution.score,
        matchDetails: result.resolution.matchDetails,
        position: {
          id: position.id,
          title: position.title,
          departmentId: position.departmentId,
          departmentName: position.department?.name,
          businessFunctionId: position.businessFunctionId,
          businessFunctionName: position.businessFunction?.name,
          grade: position.grade,
          functions: position.functions,
        },
        evaluatedPrompts: result.resolution.evaluatedPrompts,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error resolving master prompt:', { error })
    return NextResponse.json({ error: 'Ошибка при разрешении мастер-промпта' }, { status: 500 })
  }
}
