// Серверные функции работы с мастер-промптами (Фаза 5 + Фаза 21).
// Чистые утилиты (extractVariables, renderPrompt, estimateTokens и др.)
// вынесены в master-prompt-shared.ts и безопасны для клиентских компонентов.
// Этот модуль импортирует Prisma и предназначен только для server-side.

import { db } from '@/lib/db'
import {
  PROMPT_CATEGORIES,
  type PromptCategory,
  type PromptContext,
  type PromptCriteria,
  type ResolvedPrompt,
  type PromptResolution,
  extractVariables,
  renderPrompt,
  buildContextFromPosition,
  estimateTokens,
} from '@/lib/master-prompt-shared'

// Re-export pure utilities and types for server consumers.
export {
  PROMPT_CATEGORIES,
  type PromptCategory,
  type PromptContext,
  type PromptCriteria,
  type ResolvedPrompt,
  type PromptResolution,
  extractVariables,
  renderPrompt,
  buildContextFromPosition,
  estimateTokens,
}

/**
 * Резолвить наиболее специфичный активный промпт для заданных критериев и категории.
 *
 * Приоритет (от наиболее специфичного к глобальной):
 *   position → company+department+businessFunction+grade+functionType → ...
 *   → department+businessFunction+grade → department+businessFunction →
 *   department+grade → department → businessFunction+grade → businessFunction →
 *   grade → global.
 *
 * ВНИМАНИЕ: для обратной совместимости функция фильтрует по companyId/functionType/positionId
 * только если они переданы; старые вызовы без этих полей работают как прежде.
 *
 * @param category категория промпта (generation/audit/improvement/ai_culture)
 * @param criteria критерии применимости (все опциональны — null = «для всех»)
 */
export async function resolveMasterPrompt(
  category: PromptCategory,
  criteria: PromptCriteria = {}
): Promise<{
  id: string
  name: string
  content: string
  category: string
  isAiCulture: boolean
  version: number
} | null> {
  const { companyId, departmentId, businessFunctionId, grade, functionType, positionId } = criteria

  // Базовый фильтр, общий для всех комбинаций: категория + активность.
  // Привязка к конкретной должности — наиболее специфичный уровень: если задан
  // positionId, сначала ищем промпт, привязанный к этой должности.
  if (positionId) {
    const byPosition = await db.masterPrompt.findFirst({
      where: {
        isActive: true,
        category,
        positionId,
      },
      orderBy: { version: 'desc' },
    })
    if (byPosition) {
      return {
        id: byPosition.id,
        name: byPosition.name,
        content: byPosition.content,
        category: byPosition.category,
        isAiCulture: byPosition.isAiCulture,
        version: byPosition.version,
      }
    }
  }

  // Каскад комбинаций от наиболее специфичной к глобальной.
  // Каждая комбинация — набор значений departmentId/businessFunctionId/grade.
  // companyId и functionType учитываются как дополнительные фильтры, если заданы.
  const combos: Array<{
    departmentId: string | null
    businessFunctionId: string | null
    grade: string | null
  }> = []

  if (departmentId && businessFunctionId && grade) {
    combos.push({ departmentId, businessFunctionId, grade })
  }
  if (departmentId && businessFunctionId) {
    combos.push({ departmentId, businessFunctionId, grade: null })
  }
  if (departmentId && grade) {
    combos.push({ departmentId, businessFunctionId: null, grade })
  }
  if (departmentId) {
    combos.push({ departmentId, businessFunctionId: null, grade: null })
  }
  if (businessFunctionId && grade) {
    combos.push({ departmentId: null, businessFunctionId, grade })
  }
  if (businessFunctionId) {
    combos.push({ departmentId: null, businessFunctionId, grade: null })
  }
  if (grade) {
    combos.push({ departmentId: null, businessFunctionId: null, grade })
  }
  combos.push({ departmentId: null, businessFunctionId: null, grade: null })

  for (const combo of combos) {
    const where: Record<string, unknown> = {
      isActive: true,
      category,
      departmentId: combo.departmentId || null,
      businessFunctionId: combo.businessFunctionId || null,
      grade: combo.grade || null,
    }
    // Дополнительные фильтры применимости (Фаза 21): юр. лицо и тип функции.
    if (companyId) where.companyId = companyId
    if (functionType) where.functionType = functionType

    const prompt = await db.masterPrompt.findFirst({
      where,
      orderBy: { version: 'desc' },
    })
    if (prompt) {
      return {
        id: prompt.id,
        name: prompt.name,
        content: prompt.content,
        category: prompt.category,
        isAiCulture: prompt.isAiCulture,
        version: prompt.version,
      }
    }
  }

  return null
}

