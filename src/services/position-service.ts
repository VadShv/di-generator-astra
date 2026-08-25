// Сервис управления должностями (спринт 3: вынос бизнес-логики из API-роутов).
// Все проверки, валидации и операции БД сосредоточены здесь.
// API Route Handlers — тонкие адаптеры HTTP→Service.

import { db } from '@/lib/db'
import { ApiError } from '@/lib/api-utils'

const VALID_GRADES = ['линейная', 'руководитель'] as const
type ValidGrade = (typeof VALID_GRADES)[number]

export interface PositionListFilters {
  departmentId?: string | null
  grade?: string | null
  businessFunctionId?: string | null
  projectId?: string | null
}

export interface CreatePositionInput {
  title: string
  code: string
  departmentId: string
  grade?: string | null
  businessFunctionId?: string | null
  projectId?: string | null
  headcount?: number | null
  functions?: string | null
  attributeIds?: string[]
}

export interface UpdatePositionInput {
  id: string
  title?: string
  code?: string
  departmentId?: string
  grade?: string | null
  businessFunctionId?: string | null
  projectId?: string | null
  headcount?: number | null
  functions?: string | null
  attributeIds?: string[]
}

const POSITION_INCLUDE = {
  department: { include: { company: true } },
  businessFunction: true,
  project: true,
  generatedDIs: { select: { id: true, status: true, signedByEmployee: true } },
  archiveDIs: { select: { id: true } },
  attributes: true,
} as const

/** Построить Prisma-where по фильтрам. */
function buildWhere(filters: PositionListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (filters.departmentId) where.departmentId = filters.departmentId
  if (filters.grade) where.grade = filters.grade
  if (filters.businessFunctionId) where.businessFunctionId = filters.businessFunctionId
  if (filters.projectId) where.projectId = filters.projectId
  return where
}

function assertValidGrade(grade: string | null | undefined): void {
  if (grade && !VALID_GRADES.includes(grade as ValidGrade)) {
    throw new ApiError('Грейд должен быть "линейная" или "руководитель"', 400, 'invalid_grade')
  }
}

async function assertUniqueCode(code: string, excludeId?: string): Promise<void> {
  const existing = await db.position.findUnique({ where: { code } })
  if (existing && existing.id !== excludeId) {
    throw new ApiError('Должность с таким кодом уже существует', 409, 'duplicate_code')
  }
}

async function assertDepartmentExists(departmentId: string): Promise<void> {
  const dept = await db.department.findUnique({ where: { id: departmentId } })
  if (!dept) {
    throw new ApiError('Подразделение не найдено', 404, 'department_not_found')
  }
}

async function assertBusinessFunctionExists(id: string): Promise<void> {
  const bf = await db.businessFunction.findUnique({ where: { id } })
  if (!bf) {
    throw new ApiError('Бизнес-функция не найдена', 404, 'business_function_not_found')
  }
}

async function assertProjectExists(id: string): Promise<void> {
  const proj = await db.project.findUnique({ where: { id } })
  if (!proj) {
    throw new ApiError('Проект не найден', 404, 'project_not_found')
  }
}

// ───────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────

export async function listPositions(filters: PositionListFilters = {}) {
  return db.position.findMany({
    where: buildWhere(filters),
    include: POSITION_INCLUDE,
    orderBy: { title: 'asc' },
  })
}

export async function createPosition(input: CreatePositionInput) {
  const { title, code, departmentId, grade, businessFunctionId, projectId, headcount, functions, attributeIds } = input

  if (!title || !code || !departmentId) {
    throw new ApiError('Название, код и подразделение обязательны', 400, 'missing_fields')
  }

  assertValidGrade(grade)
  await assertUniqueCode(code)
  await assertDepartmentExists(departmentId)
  if (businessFunctionId) await assertBusinessFunctionExists(businessFunctionId)
  if (projectId) await assertProjectExists(projectId)

  return db.position.create({
    data: {
      title,
      code,
      departmentId,
      grade: grade || null,
      businessFunctionId: businessFunctionId || null,
      projectId: projectId || null,
      headcount: headcount || 1,
      functions: functions || null,
      ...(attributeIds && attributeIds.length > 0 && {
        attributes: { connect: attributeIds.map((id) => ({ id })) },
      }),
    },
    include: POSITION_INCLUDE,
  })
}

export async function updatePosition(input: UpdatePositionInput) {
  const { id, title, code, departmentId, grade, businessFunctionId, projectId, headcount, functions, attributeIds } = input

  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.position.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('Должность не найдена', 404, 'position_not_found')
  }

  assertValidGrade(grade)
  if (code && code !== existing.code) await assertUniqueCode(code, id)
  if (departmentId && departmentId !== existing.departmentId) await assertDepartmentExists(departmentId)
  if (businessFunctionId) await assertBusinessFunctionExists(businessFunctionId)
  if (projectId) await assertProjectExists(projectId)

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (code !== undefined) data.code = code
  if (departmentId !== undefined) data.departmentId = departmentId
  if (grade !== undefined) data.grade = grade || null
  if (businessFunctionId !== undefined) data.businessFunctionId = businessFunctionId || null
  if (projectId !== undefined) data.projectId = projectId || null
  if (headcount !== undefined) data.headcount = headcount
  if (functions !== undefined) data.functions = functions || null
  if (attributeIds !== undefined) {
    data.attributes = { set: attributeIds.map((aid) => ({ id: aid })) }
  }

  return db.position.update({
    where: { id },
    data,
    include: POSITION_INCLUDE,
  })
}

export async function deletePosition(id: string) {
  if (!id) {
    throw new ApiError('ID обязателен', 400, 'missing_id')
  }

  const existing = await db.position.findUnique({
    where: { id },
    include: { archiveDIs: true, generatedDIs: true },
  })

  if (!existing) {
    throw new ApiError('Должность не найдена', 404, 'position_not_found')
  }

  if (existing.archiveDIs.length > 0 || existing.generatedDIs.length > 0) {
    throw new ApiError('Невозможно удалить должность с привязанными ДИ', 400, 'has_linked_di')
  }

  await db.position.delete({ where: { id } })
  return { success: true }
}
