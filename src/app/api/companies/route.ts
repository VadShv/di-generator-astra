import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import {
  listCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from '@/services/company-service'

export async function GET() {
  try {
    await requireAuth()
    const companies = await listCompanies()
    return NextResponse.json(companies)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching companies:', error)
    return NextResponse.json({ error: 'Ошибка при получении компаний' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const company = await createCompany(body)
    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating company:', error)
    return NextResponse.json({ error: 'Ошибка при создании компании' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const company = await updateCompany(body)
    return NextResponse.json(company)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating company:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении компании' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const result = await deleteCompany(body.id)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting company:', error)
    return NextResponse.json({ error: 'Ошибка при удалении компании' }, { status: 500 })
  }
}
