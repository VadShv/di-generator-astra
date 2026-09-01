// Воркер массовой генерации ДИ (Фаза 3).
// Обрабатывает записи GenerationJob из БД: для каждой должности генерирует ДИ,
// обновляет прогресс (completed/failed/results), переводит статус
// running -> completed | failed.
//
// In-process реализация: воркер запускается в том же процессе Next.js через
// setTimeout-polling после создания job. Для масштабирования на прод — заменить
// на внешнюю очередь (BullMQ/Redis); интерфейс GenerationJob остаётся прежним.

import { db } from '../db'
import { getProviderClient } from '../ai-connector'
import {
  resolveMasterPrompt,
  resolveAiCulturePrompt,
  renderPrompt,
  buildContextFromPosition,
} from '../master-prompt'
import { generateSectionsForPosition, generateAiCultureSection } from './generate-core'
import { createInitialVersion } from './version'
import { type ArchiveDIRef, buildLineageContext } from './prompts'
import { createLogger } from '../logger'
import { createNotification } from '../notifications'

const log = createLogger('mass-generate-worker')

/** Интервал опроса очереди (мс). */
const POLL_INTERVAL_MS = 2000
/** Максимум одновременных обрабатываемых job'ов. */
const MAX_CONCURRENT_JOBS = 3
/** Размер пакета должностей для параллельной обработки. */
const BATCH_SIZE = 5
/** Per-job таймаут (мс). По умолчанию 10 минут (env JOB_TIMEOUT_MS). */
const JOB_TIMEOUT_MS = (() => {
  const raw = process.env.JOB_TIMEOUT_MS
  const n = raw ? Number(raw) : 10 * 60 * 1000
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10 * 60 * 1000
})()

let activeJobs = 0
let pollTimer: ReturnType<typeof setTimeout> | null = null

interface JobScopeData {
  departmentIds?: string[]
  companyIds?: string[]
  positionIds?: string[]
}

/**
 * Запустить обработку конкретной job в фоне (не блокирует ответ роута).
 * Защита от повторного запуска той же job — через атомарное обновление статуса.
 */
