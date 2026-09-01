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
