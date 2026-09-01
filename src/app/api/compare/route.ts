import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

import { createLogger } from '@/lib/logger'

const log = createLogger('compare')

// GET /api/compare - Paginated list of DI versions (with DI info)
// Параметры: generatedDIId, page, pageSize
// Возвращает: { items, total, page, pageSize }
// content НЕ загружается в списке — только при запросе конкретной версии (GET /api/compare/[id])
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const generatedDIId = searchParams.get('generatedDIId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const pageSize = Math.min(MAX_PAGE_SIZE, Number(searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE)

    const where: Record<string, unknown> = {}
    if (generatedDIId) {
      where.generatedDIId = generatedDIId
    }

    const [items, total] = await Promise.all([
      db.dIVersion.findMany({
        where,
        select: {
          id: true,
          version: true,
          isOriginal: true,
          uploadedBy: true,
          fileName: true,
          diffSummary: true,
          changeDescription: true,
          createdAt: true,
          generatedDI: {
            select: {
              id: true,
              title: true,
              status: true,
              position: {
                select: {
                  id: true,
                  title: true,
                  department: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.dIVersion.count({ where }),
    ])

    return NextResponse.json({ items, total, page, pageSize })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Compare GET error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки версий' }, { status: 500 })
  }
}

// POST /api/compare - Upload new version
export async function POST(request: Request) {
  try {
    await requireAuth()
    const body = await request.json()
    const { generatedDIId, content, uploadedBy, fileName, isOriginal } = body

    if (!generatedDIId || !content) {
      return NextResponse.json(
        { error: 'ID сгенерированной ДИ и содержание обязательны' },
        { status: 400 }
      )
    }

    // Verify generated DI exists
    const generatedDI = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
    })

    if (!generatedDI) {
      return NextResponse.json(
        { error: 'Сгенерированная ДИ не найдена' },
        { status: 404 }
      )
    }

    // Get current max version for this DI
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
        isOriginal: isOriginal ?? false,
        uploadedBy: uploadedBy || null,
        fileName: fileName || null,
      },
     include: {
       generatedDI: {
         include: {
           position: {
             include: {
                department: { include: { company: true } },
             },
           },
         },
       },
      },
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Compare POST error:', { error })
    return NextResponse.json({ error: 'Ошибка создания версии' }, { status: 500 })
  }
}