export async function runJob(jobId: string): Promise<void> {
  // Захват job: переводим queued -> running только если она ещё queued.
  const claimed = await db.generationJob
    .updateMany({
      where: { id: jobId, status: 'queued' },
      data: { status: 'running', startedAt: new Date() },
    })
    .catch((e) => {
      log.error(`Failed to claim job ${jobId}`, { message: e instanceof Error ? e.message : String(e) })
      return { count: 0 }
    })

  if (claimed.count === 0) {
    // Уже занята или не существует — пропускаем.
    return
  }

  activeJobs++
  try {
    // Per-job таймаут с активной отменой через AbortController.
    // При превышении — прерываем запросы к провайдеру и помечаем job как failed.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS)
    try {
      await processJob(jobId, controller.signal)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    log.error(`Job ${jobId} failed unexpectedly`, { message: error instanceof Error ? error.message : String(error) })
    await db.generationJob
      .update({
        where: { id: jobId },
        data: { status: 'failed', finishedAt: new Date() },
      })
      .catch(() => {})
  } finally {
    activeJobs--
  }
}

/** Обработка одной job: выборка должностей и генерация. */
async function processJob(jobId: string, signal?: AbortSignal): Promise<void> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } })
  if (!job) {
    log.warn(`Job ${jobId} not found`)
    return
  }

  const scope = (typeof job.scopeData === 'string' ? JSON.parse(job.scopeData) : {}) as JobScopeData
  const templateId = job.templateId
  if (!templateId) {
    await failJob(jobId, 'Не указан шаблон')
    return
  }

  const template = await db.dITemplate.findUnique({
    where: { id: templateId },
    include: { sections: { orderBy: { order: 'asc' } } },
  })
  if (!template || !template.sections?.length) {
    await failJob(jobId, 'Шаблон не найден или не содержит секций')
    return
  }

  // Выборка должностей по scope.
  const where = buildPositionWhere(scope)
  const positions = await db.position.findMany({
    where,
    include: { department: true, businessFunction: true, project: true, attributes: true },
  })

  if (positions.length === 0) {
    await failJob(jobId, 'Не найдено должностей по выбранным критериям')
    return
  }

  const client = await getProviderClient(job.providerId || undefined)
  const templateSections = template.sections.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    promptGuidance: s.promptGuidance,
    content: s.content,
  }))

  // Загрузка контекста линейки (если scopeData содержит lineageId)
  let lineageContext: string | null = null
  const scopeDataObj = typeof job.scopeData === 'string' ? JSON.parse(job.scopeData) : {}
  if (scopeDataObj.lineageId) {
    const lineage = await db.positionLineage.findUnique({
      where: { id: scopeDataObj.lineageId },
      include: {
        items: {
          include: { position: { select: { title: true } } },
          orderBy: { level: 'asc' },
        },
      },
    })
    if (lineage) {
      lineageContext = buildLineageContext({
        name: lineage.name,
        items: lineage.items.map((item) => ({
          positionTitle: item.position.title,
          level: item.level,
          levelLabel: item.levelLabel,
        })),
      })
    }
  }

  await db.generationJob.update({
    where: { id: jobId },
    data: { total: positions.length },
  })

  // Pre-fetch archive DIs for ALL positions in a single query (N+1 fix).
  // Each position needs top-2 most recent archives; we fetch all at once and
  // group them in-memory to avoid per-position DB round-trips.
  const allArchiveDIs = await db.archiveDI.findMany({
    where: { positionId: { in: positions.map((p) => p.id) } },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, positionId: true, title: true, content: true, uploadedAt: true },
  })
  const archiveByPosition = new Map<string, typeof allArchiveDIs>()
  for (const ar of allArchiveDIs) {
    if (!ar.positionId) continue
    const arr = archiveByPosition.get(ar.positionId)
    if (arr) {
      if (arr.length < 2) arr.push(ar)
    } else {
      archiveByPosition.set(ar.positionId, [ar])
    }
  }

  const results: Array<{ positionId: string; positionTitle: string; diId: string; title: string; status: string; message?: string }> = []
  let completed = 0
  let failed = 0

  // Обработка одной должности (вынесена для параллельного вызова).
  const processPosition = async (position: typeof positions[0]): Promise<{ positionId: string; positionTitle: string; diId: string; title: string; status: string; message?: string }> => {
    try {
      const masterPrompt = job.masterPromptId
        ? await db.masterPrompt.findUnique({ where: { id: job.masterPromptId } })
        : await resolveMasterPrompt('generation', {
            departmentId: position.departmentId,
            businessFunctionId: position.businessFunctionId,
            grade: position.grade,
          })
      const renderedMasterPrompt = masterPrompt
        ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
        : null

      const archiveDIs = archiveByPosition.get(position.id) ?? []
      const archiveRefs: ArchiveDIRef[] = archiveDIs.map((di) => ({ title: di.title, content: di.content }))

      const generatedSections = await generateSectionsForPosition({
        position,
        templateSections,
        client,
        renderedMasterPrompt,
        archiveDIs: archiveRefs,
        extraContext: lineageContext || undefined,
        errorPlaceholder: '[Ошибка генерации. Повторите для данной должности.]',
        signal,
      })

      const aiCulturePrompt = await resolveAiCulturePrompt({
        departmentId: position.departmentId,
        businessFunctionId: position.businessFunctionId,
        grade: position.grade,
      })
      if (aiCulturePrompt) {
        const cultureSystem = renderPrompt(aiCulturePrompt.content, buildContextFromPosition(position))
        const cultureSection = await generateAiCultureSection(client, aiCulturePrompt, cultureSystem, signal)
        if (cultureSection) {
          generatedSections.push({ ...cultureSection, order: generatedSections.length })
        }
      }

      // Создание ДИ и начальной версии — атомарно (TOCTOU-защита).
      const generatedDI = await db.$transaction(async (tx) => {
        const di = await tx.generatedDI.create({
          data: {
            positionId: position.id,
            templateId,
            title: `ДИ — ${position.title}`,
            status: 'draft',
            currentVersion: 1,
            signedByEmployee: false,
            sections: { create: generatedSections },
          },
        })

        await createInitialVersion(
          di.id,
          di.title,
          generatedSections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })),
          'ai-mass-generate',
          'Начальная AI-генерация (массовая)',
          tx
        )
        return di
      })

      return { positionId: position.id, positionTitle: position.title, diId: generatedDI.id, title: generatedDI.title, status: 'success' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка генерации'
      log.error(`Job ${jobId}: position ${position.id} failed`, { message })
      return { positionId: position.id, positionTitle: position.title, diId: '', title: '', status: 'error', message }
    }
  }

  // Пакетная параллельная обработка: BATCH_SIZE должностей одновременно.
  for (let i = 0; i < positions.length; i += BATCH_SIZE) {
    const batch = positions.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(batch.map((p) => processPosition(p)))

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
        if (r.value.status === 'success') completed++
        else failed++
      } else {
        // allSettled reject — не должно случиться (processPosition ловит ошибки)
        failed++
      }
    }

    // Обновляем прогресс после каждого пакета (меньше DB-запросов).
    await db.generationJob.update({
      where: { id: jobId },
      data: { completed, failed, results: JSON.stringify(results) },
    })
  }

  await db.generationJob.update({
    where: { id: jobId },
    data: {
      status: failed === positions.length ? 'failed' : 'completed',
      completed,
      failed,
      results: JSON.stringify(results),
      finishedAt: new Date(),
    },
  })

  // Уведомление о завершении массовой генерации
  createNotification({
    type: 'mass_gen_complete',
    title: failed === positions.length ? 'Массовая генерация завершена с ошибками' : 'Массовая генерация завершена',
    message: `Создано ${completed} ДИ из ${positions.length}. Ошибок: ${failed}.`,
    entityType: 'job',
    entityId: jobId,
  })

  log.info(`Job ${jobId} finished`, { total: positions.length, completed, failed })
}

