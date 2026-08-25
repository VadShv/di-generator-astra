// Сервис управления подразделениями (спринт 3).

import { db } from '@/lib/db'
import { ApiError } from '@/lib/api-utils'

const DEPARTMENT_INCLUDE = {
  parent: true,
  children: true,
  company: true,
  _count: { select: { positions: true } },
} as const

export interface CreateDepartmentInput {
  name: string
  code: string
  parentId?: string | null
  companyId?: string | null
}

export interface UpdateDepartmentInput {
  id: string
  name?: string
  code?: string
  parentId?: string | null
  companyId?: string | null
}

export async function listDepartments() {
  return db.department.findMany({
    include: DEPARTMENT_INCLUDE,
    orderBy: { name: 'asc' },
  })
}

export async function createDepartment(input: CreateDepartmentInput) {
  const { name, code, parentId, companyId } = input

  if (!name || !code) {
    throw new ApiError('Название и код обязательны', 400, 'missing_fields')
  }

  const existing = await db.department.findUnique({ where: { code } })
  if (existing) {
    throw new ApiError('Подразделение с таким кодом уже существует', 409, 'duplicate_code')
  }

  if (parentId) {
    const parent = await db.department.findUnique({ where: { id: parentId } })
    if (!parent) {
      throw new ApiError('Родительское подразделение не найдено', 404, 'parent_not_found')
    }
  }

  return db.department.create({
    data: {
      name,
      code,
      parentId: parentId || null,
      companyId: companyId || null,
    },
    include: DEPARTMENT_INCLUDE,
  })
}

export async function updateDepartment(input: UpdateDepartmentInput) {
  const { id, name, code, parentId, companyId } = input

  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.department.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('Подразделение не найдено', 404, 'department_not_found')
  }

  if (code && code !== existing.code) {
    const codeTaken = await db.department.findUnique({ where: { code } })
    if (codeTaken) {
      throw new ApiError('Подразделение с таким кодом уже существует', 409, 'duplicate_code')
    }
  }

  if (parentId === id) {
    throw new ApiError('Подразделение не может быть родителем самому себе', 400, 'circular_reference')
  }

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name
  if (code !== undefined) data.code = code
  if (parentId !== undefined) data.parentId = parentId || null
  if (companyId !== undefined) data.companyId = companyId || null

  return db.department.update({
    where: { id },
    data,
    include: DEPARTMENT_INCLUDE,
  })
}

export async function deleteDepartment(id: string) {
  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.department.findUnique({
    where: { id },
    include: { children: true, positions: true },
  })

  if (!existing) {
    throw new ApiError('Подразделение не найдено', 404, 'department_not_found')
  }

  if (existing.children.length > 0) {
    throw new ApiError('Невозможно удалить подразделение с дочерними элементами', 400, 'has_children')
  }

  if (existing.positions.length > 0) {
    throw new ApiError('Невозможно удалить подразделение с должностями', 400, 'has_positions')
  }

  await db.department.delete({ where: { id } })
  return { success: true }
}
