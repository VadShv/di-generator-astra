import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/archive-di/[id] - Get single archive DI with full content
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const archiveDI = await db.archiveDI.findUnique({
      where: { id },
      include: {
        position: {
          include: {
            department: true,
          },
        },
      },
    })

    if (!archiveDI) {
      return NextResponse.json(
        { error: 'Архивная ДИ не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(archiveDI)
  } catch (error) {
    console.error('ArchiveDI GET [id] error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки архивной ДИ' }, { status: 500 })
  }
}

// DELETE /api/archive-di/[id] - Удаление архивной ДИ
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.archiveDI.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Архивная ДИ не найдена' }, { status: 404 })
    }

    await db.archiveDI.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ArchiveDI DELETE [id] error:', error)
    return NextResponse.json({ error: 'Ошибка удаления архивной ДИ' }, { status: 500 })
  }
}
