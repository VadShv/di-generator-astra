import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/position-lineages — список линеек
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const lineages = await db.positionLineage.findMany({
      include: {
        department: { select: { id: true, name: true } },
        items: {
          include: {
            position: { select: { id: true, title: true, code: true, grade: true } },
          },
          orderBy: { level: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(lineages)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching lineages:', error)
    return NextResponse.json({ error: 'Ошибка получения линеек' }, { status: 500 })
  }
}

// POST /api/position-lineages — создание линейки
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { name, description, departmentId, items } = body

    if (!name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Название и минимум одна должность обязательны' }, { status: 400 })
    }

    const lineage = await db.positionLineage.create({
      data: {
        name,
        description: description || null,
        departmentId: departmentId || null,
        items: {
          create: items.map((item: { positionId: string; level: number; levelLabel?: string }) => ({
            positionId: item.positionId,
            level: item.level,
            levelLabel: item.levelLabel || null,
          })),
        },
      },
      include: {
        items: { include: { position: { select: { id: true, title: true, code: true } } }, orderBy: { level: 'asc' } },
      },
    })

    return NextResponse.json(lineage, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating lineage:', error)
    return NextResponse.json({ error: 'Ошибка создания линейки' }, { status: 500 })
  }
}
