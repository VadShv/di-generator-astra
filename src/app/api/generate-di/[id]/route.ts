import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { getGeneratedDIById } from '@/services/generated-di-service'

import { createLogger } from '@/lib/logger'

const log = createLogger('generate-di')

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const di = await getGeneratedDIById(id)
    return NextResponse.json(di)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GenerateDI GET by id error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки ДИ' }, { status: 500 })
  }
}
