import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/generate-di - List all generated DIs with position and section count
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const positionId = searchParams.get('positionId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (positionId) where.positionId = positionId
    if (status) where.status = status

    const generatedDIs = await db.generatedDI.findMany({
      where,
      include: {
        position: {
          include: { department: true },
        },
        template: true,
        sections: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { sections: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(generatedDIs)
  } catch (error) {
    console.error('GenerateDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки сгенерированных ДИ' }, { status: 500 })
  }
}

// POST /api/generate-di - Create new DI manually
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { positionId, templateId, title, sections } = body

    if (!positionId || typeof positionId !== 'string') {
      return NextResponse.json({ error: 'ID должности обязателен' }, { status: 400 })
    }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Название ДИ обязательно' }, { status: 400 })
    }

    // Validate position exists
    const position = await db.position.findUnique({
      where: { id: positionId },
      include: { department: true },
    })
    if (!position) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    // Validate template if provided
    if (templateId) {
      const template = await db.dITemplate.findUnique({ where: { id: templateId } })
      if (!template) {
        return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
      }
    }

    const generatedDI = await db.generatedDI.create({
      data: {
        positionId,
        templateId: templateId || null,
        title: title.trim(),
        status: 'draft',
        sections: sections && Array.isArray(sections) && sections.length > 0
          ? {
              create: sections.map((s: { sectionTitle: string; sectionContent: string; order: number }) => ({
                sectionTitle: s.sectionTitle.trim(),
                sectionContent: s.sectionContent,
                order: s.order,
                aiGenerated: false,
                editedBy: 'manual',
              })),
            }
          : undefined,
      },
      include: {
        position: { include: { department: true } },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json(generatedDI, { status: 201 })
  } catch (error) {
    console.error('GenerateDI POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания ДИ' }, { status: 500 })
  }
}

// PUT /api/generate-di - Update generated DI
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, status, sections, signedByEmployee } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID ДИ обязателен' }, { status: 400 })
    }

    const existing = await db.generatedDI.findUnique({
      where: { id },
      include: { sections: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    // Validate status transition
    const validStatuses = ['draft', 'review', 'approved', 'exported']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 })
    }

    // Handle signedByEmployee
    const signedData: Record<string, unknown> = {}
    if (signedByEmployee !== undefined) {
      signedData.signedByEmployee = signedByEmployee
      signedData.signedAt = signedByEmployee ? new Date() : null
    }

    // Update sections if provided
    if (sections && Array.isArray(sections)) {
      // Delete existing sections and recreate
      await db.generatedDISection.deleteMany({ where: { generatedDIId: id } })

      await db.generatedDI.update({
        where: { id },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          status: status !== undefined ? status : undefined,
          ...signedData,
          sections: {
            create: sections.map((s: { sectionTitle: string; sectionContent: string; order: number; aiGenerated?: boolean; editedBy?: string }) => ({
              sectionTitle: s.sectionTitle.trim(),
              sectionContent: s.sectionContent,
              order: s.order,
              aiGenerated: s.aiGenerated !== undefined ? s.aiGenerated : true,
              editedBy: s.editedBy || null,
            })),
          },
        },
        include: {
          position: { include: { department: true } },
          template: true,
          sections: { orderBy: { order: 'asc' } },
        },
      })
    } else {
      await db.generatedDI.update({
        where: { id },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          status: status !== undefined ? status : undefined,
          ...signedData,
        },
        include: {
          position: { include: { department: true } },
          template: true,
          sections: { orderBy: { order: 'asc' } },
        },
      })
    }

    // Fetch the updated DI
    const updated = await db.generatedDI.findUnique({
      where: { id },
      include: {
        position: { include: { department: true } },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('GenerateDI PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления ДИ' }, { status: 500 })
  }
}

// DELETE /api/generate-di - Delete generated DI
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID ДИ обязателен' }, { status: 400 })
    }

    const existing = await db.generatedDI.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    await db.generatedDI.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GenerateDI DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления ДИ' }, { status: 500 })
  }
}
