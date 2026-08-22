import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/activity-feed — единая лента событий Журнала действий.
//
// Агрегирует события из существующих таблиц (без правок других роутов):
//   - создание/обновление ДИ (GeneratedDI)
//   - версии ДИ (DIVersion)
//   - аудиты ДИ (DIAuditResult)
//   - загрузка архивных ДИ (ArchiveDI)
//   - смена статусов согласования (DITracking)
//   - метки отслеживания (TrackingTag)
//   - ручные записи журнала (ActivityLog)
//
// Фильтры:
//   entityType — company | department | position (тогда лента фильтруется по этой сущности)
//   entityId   — id сущности
//   tagId      — только события конкретной метки
//   limit      — макс. число событий (по умолчанию 100)
//
// Каждое событие приводится к единому формату:
//   { id, type, title, description, author, createdAt, entityType, entityId,
//     diId, diTitle, tagId, metadata }

interface FeedEvent {
  id: string
  type: string
  title: string
  description: string | null
  author: string | null
  createdAt: Date
  entityType: string | null
  entityId: string | null
  diId: string | null
  diTitle: string | null
  tagId: string | null
  metadata: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') // company | department | position
    const entityId = searchParams.get('entityId')
    const tagId = searchParams.get('tagId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    // Если задан фильтр по сущности, нужно вычислить множество positionId,
    // попадающих в область видимости (для company — все должности компании и её
    // подразделений; для department — должности подразделения и его потомков;
    // для position — одна должность).
    let positionIds: string[] | null = null
    let departmentIds: string[] | null = null
    let companyIds: string[] | null = null

    if (entityType && entityId) {
      if (entityType === 'position') {
        positionIds = [entityId]
      } else if (entityType === 'department') {
        // Подразделение + все его потомки.
        const collect = async (rootId: string): Promise<string[]> => {
          const result = [rootId]
          let frontier = [rootId]
          while (frontier.length > 0) {
            const children = await db.department.findMany({
              where: { parentId: { in: frontier } },
              select: { id: true },
            })
            const ids = children.map((c) => c.id)
            if (ids.length === 0) break
            result.push(...ids)
            frontier = ids
          }
          return result
        }
        departmentIds = await collect(entityId)
        const positions = await db.position.findMany({
          where: { departmentId: { in: departmentIds } },
          select: { id: true },
        })
        positionIds = positions.map((p) => p.id)
      } else if (entityType === 'company') {
        companyIds = [entityId]
        const depts = await db.department.findMany({
          where: { companyId: entityId },
          select: { id: true },
        })
        departmentIds = depts.map((d) => d.id)
        const positions = await db.position.findMany({
          where: { departmentId: { in: depts.map((d) => d.id) } },
          select: { id: true },
        })
        positionIds = positions.map((p) => p.id)
      }
    }

    const events: FeedEvent[] = []

    // 1. Создание/обновление ДИ.
    const diWhere: Record<string, unknown> = {}
    if (positionIds !== null) diWhere.positionId = { in: positionIds }
    const generatedDIs = await db.generatedDI.findMany({
      where: diWhere,
      include: { position: { include: { department: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const di of generatedDIs) {
      events.push({
        id: `di-created-${di.id}`,
        type: 'di_created',
        title: `Создана ДИ: ${di.title}`,
        description: `Статус: ${di.status}`,
        author: null,
        createdAt: di.createdAt,
        entityType: 'position',
        entityId: di.positionId,
        diId: di.id,
        diTitle: di.title,
        tagId: null,
        metadata: { status: di.status, version: di.currentVersion },
      })
      // Событие обновления, если updatedAt заметно отличается от createdAt.
      if (di.updatedAt.getTime() - di.createdAt.getTime() > 60_000) {
        events.push({
          id: `di-updated-${di.id}`,
          type: 'di_updated',
          title: `ДИ обновлена: ${di.title}`,
          description: `Текущий статус: ${di.status}, версия ${di.currentVersion}`,
          author: null,
          createdAt: di.updatedAt,
          entityType: 'position',
          entityId: di.positionId,
          diId: di.id,
          diTitle: di.title,
          tagId: null,
          metadata: { status: di.status, version: di.currentVersion },
        })
      }
    }

    // 2. Версии ДИ.
    const versionWhere: Record<string, unknown> = {}
    if (positionIds !== null) {
      versionWhere.generatedDI = { positionId: { in: positionIds } }
    }
    const versions = await db.dIVersion.findMany({
      where: versionWhere,
      include: { generatedDI: { include: { position: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const v of versions) {
      events.push({
        id: `version-${v.id}`,
        type: 'version_created',
        title: `Версия ${v.version} ДИ: ${v.generatedDI?.title ?? '—'}`,
        description: v.changeDescription || (v.isOriginal ? 'Сгенерированная версия' : 'Загруженная версия'),
        author: v.uploadedBy || null,
        createdAt: v.createdAt,
        entityType: 'position',
        entityId: v.generatedDI?.positionId ?? null,
        diId: v.generatedDIId,
        diTitle: v.generatedDI?.title ?? null,
        tagId: null,
        metadata: { version: v.version, isOriginal: v.isOriginal, fileName: v.fileName },
      })
    }

    // 3. Аудиты ДИ.
    const auditWhere: Record<string, unknown> = {}
    if (positionIds !== null) {
      auditWhere.generatedDI = { positionId: { in: positionIds } }
    }
    const audits = await db.dIAuditResult.findMany({
      where: auditWhere,
      include: { generatedDI: { include: { position: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const a of audits) {
      events.push({
        id: `audit-${a.id}`,
        type: 'audit',
        title: `Аудит ДИ: ${a.generatedDI?.title ?? '—'}`,
        description: `${a.auditType}: оценка ${a.overallScore}/100${a.summary ? ' — ' + a.summary : ''}`,
        author: a.auditedBy || null,
        createdAt: a.createdAt,
        entityType: 'position',
        entityId: a.generatedDI?.positionId ?? null,
        diId: a.generatedDIId,
        diTitle: a.generatedDI?.title ?? null,
        tagId: null,
        metadata: { auditType: a.auditType, score: a.overallScore },
      })
    }

    // 4. Загрузка архивных ДИ.
    const archiveWhere: Record<string, unknown> = {}
    if (positionIds !== null) archiveWhere.positionId = { in: positionIds }
    const archives = await db.archiveDI.findMany({
      where: archiveWhere,
      include: { position: true },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    })
    for (const ar of archives) {
      events.push({
        id: `archive-${ar.id}`,
        type: 'archive_uploaded',
        title: `Загружена архивная ДИ: ${ar.title}`,
        description: ar.fileName ? `Файл: ${ar.fileName}` : null,
        author: null,
        createdAt: ar.uploadedAt,
        entityType: ar.positionId ? 'position' : null,
        entityId: ar.positionId ?? null,
        diId: null,
        diTitle: ar.title,
        tagId: null,
        metadata: { fileName: ar.fileName, archiveId: ar.id },
      })
    }

    // 5. Смена статусов согласования (DITracking).
    const trackingWhere: Record<string, unknown> = {}
    if (positionIds !== null) trackingWhere.positionId = { in: positionIds }
    else if (departmentIds !== null) trackingWhere.departmentId = { in: departmentIds }
    const trackings = await db.dITracking.findMany({
      where: trackingWhere,
      include: { generatedDI: { include: { position: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const t of trackings) {
      events.push({
        id: `tracking-${t.id}`,
        type: 'status_change',
        title: `Статус согласования: ${t.status}`,
        description: t.notes || null,
        author: t.assignee || null,
        createdAt: t.createdAt,
        entityType: t.positionId ? 'position' : t.departmentId ? 'department' : null,
        entityId: t.positionId ?? t.departmentId ?? null,
        diId: t.generatedDIId,
        diTitle: t.generatedDI?.title ?? null,
        tagId: null,
        metadata: { status: t.status },
      })
    }

    // 6. Метки отслеживания.
    const tagWhere: Record<string, unknown> = {}
    if (entityType && entityId) {
      tagWhere.entityType = entityType
      tagWhere.entityId = entityId
    }
    if (tagId) tagWhere.id = tagId
    const tags = await db.trackingTag.findMany({
      where: tagWhere,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const tg of tags) {
      events.push({
        id: `tag-${tg.id}`,
        type: tg.isResolved ? 'tag_resolved' : 'tag_created',
        title: `Метка: ${tg.label}`,
        description: tg.note || `Категория: ${tg.kind}`,
        author: tg.assignee || tg.createdBy || null,
        createdAt: tg.createdAt,
        entityType: tg.entityType,
        entityId: tg.entityId,
        diId: null,
        diTitle: null,
        tagId: tg.id,
        metadata: { kind: tg.kind, color: tg.color, isResolved: tg.isResolved, dueDate: tg.dueDate },
      })
    }

    // 7. Ручные записи журнала.
    const logWhere: Record<string, unknown> = {}
    if (entityType && entityId) {
      logWhere.OR = [
        { entityType, entityId },
        // Записи, привязанные к метке на этой сущности.
        { tag: { entityType, entityId } },
      ]
    }
    if (tagId) logWhere.tagId = tagId
    const logs = await db.activityLog.findMany({
      where: logWhere,
      include: { tag: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    for (const lg of logs) {
      events.push({
        id: `log-${lg.id}`,
        type: lg.actionType,
        title: lg.title,
        description: lg.description,
        author: lg.author || null,
        createdAt: lg.createdAt,
        entityType: lg.entityType,
        entityId: lg.entityId,
        diId: lg.generatedDIId,
        diTitle: null,
        tagId: lg.tagId,
        metadata: { actionType: lg.actionType, tagLabel: lg.tag?.label ?? null },
      })
    }

    // Финальная сортировка по убыванию даты и обрезка по лимиту.
    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    const result = events.slice(0, limit)

    return NextResponse.json({
      events: result,
      total: events.length,
      filters: { entityType, entityId, tagId, limit },
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Activity feed error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки ленты действий' }, { status: 500 })
  }
}
