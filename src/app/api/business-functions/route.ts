import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET: List all business functions, optionally filtered by isActive
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const isActiveFilter = searchParams.get('isActive')

    const where = isActiveFilter !== null
      ? { isActive: isActiveFilter === 'true' }
      : {}

    const businessFunctions = await db.businessFunction.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(businessFunctions)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching business functions:', error)
    return NextResponse.json(
      { error: 'Ошибка при получении бизнес-функций' },
      { status: 500 }
    )
  }
}

// POST: Create a new business function
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { name, code, description, isActive } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Название бизнес-функции обязательно' },
        { status: 400 }
      )
    }

    // Check uniqueness of name
    const existing = await db.businessFunction.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json(
        { error: 'Бизнес-функция с таким названием уже существует' },
        { status: 409 }
      )
    }

    const businessFunction = await db.businessFunction.create({
      data: {
        name,
        code: code || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(businessFunction, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating business function:', error)
    return NextResponse.json(
      { error: 'Ошибка при создании бизнес-функции' },
      { status: 500 }
    )
  }
}

// PUT: Update a business function
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, name, code, description, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен' },
        { status: 400 }
      )
    }

    const existing = await db.businessFunction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Бизнес-функция не найдена' },
        { status: 404 }
      )
    }

    // Check unique name constraint if name is being changed
    if (name !== undefined && name !== existing.name) {
      const nameTaken = await db.businessFunction.findUnique({ where: { name } })
      if (nameTaken) {
        return NextResponse.json(
          { error: 'Бизнес-функция с таким названием уже существует' },
          { status: 409 }
        )
      }
    }

    const businessFunction = await db.businessFunction.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: code || null }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(businessFunction)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating business function:', error)
    return NextResponse.json(
      { error: 'Ошибка при обновлении бизнес-функции' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a business function by id, checking for referencing positions
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен' },
        { status: 400 }
      )
    }

    const existing = await db.businessFunction.findUnique({
      where: { id },
      include: { positions: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Бизнес-функция не найдена' },
        { status: 404 }
      )
    }

    if (existing.positions.length > 0) {
      return NextResponse.json(
        { error: 'Невозможно удалить бизнес-функцию, привязанную к должностям' },
        { status: 400 }
      )
    }

    await db.businessFunction.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting business function:', error)
    return NextResponse.json(
      { error: 'Ошибка при удалении бизнес-функции' },
      { status: 500 }
    )
  }
}
