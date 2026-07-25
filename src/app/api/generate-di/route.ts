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
          include: { department: { include: { company: true } }, businessFunction: true },
       },
       template: true,
       sections: {
         orderBy: { order: 'asc' },
       },
       _count: {
         select: { sections: true, versions: true },
       },
        // Фаза 23: архивная ДИ как база генерации.
        sourceArchive: true,
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
      include: { department: { include: { company: true } } },
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
        currentVersion: 1,
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
        position: { include: { department: { include: { company: true } } } },
       template: true,
       sections: { orderBy: { order: 'asc' } },
     },
    })

    // Create initial version record v1
    const versionContent = JSON.stringify({
      title: generatedDI.title,
      sections: generatedDI.sections.map(s => ({ title: s.sectionTitle, content: s.sectionContent })),
    })
    await db.dIVersion.create({
      data: {
        generatedDIId: generatedDI.id,
        content: versionContent,
        version: 1,
        isOriginal: true,
        changeDescription: 'Начальная версия (ручное создание)',
        uploadedBy: 'manual',
      },
    })

    return NextResponse.json(generatedDI, { status: 201 })
  } catch (error) {
    console.error('GenerateDI POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания ДИ' }, { status: 500 })
  }
}

// PUT /api/generate-di - Update generated DI with auto-versioning
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, status, sections, signedByEmployee, changeDescription } = body

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

    // Determine if we need to create a new version (sections changed)
    const sectionsChanged = sections && Array.isArray(sections)
    let newVersionNumber = existing.currentVersion

    if (sectionsChanged) {
      // Save current state as version before updating
      const currentContent = JSON.stringify({
        title: existing.title,
        sections: existing.sections.map(s => ({ title: s.sectionTitle, content: s.sectionContent })),
      })

      // Check if there's an existing version for currentVersion
      const existingVersion = await db.dIVersion.findFirst({
        where: { generatedDIId: id, version: existing.currentVersion },
      })

      if (!existingVersion) {
        // No version exists for current version number — create it
        await db.dIVersion.create({
          data: {
            generatedDIId: id,
            content: currentContent,
            version: existing.currentVersion,
            isOriginal: existing.currentVersion === 1,
            changeDescription: `Версия v${existing.currentVersion} (авто-сохранение перед изменением)`,
            uploadedBy: 'system',
          },
        })
      }

      // Increment version number
      newVersionNumber = existing.currentVersion + 1

      // Delete existing sections and recreate
      await db.generatedDISection.deleteMany({ where: { generatedDIId: id } })

      await db.generatedDI.update({
        where: { id },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          status: status !== undefined ? status : undefined,
          currentVersion: newVersionNumber,
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
          position: { include: { department: { include: { company: true } } } },
         template: true,
         sections: { orderBy: { order: 'asc' } },
       },
     })

      // Create new version record
      const updated = await db.generatedDI.findUnique({
        where: { id },
        include: { sections: { orderBy: { order: 'asc' } } },
      })
      const newContent = JSON.stringify({
        title: updated?.title || existing.title,
        sections: updated?.sections.map(s => ({ title: s.sectionTitle, content: s.sectionContent })) || [],
      })

      await db.dIVersion.create({
        data: {
          generatedDIId: id,
          content: newContent,
          version: newVersionNumber,
          isOriginal: false,
          changeDescription: changeDescription || `Обновление до версии v${newVersionNumber}`,
          uploadedBy: 'manual-edit',
        },
      })
    } else {
      // No sections change — just update metadata
      await db.generatedDI.update({
        where: { id },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          status: status !== undefined ? status : undefined,
         ...signedData,
       },
       include: {
          position: { include: { department: { include: { company: true } } } },
         template: true,
         sections: { orderBy: { order: 'asc' } },
       },
     })
   }

   // Fetch the updated DI with version info
   const finalDI = await db.generatedDI.findUnique({
     where: { id },
     include: {
        position: { include: { department: { include: { company: true } } } },
       template: true,
       sections: { orderBy: { order: 'asc' } },
       versions: { orderBy: { version: 'desc' } },
      },
    })

    return NextResponse.json(finalDI)
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
