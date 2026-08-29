import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition, incrementPromptUsage } from '@/lib/master-prompt'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { aiImproveSchema, type magicWandPresetSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { buildPositionContext } from '@/lib/di/prompts'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import type { z } from 'zod'

const log = createLogger('generate-di/ai-improve')

/** Системные промпты для пресетов Magic Wand. */
const PRESET_PROMPTS: Record<z.infer<typeof magicWandPresetSchema>, string> = {
  detail: 'Усиль детализацию: добавь конкретные примеры выполнения, критерии качества, используемые информационные системы и нормативные документы. Сохрани структуру нумерованного списка.',
  shorten: 'Сократи текст на 25–35%, сохранив полный смысл и все ключевые обязанности. Удали повторы, избыточные вводные фразы и канцеляризмы.',
  formalize: 'Перепиши текст в строго формально-деловом стиле. Убери разговорные и эмоциональные обороты. Используй терминологию трудового законодательства РФ.',
  simplify: 'Перепиши простым и понятным языком. Каждый пункт — одним коротким предложением. Убери канцеляризмы и сложные конструкции.',
  kpi: 'Добавь к каждой обязанности измеримый показатель эффективности (KPI) или критерий оценки результата. KPI должны быть конкретными, достижимыми и измеримыми.',
  style: 'Приведи текст к единому корпоративному стилю должностных инструкций Группы Астра: формально-деловой язык, чёткая структура, недвусмысленные формулировки, нумерованные пункты.',
}

// POST /api/generate-di/ai-improve - Improve existing section content with AI
export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth()
  checkRateLimit(request, 'ai-improve', 20, 60_000, session?.user?.id)
  const body = await parseBody(request, aiImproveSchema)
  const { sectionId, instruction, preset } = body

  // Формируем финальную инструкцию: пресет + пользовательская инструкция
  const finalInstruction = preset
    ? `${PRESET_PROMPTS[preset]}${instruction ? `\n\nДополнительные указания: ${instruction}` : ''}`
    : instruction!

  // Get the section
  const section = await db.generatedDISection.findUnique({
    where: { id: sectionId },
    include: {
      generatedDI: {
        include: {
          position: { include: { department: { include: { company: true } }, businessFunction: true, project: true } },
        },
      },
    },
  })

  if (!section) {
    return NextResponse.json({ error: 'Секция не найдена' }, { status: 404 })
  }
  if (!section.sectionContent || section.sectionContent.trim() === '') {
    return NextResponse.json({ error: 'Секция пуста, улучшение невозможно' }, { status: 400 })
  }

  const positionContext = buildPositionContext(section.generatedDI.position)

  const systemPrompt = `Ты — эксперт по созданию и улучшению должностных инструкций для компании Группа Астра.
Ты работаешь с существующим текстом секции должностной инструкции и улучшаешь его по указанию пользователя.

КОНТЕКСТ:
${positionContext}
Секция: ${section.sectionTitle}

ПРАВИЛА:
- Улучшай только указанную секцию, сохраняя её общую структуру и смысл
- Следуй инструкции пользователя точно
- Сохраняй формально-деловой стиль
- Не добавляй заголовок секции в начало текста
- Возвращай только улучшенный текст без пояснений`

  const improvePrompt = await resolveMasterPrompt('improvement', {
    departmentId: section.generatedDI.position.departmentId,
    businessFunctionId: section.generatedDI.position.businessFunctionId,
    grade: section.generatedDI.position.grade,
  })
  const renderedImprovePrompt = improvePrompt
    ? renderPrompt(improvePrompt.content, buildContextFromPosition(section.generatedDI.position))
    : null
  if (improvePrompt) await incrementPromptUsage(improvePrompt.id)

  const userPrompt = `Текущий текст секции "${section.sectionTitle}":

${section.sectionContent}

Инструкция по улучшению: ${finalInstruction.trim()}

Верни улучшенный текст секции.`

  const client = await getProviderClient()
  const result = await client.generate({
    messages: [
      { role: 'system', content: renderedImprovePrompt ? `${systemPrompt}\n\nПРОМПТ УЛУЧШЕНИЯ:\n${renderedImprovePrompt}` : systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const response = result.content || ''

  const updatedSection = await db.generatedDISection.update({
    where: { id: sectionId },
    data: {
      sectionContent: response.trim(),
      editedBy: preset ? `magic-wand:${preset}` : 'ai-improve',
    },
  })

  log.info('Section improved', { sectionId, preset: preset ?? null, hasCustomInstruction: Boolean(instruction) })
  return NextResponse.json({ ...updatedSection, preset: preset ?? null })
}, 'generate-di/ai-improve')
