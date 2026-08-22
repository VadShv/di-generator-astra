import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// PUT /api/position-attributes/[id] — обновление признака
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = await request.json()
    const { name, code, description, promptAddition, category, isActive } = body

    const existing = await db.positionAttribute.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Признак не найден' },
        { status: 404 }
      )
    }

    if (code && code !== existing.code) {
      const conflict = await db.positionAttribute.findUnique({ where: { code } })
      if (conflict) {
        return NextResponse.json(
          { error: 'Признак с таким кодом уже существует' },
          { status: 409 }
        )
      }
    }

    const updated = await db.positionAttribute.update({
      where: { id },
      data: {
        name: name ?? undefined,
        code: code ?? undefined,
        description: description !== undefined ? description || null : undefined,
        promptAddition: promptAddition ?? undefined,
        category: category !== undefined ? category || null : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating position attribute:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении признака должности' },
      { status: 500 }
    )
  }
}

// DELETE /api/position-attributes/[id] — удаление признака
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params

    const existing = await db.positionAttribute.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Признак не найден' },
        { status: 404 }
      )
    }

    await db.positionAttribute.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting position attribute:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении признака должности' },
      { status: 500 }
    )
  }
}
