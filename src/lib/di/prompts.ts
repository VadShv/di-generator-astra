// Общие билдеры промптов для генерации ДИ (Фаза 2).
// Выносит дублирующуюся логику построения positionContext / systemPrompt / archiveContext
// из роутов generate-di/* (раньше дублировалось в 5-7 местах).

/** Позиция с загруженными связями (минимальный набор, нужный для контекста). */
export interface PositionForContext {
  title: string
  code: string
  grade: string | null
  headcount?: number
  functions?: string | null
  department?: { name: string; code?: string; company?: { name: string } | null } | null
  businessFunction?: { name: string } | null
  project?: { name: string } | null
  attributes?: { name: string; promptAddition: string }[]
}

/** Построить текстовый контекст должности для промпта. */
export function buildPositionContext(position: PositionForContext): string {
  const lines = [
    `Должность: ${position.title}`,
    `Код должности: ${position.code}`,
    `Подразделение: ${position.department?.name ?? 'Не указано'}`,
    `Грейд: ${position.grade ?? 'Не указан'}`,
    `Бизнес-функция: ${position.businessFunction?.name ?? 'Не указана'}`,
    `Проект: ${position.project?.name ?? 'Не указан'}`,
  ]
  if (typeof position.headcount === 'number') {
    lines.push(`Количество штатных единиц: ${position.headcount}`)
  }
  if (position.functions) {
    lines.push(`Выполняемые функции: ${position.functions}`)
  }
  if (position.attributes && position.attributes.length > 0) {
    lines.push('ДОПОЛНИТЕЛЬНЫЕ ОБЯЗАННОСТИ (обязательно включить в ДИ):')
    for (const attr of position.attributes) {
      lines.push(`— ${attr.name}: ${attr.promptAddition}`)
    }
  }
  return lines.join('\n')
}

/** Архивная ДИ как референс. */
export interface ArchiveDIRef {
  title: string
  content: string
}

/** Построить блок контекста архивных ДИ для промпта. */
export function buildArchiveContext(archiveDIs: ArchiveDIRef[]): string {
  if (archiveDIs.length === 0) return 'Архивные ДИ для данной должности отсутствуют.'
  return archiveDIs
    .map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`)
    .join('\n\n')
}

/**
 * Построить системный промпт для генерации секций ДИ.
 * @param position контекст должности
 * @param renderedMasterPrompt отрендеренный мастер-промпт категории generation (или null)
 * @param archiveContext блок архивных ДИ
 * @param extraContext доп. контекст (например, другие секции) — вставляется перед ПРАВИЛА
 */
export function buildGenerationSystemPrompt(
  position: PositionForContext,
  renderedMasterPrompt: string | null,
  archiveContext: string,
  extraContext?: string
): string {
  return `Ты — эксперт по созданию должностных инструкций для компании Группа Астра.
Ты создаёшь профессиональные, подробные и формально корректные должностные инструкции на русском языке в соответствии с требованиями трудового законодательства РФ.

${renderedMasterPrompt ? `МАСТЕР-ПРОМПТ (основные правила и стиль):\n${renderedMasterPrompt}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${buildPositionContext(position)}

АРХИВНЫЕ ДИ (для справки):
${archiveContext}
${extraContext ? `\n${extraContext}\n` : ''}
ПРАВИЛА:
- Генерируй содержание только для указанной секции
- Используй формально-деловой стиль
- Учитывай специфику должности и подразделения
- При наличии архивных ДИ, ориентируйся на их стиль и структуру
- Формулируй чётко и недвусмысленно
- Используй нумерованные списки где уместно
- Не добавляй заголовок секции в начало текста — только содержание`
}

/** Построить user-промпт для генерации одной секции по шаблону. */
export function buildSectionUserPrompt(section: {
  title: string
  promptGuidance?: string | null
  content?: string | null
}): string {
  let prompt = `Сгенерируй содержание секции "${section.title}" для должностной инструкции.`
  if (section.promptGuidance) {
    prompt += `\nРуководство для генерации: ${section.promptGuidance}`
  }
  if (section.content) {
    prompt += `\nПримерное содержание/шаблон: ${section.content}`
  }
  prompt += '\n\nСгенерируй подробное, профессиональное содержание для этой секции.'
  return prompt
}
