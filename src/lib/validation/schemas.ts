// Zod-схемы валидации тел запросов (Фаза 1).
// Переиспользуемые схемы для роутов generate-di/* и других API.
// Zod v4 синтаксис.

import { z } from 'zod'

/** Базовая проверка: непустая строка (после trim). */
export const nonEmptyString = z
  .string()
  .trim()
  .min(1, 'Поле не может быть пустым')

/** ID (cuid) — непустая строка. */
export const idSchema = nonEmptyString

/** Массив ID с минимум одним элементом (макс. 200 — защита от DoS). */
export const idArraySchema = z
  .array(nonEmptyString)
  .min(1, 'Список не может быть пустым')
  .max(200, 'Список не может содержать более 200 элементов')

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
   sectionTitle: z.string().trim().max(2000, 'Слишком длинный заголовок секции').optional(),
   promptGuidance: z.string().trim().max(5000, 'Слишком длинные указания').optional(),
   customPrompt: z.string().trim().max(5000, 'Слишком длинный пользовательский промпт').optional(),
 })
 .refine((data) => data.manualMode || data.generatedDIId, {
   message: 'Требуется либо manualMode+positionId, либо generatedDIId',
 })

/** Пресеты Magic Wand Toolbar. */
export const magicWandPresetSchema = z.enum([
  'detail',
  'shorten',
  'formalize',
  'simplify',
  'kpi',
  'style',
])

