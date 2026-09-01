import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePermission, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

import {
  createPromptChainSchema,
  updatePromptChainSchema,
  deletePromptChainSchema,
} from '@/lib/validation/schemas'

const log = createLogger('prompt-chains')

// GET /api/prompt-chains — список цепочек промптов.
// ?active=true — только активные.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true

    const chains = await db.promptChain.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    })

    // Парсим steps из JSON для удобства клиента.
    const result = chains.map((chain) => ({
      ...chain,
      steps: safeParseSteps(chain.steps),
    }))

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PromptChains GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки цепочек промптов' }, { status: 500 })
  }
}

// POST /api/prompt-chains — создание цепочки промптов.
// Тело: { name, description?, steps?: Array<{category, order, stopOnError}>, isActive? }
export async function POST(request: NextRequest) {
  try {
    await requirePermission('master-prompts', 'write')
    const body = await parseBody(request, createPromptChainSchema)
    const { name, description, steps, isActive } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Название цепочки обязательно' }, { status: 400 })
    }

    const stepsJson = stringifySteps(steps)

    // Атомарно: снимаем isActive с остальных + создаём новую (защита от race condition).
    const chain = await db.$transaction(async (tx) => {
      if (isActive === true) {
        await tx.promptChain.updateMany({ where: { isActive: true }, data: { isActive: false } })
      }
      return tx.promptChain.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          steps: stepsJson,
          isActive: isActive === true,
        },
      })
    })

    return NextResponse.json({ ...chain, steps: safeParseSteps(chain.steps) }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PromptChains POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания цепочки промптов' }, { status: 500 })
  }
}

// PUT /api/prompt-chains — обновление цепочки промптов.
// Тело: { id, name?, description?, steps?, isActive? }
export async function PUT(request: NextRequest) {
  try {
    await requirePermission('master-prompts', 'write')
    const body = await parseBody(request, updatePromptChainSchema)
    const { id, name, description, steps, isActive } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID цепочки обязателен' }, { status: 400 })
    }

    const existing = await db.promptChain.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Цепочка не найдена' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (steps !== undefined) updateData.steps = stringifySteps(steps)
    if (isActive !== undefined) updateData.isActive = isActive === true

    // Атомарно: снимаем isActive с остальных + обновляем текущую.
    const chain = await db.$transaction(async (tx) => {
      if (isActive === true && !existing.isActive) {
        await tx.promptChain.updateMany({ where: { isActive: true }, data: { isActive: false } })
      }
      return tx.promptChain.update({ where: { id }, data: updateData })
    })

    return NextResponse.json({ ...chain, steps: safeParseSteps(chain.steps) })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PromptChains PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления цепочки промптов' }, { status: 500 })
  }
}

// DELETE /api/prompt-chains — удаление цепочки промптов.
// Тело: { id }
export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await parseBody(request, deletePromptChainSchema)
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID цепочки обязателен' }, { status: 400 })
    }

    const existing = await db.promptChain.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Цепочка не найдена' }, { status: 404 })
    }

    await db.promptChain.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PromptChains DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления цепочки промптов' }, { status: 500 })
  }
}

// Безопасно распарсить steps из JSON-строки.
function safeParseSteps(stepsJson: string): Array<{ category: string; order: number; stopOnError: boolean }> {
  if (!stepsJson) return []
  try {
    const parsed = JSON.parse(stepsJson)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }
  return []
}

// Привести steps к JSON-строке.
function stringifySteps(steps: unknown): string {
  if (Array.isArray(steps)) return JSON.stringify(steps)
  if (typeof steps === 'string' && steps.trim()) {
    try {
      const parsed = JSON.parse(steps)
      if (Array.isArray(parsed)) return JSON.stringify(parsed)
    } catch {
      // ignore
    }
  }
  return '[]'
}
