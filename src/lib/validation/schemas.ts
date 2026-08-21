// Zod-схемы валидации тел запросов (Фаза 1).
// Переиспользуемые схемы для роутов generate-di/* и других API.
// Zod v4 синтаксис.

import { z } from 'zod'

/** Базовая проверка: непустая строка (после trim). */
const nonEmptyString = z
  .string()
  .trim()
  .min(1, 'Поле не может быть пустым')

/** ID (cuid) — непустая строка. */
export const idSchema = nonEmptyString

/** Массив ID с минимум одним элементом. */
export const idArraySchema = z
  .array(nonEmptyString)
  .min(1, 'Список не может быть пустым')

// ─────────────────────────────────────────────
// Схемы роутов generate-di/*
// ─────────────────────────────────────────────

/** POST /api/generate-di/ai-generate */
export const aiGenerateSchema = z.object({
  positionId: idSchema,
  templateId: idSchema,
  masterPromptId: z.string().optional(),
  archiveDIId: z.string().optional(),
  useArchiveAsReference: z.boolean().optional().default(true),
})

/** POST /api/generate-di/ai-section (оба режима). */
export const aiSectionSchema = z
  .object({
    manualMode: z.boolean().optional(),
    positionId: z.string().optional(),
    generatedDIId: z.string().optional(),
    sectionOrder: z.number().int().nonnegative().optional(),
    sectionTitle: z.string().optional(),
    promptGuidance: z.string().optional(),
    customPrompt: z.string().optional(),
  })
  .refine((data) => data.manualMode || data.generatedDIId, {
    message: 'Требуется либо manualMode+positionId, либо generatedDIId',
  })

/** POST /api/generate-di/ai-improve */
export const aiImproveSchema = z.object({
  sectionId: idSchema,
  instruction: nonEmptyString,
})

/** POST /api/generate-di/ai-audit */
export const aiAuditSchema = z.object({
  generatedDIId: idSchema,
  auditType: z.enum(['full', 'legal', 'consistency']).optional().default('full'),
})

/** POST /api/generate-di/batch-audit */
export const batchAuditSchema = z.object({
  diIds: idArraySchema,
})

/** POST /api/generate-di/mass-generate */
export const massGenerateSchema = z
  .object({
    departmentIds: z.array(nonEmptyString).optional(),
    companyIds: z.array(nonEmptyString).optional(),
    positionIds: z.array(nonEmptyString).optional(),
    templateId: idSchema,
    masterPromptId: z.string().optional(),
    providerId: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.positionIds && data.positionIds.length > 0) ||
      (data.departmentIds && data.departmentIds.length > 0) ||
      (data.companyIds && data.companyIds.length > 0),
    { message: 'Выберите хотя бы одну организацию, подразделение или должность' }
  )

/** POST /api/generate-di/batch-delete */
export const batchDeleteSchema = z.object({
  ids: idArraySchema,
})