/**
 * Score a single prompt against position criteria (unified algorithm).
 * Returns { score, matchDetails } or { score: -1 } if hard-mismatch.
 * This is the SINGLE source of truth for prompt matching — used by both
 * /api/master-prompts/resolve (UI resolver) and generate-di routes.
 */
function scorePromptAgainstCriteria(
  prompt: {
    departmentId: string | null
    businessFunctionId: string | null
    grade: string | null
    functionType: string | null
    companyId: string | null
    positionId: string | null
  },
  criteria: PromptCriteria,
): { score: number; matchDetails: string[] } {
  let score = 0
  const matchDetails: string[] = []

  // Company match (highest priority — scope isolation)
  if (prompt.companyId && criteria.companyId) {
    if (prompt.companyId === criteria.companyId) {
      score += 10000
      matchDetails.push('Юр. лицо')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.companyId !== null && criteria.companyId !== prompt.companyId) {
    return { score: -1, matchDetails: [] }
  }

  // Position match (most specific)
  if (prompt.positionId && criteria.positionId) {
    if (prompt.positionId === criteria.positionId) {
      score += 5000
      matchDetails.push('Должность')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.positionId !== null && criteria.positionId !== prompt.positionId) {
    return { score: -1, matchDetails: [] }
  }

  // Department match
  if (prompt.departmentId && criteria.departmentId) {
    if (prompt.departmentId === criteria.departmentId) {
      score += 1000
      matchDetails.push('Подразделение')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.departmentId !== null && criteria.departmentId !== prompt.departmentId) {
    return { score: -1, matchDetails: [] }
  }

  // Business function match
  if (prompt.businessFunctionId && criteria.businessFunctionId) {
    if (prompt.businessFunctionId === criteria.businessFunctionId) {
      score += 100
      matchDetails.push('Бизнес-функция')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.businessFunctionId !== null && criteria.businessFunctionId !== prompt.businessFunctionId) {
    return { score: -1, matchDetails: [] }
  }

  // Grade match
  if (prompt.grade && criteria.grade) {
    if (prompt.grade === criteria.grade) {
      score += 10
      matchDetails.push('Грейд')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.grade !== null && criteria.grade !== null && prompt.grade !== criteria.grade) {
    return { score: -1, matchDetails: [] }
  }

  // Function type match: prompt.functionType is a single string,
  // criteria.functionType can be a single string or JSON array.
  if (prompt.functionType && criteria.functionType) {
    let matches = false
    try {
      const parsed = JSON.parse(criteria.functionType)
      if (Array.isArray(parsed)) {
        matches = parsed.includes(prompt.functionType)
      } else {
        matches = prompt.functionType === criteria.functionType
      }
    } catch {
      matches = prompt.functionType === criteria.functionType
    }
    if (matches) {
      score += 1
      matchDetails.push('Функция')
    } else {
      return { score: -1, matchDetails: [] }
    }
  } else if (prompt.functionType !== null && !criteria.functionType) {
    return { score: -1, matchDetails: [] }
  }

  return { score, matchDetails }
}

/**
 * Unified prompt resolver: returns the best-matching active prompt plus
 * resolution details (score, matchDetails, evaluated list).
 * This replaces the divergent scoring in /api/master-prompts/resolve.
 */
export async function resolveMasterPromptWithDetails(
  category: PromptCategory,
  criteria: PromptCriteria = {},
): Promise<{ prompt: ResolvedPrompt; resolution: PromptResolution } | null> {
  const where: Record<string, unknown> = { isActive: true, category }
  if (criteria.positionId) where.positionId = criteria.positionId
  if (criteria.companyId) where.companyId = criteria.companyId

  const active = await db.masterPrompt.findMany({
    where,
    select: {
      id: true,
      name: true,
      content: true,
      category: true,
      isAiCulture: true,
      version: true,
      departmentId: true,
      businessFunctionId: true,
      grade: true,
      functionType: true,
      companyId: true,
      positionId: true,
    },
    orderBy: { version: 'desc' },
  })

  if (active.length === 0) return null

  const scored = active.map((p) => {
    const { score, matchDetails } = scorePromptAgainstCriteria(p, criteria)
    return { prompt: p, score, matchDetails }
  })

  const matching = scored.filter((s) => s.score >= 0)
  if (matching.length === 0) return null

  matching.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.prompt.version - a.prompt.version
  })

  const best = matching[0]
  return {
    prompt: {
      id: best.prompt.id,
      name: best.prompt.name,
      content: best.prompt.content,
      category: best.prompt.category,
      isAiCulture: best.prompt.isAiCulture,
      version: best.prompt.version,
    },
    resolution: {
      score: best.score,
      matchDetails: best.matchDetails,
      evaluatedPrompts: matching.map((m) => ({
        id: m.prompt.id,
        name: m.prompt.name,
        version: m.prompt.version,
        score: m.score,
        matchDetails: m.matchDetails,
      })),
    },
  }
}

/**
 * Резолвить промпт «Культура ИИ» (category=ai_culture, isAiCulture=true).
 * Используется для автоматического добавления в ДИ раздела
 * «Взаимодействие с системами ИИ».
 */
export async function resolveAiCulturePrompt(criteria: PromptCriteria = {}): Promise<{ id: string; name: string; content: string } | null> {
  const prompt = await resolveMasterPrompt('ai_culture', criteria)
  if (!prompt) return null
  return { id: prompt.id, name: prompt.name, content: prompt.content }
}

/**
 * Обнаружить конфликты активных промптов (Фаза 21).
 *
 * Конфликт — два и более активных промпта одной категории с одинаковым набором
 * условий применимости (companyId, departmentId, businessFunctionId, grade,
 * functionType, positionId). При резолве такие промпты создают неоднозначность.
 *
 * @param category категория для проверки (если null — по всем категориям)
 * @returns список групп конфликтующих промптов
 */
export async function detectPromptConflicts(category?: PromptCategory | null): Promise<
  Array<{
    category: string
    criteria: PromptCriteria
    prompts: Array<{ id: string; name: string; version: number }>
  }>
> {
  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = category

  const active = await db.masterPrompt.findMany({
    where,
    select: {
      id: true,
      name: true,
      version: true,
      category: true,
      companyId: true,
      departmentId: true,
      businessFunctionId: true,
      grade: true,
      functionType: true,
      positionId: true,
    },
  })

  // Группировка по (category + набор критериев).
  const groups: Record<string, { category: string; criteria: PromptCriteria; prompts: Array<{ id: string; name: string; version: number }> }> = {}
  for (const p of active) {
    const key = JSON.stringify({
      category: p.category,
      companyId: p.companyId || null,
      departmentId: p.departmentId || null,
      businessFunctionId: p.businessFunctionId || null,
      grade: p.grade || null,
      functionType: p.functionType || null,
      positionId: p.positionId || null,
    })
    if (!groups[key]) {
      groups[key] = {
        category: p.category,
        criteria: {
          companyId: p.companyId || null,
          departmentId: p.departmentId || null,
          businessFunctionId: p.businessFunctionId || null,
          grade: p.grade || null,
          functionType: p.functionType || null,
          positionId: p.positionId || null,
        },
        prompts: [],
      }
    }
    groups[key].prompts.push({ id: p.id, name: p.name, version: p.version })
  }

  // Конфликты — группы с более чем одним промптом.
  return Object.values(groups).filter((g) => g.prompts.length > 1)
}

/**
 * Инкрементировать счётчик применений промпта (Фаза 21).
 * Вызывается при генерации ДИ для учёта метрик.
 */
export async function incrementPromptUsage(promptId: string): Promise<void> {
  try {
    await db.masterPrompt.update({
      where: { id: promptId },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })
  } catch {
    // silent — метрики не должны ломать генерацию
  }
}

/**
 * Создать snapshot версии промпта в MasterPromptVersion.
 * Вызывается при создании/обновлении промпта для сохранения истории.
 */
export async function savePromptVersion(params: {
  masterPromptId: string
  version: number
  content: string
  description?: string | null
  createdBy?: string | null
  diff?: string | null
}): Promise<void> {
  await db.masterPromptVersion.create({
    data: {
      masterPromptId: params.masterPromptId,
      version: params.version,
      content: params.content,
      description: params.description || null,
      createdBy: params.createdBy || null,
      diff: params.diff || null,
    },
  })
}
