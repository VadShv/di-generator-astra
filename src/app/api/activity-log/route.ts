import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/activity-log — ручные записи журнала.
// Фильтры: entityType, entityId, tagId, generatedDIId.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const tagId = searchParams.get('tagId')
    const generatedDIId = searchParams.get('generatedDIId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (tagId) where.tagId = tagId
    if (generatedDIId) where.generatedDIId = generatedDIId

    const logs = await db.activityLog.findMany({
      where,
      include: { tag: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    })

    return NextResponse.json(logs)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ActivityLog GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки журнала' }, { status: 500 })
  }
}

// POST /api/activity-log — добавить запись в журнал.
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { actionType, entityType, entityId, tagId, title, description, author, generatedDIId } = body

    if (!title) {
      return NextResponse.json({ error: 'title обязателен' }, { status: 400 })
    }

    const log = await db.activityLog.create({
      data: {
        actionType: actionType || 'note',
        entityType: entityType || null,
        entityId: entityId || null,
        tagId: tagId || null,
        title,
        description: description || null,
        author: author || null,
        generatedDIId: generatedDIId || null,
      },
      include: { tag: true },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ActivityLog POST error:', error)
    return NextResponse.json({ error: 'Ошибка добавления записи' }, { status: 500 })
  }
}

// DELETE /api/activity-log — удалить запись.
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.activityLog.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
    }

    await db.activityLog.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ActivityLog DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления записи' }, { status: 500 })
  }
}
