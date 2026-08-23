import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { massGenerateSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { scheduleJob } from '@/lib/di/mass-generate-worker'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { checkRateLimit } from '@/lib/rate-limit'

const log = createLogger('generate-di/mass-generate')

// POST /api/generate-di/mass-generate - Mass generation of DIs (async via GenerationJob)
// Создаёт запись GenerationJob и запускает фоновую обработку.
// Возвращает 202 с { jobId } — клиент опрашивает статус через GET ?jobId=.
export const POST = withErrorHandler(async (request: Request) => {
  await requireAuth()
  checkRateLimit(request, 'mass-generate', 5)
  const body = await parseBody(request, massGenerateSchema)
  const { departmentIds, companyIds, positionIds, templateId, masterPromptId, providerId } = body

  // Подсчёт должностей ДО создания job — проверка лимита
  let positionCount = 0
  if (positionIds?.length) {
    positionCount = positionIds.length
  } else if (departmentIds?.length) {
    positionCount = await db.position.count({
      where: { departmentId: { in: departmentIds } },
    })
  } else if (companyIds?.length) {
    const deptIds = await db.department.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    })
    positionCount = await db.position.count({
      where: { departmentId: { in: deptIds.map((d) => d.id) } },
    })
  }

  // Проверка лимита из SystemSettings (по умолчанию 20)
  const limitSetting = await db.systemSettings.findUnique({ where: { key: 'massGenLimit' } })
  const massGenLimit = parseInt(limitSetting?.value || '20', 10)
  if (positionCount > massGenLimit) {
    throw new ApiError(
      `Превышен лимит массовой генерации: ${positionCount} должностей, максимум ${massGenLimit}. Уменьшите выборку.`,
      400,
      'limit_exceeded'
    )
  }

  // Создаём job-запись со scope.
  const job = await db.generationJob.create({
    data: {
      scope: positionIds?.length ? 'positions' : departmentIds?.length ? 'department' : 'company',
      scopeData: JSON.stringify({ departmentIds, companyIds, positionIds }),
      status: 'queued',
      total: 0,
      completed: 0,
      failed: 0,
      results: '[]',
      templateId,
      ...(masterPromptId ? { masterPromptId } : {}),
      ...(providerId ? { providerId } : {}),
    },
  })

  // Запускаем фоновую обработку in-process.
  scheduleJob(job.id)

  log.info('Mass generation job created', { jobId: job.id, templateId })
  return NextResponse.json({ jobId: job.id, status: 'queued' }, { status: 202 })
}, 'generate-di/mass-generate')

// GET /api/generate-di/mass-generate?jobId=... - Статус массовой генерации
export async function GET(request: Request) {
  try {
  await requireAuth()
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'Параметр jobId обязателен' }, { status: 400 })
    }

    const job = await db.generationJob.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
    }

    let results: unknown = []
    try {
      results = typeof job.results === 'string' && job.results ? JSON.parse(job.results) : []
    } catch {
      results = []
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      failed: job.failed,
      results,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Mass generate GET error', { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Ошибка получения статуса задачи' }, { status: 500 })
  }
}
