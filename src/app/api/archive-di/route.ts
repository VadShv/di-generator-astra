import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Общий include для архивных ДИ: должность → подразделение → компания (для селектора)
const ARCHIVE_INCLUDE = {
  position: {
    include: {
      department: {
        include: { company: true },
      },
    },
  },
} as const

// GET /api/archive-di - Список архивных ДИ с фильтрами
// Параметры:
//   positionId — фильтр по конкретной должности
//   search     — поиск по title/content/fileName
//   linkStatus — unlinked | linked | all (статус привязки к должности)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const positionId = searchParams.get('positionId')
    const search = searchParams.get('search')
    const linkStatus = searchParams.get('linkStatus') // unlinked | linked | all

    const where: Record<string, unknown> = {}

    if (positionId) {
      where.positionId = positionId
    } else if (linkStatus === 'unlinked') {
      where.positionId = null
    } else if (linkStatus === 'linked') {
      where.positionId = { not: null }
    }
    // linkStatus === 'all' или не передан — без фильтра по привязке

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { fileName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const archiveDIs = await db.archiveDI.findMany({
      where,
      include: {
        ...ARCHIVE_INCLUDE,
        // Фаза 23: производные сгенерированные ДИ (для бейджа «на базе»).
        _count: { select: { derivedGeneratedDIs: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    // Фаза 23: добавляем type = 'archive' и кол-во производных ДИ.
    const withType = archiveDIs.map((di) => ({
      ...di,
      type: 'archive' as const,
      derivedCount: di._count?.derivedGeneratedDIs ?? 0,
    }))
    return NextResponse.json(withType)
  } catch (error) {
    console.error('ArchiveDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки архива ДИ' }, { status: 500 })
  }
}

// POST /api/archive-di - Создание архивной ДИ
// positionId опционален: ДИ можно загрузить без привязки и привязать позже
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, content, positionId, fileName } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Название и содержание обязательны' },
        { status: 400 }
      )
    }

    // Если positionId передан — проверяем существование должности
    if (positionId) {
      const position = await db.position.findUnique({
        where: { id: positionId },
      })

      if (!position) {
        return NextResponse.json(
          { error: 'Должность не найдена' },
          { status: 404 }
        )
      }
    }

    const archiveDI = await db.archiveDI.create({
      data: {
        title,
        content,
        positionId: positionId || null,
        fileName: fileName || null,
      },
      include: ARCHIVE_INCLUDE,
    })

    return NextResponse.json(archiveDI, { status: 201 })
  } catch (error) {
    console.error('ArchiveDI POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания архивной ДИ' }, { status: 500 })
  }
}

// PUT /api/archive-di - Обновление архивной ДИ
// positionId может быть null (отвязка) или string (привязка/перепривязка)
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

    // Если positionId передан и не null — проверяем должность
    if (positionId !== undefined && positionId !== null) {
      const position = await db.position.findUnique({
        where: { id: positionId },
      })
      if (!position) {
        return NextResponse.json(
          { error: 'Должность не найдена' },
          { status: 404 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    // positionId может быть явно null (отвязка) или string (привязка)
    if (positionId !== undefined) updateData.positionId = positionId || null
    if (fileName !== undefined) updateData.fileName = fileName

    const updated = await db.archiveDI.update({
      where: { id },
      data: updateData,
      include: ARCHIVE_INCLUDE,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('ArchiveDI PUT error:', error)
    return NextResponse.json({ error: 'Ошибка обновления архивной ДИ' }, { status: 500 })
  }
}

// DELETE /api/archive-di - Удаление архивной ДИ
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
