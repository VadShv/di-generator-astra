import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/generate-di/mass-generate - Mass generation of DIs for selected departments/companies
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { departmentIds, companyIds, templateId } = body

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json({ error: 'ID шаблона обязателен' }, { status: 400 })
    }

    if ((!departmentIds || !Array.isArray(departmentIds) || departmentIds.length === 0) &&
        (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0)) {
      return NextResponse.json({ error: 'Выберите хотя бы одно подразделение или компанию' }, { status: 400 })
    }

    // Get the template
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

    // Build where clause for positions
    const departmentWhere: Record<string, unknown> = {}
    if (departmentIds && departmentIds.length > 0) {
      departmentWhere.id = { in: departmentIds }
    }
    if (companyIds && companyIds.length > 0) {
      departmentWhere.companyId = { in: companyIds }
    }
    if (departmentIds && companyIds) {
      // Combine: departments directly OR departments in companies
      departmentWhere.OR = [
        { id: { in: departmentIds } },
        { companyId: { in: companyIds } },
      ]
      delete departmentWhere.id
      delete departmentWhere.companyId
    }

    // Get all positions in selected departments/companies
    const positions = await db.position.findMany({
      where: { department: departmentWhere },
      include: { department: true, businessFunction: true, project: true },
    })

    if (positions.length === 0) {
      return NextResponse.json({ error: 'Не найдено должностей в выбранных подразделениях/компаниях' }, { status: 400 })
    }

    // Initialize AI
    const zai = await ZAI.create()

    const results: { positionId: string; positionTitle: string; diId: string; title: string; success: boolean; error?: string }[] = []
    let successCount = 0
    let failCount = 0

    // Generate DI for each position
    for (const position of positions) {
      try {
        // Resolve master prompt
        const masterPrompt = await resolveMasterPromptInternal(
          position.departmentId,
          position.businessFunctionId,
          position.grade
        )

        // Get archive DIs for reference
        const archiveDIs = await db.archiveDI.findMany({
          where: { positionId: position.id },
          orderBy: { uploadedAt: 'desc' },
          take: 2,
        })
        const archiveContext = archiveDIs.length > 0
          ? archiveDIs.map((di, i) => `--- Архивная ДИ #${i + 1}: ${di.title} ---\n${di.content}`).join('\n\n')
          : 'Архивные ДИ для данной должности отсутствуют.'

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
- Формулируй чётко и недвусмысленно
- Не добавляй заголовок секции в начало текста`

        const generatedSections: { sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean }[] = []

        for (const section of template.sections) {
          const userPrompt = `Сгенерируй содержание секции "${section.title}" для должностной инструкции.
${section.promptGuidance ? `Руководство для генерации: ${section.promptGuidance}` : ''}
${section.content ? `Примерное содержание: ${section.content}` : ''}

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
          } catch {
            generatedSections.push({
              sectionTitle: section.title,
              sectionContent: `[Ошибка генерации. Повторите для данной должности.]`,
              order: section.order,
              aiGenerated: true,
            })
          }
        }

        // Create GeneratedDI
        const generatedDI = await db.generatedDI.create({
          data: {
            positionId: position.id,
            templateId,
            title: `ДИ — ${position.title}`,
            status: 'draft',
            currentVersion: 1,
            signedByEmployee: false,
            sections: { create: generatedSections },
          },
          include: {
            position: { include: { department: true } },
            template: true,
            sections: { orderBy: { order: 'asc' } },
          },
        })

        // Create initial version record
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
            changeDescription: 'Начальная AI-генерация (массовая)',
            uploadedBy: 'ai-mass-generate',
          },
        })

        results.push({
          positionId: position.id,
          positionTitle: position.title,
          diId: generatedDI.id,
          title: generatedDI.title,
          success: true,
        })
        successCount++
      } catch (error) {
        console.error(`Mass generate error for position ${position.id}:`, error)
        results.push({
          positionId: position.id,
          positionTitle: position.title,
          diId: '',
          title: '',
          success: false,
          error: 'Ошибка генерации',
        })
        failCount++
      }
    }

    return NextResponse.json({
      total: positions.length,
      successCount,
      failCount,
      results,
    })
  } catch (error) {
    console.error('Mass generate error:', error)
    return NextResponse.json({ error: 'Ошибка массовой генерации ДИ' }, { status: 500 })
  }
}

// Internal function to resolve master prompt
async function resolveMasterPromptInternal(
  departmentId: string,
  businessFunctionId: string | null,
  grade: string | null
) {
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
