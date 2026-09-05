import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/services/department-service'
import { createDepartmentSchema, updateDepartmentSchema, deleteDepartmentSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'

const log = createLogger('departments')

export async function GET() {
  try {
    await requireAuth()
    const departments = await listDepartments()
    return NextResponse.json(departments)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching departments:', { error })
    return NextResponse.json({ error: 'Ошибка при получении подразделений' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, createDepartmentSchema)
    const department = await createDepartment(body as unknown as Parameters<typeof createDepartment>[0])
    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, updateDepartmentSchema)
    const department = await updateDepartment(body as unknown as Parameters<typeof updateDepartment>[0])
    return NextResponse.json(department)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, deleteDepartmentSchema)
    const result = await deleteDepartment(body.id)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
