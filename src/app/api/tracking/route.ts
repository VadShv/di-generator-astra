import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('tracking')

const validTrackingStatuses = ['draft', 'review', 'approved', 'exported', 'outdated', 'missing']

const trackingCreateSchema = z.object({
  generatedDIId: z.string().trim().min(1),
  status: z.enum(validTrackingStatuses as [string, ...string[]]),
  assignee: z.string().max(255).optional(),
  notes: z.string().max(10_000).optional(),
})

const trackingUpdateSchema = z.object({
  status: z.enum(validTrackingStatuses as [string, ...string[]]).optional(),
  assignee: z.string().max(255).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
})

// GET /api/tracking - List all tracking entries with DI and position info
export async function GET(request: Request) {
  try {
    await requireAuth()
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
      take: 500,
    })

    return NextResponse.json(trackings)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Tracking GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки отслеживаний' }, { status: 500 })
  }
}

// POST /api/tracking - Create tracking entry
export async function POST(request: Request) {
  try {
    await requireAuth()
    const { generatedDIId, status, assignee, notes } = await parseBody(request, trackingCreateSchema)

    // Verify GeneratedDI exists и получаем position для связи с должностью/отделом
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
      include: { position: { select: { id: true, departmentId: true } } },
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
        // Кросс-модульная связь: positionId и departmentId из GeneratedDI.position,
        // чтобы tracking-запись была связана с должностью/отделом для activity-feed.
        positionId: generatedDI.positionId,
        departmentId: generatedDI.position?.departmentId ?? null,
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
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Tracking POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания записи отслеживания' }, { status: 500 })
  }
}

// PUT /api/tracking - Update tracking entry
export async function PUT(request: Request) {
  try {
    await requireAuth()
    const body = await parseBody(request, z.object({ id: z.string().trim().min(1) }).extend(trackingUpdateSchema.shape))
    const { id, status, assignee, notes } = body

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
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Tracking PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления записи отслеживания' }, { status: 500 })
  }
}

// DELETE /api/tracking - Delete tracking entry
export async function DELETE(request: Request) {
  try {
    await requireRole('admin')
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
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Tracking DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления записи отслеживания' }, { status: 500 })
  }
}
