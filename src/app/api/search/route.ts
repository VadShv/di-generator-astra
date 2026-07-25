import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Глобальный поиск по должностям, подразделениям и должностным инструкциям.
// GET /api/search?q=<текст>&limit=<число>
// Возвращает сгруппированные результаты с подсветкой контекста для перехода.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 25)

    if (q.length < 2) {
      return NextResponse.json({
        positions: [],
        departments: [],
        instructions: [],
      })
    }

    const [positions, departments, instructions] = await Promise.all([
      db.position.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        take: limit,
        select: {
          id: true,
          title: true,
          grade: true,
          department: { select: { id: true, name: true, company: { select: { name: true } } } },
        },
      }),
      db.department.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          code: true,
          company: { select: { name: true } },
        },
      }),
      db.generatedDI.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          position: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      positions: positions.map(p => ({
        id: p.id,
        title: p.title,
        grade: p.grade,
        departmentName: p.department?.name ?? null,
        companyName: p.department?.company?.name ?? null,
      })),
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        companyName: d.company?.name ?? null,
      })),
      instructions: instructions.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        updatedAt: i.updatedAt,
        positionTitle: i.position?.title ?? null,
      })),
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 })
  }
}
