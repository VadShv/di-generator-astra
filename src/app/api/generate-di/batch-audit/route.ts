import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition, incrementPromptUsage } from '@/lib/master-prompt'

// POST /api/generate-di/batch-audit — пакетный аудит сгенерированных ДИ.
// Тело: { diIds: string[] } — список ID GeneratedDI для аудита.
// Запускает аудит для каждой ДИ и сохраняет результаты в DIAuditResult.
// Возвращает сводку по каждой ДИ.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { diIds } = body as { diIds?: string[] }

    if (!diIds || !Array.isArray(diIds) || diIds.length === 0) {
      return NextResponse.json({ error: 'Список ID ДИ (diIds) обязателен' }, { status: 400 })
    }

    const client = await getProviderClient()
    const results: { diId: string; title: string; success: boolean; score?: number; error?: string }[] = []
    let successCount = 0
    let failCount = 0

    for (const diId of diIds) {
      try {
        const di = await db.generatedDI.findUnique({
          where: { id: diId },
          include: {
            position: { include: { department: true, businessFunction: true, project: true } },
            sections: { orderBy: { order: 'asc' } },
          },
        })
        if (!di) {
          results.push({ diId, title: '—', success: false, error: 'ДИ не найдена' })
          failCount++
          continue
        }

        const diText = di.sections.map((s) => `## ${s.sectionTitle}\n${s.sectionContent}`).join('\n\n')
        const positionContext = `Должность: ${di.position.title}
Подразделение: ${di.position.department?.name || 'Не указано'}
Грейд: ${di.position.grade || 'Не указан'}`

        const auditPrompt = await resolveMasterPrompt('audit', {
          departmentId: di.position.departmentId,
          businessFunctionId: di.position.businessFunctionId,
          grade: di.position.grade,
        })
        const renderedAuditPrompt = auditPrompt
          ? renderPrompt(auditPrompt.content, buildContextFromPosition(di.position))
          : null
        // Фаза 21: учитываем применение промпта в метриках.
        if (auditPrompt) await incrementPromptUsage(auditPrompt.id)

        const systemPrompt = `Ты — эксперт-юрист и HR-аналитик, специализирующийся на должностных инструкциях в РФ. Проведи краткий аудит ДИ.

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${positionContext}

Ответ строго в JSON: {"overallScore": число 0-100, "summary": "краткое резюме", "issues": ["проблема 1", "проблема 2"]}
${renderedAuditPrompt ? `\nПРОМПТ АУДИТА:\n${renderedAuditPrompt}` : ''}`

        const userPrompt = `ТЕКСТ ДОЛЖНОСТНОЙ ИНСТРУКЦИИ:\n${diText}\n\nПроведи аудит и верни JSON.`

        const result = await client.generate({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        let score = 0
        let summary = result.content || ''
        try {
          const parsed = JSON.parse(summary.replace(/```(?:json)?\s*\n?([\s\S]*?)\n?```/, '$1'))
          score = Number(parsed.overallScore) || 0
          summary = parsed.summary || summary
        } catch {
          // Оставляем сырой текст как summary.
        }

        await db.dIAuditResult.create({
          data: {
            generatedDIId: diId,
            auditType: 'full',
            overallScore: score,
            duplicatedTkItems: '[]',
            vagueFormulationItems: '[]',
            legislativeConflictItems: '[]',
            unrealisticRequirementItems: '[]',
            incompleteSectionItems: '[]',
            outdatedItems: '[]',
            contradictoryItems: '[]',
            riskyItems: '[]',
            recommendations: JSON.stringify([{ area: 'Пакетный аудит', priority: 'средний', current: '—', suggested: summary }]),
            summary,
            auditedBy: 'batch-audit',
          },
        })

        results.push({ diId, title: di.title, success: true, score })
        successCount++
      } catch (err) {
        console.error(`Batch audit error for DI ${diId}:`, err)
        results.push({ diId, title: '—', success: false, error: 'Ошибка аудита' })
        failCount++
      }
    }

    return NextResponse.json({ total: diIds.length, successCount, failCount, results })
  } catch (error) {
    console.error('Batch audit error:', error)
    return NextResponse.json({ error: 'Ошибка пакетного аудита' }, { status: 500 })
  }
}