/** Построить Prisma-условие выборки должностей по scope. */
function buildPositionWhere(scope: JobScopeData): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (scope.positionIds && scope.positionIds.length > 0) {
    where.id = { in: scope.positionIds }
  } else if (scope.departmentIds && scope.departmentIds.length > 0) {
    where.department = { id: { in: scope.departmentIds } }
  } else if (scope.companyIds && scope.companyIds.length > 0) {
    where.department = { companyId: { in: scope.companyIds } }
  }
  return where
}

async function failJob(jobId: string, message: string): Promise<void> {
  await db.generationJob
    .update({
      where: { id: jobId },
      data: { status: 'failed', finishedAt: new Date(), results: JSON.stringify([{ status: 'error', message }]) },
    })
    .catch(() => {})
  log.warn(`Job ${jobId} marked failed: ${message}`)
}

/**
 * Запланировать запуск job в фоне (in-process).
 * Вызывается из роута сразу после создания GenerationJob.
 */
export function scheduleJob(jobId: string): void {
  // Небольшая задержка, чтобы роут успел вернуть 202.
  setTimeout(() => {
    void runJob(jobId)
  }, 100)
}

/**
 * Опросчик очереди: подхватывает зависшие/оставшиеся job'ы.
 * Полезен при перезапуске процесса — дозавершает незавершённые job.
 * Запускается один раз при старте модуля.
 */
export function startQueuePoller(): void {
  if (pollTimer) return
  const tick = async () => {
    // Recovery: помечаем зависшие running-задачи (> 30 мин) как failed.
    await db.generationJob
      .updateMany({
        where: {
          status: 'running',
          startedAt: { lt: new Date(Date.now() - JOB_TIMEOUT_MS) },
        },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          results: JSON.stringify([{ status: 'error', message: `Таймаут задачи (превышен лимит ${Math.ceil(JOB_TIMEOUT_MS / 60000)} мин)` }]),
        },
      })
      .catch(() => {})

    if (activeJobs < MAX_CONCURRENT_JOBS) {
      try {
        const next = await db.generationJob.findFirst({
          where: { status: 'queued' },
          orderBy: { createdAt: 'asc' },
        })
        if (next) {
          void runJob(next.id)
        }
      } catch (e) {
        log.error('Queue poller error', { message: e instanceof Error ? e.message : String(e) })
      }
    }
    pollTimer = setTimeout(tick, POLL_INTERVAL_MS)
  }
  pollTimer = setTimeout(tick, POLL_INTERVAL_MS)
  log.info('Queue poller started')
}

/**
 * Остановить queue poller (graceful shutdown).
 * Останавливает таймер опроса; активные job завершаются сами.
 * @returns количество активных job (для ожидания).
 */
export function stopQueuePoller(): number {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
    log.info('Queue poller stopped')
  }
  return activeJobs
}

/** Текущее количество активных job (для graceful shutdown). */
export function getActiveJobsCount(): number {
  return activeJobs
}
