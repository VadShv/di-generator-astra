import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// PUT /api/tracking/update-di-status - Update the GeneratedDI status
export async function PUT(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const { generatedDIId, status } = body

    if (!generatedDIId || !status) {
      return NextResponse.json(
        { error: 'generatedDIId и status обязательны' },
        { status: 400 }
      )
    }

    const validStatuses = ['draft', 'review', 'approved', 'exported']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Недопустимый статус. Допустимые: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Сгенерированная ДИ не найдена' },
        { status: 404 }
      )
    }

    const updated = await db.generatedDI.update({
      where: { id: generatedDIId },
      data: { status },
      include: {
        position: {
          include: {
            department: true,
          },
        },
        trackings: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Update DI status error:', error)
    return NextResponse.json({ error: 'Ошибка обновления статуса ДИ' }, { status: 500 })
  }
}
