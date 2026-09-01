import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('position-attributes')

// GET /api/position-attributes — список признаков должности
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const isActiveFilter = searchParams.get('isActive')

    const where = isActiveFilter !== null
      ? { isActive: isActiveFilter === 'true' }
      : {}

    const attributes = await db.positionAttribute.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(attributes)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching position attributes:', { error })
    return NextResponse.json(
      { error: 'Ошибка при получении признаков должности' },
      { status: 500 }
    )
  }
}

// POST /api/position-attributes — создание признака
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { name, code, description, promptAddition, category, isActive } = body

    if (!name || !code || !promptAddition) {
      return NextResponse.json(
        { error: 'Название, код и текст-инструкция обязательны' },
        { status: 400 }
      )
    }

    const existing = await db.positionAttribute.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json(
        { error: 'Признак с таким кодом уже существует' },
        { status: 409 }
      )
    }

    const attribute = await db.positionAttribute.create({
      data: {
        name,
        code,
        description: description || null,
        promptAddition,
        category: category || null,
        isActive: isActive !== false,
      }
    })

    return NextResponse.json(attribute, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error creating position attribute:', { error })
    return NextResponse.json(
      { error: 'Ошибка при создании признака должности' },
      { status: 500 }
    )
  }
}
