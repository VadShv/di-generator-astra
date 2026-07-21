import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/archive-di - List all archive DIs with position info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionId = searchParams.get('positionId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}

    if (positionId) {
      where.positionId = positionId
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
        { fileName: { contains: search } },
      ]
    }

    const archiveDIs = await db.archiveDI.findMany({
      where,
      include: {
        position: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json(archiveDIs)
  } catch (error) {
    console.error('ArchiveDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки архива ДИ' }, { status: 500 })
  }
}

// POST /api/archive-di - Create new archive DI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, content, positionId, fileName } = body

    if (!title || !content || !positionId) {
      return NextResponse.json(
        { error: 'Название, содержание и должность обязательны' },
        { status: 400 }
      )
    }

    // Verify position exists
    const position = await db.position.findUnique({
      where: { id: positionId },
    })

    if (!position) {
      return NextResponse.json(
        { error: 'Должность не найдена' },
        { status: 404 }
      )
    }

    const archiveDI = await db.archiveDI.create({
      data: {
        title,
        content,
        positionId,
        fileName: fileName || null,
      },
      include: {
        position: {
          include: {
            department: true,
          },
        },
      },
    })

    return NextResponse.json(archiveDI, { status: 201 })
  } catch (error) {
    console.error('ArchiveDI POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания архивной ДИ' }, { status: 500 })
  }
}

// PUT /api/archive-di - Update archive DI
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, title, content, positionId, fileName } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен для обновления' },
        { status: 400 }
      )
    }

    const existing = await db.archiveDI.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Архивная ДИ не найдена' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (positionId !== undefined) updateData.positionId = positionId
    if (fileName !== undefined) updateData.fileName = fileName

    const updated = await db.archiveDI.update({
      where: { id },
      data: updateData,
      include: {
        position: {
          include: {
            department: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('ArchiveDI PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления архивной ДИ' }, { status: 500 })
  }
}

// DELETE /api/archive-di - Delete archive DI
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID обязателен для удаления' },
        { status: 400 }
      )
    }

    const existing = await db.archiveDI.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json(
        { error: 'Архивная ДИ не найдена' },
        { status: 404 }
      )
    }

    await db.archiveDI.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ArchiveDI DELETE error:', error)
    return NextResponse.json({ error: 'Ошибка удаления архивной ДИ' }, { status: 500 })
  }
}
