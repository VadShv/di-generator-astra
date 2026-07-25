import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveMasterPrompt as resolvePromptByCategory,
  savePromptVersion,
  PROMPT_CATEGORIES,
  type PromptCategory,
} from '@/lib/master-prompt'

// Допустимые категории промптов (соответствуют PROMPT_CATEGORIES в src/lib/master-prompt.ts).
const VALID_CATEGORIES = new Set<string>(Object.keys(PROMPT_CATEGORIES))

// Проверить и привести категорию к строковому значению или null.
function normalizeCategory(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  return VALID_CATEGORIES.has(value) ? value : null
}

// GET /api/master-prompts - список всех мастер-промптов или резолв по критериям.
// Поддерживает ?category=... для фильтрации списка и резолва по категории.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const departmentId = searchParams.get('departmentId')
    const businessFunctionId = searchParams.get('businessFunctionId')
    const grade = searchParams.get('grade')
    const category = searchParams.get('category')

    // Если переданы критерии резолва — вернуть наиболее специфичный активный промпт.
    // Категория опциональна: при её отсутствии резолвим по категории "generation".
    if (departmentId || businessFunctionId || grade) {
      return await resolveMasterPromptHandler(
        category as PromptCategory | null,
        departmentId,
        businessFunctionId,
        grade
      )
    }

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true
    if (category) where.category = category

    const prompts = await db.masterPrompt.findMany({
      where,
      include: {
        department: true,
        businessFunction: true,
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
    console.error('MasterPrompts GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки мастер-промптов' }, { status: 500 })
  }
}

// Обёртка резолва: использует утилиту из src/lib/master-prompt.ts,
// которая фильтрует по категории и поддерживает каскад специфичности.
async function resolveMasterPromptHandler(
  category: PromptCategory | null,
  departmentId: string | null,
  businessFunctionId: string | null,
  grade: string | null
) {
  try {
    const resolved = await resolvePromptByCategory(category || 'generation', {
      departmentId: departmentId || null,
      businessFunctionId: businessFunctionId || null,
      grade: grade || null,
    })
    if (!resolved) return NextResponse.json(null)
    // Догружаем связи для единообразия ответа со списком.
    const full = await db.masterPrompt.findUnique({
      where: { id: resolved.id },
      include: { department: true, businessFunction: true },
    })
    return NextResponse.json(full ?? resolved)
  } catch (error) {
    console.error('MasterPrompt resolve error:', error)
    return NextResponse.json({ error: 'Ошибка разрешения мастер-промпта' }, { status: 500 })
  }
}

// POST /api/master-prompts - создание мастер-промпта (с категорией, флагом Культуры ИИ,
// списком переменных и автоматическим snapshot-ом в MasterPromptVersion).
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, content, departmentId, businessFunctionId, grade, functionType, description, category, isAiCulture, variables } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Название промпта обязательно' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'Содержимое промпта обязательно' }, { status: 400 })
    }

    // Найти последнюю версию для того же имени и критериев применимости.
    const existing = await db.masterPrompt.findFirst({
      where: {
        name: name.trim(),
        departmentId: departmentId || null,
        businessFunctionId: businessFunctionId || null,
        grade: grade || null,
        functionType: functionType || null,
        // Учитываем категорию: версии нумеруются в пределах имени+критерии+категория.
        category: normalizeCategory(category) || 'generation',
      },
      orderBy: { version: 'desc' },
    })

    const version = existing ? existing.version + 1 : 1
    // Если явно задан флаг Культуры ИИ — категория принудительно ai_culture.
    const resolvedCategory = isAiCulture === true ? 'ai_culture' : (normalizeCategory(category) || 'generation')
    // variables хранится как JSON-строка; принимаем массив или готовую строку.
    const variablesJson = Array.isArray(variables)
      ? JSON.stringify(variables)
      : typeof variables === 'string' && variables.trim()
        ? variables
        : '[]'

    const prompt = await db.masterPrompt.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        version,
        category: resolvedCategory,
        isAiCulture: isAiCulture === true,
        variables: variablesJson,
        departmentId: departmentId || null,
        businessFunctionId: businessFunctionId || null,
        grade: grade || null,
        functionType: functionType || null,
        description: description?.trim() || null,
      },
      include: { department: true, businessFunction: true },
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
    console.error('MasterPrompts POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания мастер-промпта' }, { status: 500 })
  }
}

// PUT /api/master-prompts - обновление мастер-промпта. При изменении content
// инкрементируем version и создаём новый snapshot в MasterPromptVersion.
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, content, isActive, departmentId, businessFunctionId, grade, functionType, description, category, isAiCulture, variables } = body

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
    const variablesJson = Array.isArray(variables)
      ? JSON.stringify(variables)
      : typeof variables === 'string' && variables.trim()
        ? variables
        : undefined

    const prompt = await db.masterPrompt.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        content: content !== undefined ? content.trim() : undefined,
        category: resolvedCategory,
        isAiCulture: isAiCulture !== undefined ? isAiCulture === true : undefined,
        variables: variablesJson,
        isActive: isActive !== undefined ? isActive : undefined,
        departmentId: departmentId !== undefined ? (departmentId || null) : undefined,
        businessFunctionId: businessFunctionId !== undefined ? (businessFunctionId || null) : undefined,
        grade: grade !== undefined ? (grade || null) : undefined,
        functionType: functionType !== undefined ? (functionType || null) : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        // Инкремент версии только при фактическом изменении контента.
        version: contentChanged ? existing.version + 1 : undefined,
      },
      include: { department: true, businessFunction: true },
    })

    // При изменении контента сохраняем snapshot новой версии.
    if (contentChanged) {
      await savePromptVersion({
        masterPromptId: prompt.id,
        version: prompt.version,
        content: prompt.content,
        description: prompt.description,
        createdBy: 'api-update',
      })
    }

    return NextResponse.json(prompt)
  } catch (error) {
    console.error('MasterPrompts PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления мастер-промпта' }, { status: 500 })
  }
}

// DELETE /api/master-prompts - Delete master prompt
export async function DELETE(request: Request) {
  try {
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
    console.error('MasterPrompts DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления мастер-промпта' }, { status: 500 })
  }
}
