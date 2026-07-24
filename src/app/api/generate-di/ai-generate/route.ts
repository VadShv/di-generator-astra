import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/generate-di/ai-generate - Full AI generation of DI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { positionId, templateId } = body

    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json({ error: 'ID должности обязателен' }, { status: 400 })
    }

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json({ error: 'ID шаблона обязателен' }, { status: 400 })
    }

    // a) Get the position info (with department, business function, project)
    const position = await db.position.findUnique({
      where: { id: positionId },
      include: { department: true, businessFunction: true, project: true },
    })
    if (!position) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    // b) Resolve the applicable master prompt
    const masterPrompt = await resolveMasterPromptInternal(
      position.departmentId,
      position.businessFunctionId,
      position.grade
    )

    // c) Get the template with sections
    const template = await db.dITemplate.findUnique({
      where: { id: templateId },
      include: { sections: { orderBy: { order: 'asc' } } },
    })
    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    if (!template.sections || template.sections.length === 0) {
      return NextResponse.json({ error: 'Шаблон не содержит секций' }, { status: 400 })
    }

    // d) Get any archive DIs for this position (as reference)
    const archiveDIs = await db.archiveDI.findMany({
      where: { positionId },
      orderBy: { uploadedAt: 'desc' },
      take: 3, // Limit to 3 most recent
    })

    const archiveContext = archiveDIs.length > 0
      ? archiveDIs.map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`).join('\n\n')
      : 'Архивные ДИ для данной должности отсутствуют.'

    // e) Initialize AI
    const zai = await ZAI.create()

    // Build common context
    const positionContext = `Должность: ${position.title}
Код должности: ${position.code}
Подразделение: ${position.department.name}
Код подразделения: ${position.department.code}
Грейд: ${position.grade || 'Не указан'}
Бизнес-функция: ${position.businessFunction?.name || 'Не указана'}
Проект: ${position.project?.name || 'Не указан'}
Количество штатных единиц: ${position.headcount}
${position.functions ? `Выполняемые функции: ${position.functions}` : ''}`

    const systemPrompt = `Ты — эксперт по созданию должностных инструкций для компании Группа Астра. 
Ты создаёшь профессиональные, подробные и формально корректные должностные инструкции на русском языке в соответствии с требованиями трудового законодательства РФ.

${masterPrompt ? `МАСТЕР-ПРОМПТ (основные правила и стиль):
${masterPrompt.content}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${positionContext}

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

    // f) Generate content for each section
    const generatedSections: { sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean }[] = []

    for (const section of template.sections) {
      const userPrompt = `Сгенерируй содержание секции "${section.title}" для должностной инструкции.
${section.promptGuidance ? `Руководство для генерации: ${section.promptGuidance}` : ''}
${section.content ? `Примерное содержание/шаблон: ${section.content}` : ''}

Сгенерируй подробное, профессиональное содержание для этой секции.`

      try {
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          thinking: { type: 'disabled' },
        })

        const response = completion.choices[0]?.message?.content || ''

        generatedSections.push({
          sectionTitle: section.title,
          sectionContent: response.trim(),
          order: section.order,
          aiGenerated: true,
        })
      } catch (aiError) {
        console.error(`AI generation error for section "${section.title}":`, aiError)
        generatedSections.push({
          sectionTitle: section.title,
          sectionContent: `[Ошибка генерации секции. Пожалуйста, повторите генерацию.]`,
          order: section.order,
          aiGenerated: true,
        })
      }
    }

    // g) Create the GeneratedDI in the database
    const generatedDI = await db.generatedDI.create({
      data: {
        positionId,
        templateId,
        title: `ДИ — ${position.title}`,
        status: 'draft',
        currentVersion: 1,
        signedByEmployee: false,
        sections: {
          create: generatedSections,
        },
      },
      include: {
        position: { include: { department: true, businessFunction: true, project: true } },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    // Create initial version record v1
    const versionContent = JSON.stringify({
      title: generatedDI.title,
      sections: generatedDI.sections.map(s => ({ title: s.sectionTitle, content: s.sectionContent })),
    })
    await db.dIVersion.create({
      data: {
        generatedDIId: generatedDI.id,
        content: versionContent,
        version: 1,
        isOriginal: true,
        changeDescription: 'Начальная AI-генерация',
        uploadedBy: 'ai-generate',
      },
    })

    return NextResponse.json(generatedDI, { status: 201 })
  } catch (error) {
    console.error('AI Generate error:', error)
    return NextResponse.json({ error: 'Ошибка AI-генерации ДИ' }, { status: 500 })
  }
}

// Internal function to resolve master prompt without making HTTP request
async function resolveMasterPromptInternal(
  departmentId: string,
  businessFunctionId: string | null,
  grade: string | null
) {
  // Build priority list of criteria combinations
  const combinations: Record<string, string | null>[] = []

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
        departmentId: combo.departmentId || null,
        businessFunctionId: combo.businessFunctionId || null,
        grade: combo.grade || null,
      },
      orderBy: { version: 'desc' },
    })
    if (prompt) return prompt
  }

  return null
}
