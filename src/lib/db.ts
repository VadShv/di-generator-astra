import { PrismaClient } from '@prisma/client'

// Модели с поддержкой soft-delete (поле deletedAt).
// Для этих моделей стандартные findMany/findUnique/findFirst/count автоматически
// фильтруют удалённые записи, а delete/deleteMany → update deletedAt.
// Флаг `bypassSoftDelete: true` в where отключает фильтрацию/soft-delete.
const SOFT_DELETE_MODELS = new Set(['User', 'GeneratedDI', 'ArchiveDI'])

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = baseClient

/**
 * Prisma client extension: soft-delete для User, GeneratedDI, ArchiveDI.
 *
 * Поведение:
 *  - findMany / findUnique / findFirst / count: автоматически добавляют
 *    `deletedAt: null` в where (если не передан `bypassSoftDelete: true`).
 *  - delete / deleteMany: перехватываются → update `deletedAt = new Date()`
 *    (если не передан `bypassSoftDelete: true` — тогда физическое удаление).
 *
 * Флаг `bypassSoftDelete` — не настоящее поле Prisma; он удаляется из where
 * перед передачей в БД. Используется в админ-роутах для физического удаления.
 *
 * Использование `any` внутри extension — стандартная практика: Prisma
 * генерирует union-типы where-условий для всех моделей, и точная типизация
 * runtime-перехватчика требует GenericUtil, который не экспортируется.
 */
export const db = baseClient.$extends({
  query: {
    $allModels: {
      async findMany({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
          } else {
            args.where = { ...where, deletedAt: null }
          }
        }
        return query(args)
      },

      async findUnique({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
          } else {
            args.where = { ...where, deletedAt: null }
          }
        }
        return query(args)
      },

      async findFirst({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
          } else {
            args.where = { ...where, deletedAt: null }
          }
        }
        return query(args)
      },

      async count({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
          } else {
            args.where = { ...where, deletedAt: null }
          }
        }
        return query(args)
      },

      async delete({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
            return query(args)
          }
          // Soft-delete: помечаем deletedAt + каскадно удаляем дочерние записи.
          // Без этого child-записи (секции, версии, аудит) осиротевают (W9).
          const now = new Date()
          if (model === 'GeneratedDI') {
            const id = (args.where as { id?: string }).id
            if (id) {
              await Promise.all([
                (baseClient as any).generatedDISection.deleteMany({ where: { generatedDIId: id } }),
                (baseClient as any).dIVersion.deleteMany({ where: { generatedDIId: id } }),
                (baseClient as any).dIAuditResult.deleteMany({ where: { generatedDIId: id } }),
                (baseClient as any).dITracking.deleteMany({ where: { generatedDIId: id } }),
              ]).catch(() => {})
            }
          }
          return (baseClient as any)[model].update({
            where: args.where,
            data: { deletedAt: now },
          })
        }
        return query(args)
      },

      async deleteMany({ model, args, query }: any) {
        if (model && SOFT_DELETE_MODELS.has(model)) {
          const where = args.where
          if (where && where.bypassSoftDelete === true) {
            const { bypassSoftDelete: _omit, ...rest } = where
            args.where = rest
            return query(args)
          }
          // Soft-delete: updateMany с deletedAt вместо физического удаления.
          return (baseClient as any)[model].updateMany({
            where: { ...where, deletedAt: null },
            data: { deletedAt: new Date() },
          })
        }
        return query(args)
      },
    },
  },
})

// Тип для обхода soft-delete в where-условиях (админ-роуты).
export type SoftDeleteWhere = {
  bypassSoftDelete?: boolean
}
