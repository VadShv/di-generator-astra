import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/position-lineages/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const lineage = await db.positionLineage.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        items: {
          include: { position: { select: { id: true, title: true, code: true, grade: true } } },
          orderBy: { level: 'asc' },
        },
      },
    })
    if (!lineage) return NextResponse.json({ error: 'Линейка не найдена' }, { status: 404 })
    return NextResponse.json(lineage)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}

// PUT /api/position-lineages/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { name, description, departmentId, items } = body

    const existing = await db.positionLineage.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Линейка не найдена' }, { status: 404 })

    // Обновляем базовые поля
    await db.positionLineage.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description !== undefined ? description || null : undefined,
        departmentId: departmentId !== undefined ? departmentId || null : undefined,
      },
    })

    // Если переданы items — заменяем весь набор
    if (items && Array.isArray(items)) {
      await db.positionLineageItem.deleteMany({ where: { lineageId: id } })
      if (items.length > 0) {
        await db.positionLineageItem.createMany({
          data: items.map((item: { positionId: string; level: number; levelLabel?: string }) => ({
            lineageId: id,
            positionId: item.positionId,
            level: item.level,
            levelLabel: item.levelLabel || null,
          })),
        })
      }
    }

    const updated = await db.positionLineage.findUnique({
      where: { id },
      include: {
        items: {
          include: { position: { select: { id: true, title: true, code: true } } },
          orderBy: { level: 'asc' },
        },
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка обновления линейки' }, { status: 500 })
  }
}

// DELETE /api/position-lineages/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    await db.positionLineage.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка удаления линейки' }, { status: 500 })
  }
}
