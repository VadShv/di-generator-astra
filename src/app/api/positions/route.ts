import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const grade = searchParams.get('grade')
    const domain = searchParams.get('domain')

    const where: Record<string, unknown> = {}
    if (departmentId) where.departmentId = departmentId
    if (grade) where.grade = grade
    if (domain) where.domain = domain

    const positions = await db.position.findMany({
      where,
      include: {
        department: true,
      },
      orderBy: { title: 'asc' }
    })

    return NextResponse.json(positions)
  } catch (error) {
    console.error('Error fetching positions:', error)
    return NextResponse.json({ error: 'Ошибка при получении должностей' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, code, departmentId, grade, domain, headcount, functions } = body

    if (!title || !code || !departmentId) {
      return NextResponse.json({ error: 'Название, код и подразделение обязательны' }, { status: 400 })
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

    const position = await db.position.create({
      data: {
        title,
        code,
        departmentId,
        grade: grade || null,
        domain: domain || null,
        headcount: headcount || 1,
        functions: functions || null,
      },
      include: {
        department: true,
      }
    })

    return NextResponse.json(position, { status: 201 })
  } catch (error) {
    console.error('Error creating position:', error)
    return NextResponse.json({ error: 'Ошибка при создании должности' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, code, departmentId, grade, domain, headcount, functions } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.position.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
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

    const position = await db.position.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(code !== undefined && { code }),
        ...(departmentId !== undefined && { departmentId }),
        ...(grade !== undefined && { grade: grade || null }),
        ...(domain !== undefined && { domain: domain || null }),
        ...(headcount !== undefined && { headcount }),
        ...(functions !== undefined && { functions: functions || null }),
      },
      include: {
        department: true,
      }
    })

    return NextResponse.json(position)
  } catch (error) {
    console.error('Error updating position:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении должности' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
    console.error('Error deleting position:', error)
    return NextResponse.json({ error: 'Ошибка при удалении должности' }, { status: 500 })
  }
}
