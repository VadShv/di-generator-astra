import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  savePromptVersion,
  estimateTokens,
  extractVariables,
  PROMPT_CATEGORIES,
} from '@/lib/master-prompt'
import { requireAuth, requirePermission } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('master-prompts')

// Допустимые категории промптов (соответствуют PROMPT_CATEGORIES в src/lib/master-prompt.ts).
const VALID_CATEGORIES = new Set<string>(Object.keys(PROMPT_CATEGORIES))

// Привести строку к валидной категории или null.
function normalizeCategory(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  return VALID_CATEGORIES.has(value) ? value : null
}

// Нормализовать массив тегов или JSON-строку тегов в JSON-строку.
function normalizeTags(value: unknown): string {
  if (Array.isArray(value)) {
    const tags = value.map((t) => String(t).trim()).filter(Boolean)
    return JSON.stringify(tags)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed.map((t) => String(t).trim()).filter(Boolean))
      }
    } catch {
      // Не JSON — трактуем как один тег.
      return JSON.stringify([value.trim()])
    }
  }
  return '[]'
}

// Нормализовать переменные в JSON-строку.
function normalizeVariables(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((v) => String(v).trim()).filter(Boolean))
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed.map((v) => String(v).trim()).filter(Boolean))
      }
    } catch {
      // Не JSON — оставляем как есть.
      return value
    }
  }
  return '[]'
}

// GET /api/master-prompts — список промптов с фильтрами.
// Поддерживаемые query-параметры:
//   ?active=true            — только активные
//   ?category=generation    — фильтр по категории
//   ?tag=...                — фильтр по тегу (поиск в JSON-массиве)
//   ?search=...             — поиск по содержимому (content)
//   ?companyId=...          — фильтр по юр. лицу
//   ?departmentId=...       — фильтр по подразделению
//   ?businessFunctionId=... — фильтр по бизнес-функции
//   ?grade=...              — фильтр по грейду
//   ?positionId=...         — фильтр по должности
//   ?functionType=...       — фильтр по типу функции
// Резолв промпта по критериям выполняется отдельным POST /api/master-prompts/resolve.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const departmentId = searchParams.get('departmentId')
    const businessFunctionId = searchParams.get('businessFunctionId')
    const grade = searchParams.get('grade')
    const category = searchParams.get('category')
    const companyId = searchParams.get('companyId')
    const positionId = searchParams.get('positionId')
    const functionType = searchParams.get('functionType')
    const tag = searchParams.get('tag')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true
    if (category) where.category = category
    if (companyId) where.companyId = companyId
    if (departmentId) where.departmentId = departmentId
    if (businessFunctionId) where.businessFunctionId = businessFunctionId
    if (grade) where.grade = grade
    if (positionId) where.positionId = positionId
    if (functionType) where.functionType = functionType
    if (search) where.content = { contains: search, mode: 'insensitive' }
    // Фильтр по тегу: ищем JSON-массив, содержащий тег.
    if (tag) where.tags = { contains: `"${tag}"` }

    const prompts = await db.masterPrompt.findMany({
      where,
      include: {
        department: true,
        businessFunction: true,
        company: true,
        position: true,
      },
      orderBy: [
        { departmentId: 'desc' }, // Более специфичные первыми
        { businessFunctionId: 'desc' },
        { grade: 'desc' },
        { version: 'desc' },
      ],
    })

    return NextResponse.json(prompts)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('MasterPrompts GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки мастер-промптов' }, { status: 500 })
  }
}

