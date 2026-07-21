import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/templates - List all templates with sections
export async function GET() {
  try {
    const templates = await db.dITemplate.findMany({
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки шаблонов' }, { status: 500 })
  }
}

// POST /api/templates - Create template with sections
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, sections } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Название шаблона обязательно' }, { status: 400 })
    }

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'Добавьте хотя бы одну секцию' }, { status: 400 })
    }

    const template = await db.dITemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        sections: {
          create: sections.map((s: { title: string; order: number; promptGuidance?: string; isRequired?: boolean; content?: string }) => ({
            title: s.title.trim(),
            order: s.order,
            promptGuidance: s.promptGuidance?.trim() || null,
            isRequired: s.isRequired !== undefined ? s.isRequired : true,
            content: s.content?.trim() || null,
          })),
        },
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания шаблона' }, { status: 500 })
  }
}

// PUT /api/templates - Update template
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, description, isActive, sections } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID шаблона обязателен' }, { status: 400 })
    }

    const existing = await db.dITemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    // If sections are provided, replace all sections
    if (sections && Array.isArray(sections)) {
      // Delete existing sections and recreate
      await db.dITemplateSection.deleteMany({ where: { templateId: id } })

      await db.dITemplate.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          description: description !== undefined ? (description?.trim() || null) : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          sections: {
            create: sections.map((s: { title: string; order: number; promptGuidance?: string; isRequired?: boolean; content?: string }) => ({
              title: s.title.trim(),
              order: s.order,
              promptGuidance: s.promptGuidance?.trim() || null,
              isRequired: s.isRequired !== undefined ? s.isRequired : true,
              content: s.content?.trim() || null,
            })),
          },
        },
        include: {
          sections: { orderBy: { order: 'asc' } },
        },
      })
    } else {
      // Update only template fields
      await db.dITemplate.update({
        where: { id },
        data: {
          name: name !== undefined ? name.trim() : undefined,
          description: description !== undefined ? (description?.trim() || null) : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
        },
        include: {
          sections: { orderBy: { order: 'asc' } },
        },
      })
    }

    // Fetch the updated template with sections
    const updated = await db.dITemplate.findUnique({
      where: { id },
      include: { sections: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Templates PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления шаблона' }, { status: 500 })
  }
}

// DELETE /api/templates - Delete template
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID шаблона обязателен' }, { status: 400 })
    }

    const existing = await db.dITemplate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    await db.dITemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления шаблона' }, { status: 500 })
  }
}
