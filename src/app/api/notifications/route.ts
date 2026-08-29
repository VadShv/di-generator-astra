import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAppSession } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/notifications — список уведомлений текущего пользователя
export async function GET(request: NextRequest) {
  try {
    const session = await getAppSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10))

    const where = {
      OR: [{ userId: session.user.id }, { userId: null }],
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [items, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.notification.count({
        where: { ...where, isRead: false },
      }),
    ])

    return NextResponse.json({ items, unreadCount })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка получения уведомлений' }, { status: 500 })
  }
}

// PUT /api/notifications — отметить как прочитанное
export async function PUT(request: NextRequest) {
  try {
    const session = await getAppSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    const body = await request.json()
    const { id, markAll } = body

    if (markAll) {
      await db.notification.updateMany({
        where: {
          OR: [{ userId: session.user.id }, { userId: null }],
          isRead: false,
        },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true })
    }

   if (id) {
      // IDOR-защита: обновляем только уведомления, принадлежащие текущему
      // пользователю или общие (userId=null). updateMany возвращает count —
      // если 0, значит уведомление чужое/не существует → 404.
      const result = await db.notification.updateMany({
        where: {
          id,
          OR: [{ userId: session.user.id }, { userId: null }],
        },
        data: { isRead: true },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: 'Уведомление не найдено' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
   }

    return NextResponse.json({ error: 'id или markAll required' }, { status: 400 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 })
  }
}
