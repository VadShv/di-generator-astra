import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'
import { scheduleJob } from '@/lib/di/mass-generate-worker'
import { requireAuth } from '@/lib/auth/session'
import { z } from 'zod'

const log = createLogger('generate-di/lineage-generate')

const lineageGenerateSchema = z.object({
  lineageId: z.string().min(1),
  templateId: z.string().min(1),
  masterPromptId: z.string().optional(),
  providerId: z.string().optional(),
})

// POST /api/generate-di/lineage-generate — генерация ДИ для всех должностей в линейке
// AI дифференцирует обязанности по уровням (junior → lead)
export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth()
  const body = await parseBody(request, lineageGenerateSchema)
  const { lineageId, templateId, masterPromptId, providerId } = body

  // Загружаем линейку с должностями
  const lineage = await db.positionLineage.findUnique({
    where: { id: lineageId },
    include: {
      items: {
        include: { position: { select: { id: true, title: true } } },
        orderBy: { level: 'asc' },
      },
    },
  })

  if (!lineage) {
    return NextResponse.json({ error: 'Линейка не найдена' }, { status: 404 })
  }

  if (lineage.items.length === 0) {
    return NextResponse.json({ error: 'Линейка не содержит должностей' }, { status: 400 })
  }

  // Проверяем лимит массовой генерации
  const limitSetting = await db.systemSettings.findUnique({ where: { key: 'massGenLimit' } })
  const massGenLimit = Number.isFinite(parseInt(limitSetting?.value || '20', 10)) && parseInt(limitSetting?.value || '20', 10) > 0 ? parseInt(limitSetting?.value || '20', 10) : 20
  if (lineage.items.length > massGenLimit) {
    return NextResponse.json(
      { error: `Превышен лимит: ${lineage.items.length} должностей в линейке, максимум ${massGenLimit}` },
      { status: 400 }
    )
  }

  const positionIds = lineage.items.map((item) => item.positionId)

  // Создаём job с scope='positions' + lineageId в scopeData
  const job = await db.generationJob.create({
    data: {
      scope: 'positions',
      scopeData: JSON.stringify({ positionIds, lineageId }),
      status: 'queued',
      total: 0,
      completed: 0,
      failed: 0,
      results: '[]',
      templateId,
      createdBy: session?.user?.id,
      ...(masterPromptId ? { masterPromptId } : {}),
      ...(providerId ? { providerId } : {}),
    },
  })

  scheduleJob(job.id)

  log.info('Lineage generation job created', { jobId: job.id, lineageId, positionCount: positionIds.length })
  return NextResponse.json({ jobId: job.id, status: 'queued' }, { status: 202 })
}, 'generate-di/lineage-generate')