/** POST /api/generate-di/ai-improve */
export const aiImproveSchema = z.object({
 sectionId: idSchema,
 instruction: z.string().trim().max(5000, 'Слишком длинная инструкция').optional(),
 preset: magicWandPresetSchema.optional(),
}).refine((data) => data.instruction || data.preset, {
  message: 'Требуется либо instruction, либо preset',
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
    departmentIds: z.array(nonEmptyString).max(200).optional(),
    companyIds: z.array(nonEmptyString).max(200).optional(),
    positionIds: z.array(nonEmptyString).max(200).optional(),
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

// ─────────────────────────────────────────────
// Схемы роутов companies/* (Фаза 3, шаг 3.4)
// ─────────────────────────────────────────────

/** Общие поля компании (опциональные в update, обязательные в create). */
const companyFields = {
  shortName: z.string().trim().optional(),
  type: z.string().trim().optional(),
  director: z.string().trim().optional(),
  description: z.string().trim().optional(),
  inn: z
    .string()
    .trim()
    .regex(/^\d{10,12}$/, 'ИНН должен содержать 10–12 цифр')
    .optional(),
  ogrn: z
    .string()
    .trim()
    .regex(/^\d{13,15}$/, 'ОГРН должен содержать 13–15 цифр')
    .optional(),
  kpp: z
    .string()
    .trim()
    .regex(/^\d{9}$/, 'КПП должен содержать 9 цифр')
    .optional(),
  legalAddress: z.string().trim().optional(),
  actualAddress: z.string().trim().optional(),
}

/** POST /api/companies */
export const createCompanySchema = z.object({
  name: nonEmptyString.max(500, 'Слишком длинное название'),
  code: nonEmptyString.max(100, 'Слишком длинный код'),
  ...companyFields,
})

/** PUT /api/companies */
export const updateCompanySchema = z
  .object({
    id: idSchema,
    name: nonEmptyString.max(500).optional(),
    code: nonEmptyString.max(100).optional(),
    ...companyFields,
  })
  .refine((data) => Object.keys(data).length > 1, {
    message: 'Укажите хотя бы одно поле для обновления',
  })

/** DELETE /api/companies */
export const deleteCompanySchema = z.object({ id: idSchema })

// ─────────────────────────────────────────────
// Схемы роутов archive-di/* (Фаза 3, шаг 3.4)
// ─────────────────────────────────────────────

/** POST /api/archive-di */
export const createArchiveDISchema = z.object({
  title: nonEmptyString.max(500, 'Слишком длинный заголовок'),
  content: nonEmptyString.max(5 * 1024 * 1024, 'Содержимое слишком велико'),
  positionId: z.string().optional(),
  fileName: z.string().trim().max(255).optional(),
})

/** PUT /api/archive-di */
export const updateArchiveDISchema = z
  .object({
    id: idSchema,
    title: nonEmptyString.max(500).optional(),
    content: nonEmptyString.max(5 * 1024 * 1024).optional(),
    positionId: z.string().nullable().optional(),
    fileName: z.string().trim().max(255).optional(),
  })
  .refine((data) => Object.keys(data).length > 1, {
    message: 'Укажите хотя бы одно поле для обновления',
  })

/** DELETE /api/archive-di */
export const deleteArchiveDISchema = z.object({ id: idSchema })

// ─────────────────────────────────────────────
// Схемы роутов di-upload (save) и staffing-upload (import) (Фаза 3, шаг 3.4)
// ─────────────────────────────────────────────

/** POST /api/di-upload?mode=save */
export const diUploadSaveSchema = z.object({
  fileName: nonEmptyString.max(255),
  fileType: z.string().trim().max(50).optional().default('unknown'),
  rawText: nonEmptyString.max(5 * 1024 * 1024, 'Текст слишком велик'),
  sections: z
    .array(
      z.object({
        title: z.string().trim().max(500),
        content: z.string().max(5 * 1024 * 1024),
      })
    )
    .max(500, 'Слишком много секций')
    .optional()
    .default([]),
  positionId: idSchema,
  companyId: z.string().optional(),
})

/** Одна строка штатного расписания для импорта. */
export const staffingRowSchema = z.object({
  departmentName: nonEmptyString.max(500),
  departmentCode: z.string().trim().max(100).nullable().optional(),
  positionTitle: nonEmptyString.max(500),
  positionCode: z.string().trim().max(100).nullable().optional(),
  headcount: z.number().positive('Количество ставок должно быть положительным'),
  category: z.string().trim().max(200).nullable().optional(),
  grade: z.string().trim().max(100).nullable().optional(),
  rowNumber: z.number().int().nonnegative(),
})

/** POST /api/staffing-upload?mode=import */
export const staffingImportSchema = z.object({
  companyId: z.string().optional(),
  rows: z.array(staffingRowSchema).min(1, 'Нет строк для импорта').max(10000, 'Слишком много строк'),
})

// ─────────────────────────────────────────────
// Схема смены пароля (Фаза 3, шаг 3.5)
// ─────────────────────────────────────────────

/**
 * POST /api/auth/change-password
 * Минимум 8 символов, обязательны буква и цифра, максимум 128,
 * новый пароль не должен совпадать с текущим.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: nonEmptyString.max(128, 'Слишком длинный пароль'),
    newPassword: z
      .string()
      .min(8, 'Пароль должен быть не менее 8 символов')
      .max(128, 'Слишком длинный пароль')
      .regex(/[A-Za-zА-Яа-яЁё]/, 'Пароль должен содержать букву')
      .regex(/\d/, 'Пароль должен содержать цифру'),
  })
 .refine((data) => data.newPassword !== data.currentPassword, {
   message: 'Новый пароль не должен совпадать с текущим',
   path: ['newPassword'],
 })
 
 // ─────────────────────────────────────────────
 // Схемы роутов users/* (Фаза 6, шаг 6.1 — защита от mass assignment)
 // ─────────────────────────────────────────────
 
 /**
  * POST /api/users — создание пользователя.
  * role валидируется против whitelist; permissions — record из известных вкладок.
  */
 export const createUserSchema = z.object({
   email: z
     .string()
     .trim()
     .toLowerCase()
     .min(1, 'Email обязателен')
     .email('Некорректный email')
     .max(254, 'Слишком длинный email'),
   name: z.string().trim().max(200, 'Слишком длинное имя').optional(),
   password: z
     .string()
     .min(8, 'Пароль должен быть не менее 8 символов')
     .max(128, 'Слишком длинный пароль')
     .regex(/[A-Za-zА-Яа-яЁё]/, 'Пароль должен содержать букву')
     .regex(/\d/, 'Пароль должен содержать цифру'),
   role: z.enum(['admin', 'kdp', 'user']).optional().default('user'),
   permissions: z
     .record(
       z.enum([
         'dashboard',
         'staff-schedule',
         'dictionaries',
         'archive',
         'templates',
         'master-prompts',
         'ai-providers',
         'generation',
         'mass-generation',
         'tracking',
         'version-history',
         'ai-audit',
         'instructions',
         'tech-stack',
         'profile',
       ]),
       z.enum(['read', 'write', 'none'])
     )
     .optional(),
 })
 
 /**
  * PUT /api/users/[id] — обновление пользователя.
  * Все поля опциональны; role и permissions валидируются при наличии.
  */
 export const updateUserSchema = z
   .object({
     name: z.string().trim().max(200, 'Слишком длинное имя').optional(),
     role: z.enum(['admin', 'kdp', 'user']).optional(),
     permissions: z
       .record(
         z.enum([
           'dashboard',
           'staff-schedule',
           'dictionaries',
           'archive',
           'templates',
           'master-prompts',
           'ai-providers',
           'generation',
           'mass-generation',
           'tracking',
           'version-history',
           'ai-audit',
           'instructions',
           'tech-stack',
           'profile',
         ]),
         z.enum(['read', 'write', 'none'])
       )
       .nullable()
       .optional(),
     isActive: z.boolean().optional(),
   })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Укажите хотя бы одно поле для обновления',
  })

