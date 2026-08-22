import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/master-prompts/test-results — история тестов промпта.
// ?masterPromptId=... — фильтр по промпту.
// ?limit=20 — ограничение количества.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const masterPromptId = searchParams.get('masterPromptId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100)

    const where: Record<string, unknown> = {}
    if (masterPromptId) where.masterPromptId = masterPromptId

    const results = await db.promptTestResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(results)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('TestResults GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки результатов тестов' }, { status: 500 })
  }
}

// PUT /api/master-prompts/test-results — выставить оценку результату теста.
// Тело: { id, rating }  rating: 1-5
export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, rating } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID результата обязателен' }, { status: 400 })
    }

    const ratingNum = typeof rating === 'number' ? rating : parseInt(String(rating), 10)
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'Оценка должна быть от 1 до 5' }, { status: 400 })
    }

    const existing = await db.promptTestResult.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Результат теста не найден' }, { status: 404 })
    }

    const updated = await db.promptTestResult.update({
      where: { id },
      data: { rating: ratingNum },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('TestResults PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления оценки' }, { status: 500 })
  }
}
