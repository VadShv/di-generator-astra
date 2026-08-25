import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import {
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from '@/services/position-service'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const positions = await listPositions({
      departmentId: searchParams.get('departmentId'),
      grade: searchParams.get('grade'),
      businessFunctionId: searchParams.get('businessFunctionId'),
      projectId: searchParams.get('projectId'),
    })
    return NextResponse.json(positions)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching positions:', error)
    return NextResponse.json({ error: 'Ошибка при получении должностей' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const position = await createPosition(body)
    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating position:', error)
    return NextResponse.json({ error: 'Ошибка при создании должности' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const position = await updatePosition(body)
    return NextResponse.json(position)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating position:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении должности' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const result = await deletePosition(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting position:', error)
    return NextResponse.json({ error: 'Ошибка при удалении должности' }, { status: 500 })
  }
}
