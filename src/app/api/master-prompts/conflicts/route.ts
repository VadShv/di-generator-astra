// GET /api/master-prompts/conflicts?category=<category> (Фаза 8: Product gaps).
// Возвращает список конфликтов активных промптов — группы с одинаковыми
// критериями применимости (category + company/department/businessFunction/
// grade/functionType/position), где более одного промпта активны одновременно.
// Используется UI master-prompts для предупреждения пользователя.

import { NextRequest, NextResponse } from 'next/server'
import { detectPromptConflicts, PROMPT_CATEGORIES, type PromptCategory } from '@/lib/master-prompt'
import { withErrorHandler } from '@/lib/api-utils'

export const GET = withErrorHandler(async (request: NextRequest, scope) => {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  let parsedCategory: PromptCategory | null = null
  if (category) {
    if (!(category in PROMPT_CATEGORIES)) {
      return NextResponse.json(
        { error: `Неизвестная категория: ${category}` },
        { status: 400 }
      )
    }
    parsedCategory = category as PromptCategory
  }

  const conflicts = await detectPromptConflicts(parsedCategory)
  return NextResponse.json({ conflicts, count: conflicts.length })
}, 'master-prompts/conflicts')
