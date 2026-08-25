// Сервис управления сгенерированными ДИ (спринт 3).
// Обрабатывает CRUD, версионирование и валидацию статусов.

import { db } from '@/lib/db'
import { ApiError } from '@/lib/api-utils'

const DI_INCLUDE = {
  position: { include: { department: { include: { company: true } }, businessFunction: true } },
  template: true,
  sections: { orderBy: { order: 'asc' } },
  sourceArchive: true,
} as const

const DI_INCLUDE_WITH_VERSIONS = {
  ...DI_INCLUDE,
  versions: { orderBy: { version: 'desc' } },
} as const

const VALID_STATUSES = ['draft', 'review', 'approved', 'exported'] as const

export interface DIListFilters {
  positionId?: string | null
  status?: string | null
}

export interface CreateDIInput {
  positionId: string
  templateId?: string | null
  title: string
  sections?: Array<{ sectionTitle: string; sectionContent: string; order: number }>
}

export interface UpdateDIInput {
  id: string
  title?: string
  status?: string
  sections?: Array<{ sectionTitle: string; sectionContent: string; order: number; aiGenerated?: boolean; editedBy?: string }>
  signedByEmployee?: boolean
  changeDescription?: string
}

function buildWhere(filters: DIListFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  if (filters.positionId) where.positionId = filters.positionId
  if (filters.status) where.status = filters.status
  return where
}

export async function listGeneratedDIs(filters: DIListFilters = {}) {
  return db.generatedDI.findMany({
    where: buildWhere(filters),
    include: {
      position: { include: { department: { include: { company: true } }, businessFunction: true } },
      template: true,
      sections: { orderBy: { order: 'asc' } },
      _count: { select: { sections: true, versions: true } },
      sourceArchive: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createGeneratedDI(input: CreateDIInput) {
  const { positionId, templateId, title, sections } = input

  if (!positionId || typeof positionId !== 'string') {
    throw new ApiError('ID должности обязателен', 400, 'missing_position_id')
  }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new ApiError('Название ДИ обязательно', 400, 'missing_title')
  }

  const position = await db.position.findUnique({
    where: { id: positionId },
    include: { department: { include: { company: true } } },
  })
  if (!position) {
    throw new ApiError('Должность не найдена', 404, 'position_not_found')
  }

  if (templateId) {
    const template = await db.dITemplate.findUnique({ where: { id: templateId } })
    if (!template) {
      throw new ApiError('Шаблон не найден', 404, 'template_not_found')
    }
  }

  const generatedDI = await db.generatedDI.create({
    data: {
      positionId,
      templateId: templateId || null,
      title: title.trim(),
      status: 'draft',
      currentVersion: 1,
      sections:
        sections && Array.isArray(sections) && sections.length > 0
          ? {
              create: sections.map((s) => ({
                sectionTitle: s.sectionTitle.trim(),
                sectionContent: s.sectionContent,
                order: s.order,
                aiGenerated: false,
                editedBy: 'manual',
              })),
            }
          : undefined,
    },
    include: DI_INCLUDE,
  })

  // Create initial version record v1
  const versionContent = JSON.stringify({
    title: generatedDI.title,
    sections: generatedDI.sections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })),
  })
  await db.dIVersion.create({
    data: {
      generatedDIId: generatedDI.id,
      content: versionContent,
      version: 1,
      isOriginal: true,
      changeDescription: 'Начальная версия (ручное создание)',
      uploadedBy: 'manual',
    },
  })

  return generatedDI
}

export async function updateGeneratedDI(input: UpdateDIInput) {
  const { id, title, status, sections, signedByEmployee, changeDescription } = input

  if (!id || typeof id !== 'string') {
    throw new ApiError('ID ДИ обязателен', 400, 'missing_id')
  }

  const existing = await db.generatedDI.findUnique({
    where: { id },
    include: { sections: true },
  })
  if (!existing) {
    throw new ApiError('ДИ не найдена', 404, 'di_not_found')
  }

  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new ApiError('Недопустимый статус', 400, 'invalid_status')
  }

  const signedData: Record<string, unknown> = {}
  if (signedByEmployee !== undefined) {
    signedData.signedByEmployee = signedByEmployee
    signedData.signedAt = signedByEmployee ? new Date() : null
  }

  const sectionsChanged = sections && Array.isArray(sections)
  let newVersionNumber = existing.currentVersion

  if (sectionsChanged) {
    // Save current state as version before updating
    const currentContent = JSON.stringify({
      title: existing.title,
      sections: existing.sections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })),
    })

    const existingVersion = await db.dIVersion.findFirst({
      where: { generatedDIId: id, version: existing.currentVersion },
    })

    if (!existingVersion) {
      await db.dIVersion.create({
        data: {
          generatedDIId: id,
          content: currentContent,
          version: existing.currentVersion,
          isOriginal: existing.currentVersion === 1,
          changeDescription: `Версия v${existing.currentVersion} (авто-сохранение перед изменением)`,
          uploadedBy: 'system',
        },
      })
    }

    newVersionNumber = existing.currentVersion + 1

    await db.generatedDISection.deleteMany({ where: { generatedDIId: id } })

    await db.generatedDI.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        status: status !== undefined ? status : undefined,
        currentVersion: newVersionNumber,
        ...signedData,
        sections: {
          create: sections.map((s) => ({
            sectionTitle: s.sectionTitle.trim(),
            sectionContent: s.sectionContent,
            order: s.order,
            aiGenerated: s.aiGenerated !== undefined ? s.aiGenerated : true,
            editedBy: s.editedBy || null,
          })),
        },
      },
      include: DI_INCLUDE,
    })

    const updated = await db.generatedDI.findUnique({
      where: { id },
      include: { sections: { orderBy: { order: 'asc' } } },
    })

    const newContent = JSON.stringify({
      title: updated?.title || existing.title,
      sections: updated?.sections.map((s) => ({ title: s.sectionTitle, content: s.sectionContent })) || [],
    })

    await db.dIVersion.create({
      data: {
        generatedDIId: id,
        content: newContent,
        version: newVersionNumber,
        isOriginal: false,
        changeDescription: changeDescription || `Обновление до версии v${newVersionNumber}`,
        uploadedBy: 'manual-edit',
      },
    })
  } else {
    await db.generatedDI.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        status: status !== undefined ? status : undefined,
        ...signedData,
      },
      include: DI_INCLUDE,
    })
  }

  return db.generatedDI.findUnique({
    where: { id },
    include: DI_INCLUDE_WITH_VERSIONS,
  })
}

export async function deleteGeneratedDI(id: string) {
  if (!id || typeof id !== 'string') {
    throw new ApiError('ID ДИ обязателен', 400, 'missing_id')
  }

  const existing = await db.generatedDI.findUnique({ where: { id } })
  if (!existing) {
    throw new ApiError('ДИ не найдена', 404, 'di_not_found')
  }

  await db.generatedDI.delete({ where: { id } })
  return { success: true }
}
