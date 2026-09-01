import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import {
  listGeneratedDIs,
  createGeneratedDI,
  updateGeneratedDI,
  deleteGeneratedDI,
} from '@/services/generated-di-service'

import { createLogger } from '@/lib/logger'

const log = createLogger('generate-di')

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const generatedDIs = await listGeneratedDIs({
      positionId: searchParams.get('positionId'),
      status: searchParams.get('status'),
    })
    return NextResponse.json(generatedDIs)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GenerateDI GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки сгенерированных ДИ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('generation', 'write')
    const body = await request.json()
    const generatedDI = await createGeneratedDI(body)
    return NextResponse.json(generatedDI, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GenerateDI POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания ДИ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission('generation', 'write')
    const body = await request.json()
    const finalDI = await updateGeneratedDI(body)
    return NextResponse.json(finalDI)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GenerateDI PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления ДИ' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission('generation', 'write')
    const body = await request.json()
    const result = await deleteGeneratedDI(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GenerateDI DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления ДИ' }, { status: 500 })
  }
}
