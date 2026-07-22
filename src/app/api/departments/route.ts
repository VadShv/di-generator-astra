import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const departments = await db.department.findMany({
      include: {
        parent: true,
        children: true,
        company: true,
        _count: {
          select: { positions: true }
        }
      },
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Ошибка при получении подразделений' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, code, parentId, companyId } = body

    if (!name || !code) {
      return NextResponse.json({ error: 'Название и код обязательны' }, { status: 400 })
    }

    // Check for unique code
    const existing = await db.department.findUnique({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: 'Подразделение с таким кодом уже существует' }, { status: 409 })
    }

    // Validate parent exists if provided
    if (parentId) {
      const parent = await db.department.findUnique({ where: { id: parentId } })
      if (!parent) {
        return NextResponse.json({ error: 'Родительское подразделение не найдено' }, { status: 404 })
      }
    }

    const department = await db.department.create({
      data: {
        name,
        code,
        parentId: parentId || null,
        companyId: companyId || null,
      },
      include: {
        parent: true,
        children: true,
        company: true,
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(department, { status: 201 })
  } catch (error) {
    console.error('Error creating department:', error)
    return NextResponse.json({ error: 'Ошибка при создании подразделения' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, code, parentId, companyId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 })
    }

    // Check unique code if changing
    if (code && code !== existing.code) {
      const codeTaken = await db.department.findUnique({ where: { code } })
      if (codeTaken) {
        return NextResponse.json({ error: 'Подразделение с таким кодом уже существует' }, { status: 409 })
      }
    }

    // Prevent circular reference
    if (parentId === id) {
      return NextResponse.json({ error: 'Подразделение не может быть родителем самому себе' }, { status: 400 })
    }

    const department = await db.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(companyId !== undefined && { companyId: companyId || null }),
      },
      include: {
        parent: true,
        children: true,
        company: true,
        _count: {
          select: { positions: true }
        }
      }
    })

    return NextResponse.json(department)
  } catch (error) {
    console.error('Error updating department:', error)
    return NextResponse.json({ error: 'Ошибка при обновлении подразделения' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const existing = await db.department.findUnique({
      where: { id },
      include: {
        children: true,
        positions: true,
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 })
    }

    if (existing.children.length > 0) {
      return NextResponse.json({ error: 'Невозможно удалить подразделение с дочерними элементами' }, { status: 400 })
    }

    if (existing.positions.length > 0) {
      return NextResponse.json({ error: 'Невозможно удалить подразделение с должностями' }, { status: 400 })
    }

    await db.department.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting department:', error)
    return NextResponse.json({ error: 'Ошибка при удалении подразделения' }, { status: 500 })
  }
}
