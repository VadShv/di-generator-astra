import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// POST /api/compare/auto-save-original - Auto-save original generated DI as version
export async function POST(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const { generatedDIId } = body

    if (!generatedDIId) {
      return NextResponse.json(
        { error: 'ID сгенерированной ДИ обязателен' },
        { status: 400 }
      )
    }

    // Get the generated DI with sections
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
        versions: {
          where: { isOriginal: true },
        },
      },
    })

    if (!generatedDI) {
      return NextResponse.json(
        { error: 'Сгенерированная ДИ не найдена' },
        { status: 404 }
      )
    }

    // Check if original version already exists
    if (generatedDI.versions.length > 0) {
      // Update existing original version
      const sectionsContent = generatedDI.sections.map((s) => ({
        title: s.sectionTitle,
        content: s.sectionContent,
        order: s.order,
      }))

      const content = JSON.stringify({
        title: generatedDI.title,
        status: generatedDI.status,
        sections: sectionsContent,
      })

      const updatedVersion = await db.dIVersion.update({
        where: { id: generatedDI.versions[0].id },
        data: { content },
        include: {
          generatedDI: {
            include: {
              position: {
                include: {
                  department: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updatedVersion)
    }

    // Create new original version
    const sectionsContent = generatedDI.sections.map((s) => ({
      title: s.sectionTitle,
      content: s.sectionContent,
      order: s.order,
    }))

    const content = JSON.stringify({
      title: generatedDI.title,
      status: generatedDI.status,
      sections: sectionsContent,
    })

    // Get current max version
    const maxVersion = await db.dIVersion.findFirst({
      where: { generatedDIId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const nextVersion = (maxVersion?.version ?? 0) + 1

    const version = await db.dIVersion.create({
      data: {
        generatedDIId,
        content,
        version: nextVersion,
        isOriginal: true,
        uploadedBy: null,
        fileName: null,
      },
      include: {
        generatedDI: {
          include: {
            position: {
              include: {
                department: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Auto-save-original POST error:', error)
    return NextResponse.json({ error: 'Ошибка автосохранения оригинала' }, { status: 500 })
  }
}
