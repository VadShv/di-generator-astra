import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/compare/[id] - Get single version detail
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const version = await db.dIVersion.findUnique({
      where: { id },
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

    if (!version) {
      return NextResponse.json(
        { error: 'Версия не найдена' },
        { status: 404 }
      )
    }

    return NextResponse.json(version)
  } catch (error) {
    console.error('Compare GET [id] error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки версии' }, { status: 500 })
  }
}
