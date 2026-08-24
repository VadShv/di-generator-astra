import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/legal-references — список правовых норм
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (category) where.category = category

    const refs = await db.legalReference.findMany({
      where,
      orderBy: [{ type: 'asc' }, { article: 'asc' }],
    })
    return NextResponse.json(refs)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка получения правовых норм' }, { status: 500 })
  }
}

// POST /api/legal-references — создание (admin)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { type, article, title, text, category, relatedPositionCodes } = body

    if (!type || !article || !title || !text) {
      return NextResponse.json({ error: 'Type, article, title и text обязательны' }, { status: 400 })
    }

    const ref = await db.legalReference.create({
      data: {
        type,
        article,
        title,
        text,
        category: category || null,
        relatedPositionCodes: relatedPositionCodes || null,
      },
    })
    return NextResponse.json(ref, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка создания правовой нормы' }, { status: 500 })
  }
}
