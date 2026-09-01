import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import {
  createCompanySchema,
  updateCompanySchema,
  deleteCompanySchema,
} from '@/lib/validation/schemas'
import {
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from '@/services/company-service'
import { createLogger } from '@/lib/logger'

const log = createLogger('companies')

export async function GET() {
  try {
    await requireAuth()
    const companies = await listCompanies()
    return NextResponse.json(companies)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching companies:', { error })
    return NextResponse.json({ error: 'Ошибка при получении компаний' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, createCompanySchema)
    const company = await createCompany(body)
    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error creating company:', { error })
    return NextResponse.json({ error: 'Ошибка при создании компании' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, updateCompanySchema)
    const company = await updateCompany(body)
    return NextResponse.json(company)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error updating company:', { error })
    return NextResponse.json({ error: 'Ошибка при обновлении компании' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePermission('staff-schedule', 'write')
    const body = await parseBody(request, deleteCompanySchema)
    const result = await deleteCompany(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error deleting company:', { error })
    return NextResponse.json({ error: 'Ошибка при удалении компании' }, { status: 500 })
  }
}
