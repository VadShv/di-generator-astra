import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/services/department-service'

export async function GET() {
  try {
    await requireAuth()
    const departments = await listDepartments()
    return NextResponse.json(departments)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Ошибка при получении подразделений' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await request.json()
    const department = await createDepartment(body)
    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating department:', error)
    return NextResponse.json({ error: 'Ошибка при создании подразделения' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await request.json()
    const department = await updateDepartment(body)
    return NextResponse.json(department)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении подразделения' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await request.json()
    const result = await deleteDepartment(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting department:', error)
    return NextResponse.json({ error: 'Ошибка при удалении подразделения' }, { status: 500 })
  }
}
