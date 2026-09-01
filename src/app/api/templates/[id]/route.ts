import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('templates')

// GET /api/templates/[id] - Get single template with full sections.
// Ресурс общекорпоративный (без per-user owner) — доступ регулируется
// матрицей прав: requirePermission('templates', 'read').
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('templates', 'read')
    const { id } = await params

    const template = await db.dITemplate.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Template GET [id] error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки шаблона' }, { status: 500 })
  }
}
