import { NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import {
  listArchiveDIs,
  createArchiveDI,
  updateArchiveDI,
  deleteArchiveDI,
} from '@/services/archive-di-service'

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const result = await listArchiveDIs({
      positionId: searchParams.get('positionId'),
      search: searchParams.get('search'),
      linkStatus: searchParams.get('linkStatus') as 'unlinked' | 'linked' | 'all' | null,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ArchiveDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки архива ДИ' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await request.json()
    const archiveDI = await createArchiveDI(body)
    return NextResponse.json(archiveDI, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ArchiveDI POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания архивной ДИ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await request.json()
    const updated = await updateArchiveDI(body)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ArchiveDI PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления архивной ДИ' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requirePermission('archive', 'write')
    const body = await request.json()
    const result = await deleteArchiveDI(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('ArchiveDI DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления архивной ДИ' }, { status: 500 })
  }
}
