import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tracking - List all tracking entries with DI and position info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignee = searchParams.get('assignee')
    const generatedDIId = searchParams.get('generatedDIId')

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (assignee) {
      where.assignee = { contains: assignee }
    }

    if (generatedDIId) {
      where.generatedDIId = generatedDIId
    }

    const trackings = await db.dITracking.findMany({
      where,
      include: {
        generatedDI: {
          include: {
            position: {
              include: {
                department: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(trackings)
  } catch (error) {
    console.error('Tracking GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки отслеживаний' }, { status: 500 })
  }
}

// POST /api/tracking - Create tracking entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { generatedDIId, status, assignee, notes } = body

    if (!generatedDIId || !status) {
      return NextResponse.json(
        { error: 'generatedDIId и status обязательны' },
        { status: 400 }
      )
    }

    // Verify GeneratedDI exists
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
    })

    if (!generatedDI) {
      return NextResponse.json(
        { error: 'Сгенерированная ДИ не найдена' },
        { status: 404 }
      )
    }

    const tracking = await db.dITracking.create({
      data: {
        generatedDIId,
        status,
        assignee: assignee || null,
        notes: notes || null,
      },
      include: {
        generatedDI: {
          include: {
            position: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(tracking, { status: 201 })
  } catch (error) {
    console.error('Tracking POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания записи отслеживания' }, { status: 500 })
  }
}

// PUT /api/tracking - Update tracking entry
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status, assignee, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен для обновления' },
        { status: 400 }
      )
    }

    const existing = await db.dITracking.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Запись отслеживания не найдена' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (assignee !== undefined) updateData.assignee = assignee || null
    if (notes !== undefined) updateData.notes = notes || null

    const updated = await db.dITracking.update({
      where: { id },
      data: updateData,
      include: {
        generatedDI: {
          include: {
            position: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Tracking PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления записи отслеживания' }, { status: 500 })
  }
}

// DELETE /api/tracking - Delete tracking entry
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен для удаления' },
        { status: 400 }
      )
    }

    const existing = await db.dITracking.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Запись отслеживания не найдена' },
        { status: 404 }
      )
    }

    await db.dITracking.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tracking DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления записи отслеживания' }, { status: 500 })
  }
}
