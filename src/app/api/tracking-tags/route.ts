import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('tracking-tags')

// GET /api/tracking-tags — список меток.
// Фильтры: entityType, entityId, isResolved, assignee.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const isResolved = searchParams.get('isResolved')
    const assignee = searchParams.get('assignee')

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (assignee) where.assignee = { contains: assignee }
    if (isResolved === 'true') where.isResolved = true
    if (isResolved === 'false') where.isResolved = false

    const tags = await db.trackingTag.findMany({
      where,
      include: { _count: { select: { activityLogs: true } } },
      orderBy: [{ isResolved: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(tags)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('TrackingTag GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки меток' }, { status: 500 })
  }
}

// POST /api/tracking-tags — создать метку.
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { entityType, entityId, label, kind, color, assignee, dueDate, note, createdBy } = body

    if (!entityType || !entityId || !label) {
      return NextResponse.json({ error: 'entityType, entityId и label обязательны' }, { status: 400 })
    }
    if (!['company', 'department', 'position'].includes(entityType)) {
      return NextResponse.json({ error: 'Недопустимый entityType' }, { status: 400 })
    }

    const tag = await db.trackingTag.create({
      data: {
        entityType,
        entityId,
        label,
        kind: kind || 'status',
        color: color || 'amber',
        assignee: assignee || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        note: note || null,
        createdBy: createdBy || null,
      },
      include: { _count: { select: { activityLogs: true } } },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('TrackingTag POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания метки' }, { status: 500 })
  }
}

// PUT /api/tracking-tags — обновить метку.
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, label, kind, color, assignee, dueDate, note, isResolved } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.trackingTag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Метка не найдена' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (label !== undefined) data.label = label
    if (kind !== undefined) data.kind = kind
    if (color !== undefined) data.color = color
    if (assignee !== undefined) data.assignee = assignee || null
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
    if (note !== undefined) data.note = note || null
    if (isResolved !== undefined) data.isResolved = isResolved

    const updated = await db.trackingTag.update({
      where: { id },
      data,
      include: { _count: { select: { activityLogs: true } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('TrackingTag PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления метки' }, { status: 500 })
  }
}

// DELETE /api/tracking-tags — удалить метку.
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.trackingTag.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Метка не найдена' }, { status: 404 })
    }

    await db.trackingTag.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('TrackingTag DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления метки' }, { status: 500 })
  }
}
