// Сервис управления юридическими лицами (спринт 3).

import { db } from '@/lib/db'
import { ApiError } from '@/lib/api-utils'

const COMPANY_INCLUDE = {
  _count: { select: { departments: true } },
} as const

export interface CreateCompanyInput {
  name: string
  code: string
  shortName?: string | null
  type?: string | null
  director?: string | null
  description?: string | null
  inn?: string | null
  ogrn?: string | null
  kpp?: string | null
  legalAddress?: string | null
  actualAddress?: string | null
}

export interface UpdateCompanyInput {
  id: string
  name?: string
  code?: string
  shortName?: string | null
  type?: string | null
  director?: string | null
  description?: string | null
  inn?: string | null
  ogrn?: string | null
  kpp?: string | null
  legalAddress?: string | null
  actualAddress?: string | null
}

export async function listCompanies() {
  return db.company.findMany({
    include: COMPANY_INCLUDE,
    orderBy: { name: 'asc' },
  })
}

export async function createCompany(input: CreateCompanyInput) {
  const { name, code, shortName, type, director, description, inn, ogrn, kpp, legalAddress, actualAddress } = input

  if (!name || !code) {
    throw new ApiError('Название и код обязательны', 400, 'missing_fields')
  }

  const existing = await db.company.findUnique({ where: { code } })
  if (existing) {
    throw new ApiError('Компания с таким кодом уже существует', 409, 'duplicate_code')
  }

  return db.company.create({
    data: {
      name,
      shortName: shortName || null,
      code,
      type: type || null,
      director: director || null,
      description: description || null,
      inn: inn || null,
      ogrn: ogrn || null,
      kpp: kpp || null,
      legalAddress: legalAddress || null,
      actualAddress: actualAddress || null,
    },
    include: COMPANY_INCLUDE,
  })
}

export async function updateCompany(input: UpdateCompanyInput) {
  const { id, name, code, shortName, type, director, description, inn, ogrn, kpp, legalAddress, actualAddress } = input

  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.company.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('Компания не найдена', 404, 'company_not_found')
  }

  if (code && code !== existing.code) {
    const codeTaken = await db.company.findUnique({ where: { code } })
    if (codeTaken) {
      throw new ApiError('Компания с таким кодом уже существует', 409, 'duplicate_code')
    }
  }

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (code !== undefined) data.code = code
  if (shortName !== undefined) data.shortName = shortName || null
  if (type !== undefined) data.type = type || null
  if (director !== undefined) data.director = director || null
  if (description !== undefined) data.description = description || null
  if (inn !== undefined) data.inn = inn || null
  if (ogrn !== undefined) data.ogrn = ogrn || null
  if (kpp !== undefined) data.kpp = kpp || null
  if (legalAddress !== undefined) data.legalAddress = legalAddress || null
  if (actualAddress !== undefined) data.actualAddress = actualAddress || null

  return db.company.update({
    where: { id },
    data,
    include: COMPANY_INCLUDE,
  })
}

export async function deleteCompany(id: string) {
  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.company.findUnique({
    where: { id },
    include: { departments: true },
  })

  if (!existing) {
    throw new ApiError('Компания не найдена', 404, 'company_not_found')
  }

  if (existing.departments.length > 0) {
    throw new ApiError('Невозможно удалить компанию с подразделениями', 400, 'has_departments')
  }

  await db.company.delete({ where: { id } })
  return { success: true }
}
