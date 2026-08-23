import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

// GET /api/audit-log — пагинированный список действий пользователей
export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)

    const where: Record<string, unknown> = {}
    if (userId) where.userId = userId
    if (action) where.action = { contains: action, mode: 'insensitive' }

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({ items, total, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching audit log:', error)
    return NextResponse.json({ error: 'Ошибка получения журнала действий' }, { status: 500 })
  }
}