// POST /api/master-prompts — создание мастер-промпта.
// Принимает расширенный набор полей (Фаза 21): tags, companyId, positionId, estimatedTokens.
export async function POST(request: Request) {
  try {
    await requirePermission('master-prompts', 'write')
    const body = await request.json()
    const {
      name,
      content,
      isActive,
      isAiCulture,
      category,
      variables,
      departmentId,
      businessFunctionId,
      grade,
      functionType,
      description,
      companyId,
      positionId,
      tags,
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Название промпта обязательно' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Содержимое промпта обязательно' }, { status: 400 })
    }

    const resolvedCategory = isAiCulture === true ? 'ai_culture' : (normalizeCategory(category) || 'generation')

    // Автоматически определяем переменные из текста, если не переданы явно.
    const detectedVariables = extractVariables(content)
    const variablesJson = Array.isArray(variables)
      ? normalizeVariables(variables)
      : detectedVariables.length > 0
        ? JSON.stringify(detectedVariables)
        : '[]'

    // Версия нового промпта — 1.
    const version = 1
    const estimatedTokensValue = estimateTokens(content)

    const prompt = await db.masterPrompt.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        version,
        category: resolvedCategory,
        isActive: isActive !== undefined ? isActive : true,
        isAiCulture: isAiCulture === true,
        variables: variablesJson,
        tags: normalizeTags(tags),
        estimatedTokens: estimatedTokensValue,
        departmentId: departmentId || null,
        businessFunctionId: businessFunctionId || null,
        grade: grade || null,
        functionType: functionType || null,
        companyId: companyId || null,
        positionId: positionId || null,
        description: description?.trim() || null,
      },
      include: {
        department: true,
        businessFunction: true,
        company: true,
        position: true,
      },
    })

    // Сохраняем snapshot в историю версий.
    await savePromptVersion({
      masterPromptId: prompt.id,
      version: prompt.version,
      content: prompt.content,
      description: prompt.description,
      createdBy: 'api-create',
    })

    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('MasterPrompts POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания мастер-промпта' }, { status: 500 })
  }
}

// PUT /api/master-prompts — обновление мастер-промпта. При изменении content
// инкрементируем version и создаём новый snapshot в MasterPromptVersion.
// Принимает расширенный набор полей (Фаза 21).
export async function PUT(request: Request) {
  try {
    await requirePermission('master-prompts', 'write')
    const body = await request.json()
    const {
      id,
      name,
      content,
      isActive,
      isAiCulture,
      category,
      variables,
      departmentId,
      businessFunctionId,
      grade,
      functionType,
      description,
      companyId,
      positionId,
      tags,
      changeDescription,
    } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID промпта обязателен' }, { status: 400 })
    }

    const existing = await db.masterPrompt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Мастер-промпт не найден' }, { status: 404 })
    }

    // Если контент меняется — создадим новую версию и snapshot.
    const contentChanged = content !== undefined && typeof content === 'string' && content.trim() !== existing.content

    const resolvedCategory = isAiCulture === true ? 'ai_culture' : (normalizeCategory(category) || undefined)

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (content !== undefined) updateData.content = content.trim()
    if (resolvedCategory !== undefined) updateData.category = resolvedCategory
    if (isAiCulture !== undefined) updateData.isAiCulture = isAiCulture === true
    if (isActive !== undefined) updateData.isActive = isActive
    if (departmentId !== undefined) updateData.departmentId = departmentId || null
    if (businessFunctionId !== undefined) updateData.businessFunctionId = businessFunctionId || null
    if (grade !== undefined) updateData.grade = grade || null
    if (functionType !== undefined) updateData.functionType = functionType || null
    if (companyId !== undefined) updateData.companyId = companyId || null
    if (positionId !== undefined) updateData.positionId = positionId || null
    if (description !== undefined) updateData.description = description?.trim() || null
    if (tags !== undefined) updateData.tags = normalizeTags(tags)

    // Переменные: если переданы явно — используем; иначе пересчитываем из нового контента.
    if (variables !== undefined) {
      updateData.variables = normalizeVariables(variables)
    } else if (contentChanged) {
      updateData.variables = JSON.stringify(extractVariables(content))
    }

    // Пересчёт оценки токенов при изменении контента.
    if (contentChanged) {
      updateData.estimatedTokens = estimateTokens(content)
      // Инкремент версии только при фактическом изменении контента.
      updateData.version = existing.version + 1
    }

    const prompt = await db.masterPrompt.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        businessFunction: true,
        company: true,
        position: true,
      },
    })

    // При изменении контента сохраняем snapshot новой версии.
    if (contentChanged) {
      await savePromptVersion({
        masterPromptId: prompt.id,
        version: prompt.version,
        content: prompt.content,
        description: changeDescription?.trim() || prompt.description,
        createdBy: 'api-update',
        diff: changeDescription || null,
      })
    }

    return NextResponse.json(prompt)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('MasterPrompts PUT error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления мастер-промпта' }, { status: 500 })
  }
}

// DELETE /api/master-prompts — удаление мастер-промпта.
export async function DELETE(request: Request) {
  try {
    await requirePermission('master-prompts', 'write')
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID промпта обязателен' }, { status: 400 })
    }

    const existing = await db.masterPrompt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Мастер-промпт не найден' }, { status: 404 })
    }

    await db.masterPrompt.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('MasterPrompts DELETE error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления мастер-промпта' }, { status: 500 })
  }
}
