import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import {
  createArchiveDISchema,
  updateArchiveDISchema,
  deleteArchiveDISchema,
} from '@/lib/validation/schemas'
import {
  listArchiveDIs,
  createArchiveDI,
  updateArchiveDI,
  deleteArchiveDI,
} from '@/services/archive-di-service'

import { createLogger } from '@/lib/logger'

const log = createLogger('archive-di')

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const result = await listArchiveDIs({
      positionId: searchParams.get('positionId'),
      search: searchParams.get('search'),
     linkStatus: searchParams.get('linkStatus') as 'unlinked' | 'linked' | 'all' | null,
      page: searchParams.get('page')
        ? Math.max(1, Number(searchParams.get('page')) || 1)
        : undefined,
      pageSize: searchParams.get('pageSize')
        ? Math.max(1, Number(searchParams.get('pageSize')) || 1)
        : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('ArchiveDI GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки архива ДИ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await parseBody(request, createArchiveDISchema)
    const archiveDI = await createArchiveDI(body)
    return NextResponse.json(archiveDI, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('ArchiveDI POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания архивной ДИ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await parseBody(request, updateArchiveDISchema)
    const updated = await updateArchiveDI(body)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('ArchiveDI PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления архивной ДИ' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await parseBody(request, deleteArchiveDISchema)
    const result = await deleteArchiveDI(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('ArchiveDI DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления архивной ДИ' }, { status: 500 })
  }
}
