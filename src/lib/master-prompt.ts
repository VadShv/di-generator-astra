// Утилиты работы с мастер-промптами (Фаза 5)
// Единое место для:
//   - резолва подходящего промпта по категории (generation/audit/improvement/ai_culture)
//     и критериям применимости (department/businessFunction/grade/functionType);
//   - рендера переменных {{должность}}, {{подразделение}}, {{юр_лицо}}, {{квалификация}}
//     и произвольных {{...}} из контекста позиции;
//   - извлечения списка переменных из текста промпта.
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
 * Резолвить наиболее специфичный активный промпт для заданных критериев и категории.
 * Приоритет: department+businessFunction+grade > department+businessFunction >
 *   department+grade > department > businessFunction+grade > businessFunction > grade > global.
 * @param category категория промпта (generation/audit/improvement/ai_culture)
 * @param criteria критерии применимости (все опциональны — null = «для всех»)
 */
export async function resolveMasterPrompt(
  category: PromptCategory,
  criteria: {
    departmentId?: string | null
    businessFunctionId?: string | null
    grade?: string | null
    functionType?: string | null
  } = {}
): Promise<{
  id: string
  name: string
  content: string
  category: string
  isAiCulture: boolean
  version: number
} | null> {
  const { departmentId, businessFunctionId, grade } = criteria

  // Каскад комбинаций от наиболее специфичной к глобальной.
  const combinations: Array<{
    departmentId: string | null
    businessFunctionId: string | null
    grade: string | null
  }> = []

  if (departmentId && businessFunctionId && grade) {
    combinations.push({ departmentId, businessFunctionId, grade })
  }
  if (departmentId && businessFunctionId) {
    combinations.push({ departmentId, businessFunctionId, grade: null })
  }
  if (departmentId && grade) {
    combinations.push({ departmentId, businessFunctionId: null, grade })
  }
  if (departmentId) {
    combinations.push({ departmentId, businessFunctionId: null, grade: null })
  }
  if (businessFunctionId && grade) {
    combinations.push({ departmentId: null, businessFunctionId, grade })
  }
  if (businessFunctionId) {
    combinations.push({ departmentId: null, businessFunctionId, grade: null })
  }
  if (grade) {
    combinations.push({ departmentId: null, businessFunctionId: null, grade })
  }
  combinations.push({ departmentId: null, businessFunctionId: null, grade: null })

  for (const combo of combinations) {
    const prompt = await db.masterPrompt.findFirst({
      where: {
        isActive: true,
        category,
        departmentId: combo.departmentId || null,
        businessFunctionId: combo.businessFunctionId || null,
        grade: combo.grade || null,
      },
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
export async function resolveAiCulturePrompt(criteria: {
  departmentId?: string | null
  businessFunctionId?: string | null
  grade?: string | null
} = {}): Promise<{ id: string; name: string; content: string } | null> {
  const prompt = await resolveMasterPrompt('ai_culture', criteria)
  if (!prompt) return null
  return { id: prompt.id, name: prompt.name, content: prompt.content }
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
}): Promise<void> {
  await db.masterPromptVersion.create({
    data: {
      masterPromptId: params.masterPromptId,
      version: params.version,
      content: params.content,
      description: params.description || null,
      createdBy: params.createdBy || null,
    },
  })
}
