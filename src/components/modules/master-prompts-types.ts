// Типы для модуля мастер-промптов (Фаза 21).
// Вынесены в отдельный файл для переиспользования между компонентами.

export interface Department { id: string; name: string; code: string }
export interface BusinessFunctionItem { id: string; name: string }
export interface CompanyItem { id: string; name: string }
export interface AIProviderItem { id: string; name: string; type: string; isActive: boolean }
export interface MasterPrompt {
  id: string; name: string; content: string; version: number; isActive: boolean
  category: string; isAiCulture: boolean; variables: string
  departmentId: string | null; department: Department | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  grade: string | null; functionType: string | null; description: string | null
  companyId: string | null; company: CompanyItem | null
  positionId: string | null; position: { id: string; title: string } | null
  tags: string; estimatedTokens: number | null; useCount: number; lastUsedAt: string | null
  createdAt: string; updatedAt: string
}
export interface Position {
  id: string; title: string; code: string; departmentId: string; department: Department
  grade: string | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  projectId: string | null; project: { id: string; name: string } | null
  functions: string | null
}
export interface PromptChain {
  id: string; name: string; description: string | null
  steps: Array<{ category: string; order: number; stopOnError?: boolean }>
  isActive: boolean; createdAt: string; updatedAt: string
}
export interface PromptTestResultItem {
  id: string; masterPromptId: string; positionId: string | null; providerId: string | null
  response: string; durationMs: number; rating: number | null; createdAt: string
}
export interface PromptGroup { name: string; prompts: MasterPrompt[]; activeVersion: MasterPrompt | undefined; latestVersion: MasterPrompt }

export const gradeLabel = (grade: string | null): string | null => {
  if (!grade) return null
  if (grade === 'линейная') return 'Линейная'
  if (grade === 'руководитель') return 'Руководитель'
  return grade
}

// Распарсить JSON-массив тегов из строки.
export const parseTags = (tagsJson: string | null | undefined): string[] => {
  if (!tagsJson) return []
  try {
    const parsed = JSON.parse(tagsJson)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

// Метка типа провайдера.
export const providerTypeLabel = (type: string): string => {
  const map: Record<string, string> = {
    openai_compatible: 'OpenAI-compatible', yandex_cloud: 'Yandex Cloud', cloud: 'Cloud.ru',
    ollama: 'Ollama', zai: 'Встроенный (ZAI)',
  }
  return map[type] || type
}

// Стандартные переменные, доступные в промптах.
export const STANDARD_VARIABLES = [
  { name: 'должность', desc: 'Название должности' },
  { name: 'подразделение', desc: 'Название подразделения' },
  { name: 'юр_лицо', desc: 'Название компании' },
  { name: 'квалификация', desc: 'Грейд / квалификация' },
  { name: 'код_должности', desc: 'Код должности' },
  { name: 'бизнес_функция', desc: 'Бизнес-функция' },
]
