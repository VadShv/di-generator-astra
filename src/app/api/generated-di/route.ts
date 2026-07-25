import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/generated-di - List all generated DIs with position info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }

    const generatedDIs = await db.generatedDI.findMany({
      where,
      include: {
        position: {
          include: {
            department: { include: { company: true } },
          },
        },
        sections: {
          orderBy: { order: 'asc' },
        },
        versions: {
          orderBy: { version: 'desc' },
        },
        // Фаза 23: архивная ДИ как база генерации.
        sourceArchive: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Фаза 23: вычисляем тип ДИ (draft|review|approved) на основе статуса.
    const withType = generatedDIs.map((di) => ({
      ...di,
      type: di.status === 'review' ? 'review' : di.status === 'approved' ? 'approved' : 'draft',
    }))
    return NextResponse.json(withType)
  } catch (error) {
    console.error('GeneratedDI GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки сгенерированных ДИ' }, { status: 500 })
  }
}
