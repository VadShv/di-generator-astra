import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const VALID_GRADES = ['линейная', 'руководитель']

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const grade = searchParams.get('grade')
    const businessFunctionId = searchParams.get('businessFunctionId')
    const projectId = searchParams.get('projectId')

    const where: Record<string, unknown> = {}
    if (departmentId) where.departmentId = departmentId
    if (grade) where.grade = grade
    if (businessFunctionId) where.businessFunctionId = businessFunctionId
    if (projectId) where.projectId = projectId

    const positions = await db.position.findMany({
      where,
      include: {
        department: { include: { company: true } },
        businessFunction: true,
        project: true,
        generatedDIs: { select: { id: true, status: true, signedByEmployee: true } },
        archiveDIs: { select: { id: true } },
        attributes: true,
      },
      orderBy: { title: 'asc' }
    })

    return NextResponse.json(positions)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching positions:', error)
    return NextResponse.json({ error: 'Ошибка при получении должностей' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { title, code, departmentId, grade, businessFunctionId, projectId, headcount, functions, attributeIds } = body

    if (!title || !code || !departmentId) {
      return NextResponse.json({ error: 'Название, код и подразделение обязательны' }, { status: 400 })
    }

    // Validate grade if provided
    if (grade && !VALID_GRADES.includes(grade)) {
      return NextResponse.json({ error: 'Грейд должен быть "линейная" или "руководитель"' }, { status: 400 })
    }

    // Check for unique code
    const existing = await db.position.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Должность с таким кодом уже существует' }, { status: 409 })
    }

    // Validate department exists
    const dept = await db.department.findUnique({ where: { id: departmentId } })
    if (!dept) {
      return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 })
    }

    // Validate business function if provided
    if (businessFunctionId) {
      const bf = await db.businessFunction.findUnique({ where: { id: businessFunctionId } })
      if (!bf) {
        return NextResponse.json({ error: 'Бизнес-функция не найдена' }, { status: 404 })
      }
    }

    // Validate project if provided
    if (projectId) {
      const proj = await db.project.findUnique({ where: { id: projectId } })
      if (!proj) {
        return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
      }
    }

    const position = await db.position.create({
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
          attributes: { connect: attributeIds.map((id: string) => ({ id })) }
        }),
      },
      include: {
        department: { include: { company: true } },
        businessFunction: true,
        project: true,
        generatedDIs: { select: { id: true, status: true, signedByEmployee: true } },
        archiveDIs: { select: { id: true } },
        attributes: true,
      }
    })

    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating position:', error)
    return NextResponse.json({ error: 'Ошибка при создании должности' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { id, title, code, departmentId, grade, businessFunctionId, projectId, headcount, functions, attributeIds } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.position.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    // Validate grade if provided
    if (grade && !VALID_GRADES.includes(grade)) {
      return NextResponse.json({ error: 'Грейд должен быть "линейная" или "руководитель"' }, { status: 400 })
    }

    // Check unique code if changing
    if (code && code !== existing.code) {
      const codeTaken = await db.position.findUnique({ where: { code } })
      if (codeTaken) {
        return NextResponse.json({ error: 'Должность с таким кодом уже существует' }, { status: 409 })
      }
    }

    // Validate department if changing
    if (departmentId && departmentId !== existing.departmentId) {
      const dept = await db.department.findUnique({ where: { id: departmentId } })
      if (!dept) {
        return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 })
      }
    }

    // Validate business function if provided
    if (businessFunctionId) {
      const bf = await db.businessFunction.findUnique({ where: { id: businessFunctionId } })
      if (!bf) {
        return NextResponse.json({ error: 'Бизнес-функция не найдена' }, { status: 404 })
      }
    }

    // Validate project if provided
    if (projectId) {
      const proj = await db.project.findUnique({ where: { id: projectId } })
      if (!proj) {
        return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
      }
    }

    const position = await db.position.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(code !== undefined && { code }),
        ...(departmentId !== undefined && { departmentId }),
        ...(grade !== undefined && { grade: grade || null }),
        ...(businessFunctionId !== undefined && { businessFunctionId: businessFunctionId || null }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(headcount !== undefined && { headcount }),
        ...(functions !== undefined && { functions: functions || null }),
        ...(attributeIds !== undefined && {
          attributes: { set: attributeIds.map((aid: string) => ({ id: aid })) }
        }),
      },
      include: {
        department: { include: { company: true } },
        businessFunction: true,
        project: true,
        generatedDIs: { select: { id: true, status: true, signedByEmployee: true } },
        archiveDIs: { select: { id: true } },
        attributes: true,
      }
    })

    return NextResponse.json(position)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error updating position:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении должности' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.position.findUnique({
      where: { id },
      include: {
        archiveDIs: true,
        generatedDIs: true,
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    if (existing.archiveDIs.length > 0 || existing.generatedDIs.length > 0) {
      return NextResponse.json({ error: 'Невозможно удалить должность с привязанными ДИ' }, { status: 400 })
    }

    await db.position.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error deleting position:', error)
    return NextResponse.json({ error: 'Ошибка при удалении должности' }, { status: 500 })
  }
}
