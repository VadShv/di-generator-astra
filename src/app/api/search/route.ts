import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// Глобальный поиск по должностям, подразделениям и должностным инструкциям
// (сгенерированным и архивным). GET /api/search?q=<текст>&limit=<число>
// Возвращает сгруппированные результаты с контекстом для перехода.
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 25)

    if (q.length < 2) {
      return NextResponse.json({
        positions: [],
        departments: [],
        instructions: [],
        archiveDIs: [],
      })
    }

    const [positions, departments, instructions, archiveDIs] = await Promise.all([
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
          position: { select: { id: true, title: true, department: { select: { id: true, name: true, company: { select: { name: true } } } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      // ArchiveDI: полнотекстовый поиск по content через to_tsvector (GIN-индекс),
      // триграммный поиск по title/fileName (pg_trgm GIN-индекс).
      db.$queryRaw<Array<{
        id: string
        title: string
        uploadedAt: Date
        fileName: string | null
        positionId: string | null
        positionTitle: string | null
        departmentName: string | null
        companyName: string | null
      }>>`
        SELECT a.id, a.title, a."uploadedAt", a."fileName",
               p.id AS "positionId", p.title AS "positionTitle",
               d.name AS "departmentName", c.name AS "companyName"
        FROM "ArchiveDI" a
        LEFT JOIN "Position" p ON a."positionId" = p.id
        LEFT JOIN "Department" d ON p."departmentId" = d.id
        LEFT JOIN "Company" c ON d."companyId" = c.id
        WHERE a.title ILIKE '%' || ${q} || '%'
           OR a."fileName" ILIKE '%' || ${q} || '%'
           OR to_tsvector('russian', a.content) @@ plainto_tsquery('russian', ${q})
        ORDER BY a."uploadedAt" DESC
        LIMIT ${limit}
      `,
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
        type: i.status === 'review' ? 'review' : i.status === 'approved' ? 'approved' : 'draft',
        updatedAt: i.updatedAt,
        positionTitle: i.position?.title ?? null,
        departmentName: i.position?.department?.name ?? null,
        companyName: i.position?.department?.company?.name ?? null,
      })),
      archiveDIs: archiveDIs.map(a => ({
        id: a.id,
        title: a.title,
        type: 'archive' as const,
        uploadedAt: a.uploadedAt,
        fileName: a.fileName ?? null,
        positionTitle: a.positionTitle ?? null,
        departmentName: a.departmentName ?? null,
        companyName: a.companyName ?? null,
        linked: Boolean(a.positionId),
      })),
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Ошибка поиска' }, { status: 500 })
  }
}
