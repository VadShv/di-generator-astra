import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

// GET /api/generated-di - Paginated list of generated DIs
// Параметры: page, pageSize, status, positionId, search
// Возвращает: { items, total, page, pageSize }
export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const positionId = searchParams.get('positionId')
    const search = searchParams.get('search')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (positionId) where.positionId = positionId
    if (search) where.title = { contains: search, mode: 'insensitive' as const }

    const [items, total] = await Promise.all([
      db.generatedDI.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          currentVersion: true,
          signedByEmployee: true,
          signedAt: true,
          createdAt: true,
          updatedAt: true,
          position: {
            select: {
              id: true,
              title: true,
              code: true,
              grade: true,
              department: {
                select: { id: true, name: true, company: { select: { id: true, name: true } } },
              },
            },
          },
          sourceArchive: { select: { id: true, title: true } },
          _count: { select: { sections: true, versions: true, auditResults: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.generatedDI.count({ where }),
    ])

    const withType = items.map((di) => ({
      ...di,
      type: di.status === 'review' ? 'review' : di.status === 'approved' ? 'approved' : 'draft',
    }))

    return NextResponse.json({ items: withType, total, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('GeneratedDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки сгенерированных ДИ' }, { status: 500 })
  }
}
