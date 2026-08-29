// Ядро генерации секций ДИ (Фаза 2).
// Общая логика для роутов ai-generate, mass-generate, ai-section, worker.
// Избавляет от дублирования цикла по секциям шаблона.

import type { AIProviderClient } from '@/lib/ai-connector'
import { buildGenerationSystemPrompt, buildSectionUserPrompt, buildArchiveContext, type ArchiveDIRef, type PositionForContext } from '@/lib/di/prompts'
import { db } from '@/lib/db'

/** Секция шаблона (минимальный набор для генерации). */
export interface TemplateSectionForGen {
  id: string
  title: string
  order: number
  promptGuidance?: string | null
  content?: string | null
}

/** Результат генерации одной секции. */
export interface GeneratedSectionResult {
  sectionTitle: string
  sectionContent: string
  order: number
  aiGenerated: boolean
}

export interface GenerateSectionsParams {
  position: PositionForContext
  templateSections: TemplateSectionForGen[]
  client: AIProviderClient
  renderedMasterPrompt: string | null
  archiveDIs: ArchiveDIRef[]
  /** Доп. контекст (например, другие секции) — опционально. */
  extraContext?: string
  /** Правовой контекст (ТК РФ, профстандарты) — опционально. */
  legalContext?: string
  /** Колбэк прогресса (выполнено, всего). */
  onProgress?: (done: number, total: number) => void
  /** Текст-заглушка при ошибке генерации секции. */
  errorPlaceholder?: string
  /** Сигнал отмены — для per-job таймаута массовой генерации. */
  signal?: AbortSignal
}

/**
 * Сгенерировать содержание для всех секций шаблона.
 * Последовательно вызывает ИИ для каждой секции.
 * При ошибке одной секции — вставляет placeholder и продолжает.
 */
export async function generateSectionsForPosition(params: GenerateSectionsParams): Promise<GeneratedSectionResult[]> {
  const {
    position,
    templateSections,
    client,
    renderedMasterPrompt,
    archiveDIs,
    extraContext,
    legalContext,
    onProgress,
    errorPlaceholder = '[Ошибка генерации секции. Пожалуйста, повторите генерацию.]',
    signal,
  } = params

  const archiveContext = buildArchiveContext(archiveDIs)
  const systemPrompt = buildGenerationSystemPrompt(position, renderedMasterPrompt, archiveContext, extraContext, legalContext)

  const results: GeneratedSectionResult[] = []
  const total = templateSections.length

  for (let i = 0; i < templateSections.length; i++) {
    const section = templateSections[i]
    const userPrompt = buildSectionUserPrompt(section)
    try {
      const result = await client.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        signal,
      })
      // Fire-and-forget: сохраняем использование токенов
      if (result.usage) {
        db.tokenUsage.create({
          data: {
            providerName: result.providerName,
            modelName: result.modelName,
            category: 'section',
            promptTokens: result.usage.promptTokens ?? 0,
            completionTokens: result.usage.completionTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          },
        }).catch(() => {})
      }
      results.push({
        sectionTitle: section.title,
        sectionContent: (result.content || '').trim(),
        order: section.order,
        aiGenerated: true,
      })
    } catch (aiError) {
      // Логируем, но продолжаем генерацию остальных секций.
      console.error(`AI generation error for section "${section.title}":`, aiError)
      results.push({
        sectionTitle: section.title,
        sectionContent: errorPlaceholder,
        order: section.order,
        aiGenerated: true,
      })
    }
    onProgress?.(i + 1, total)
  }

  return results
}

/**
 * Сгенерировать раздел «Культура ИИ» при наличии активного промпта ai_culture.
 * Возвращает секцию или null, если промпт отсутствует/генерация не удалась.
 */
export async function generateAiCultureSection(
  client: AIProviderClient,
  aiCulturePrompt: { id: string; name: string; content: string } | null,
  renderedCulturePrompt: string | null,
  signal?: AbortSignal
): Promise<GeneratedSectionResult | null> {
  if (!aiCulturePrompt || !renderedCulturePrompt) return null
  try {
    const cultureResult = await client.generate({
      messages: [
        { role: 'system', content: renderedCulturePrompt },
        {
          role: 'user',
          content:
            'Сгенерируй содержание раздела «Взаимодействие с системами ИИ» для данной должности: обязанности, ограничения и ответственность при работе с ИИ.',
        },
      ],
      signal,
    })
    // Fire-and-forget: сохраняем использование токенов
    if (cultureResult.usage) {
      db.tokenUsage.create({
        data: {
          providerName: cultureResult.providerName,
          modelName: cultureResult.modelName,
          category: 'culture',
          promptTokens: cultureResult.usage.promptTokens ?? 0,
          completionTokens: cultureResult.usage.completionTokens ?? 0,
          totalTokens: cultureResult.usage.totalTokens ?? 0,
        },
      }).catch(() => {})
    }
    return {
      sectionTitle: 'Взаимодействие с системами ИИ',
      sectionContent: (cultureResult.content || '').trim() || '[Раздел не сгенерирован]',
      order: 0, // порядок задаётся вызывающим кодом
      aiGenerated: true,
    }
  } catch (cultureError) {
    console.error('AI Culture section error:', cultureError)
    return null
  }
}
