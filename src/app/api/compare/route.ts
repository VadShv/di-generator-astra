import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/compare - List all DI versions (with DI info)
export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const generatedDIId = searchParams.get('generatedDIId')

    const where: Record<string, unknown> = {}
    if (generatedDIId) {
      where.generatedDIId = generatedDIId
    }

    const versions = await db.dIVersion.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(versions)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Compare GET error:', error)
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
    console.error('Compare POST error:', error)
    return NextResponse.json({ error: 'Ошибка создания версии' }, { status: 500 })
  }
}