// ─────────────────────────────────────────────
// Схемы роутов master-prompts/*
// ─────────────────────────────────────────────

const promptCategorySchema = z.enum(['generation', 'audit', 'improvement', 'ai_culture'])

/** POST /api/master-prompts */
export const createMasterPromptSchema = z.object({
  name: nonEmptyString.max(500, 'Название слишком длинное'),
  content: nonEmptyString.max(100_000, 'Содержимое слишком длинное'),
  isActive: z.boolean().optional(),
  isAiCulture: z.boolean().optional(),
  category: promptCategorySchema.optional(),
  variables: z.array(nonEmptyString).optional(),
  departmentId: z.string().nullable().optional(),
  businessFunctionId: z.string().nullable().optional(),
  grade: z.string().trim().max(100).nullable().optional(),
  functionType: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  companyId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().max(100)).optional(),
})

/** PUT /api/master-prompts */
export const updateMasterPromptSchema = z.object({
  id: idSchema,
  name: nonEmptyString.max(500).optional(),
  content: nonEmptyString.max(100_000).optional(),
  isActive: z.boolean().optional(),
  isAiCulture: z.boolean().optional(),
  category: promptCategorySchema.optional(),
  variables: z.array(nonEmptyString).optional(),
  departmentId: z.string().nullable().optional(),
  businessFunctionId: z.string().nullable().optional(),
  grade: z.string().trim().max(100).nullable().optional(),
  functionType: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  companyId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().max(100)).optional(),
  changeDescription: z.string().trim().max(2000).optional(),
})

/** DELETE /api/master-prompts */
export const deleteMasterPromptSchema = z.object({
  id: idSchema,
})

// ─────────────────────────────────────────────
// Схемы роутов prompt-chains/*
// ─────────────────────────────────────────────

const chainStepSchema = z.object({
  category: promptCategorySchema,
  order: z.number().int().min(0),
  stopOnError: z.boolean().optional(),
})

/** POST /api/prompt-chains */
export const createPromptChainSchema = z.object({
  name: nonEmptyString.max(500, 'Название слишком длинное'),
  description: z.string().trim().max(2000).optional(),
  steps: z.array(chainStepSchema).max(20, 'Слишком много шагов').optional(),
  isActive: z.boolean().optional(),
})

/** PUT /api/prompt-chains */
export const updatePromptChainSchema = z.object({
  id: idSchema,
  name: nonEmptyString.max(500).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  steps: z.array(chainStepSchema).max(20).optional(),
  isActive: z.boolean().optional(),
})

/** DELETE /api/prompt-chains */
export const deletePromptChainSchema = z.object({
  id: idSchema,
})

// ─────────────────────────────────────────────
// Схемы роутов master-prompts/test и /preview
// ─────────────────────────────────────────────

/** POST /api/master-prompts/test */
export const testMasterPromptSchema = z.object({
  masterPromptId: idSchema,
  positionId: z.string().optional(),
  providerId: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32_000).optional(),
})

/** POST /api/master-prompts/preview */
export const previewMasterPromptSchema = z.object({
  content: nonEmptyString.max(100_000),
  masterPromptId: z.string().optional(),
  positionId: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
})

/** POST /api/master-prompts/resolve */
export const resolveMasterPromptSchema = z.object({
  positionId: idSchema,
  category: promptCategorySchema.optional(),
})

/** POST /api/prompt-chains/run */
export const runPromptChainSchema = z.object({
  chainId: idSchema,
  positionId: z.string().optional(),
  providerId: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
})

/** PUT /api/master-prompts/test-results */
export const rateTestResultSchema = z.object({
  id: idSchema,
  rating: z.number().int().min(1).max(5),
})
