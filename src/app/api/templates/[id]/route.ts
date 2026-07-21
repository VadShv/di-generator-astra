import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/templates/[id] - Get single template with full sections
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const template = await db.dITemplate.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Template GET [id] error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки шаблона' }, { status: 500 })
  }
}
