import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('legal-references-id')

// PUT /api/legal-references/[id] — обновление правовой нормы (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = await request.json()
    const { type, article, title, text, category, relatedPositionCodes, isActive } = body

    const existing = await db.legalReference.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Правовая норма не найдена' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (type !== undefined) data.type = type
    if (article !== undefined) data.article = article
    if (title !== undefined) data.title = title
    if (text !== undefined) data.text = text
    if (category !== undefined) data.category = category || null
    if (relatedPositionCodes !== undefined) data.relatedPositionCodes = relatedPositionCodes || null
    if (isActive !== undefined) data.isActive = isActive

    const updated = await db.legalReference.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('LegalReference PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления правовой нормы' }, { status: 500 })
  }
}

// DELETE /api/legal-references/[id] — удаление правовой нормы (admin)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('admin')
    const { id } = await params

    const existing = await db.legalReference.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Правовая норма не найдена' }, { status: 404 })
    }

    await db.legalReference.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('LegalReference DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления правовой нормы' }, { status: 500 })
  }
}
