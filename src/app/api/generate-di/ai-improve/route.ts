import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition, incrementPromptUsage } from '@/lib/master-prompt'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { aiImproveSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { buildPositionContext } from '@/lib/di/prompts'

const log = createLogger('generate-di/ai-improve')

// POST /api/generate-di/ai-improve - Improve existing section content with AI
export const POST = withErrorHandler(async (request: Request) => {
  const body = await parseBody(request, aiImproveSchema)
  const { sectionId, instruction } = body

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

Инструкция по улучшению: ${instruction.trim()}

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
      editedBy: 'ai-improve',
    },
  })

  log.info('Section improved', { sectionId })
  return NextResponse.json(updatedSection)
}, 'generate-di/ai-improve')
