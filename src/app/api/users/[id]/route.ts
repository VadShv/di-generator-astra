import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { getAppSession } from '@/lib/auth/session'

// PUT /api/users/[id] — обновление пользователя (только admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = await request.json()
    const { name, role, permissions, isActive } = body

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name || null
    if (role !== undefined) data.role = role
    if (permissions !== undefined) data.permissions = permissions ? JSON.stringify(permissions) : null
    if (isActive !== undefined) data.isActive = isActive

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, permissions: true, isActive: true, lastLoginAt: true, createdAt: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Ошибка обновления пользователя' }, { status: 500 })
  }
}

// DELETE /api/users/[id] — удаление пользователя (только admin, нельзя удалить себя)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole('admin')
    const { id } = await params

    // Нельзя удалить себя
    if (session?.user?.id === id) {
      return NextResponse.json({ error: 'Нельзя удалить свою учётную запись' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    await db.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Ошибка удаления пользователя' }, { status: 500 })
  }
}
