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

const log = createLogger('mass-generate-worker')

/** Интервал опроса очереди (мс). */
const POLL_INTERVAL_MS = 2000
/** Максимум одновременных обрабатываемых job'ов. */
const MAX_CONCURRENT_JOBS = 3
/** Размер пакета должностей для параллельной обработки. */
const BATCH_SIZE = 5

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
    await processJob(jobId)
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
async function processJob(jobId: string): Promise<void> {
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

  const client = await getProviderClient()
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

  const results: Array<{ positionId: string; positionTitle: string; diId: string; title: string; status: string; message?: string }> = []
  let completed = 0
  let failed = 0

  // Обработка одной должности (вынесена для параллельного вызова).
  const processPosition = async (position: typeof positions[0]): Promise<{ positionId: string; positionTitle: string; diId: string; title: string; status: string; message?: string }> => {
    try {
      const masterPrompt = await resolveMasterPrompt('generation', {
        departmentId: position.departmentId,
        businessFunctionId: position.businessFunctionId,
        grade: position.grade,
      })
      const renderedMasterPrompt = masterPrompt
        ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
        : null

      const archiveDIs = await db.archiveDI.findMany({
        where: { positionId: position.id },
        orderBy: { uploadedAt: 'desc' },
        take: 2,
      })
      const archiveRefs: ArchiveDIRef[] = archiveDIs.map((di) => ({ title: di.title, content: di.content }))

      const generatedSections = await generateSectionsForPosition({
        position,
        templateSections,
        client,
        renderedMasterPrompt,
        archiveDIs: archiveRefs,
        extraContext: lineageContext || undefined,
        errorPlaceholder: '[Ошибка генерации. Повторите для данной должности.]',
      })

      const aiCulturePrompt = await resolveAiCulturePrompt({
        departmentId: position.departmentId,
        businessFunctionId: position.businessFunctionId,
        grade: position.grade,
      })
      if (aiCulturePrompt) {
        const cultureSystem = renderPrompt(aiCulturePrompt.content, buildContextFromPosition(position))
        const cultureSection = await generateAiCultureSection(client, aiCulturePrompt, cultureSystem)
        if (cultureSection) {
          generatedSections.push({ ...cultureSection, order: generatedSections.length })
        }
      }

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
      })

      await createInitialVersion(
        generatedDI.id,
        generatedDI.title,
        generatedSections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })),
        'ai-mass-generate',
        'Начальная AI-генерация (массовая)'
      )

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
          startedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          results: JSON.stringify([{ status: 'error', message: 'Таймаут задачи (превышен лимит 30 мин)' }]),
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
