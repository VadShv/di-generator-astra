import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, resolveAiCulturePrompt, renderPrompt, buildContextFromPosition, incrementPromptUsage } from '@/lib/master-prompt'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { aiGenerateSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { generateSectionsForPosition, generateAiCultureSection } from '@/lib/di/generate-core'
import { createInitialVersion } from '@/lib/di/version'
import { buildArchiveContext, type ArchiveDIRef } from '@/lib/di/prompts'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'

const log = createLogger('generate-di/ai-generate')

// POST /api/generate-di/ai-generate - Full AI generation of DI
export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth()
  checkRateLimit(request, 'ai-generate', 20, 60_000, session?.user?.id)
  const body = await parseBody(request, aiGenerateSchema)
  const { positionId, templateId, masterPromptId, archiveDIId, useArchiveAsReference } = body

  // a) Get the position info (with department, business function, project)
  const position = await db.position.findUnique({
    where: { id: positionId },
    include: { department: { include: { company: true } }, businessFunction: true, project: true, attributes: true },
  })
  if (!position) {
    return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
  }

  // b) Резолвим мастер-промпт категории "generation" и рендерим переменные.
  type ResolvedPrompt = Awaited<ReturnType<typeof resolveMasterPrompt>>
  let masterPrompt: ResolvedPrompt = null
  if (masterPromptId) {
    const explicit = await db.masterPrompt.findUnique({ where: { id: masterPromptId } })
    if (explicit && explicit.isActive && explicit.category === 'generation') {
      masterPrompt = {
        id: explicit.id,
        name: explicit.name,
        content: explicit.content,
        category: explicit.category,
        isAiCulture: explicit.isAiCulture,
        version: explicit.version,
      }
    }
  }
  if (!masterPrompt) {
    masterPrompt = await resolveMasterPrompt('generation', {
      departmentId: position.departmentId,
      businessFunctionId: position.businessFunctionId,
      grade: position.grade,
    })
  }
  const renderedMasterPrompt = masterPrompt
    ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
    : null
  if (masterPrompt) await incrementPromptUsage(masterPrompt.id)

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
  const selectedArchiveDI = archiveDIId && useArchiveAsReference
    ? await db.archiveDI.findUnique({ where: { id: archiveDIId } })
    : null
  const extraArchiveDIs = await db.archiveDI.findMany({
    where: { positionId, ...(selectedArchiveDI ? { id: { not: selectedArchiveDI.id } } : {}) },
    orderBy: { uploadedAt: 'desc' },
    take: 2,
  })
  const archiveRefs: ArchiveDIRef[] = []
  if (selectedArchiveDI) {
    archiveRefs.push({ title: selectedArchiveDI.title, content: selectedArchiveDI.content })
  }
  extraArchiveDIs.forEach((di) => archiveRefs.push({ title: di.title, content: di.content }))

  // e) Получаем клиент ИИ-провайдера (из БД или fallback z-ai-sdk).
  const client = await getProviderClient()

  // f) Generate content for each section (общее ядро генерации).
  const generatedSections = await generateSectionsForPosition({
    position,
    templateSections: template.sections.map((s) => ({
      id: s.id,
      title: s.title,
      order: s.order,
      promptGuidance: s.promptGuidance,
      content: s.content,
    })),
    client,
    renderedMasterPrompt,
    archiveDIs: archiveRefs,
    userId: session?.user?.id,
  })

  // h) Культура ИИ: если есть активный промпт категории ai_culture.
  const aiCulturePrompt = await resolveAiCulturePrompt({
    departmentId: position.departmentId,
    businessFunctionId: position.businessFunctionId,
    grade: position.grade,
  })
  if (aiCulturePrompt) await incrementPromptUsage(aiCulturePrompt.id)
  if (aiCulturePrompt) {
    const cultureSystem = renderPrompt(aiCulturePrompt.content, buildContextFromPosition(position))
    const cultureSection = await generateAiCultureSection(client, aiCulturePrompt, cultureSystem, session?.user?.id)
    if (cultureSection) {
      generatedSections.push({ ...cultureSection, order: generatedSections.length })
    }
  }

  // g) Create the GeneratedDI in the database
  // Создание ДИ и начальной версии — атомарно (TOCTOU-защита).
  const generatedDI = await db.$transaction(async (tx) => {
    const di = await tx.generatedDI.create({
      data: {
        positionId,
        templateId,
      ...(selectedArchiveDI ? { sourceArchiveId: selectedArchiveDI.id } : {}),
      title: `ДИ — ${position.title}`,
      status: 'draft',
      currentVersion: 1,
      signedByEmployee: false,
      sections: {
        create: generatedSections,
      },
      },
      include: {
        position: { include: { department: { include: { company: true } }, businessFunction: true, project: true } },
        template: true,
        sourceArchive: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    // Create initial version record v1 (атомарно с созданием ДИ)
    await createInitialVersion(
      di.id,
      di.title,
      di.sections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })),
      'ai-generate',
      'Начальная AI-генерация',
      tx
    )
    return di
  })

  log.info('DI generated', { diId: generatedDI.id, positionId, sections: generatedSections.length })

  // Привязываем TokenUsage, созданный во время генерации, к новой ДИ.
  // Используем await вместо fire-and-forget — ранее .catch(() => {}) глотал ошибки,
  // и generatedDIId оставался null (race condition с updateMany до завершения генерации).
  await db.tokenUsage.updateMany({
    where: { generatedDIId: null, userId: session?.user?.id ?? null, category: { in: ['section', 'culture'] }, createdAt: { gte: new Date(Date.now() - 5 * 60_000) } },
    data: { generatedDIId: generatedDI.id },
  }).catch((e) => {
    log.warn('TokenUsage binding failed', { diId: generatedDI.id, message: e instanceof Error ? e.message : String(e) })
  })

  // Кросс-модульная связь: создаём запись DITracking со статусом 'draft',
  // чтобы новая ДИ сразу появилась во вкладке "Отслеживание" (Журнал действий).
  // positionId и departmentId берутся из позиции — tracking связан с должностью и отделом.
  await db.dITracking.create({
    data: {
      generatedDIId: generatedDI.id,
      positionId,
      departmentId: position.departmentId,
      status: 'draft',
    },
  }).catch((e) => {
    log.warn('DITracking creation failed', { diId: generatedDI.id, message: e instanceof Error ? e.message : String(e) })
  })

  // Audit + уведомление: фиксируем создание ДИ в журнале действий.
  logAudit('di_created', request, 'generated-di', generatedDI.id, {
    positionId,
    positionTitle: position.title,
    templateId,
    sourceArchiveId: selectedArchiveDI?.id ?? null,
    sectionsCount: generatedSections.length,
  })
  createNotification({
    userId: session?.user?.id ?? null,
    type: 'status_change',
    title: 'ДИ создана',
    message: `Сгенерирована ДИ: ${generatedDI.title}`,
    entityType: 'generated-di',
    entityId: generatedDI.id,
  })
  return NextResponse.json(generatedDI, { status: 201 })
}, 'generate-di/ai-generate')
