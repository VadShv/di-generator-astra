import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
 import { getProviderClient } from '@/lib/ai-connector'
 import { resolveMasterPrompt, renderPrompt, buildContextFromPosition } from '@/lib/master-prompt'

// POST /api/generate-di/ai-section - Generate a SINGLE section with AI
// Supports two modes:
// 1. Existing DI: { generatedDIId, sectionOrder, customPrompt }
// 2. Manual mode: { positionId, sectionTitle, sectionOrder, promptGuidance, manualMode: true, positionContext }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { generatedDIId, sectionOrder, customPrompt, manualMode, positionId, sectionTitle, promptGuidance, positionContext } = body

    // ===== MANUAL MODE: Generate section for a new/manual DI without a DB record =====
    if (manualMode && positionId) {
      const position = await db.position.findUnique({
        where: { id: positionId },
        include: { department: true, businessFunction: true, project: true },
      })

      if (!position) {
        return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
      }

      // Resolve master prompt
      const masterPrompt = await resolveMasterPrompt('generation', {
        departmentId: position.departmentId,
        businessFunctionId: position.businessFunctionId,
        grade: position.grade,
      })
      const renderedMasterPrompt = masterPrompt
        ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
        : null

      // Get archive DIs as reference
      const archiveDIs = await db.archiveDI.findMany({
        where: { positionId },
        orderBy: { uploadedAt: 'desc' },
        take: 3,
      })

      const archiveContext = archiveDIs.length > 0
        ? archiveDIs.map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`).join('\n\n')
        : 'Архивные ДИ для данной должности отсутствуют.'

      const posContext = `Должность: ${position.title}
Код должности: ${position.code}
Подразделение: ${position.department.name}
Грейд: ${position.grade || 'Не указан'}
Бизнес-функция: ${position.businessFunction?.name || 'Не указана'}
Проект: ${position.project?.name || 'Не указан'}
Количество штатных единиц: ${position.headcount}
${position.functions ? `Выполняемые функции: ${position.functions}` : ''}`

      const systemPrompt = `Ты — эксперт по созданию должностных инструкций для компании Группа Астра.
Ты создаёшь профессиональные, подробные и формально корректные должностные инструкции на русском языке в соответствии с требованиями трудового законодательства РФ.

${renderedMasterPrompt ? `МАСТЕР-ПРОМПТ (основные правила и стиль):
${renderedMasterPrompt}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${posContext}

АРХИВНЫЕ ДИ (для справки):
${archiveContext}

ПРАВИЛА:
- Генерируй содержание только для указанной секции
- Используй формально-деловой стиль
- Учитывай специфику должности и подразделения
- При наличии архивных ДИ, ориентируйся на их стиль и структуру
- Формулируй чётко и недвусмысленно
- Используй нумерованные списки где уместно
- Не добавляй заголовок секции в начало текста — только содержание`

      const title = sectionTitle || 'Секция'
      let userPrompt = `Сгенерируй содержание секции "${title}" для должностной инструкции.`
      
      if (promptGuidance) {
        userPrompt += `\nРуководство для генерации: ${promptGuidance}`
      }

      userPrompt += '\n\nСгенерируй подробное, профессиональное содержание для этой секции.'

      const client = await getProviderClient()
      const result = await client.generate({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })

      const response = result.content || ''

      // Return the generated content (don't save to DB yet - manual mode)
      return NextResponse.json({
        content: response.trim(),
        sectionTitle: title,
        sectionOrder: sectionOrder || 0,
        aiGenerated: true,
      })
    }

    // ===== EXISTING DI MODE: Generate section for an existing GeneratedDI =====
    if (!generatedDIId || typeof generatedDIId !== 'string') {
      return NextResponse.json({ error: 'ID сгенерированной ДИ обязателен (или используйте manualMode)' }, { status: 400 })
    }

    if (sectionOrder === undefined || sectionOrder === null || typeof sectionOrder !== 'number') {
      return NextResponse.json({ error: 'Порядковый номер секции обязателен' }, { status: 400 })
    }

    // Get the generated DI with all data
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
      include: {
        position: { include: { department: true, businessFunction: true, project: true } },
        template: { include: { sections: { orderBy: { order: 'asc' } } } },
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!generatedDI) {
      return NextResponse.json({ error: 'Сгенерированная ДИ не найдена' }, { status: 404 })
    }

    // Find the specific section
    const section = generatedDI.sections.find((s) => s.order === sectionOrder)
    if (!section) {
      return NextResponse.json({ error: 'Секция не найдена' }, { status: 404 })
    }

    // Find the corresponding template section for guidance
    const templateSection = generatedDI.template?.sections.find((s) => s.title === section.sectionTitle)

    // Resolve master prompt
    const masterPrompt = await resolveMasterPrompt('generation', {
      departmentId: generatedDI.position.departmentId,
      businessFunctionId: generatedDI.position.businessFunctionId,
      grade: generatedDI.position.grade,
    })
    const renderedMasterPrompt = masterPrompt
      ? renderPrompt(masterPrompt.content, buildContextFromPosition(generatedDI.position))
      : null

    // Get archive DIs as reference
    const archiveDIs = await db.archiveDI.findMany({
      where: { positionId: generatedDI.positionId },
      orderBy: { uploadedAt: 'desc' },
      take: 3,
    })

    const archiveContext = archiveDIs.length > 0
      ? archiveDIs.map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`).join('\n\n')
      : 'Архивные ДИ для данной должности отсутствуют.'

    const posContext = `Должность: ${generatedDI.position.title}
Код должности: ${generatedDI.position.code}
Подразделение: ${generatedDI.position.department.name}
Грейд: ${generatedDI.position.grade || 'Не указан'}
Бизнес-функция: ${generatedDI.position.businessFunction?.name || 'Не указана'}
Проект: ${generatedDI.position.project?.name || 'Не указан'}
Количество штатных единиц: ${generatedDI.position.headcount}
${generatedDI.position.functions ? `Выполняемые функции: ${generatedDI.position.functions}` : ''}`

    // Build context of other sections
    const otherSections = generatedDI.sections
      .filter((s) => s.order !== sectionOrder)
      .map((s) => `=== ${s.sectionTitle} ===\n${s.sectionContent.substring(0, 500)}...`)
      .join('\n\n')

    const systemPrompt = `Ты — эксперт по созданию должностных инструкций для компании Группа Астра.
Ты создаёшь профессиональные, подробные и формально корректные должностные инструкции на русском языке.

${renderedMasterPrompt ? `МАСТЕР-ПРОМПТ:
${renderedMasterPrompt}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${posContext}

АРХИВНЫЕ ДИ:
${archiveContext}

ДРУГИЕ СЕКЦИИ ЭТОЙ ДИ (для контекста):
${otherSections || 'Другие секции ещё не сгенерированы.'}

ПРАВИЛА:
- Генерируй содержание только для указанной секции
- Обеспечь согласованность с другими секциями ДИ
- Используй формально-деловой стиль
- Не добавляй заголовок секции в начало текста`

    let userPrompt = `Сгенерируй содержание секции "${section.sectionTitle}" для должностной инструкции.`
    
    if (templateSection?.promptGuidance) {
      userPrompt += `\nРуководство для генерации: ${templateSection.promptGuidance}`
    }

    if (customPrompt && typeof customPrompt === 'string' && customPrompt.trim()) {
      userPrompt += `\n\nДополнительные указания пользователя: ${customPrompt.trim()}`
    }

    userPrompt += '\n\nСгенерируй подробное, профессиональное содержание для этой секции.'

    // Вызов ИИ через универсальный коннектор.
    const client = await getProviderClient()
    const result = await client.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const response = result.content || ''

    // Update the section in the database
    const updatedSection = await db.generatedDISection.update({
      where: { id: section.id },
      data: {
        sectionContent: response.trim(),
        aiGenerated: true,
        editedBy: null,
      },
    })

    return NextResponse.json(updatedSection)
  } catch (error) {
    console.error('AI Section error:', error)
   return NextResponse.json({ error: 'Ошибка AI-генерации секции' }, { status: 500 })
 }
}
