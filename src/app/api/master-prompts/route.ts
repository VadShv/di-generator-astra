import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/master-prompts - List all master prompts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const departmentId = searchParams.get('departmentId')
    const businessFunctionId = searchParams.get('businessFunctionId')
    const grade = searchParams.get('grade')

    // If resolve params are provided, resolve the most specific master prompt
    if (departmentId || businessFunctionId || grade) {
      return await resolveMasterPrompt(departmentId, businessFunctionId, grade)
    }

    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true

    const prompts = await db.masterPrompt.findMany({
      where,
      include: {
        department: true,
        businessFunction: true,
      },
      orderBy: [
        { departmentId: 'desc' }, // More specific first
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

// Resolve the most specific master prompt for given criteria
// Priority: department+businessFunction+grade > department+businessFunction > department+grade > department > businessFunction+grade > businessFunction > grade > global
async function resolveMasterPrompt(
  departmentId: string | null,
  businessFunctionId: string | null,
  grade: string | null
) {
  try {
    // Build priority list of criteria combinations
    const combinations: Record<string, string | null>[] = []

    // Most specific to least specific
    if (departmentId && businessFunctionId && grade) {
      combinations.push({ departmentId, businessFunctionId, grade })
    }
    if (departmentId && businessFunctionId) {
      combinations.push({ departmentId, businessFunctionId, grade: null })
    }
    if (departmentId && grade) {
      combinations.push({ departmentId, businessFunctionId: null, grade })
    }
    if (departmentId) {
      combinations.push({ departmentId, businessFunctionId: null, grade: null })
    }
    if (businessFunctionId && grade) {
      combinations.push({ departmentId: null, businessFunctionId, grade })
    }
    if (businessFunctionId) {
      combinations.push({ departmentId: null, businessFunctionId, grade: null })
    }
    if (grade) {
      combinations.push({ departmentId: null, businessFunctionId: null, grade })
    }
    // Global fallback
    combinations.push({ departmentId: null, businessFunctionId: null, grade: null })

    for (const combo of combinations) {
      const prompt = await db.masterPrompt.findFirst({
        where: {
          isActive: true,
          departmentId: combo.departmentId || null,
          businessFunctionId: combo.businessFunctionId || null,
          grade: combo.grade || null,
        },
        include: { department: true, businessFunction: true },
        orderBy: { version: 'desc' },
      })
      if (prompt) {
        return NextResponse.json(prompt)
      }
    }

    // No prompt found at all
    return NextResponse.json(null)
  } catch (error) {
    console.error('MasterPrompt resolve error:', error)
    return NextResponse.json({ error: 'Ошибка разрешения мастер-промпта' }, { status: 500 })
  }
}

// POST /api/master-prompts - Create master prompt
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, content, departmentId, businessFunctionId, grade, functionType, description } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Название промпта обязательно' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'Содержимое промпта обязательно' }, { status: 400 })
    }

    // Find the latest version for this combination
    const existing = await db.masterPrompt.findFirst({
      where: {
        name: name.trim(),
        departmentId: departmentId || null,
        businessFunctionId: businessFunctionId || null,
        grade: grade || null,
        functionType: functionType || null,
      },
      orderBy: { version: 'desc' },
    })

    const version = existing ? existing.version + 1 : 1

    const prompt = await db.masterPrompt.create({
      data: {
        name: name.trim(),
        content: content.trim(),
        version,
        departmentId: departmentId || null,
        businessFunctionId: businessFunctionId || null,
        grade: grade || null,
        functionType: functionType || null,
        description: description?.trim() || null,
      },
      include: { department: true, businessFunction: true },
    })

    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    console.error('MasterPrompts POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания мастер-промпта' }, { status: 500 })
  }
}

// PUT /api/master-prompts - Update master prompt
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, content, isActive, departmentId, businessFunctionId, grade, functionType, description } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID промпта обязателен' }, { status: 400 })
    }

    const existing = await db.masterPrompt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Мастер-промпт не найден' }, { status: 404 })
    }

    const prompt = await db.masterPrompt.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        content: content !== undefined ? content.trim() : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        departmentId: departmentId !== undefined ? (departmentId || null) : undefined,
        businessFunctionId: businessFunctionId !== undefined ? (businessFunctionId || null) : undefined,
        grade: grade !== undefined ? (grade || null) : undefined,
        functionType: functionType !== undefined ? (functionType || null) : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
      },
      include: { department: true, businessFunction: true },
    })

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
