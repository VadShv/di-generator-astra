import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
 import { getProviderClient } from '@/lib/ai-connector'
 import { resolveMasterPrompt, resolveAiCulturePrompt, renderPrompt, buildContextFromPosition } from '@/lib/master-prompt'

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

    // Получаем клиент ИИ-провайдера один раз для всей массовой генерации.
    const client = await getProviderClient()

    const results: { positionId: string; positionTitle: string; diId: string; title: string; success: boolean; error?: string }[] = []
    let successCount = 0
    let failCount = 0

    // Generate DI for each position
    for (const position of positions) {
      try {
        // Резолвим мастер-промпт категории "generation" и рендерим переменные.
        const masterPrompt = await resolveMasterPrompt('generation', {
          departmentId: position.departmentId,
          businessFunctionId: position.businessFunctionId,
          grade: position.grade,
        })
        const renderedMasterPrompt = masterPrompt
          ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
          : null

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

${renderedMasterPrompt ? `МАСТЕР-ПРОМПТ (основные правила и стиль):
${renderedMasterPrompt}` : 'Используй стандартный корпоративный стиль должностных инструкций.'}

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
            const result = await client.generate({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            })

            const response = result.content || ''
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

        // Культура ИИ: добавляем раздел при наличии активного промпта ai_culture.
        const aiCulturePrompt = await resolveAiCulturePrompt({
          departmentId: position.departmentId,
          businessFunctionId: position.businessFunctionId,
          grade: position.grade,
        })
        if (aiCulturePrompt) {
          try {
            const cultureSystem = renderPrompt(aiCulturePrompt.content, buildContextFromPosition(position))
            const cultureResult = await client.generate({
              messages: [
                { role: 'system', content: cultureSystem },
                { role: 'user', content: 'Сгенерируй содержание раздела «Взаимодействие с системами ИИ» для данной должности: обязанности, ограничения и ответственность при работе с ИИ.' },
              ],
            })
            generatedSections.push({
              sectionTitle: 'Взаимодействие с системами ИИ',
              sectionContent: (cultureResult.content || '').trim() || '[Раздел не сгенерирован]',
              order: generatedSections.length,
              aiGenerated: true,
            })
          } catch (cultureError) {
            console.error(`AI Culture section error for position ${position.id}:`, cultureError)
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
