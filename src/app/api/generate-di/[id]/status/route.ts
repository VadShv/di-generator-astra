import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAppSession } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/generate-di/[id]/status — история смены статусов ДИ
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAppSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    const { id } = await params

    const history = await db.dIStatusChange.findMany({
      where: { generatedDIId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(history)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка получения истории статусов' }, { status: 500 })
  }
}

// POST /api/generate-di/[id]/status — смена статуса ДИ с комментарием
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAppSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { toStatus, comment } = body

    const validStatuses = ['draft', 'review', 'approved', 'exported']
    if (!validStatuses.includes(toStatus)) {
      return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 })
    }

    const di = await db.generatedDI.findUnique({ where: { id }, select: { status: true } })
    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    if (di.status === toStatus) {
      return NextResponse.json({ error: 'Статус уже установлен' }, { status: 400 })
    }

    // Обновляем статус и записываем историю
    const [updatedDi] = await Promise.all([
      db.generatedDI.update({
        where: { id },
        data: { status: toStatus },
        select: { id: true, status: true, title: true },
      }),
      db.dIStatusChange.create({
        data: {
          generatedDIId: id,
          fromStatus: di.status,
          toStatus,
          comment: comment || null,
          userId: session.user.id || null,
          userEmail: session.user.email || null,
        },
      }),
    ])

    return NextResponse.json(updatedDi)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error changing DI status:', error)
    return NextResponse.json({ error: 'Ошибка смены статуса' }, { status: 500 })
  }
}
