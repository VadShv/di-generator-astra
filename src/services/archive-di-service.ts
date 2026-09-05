// Сервис управления архивными ДИ (спринт 3).

import { db } from '@/lib/db'
import { ApiError } from '@/lib/api-utils'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const ARCHIVE_INCLUDE = {
  position: {
    include: {
      department: {
        include: { company: true },
      },
    },
  },
} as const

export interface ArchiveListFilters {
  positionId?: string | null
  search?: string | null
  linkStatus?: 'unlinked' | 'linked' | 'all' | null
  page?: number
  pageSize?: number
}

export interface CreateArchiveInput {
  title: string
  content: string
  positionId?: string | null
  fileName?: string | null
}

export interface UpdateArchiveInput {
  id: string
  title?: string
  content?: string
  positionId?: string | null
  fileName?: string | null
}

function buildWhere(filters: ArchiveListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}

  if (filters.positionId) {
    where.positionId = filters.positionId
  } else if (filters.linkStatus === 'unlinked') {
    where.positionId = null
  } else if (filters.linkStatus === 'linked') {
    where.positionId = { not: null }
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { fileName: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  return where
}

export async function listArchiveDIs(filters: ArchiveListFilters = {}) {
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, filters.pageSize || DEFAULT_PAGE_SIZE)
  const where = buildWhere(filters)

  const [items, total] = await Promise.all([
    db.archiveDI.findMany({
      where,
      select: {
        id: true,
        title: true,
        content: true,
        fileName: true,
        uploadedAt: true,
        createdAt: true,
        updatedAt: true,
        positionId: true,
        position: {
          select: {
            id: true,
            title: true,
            department: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
          },
        },
        _count: { select: { derivedGeneratedDIs: true } },
      },
      orderBy: { uploadedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.archiveDI.count({ where }),
  ])

  return {
    items: items.map((di) => ({
      ...di,
      type: 'archive' as const,
      derivedCount: di._count?.derivedGeneratedDIs ?? 0,
    })),
    total,
    page,
    pageSize,
  }
}

export async function createArchiveDI(input: CreateArchiveInput) {
  const { title, content, positionId, fileName } = input

  if (!title || !content) {
    throw new ApiError('Название и содержание обязательны', 400, 'missing_fields')
  }

  if (positionId) {
    const position = await db.position.findUnique({ where: { id: positionId } })
    if (!position) {
      throw new ApiError('Должность не найдена', 404, 'position_not_found')
    }
  }

  return db.archiveDI.create({
    data: {
      title,
      content,
      positionId: positionId || null,
      fileName: fileName || null,
    },
    include: ARCHIVE_INCLUDE,
  })
}

export async function updateArchiveDI(input: UpdateArchiveInput) {
  const { id, title, content, positionId, fileName } = input

  if (!id) {
    throw new ApiError('ID обязателен для обновления', 400, 'missing_id')
  }

  const existing = await db.archiveDI.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('Архивная ДИ не найдена', 404, 'archive_not_found')
  }

  if (positionId !== undefined && positionId !== null) {
    const position = await db.position.findUnique({ where: { id: positionId } })
    if (!position) {
      throw new ApiError('Должность не найдена', 404, 'position_not_found')
    }
  }

  const data: Record<string, unknown> = {}
  if (title !== undefined) data.title = title
  if (content !== undefined) data.content = content
  if (positionId !== undefined) data.positionId = positionId || null
  if (fileName !== undefined) data.fileName = fileName

  return db.archiveDI.update({
    where: { id },
    data,
    include: ARCHIVE_INCLUDE,
  })
}

export async function deleteArchiveDI(id: string) {
  if (!id) {
    throw new ApiError('ID обязателен для удаления', 400, 'missing_id')
  }

  const existing = await db.archiveDI.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('Архивная ДИ не найдена', 404, 'archive_not_found')
  }

  await db.archiveDI.delete({ where: { id } })
  return { success: true }
}
