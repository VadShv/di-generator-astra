// Чистые утилиты работы с мастер-промптами (без обращения к БД).
// Безопасно импортируется в клиентских компонентах ('use client').
// Серверные функции, использующие Prisma, живут в master-prompt.ts.

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
  /** Доп. переменные (произвольные ключ -> значение). */
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
    if (value === null) return '' // Явный null -> пусто.
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
  attributes?: { name: string }[]
}): PromptContext {
  return {
    position: position.title,
    должность: position.title,
    подразделение: position.department?.name || null,
    юр_лицо: position.department?.company?.name || null,
    квалификация: position.grade || null,
    код_должности: position.code,
    бизнес_функция: position.businessFunction?.name || null,
    признаки: position.attributes?.map(a => a.name).join(', ') || null,
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
export interface ResolvedPrompt {
  id: string
  name: string
  content: string
  category: string
  isAiCulture: boolean
  version: number
}
export interface PromptResolution {
  score: number
  matchDetails: string[]
  evaluatedPrompts: Array<{
    id: string
    name: string
    version: number
    score: number
    matchDetails: string[]
  }>
}
