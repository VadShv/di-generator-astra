import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/generate-di/ai-section - Regenerate a SINGLE section with AI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { generatedDIId, sectionOrder, customPrompt } = body

    if (!generatedDIId || typeof generatedDIId !== 'string') {
      return NextResponse.json({ error: 'ID сгенерированной ДИ обязателен' }, { status: 400 })
    }

    if (sectionOrder === undefined || sectionOrder === null || typeof sectionOrder !== 'number') {
      return NextResponse.json({ error: 'Порядковый номер секции обязателен' }, { status: 400 })
    }

    // Get the generated DI with all data
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
      include: {
        position: { include: { department: true } },
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
    const masterPrompt = await resolveMasterPromptInternal(
      generatedDI.position.departmentId,
      generatedDI.position.domain,
      generatedDI.position.grade
    )

    // Get archive DIs as reference
    const archiveDIs = await db.archiveDI.findMany({
      where: { positionId: generatedDI.positionId },
      orderBy: { uploadedAt: 'desc' },
      take: 3,
    })

    const archiveContext = archiveDIs.length > 0
      ? archiveDIs.map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`).join('\n\n')
      : 'Архивные ДИ для данной должности отсутствуют.'

    const positionContext = `Должность: ${generatedDI.position.title}
Код должности: ${generatedDI.position.code}
Подразделение: ${generatedDI.position.department.name}
Грейд: ${generatedDI.position.grade || 'Не указан'}
Домен: ${generatedDI.position.domain || 'Не указан'}
Количество штатных единиц: ${generatedDI.position.headcount}
${generatedDI.position.functions ? `Выполняемые функции: ${generatedDI.position.functions}` : ''}`

    // Build context of other sections
    const otherSections = generatedDI.sections
      .filter((s) => s.order !== sectionOrder)
      .map((s) => `=== ${s.sectionTitle} ===\n${s.sectionContent.substring(0, 500)}...`)
      .join('\n\n')

    const systemPrompt = `Ты — эксперт по созданию должностных инструкций для компании Группа Астра.
Ты создаёшь профессиональные, подробные и формально корректные должностные инструкции на русском языке.

${masterPrompt ? `МАСТЕР-ПРОМПТ:
${masterPrompt.content}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${positionContext}

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

    // Call AI
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content || ''

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

async function resolveMasterPromptInternal(
  departmentId: string,
  domain: string | null,
  grade: string | null
) {
  const combinations: Record<string, string | null>[] = []

  if (departmentId && domain && grade) combinations.push({ departmentId, domain, grade })
  if (departmentId && domain) combinations.push({ departmentId, domain, grade: null })
  if (departmentId && grade) combinations.push({ departmentId, domain: null, grade })
  if (departmentId) combinations.push({ departmentId, domain: null, grade: null })
  if (domain && grade) combinations.push({ departmentId: null, domain, grade })
  if (domain) combinations.push({ departmentId: null, domain, grade: null })
  if (grade) combinations.push({ departmentId: null, domain: null, grade })
  combinations.push({ departmentId: null, domain: null, grade: null })

  for (const combo of combinations) {
    const prompt = await db.masterPrompt.findFirst({
      where: {
        isActive: true,
        departmentId: combo.departmentId || null,
        domain: combo.domain || null,
        grade: combo.grade || null,
      },
      orderBy: { version: 'desc' },
    })
    if (prompt) return prompt
  }

  return null
}
