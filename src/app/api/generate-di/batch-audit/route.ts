import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition, incrementPromptUsage } from '@/lib/master-prompt'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { batchAuditSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { parseJsonOr } from '@/lib/json-safe'
import { buildPositionContext } from '@/lib/di/prompts'
import { requirePermission } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'

const log = createLogger('generate-di/batch-audit')

// POST /api/generate-di/batch-audit — пакетный аудит сгенерированных ДИ.
// Тело: { diIds: string[] } — список ID GeneratedDI для аудита.
export const POST = withErrorHandler(async (request: Request) => {
  const session = await requirePermission('generate-di', 'write')
  checkRateLimit(request, 'batch-audit', 5, 60_000, session?.user?.id)
  const body = await parseBody(request, batchAuditSchema)
  const { diIds } = body

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
      const positionContext = buildPositionContext(di.position)

      const auditPrompt = await resolveMasterPrompt('audit', {
        departmentId: di.position.departmentId,
        businessFunctionId: di.position.businessFunctionId,
        grade: di.position.grade,
      })
      const renderedAuditPrompt = auditPrompt
        ? renderPrompt(auditPrompt.content, buildContextFromPosition(di.position))
        : null
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
        timeoutMs: 180_000,
      })

      const raw = result.content || ''
      const parsed = parseJsonOr<{ overallScore?: number; summary?: string; issues?: string[] }>(
        raw,
        { overallScore: 0, summary: raw, issues: [] }
      )
      const score = Number(parsed.overallScore) || 0
      const summary = parsed.summary || raw

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
      log.error(`Batch audit error for DI ${diId}`, { message: err instanceof Error ? err.message : String(err) })
      results.push({ diId, title: '—', success: false, error: 'Ошибка аудита' })
      failCount++
    }
  }

  log.info('Batch audit completed', { total: diIds.length, successCount, failCount })
  return NextResponse.json({ total: diIds.length, successCount, failCount, results })
}, 'generate-di/batch-audit')
