// Утилиты работы с мастер-промптами (Фаза 5 + Фаза 21)
// Единое место для:
//   - резолва подходящего промпта по категории (generation/audit/improvement/ai_culture)
//     и критериям применимости (company/department/businessFunction/grade/functionType/position);
//   - рендера переменных {{должность}}, {{подразделение}}, {{юр_лицо}}, {{квалификация}}
//     и произвольных {{...}} из контекста позиции;
//   - извлечения списка переменных из текста промпта;
//   - валидации конфликтов активных промптов (Фаза 21);
//   - учёта метрик применения промпта (Фаза 21).
// Заменяет дублированную resolveMasterPromptInternal в роутах generate-di/*.

import { db } from '@/lib/db'

/** Категории мастер-промптов (соответствуют полю MasterPrompt.category). */
export const PROMPT_CATEGORIES = {
  generation: 'Генерация ДИ',
  audit: 'Аудит',
  improvement: 'Улучшение',
  ai_culture: 'Культура ИИ',
} as const

export type PromptCategory = keyof typeof PROMPT_CATEGORIES

/** Контекст позиции для подстановки переменных в промпт. */
export interface PromptContext {
  /** Должность (название). Подставляется в {{должность}}. */
  position?: string | null
  /** Подразделение. Подставляется в {{подразделение}}. */
  department?: string | null
  /** Юридическое лицо. Подставляется в {{юр_лицо}}. */
  legalEntity?: string | null
  /** Квалификация/грейд. Подставляется в {{квалификация}}. */
  qualification?: string | null
  /** Код должности. Подставляется в {{код_должности}}. */
  positionCode?: string | null
  /** Бизнес-функция. Подставляется в {{бизнес_функция}}. */
  businessFunction?: string | null
  /** Доп. переменные (произвольные ключ → значение). */
  [key: string]: unknown
}

/**
 * Извлечь список переменных {{...}} из текста промпта.
 * Возвращает уникальные имена переменных без фигурных скобок.
 */
export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{\s*([^}]+?)\s*\}\}/g) || []
  const names = matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, '').trim())
  return Array.from(new Set(names))
}

/**
 * Подставить переменные из контекста в текст промпта.
 * Поддерживает {{должность}}, {{подразделение}}, {{юр_лицо}}, {{квалификация}},
 * {{код_должности}}, {{бизнес_функция}} и любые другие ключи из контекста.
 * Незаполненные переменные остаются как есть (или заменяются на пустую строку
 * если значение явно null).
 */
export function renderPrompt(text: string, context: PromptContext): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, key: string) => {
    const trimmedKey = key.trim()
    // Ищем значение по ключу в контексте.
    const value = context[trimmedKey]
    if (value === undefined) return full // Неизвестная переменная — оставляем.
    if (value === null) return '' // Явный null → пусто.
    return String(value)
  })
}

/**
 * Построить контекст переменных из позиции (с загруженными связями).
 * Ожидает position с include: { department: { include: { company } }, businessFunction }.
 */
export function buildContextFromPosition(position: {
  title: string
  code: string
  grade: string | null
  functions?: string | null
  department?: { name: string; company?: { name: string } | null } | null
  businessFunction?: { name: string } | null
}): PromptContext {
  return {
    position: position.title,
    должность: position.title,
    подразделение: position.department?.name || null,
    юр_лицо: position.department?.company?.name || null,
    квалификация: position.grade || null,
    код_должности: position.code,
    бизнес_функция: position.businessFunction?.name || null,
  }
}

/**
 * Оценить длину промпта в токенах (эвристика: ~4 символа = 1 токен).
 * Используется для индикатора в редакторе (Фаза 21).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/** Критерии применимости промпта (все опциональны — null = «для всех»). */
export interface PromptCriteria {
  companyId?: string | null
  departmentId?: string | null
  businessFunctionId?: string | null
  grade?: string | null
  functionType?: string | null
  positionId?: string | null
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
