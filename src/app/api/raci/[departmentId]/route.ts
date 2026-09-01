import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { getProviderClient } from '@/lib/ai-connector'
import { createLogger } from '@/lib/logger'

const log = createLogger('raci')

// GET /api/raci/[departmentId] — текущая RACI матрица
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    await requireAuth()
    const { departmentId } = await params

    const matrix = await db.rACIMatrix.findUnique({
      where: { departmentId },
    })

    if (!matrix) {
      return NextResponse.json({ error: 'RACI матрица не создана' }, { status: 404 })
    }

    return NextResponse.json({
      ...matrix,
      zones: JSON.parse(matrix.zones),
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка получения RACI матрицы' }, { status: 500 })
  }
}

// POST /api/raci/[departmentId] — AI-генерация RACI матрицы
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    await requireAuth()
    const { departmentId } = await params

    const department = await db.department.findUnique({
      where: { id: departmentId },
      include: {
        positions: {
          include: {
            generatedDIs: {
              include: { sections: { select: { sectionTitle: true, sectionContent: true } } },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json({ error: 'Подразделение не найдено' }, { status: 404 })
    }

    const positionsWithDI = department.positions.filter((p) => p.generatedDIs.length > 0)
    if (positionsWithDI.length === 0) {
      return NextResponse.json({ error: 'Нет должностей с сгенерированными ДИ в подразделении' }, { status: 400 })
    }

    // Строим контекст для AI
    const positionsContext = positionsWithDI.map((p) => ({
      positionId: p.id,
      title: p.title,
      diSections: p.generatedDIs[0]?.sections?.map((s) => `${s.sectionTitle}: ${s.sectionContent.slice(0, 500)}`) || [],
    }))

    const systemPrompt = `Ты — HR-аналитик, специализирующийся на матрицах ответственности RACI.
Для подразделения "${department.name}" проанализируй должностные инструкции и создай RACI матрицу.

Извлеки 5-15 ключевых зон ответственности из ДИ.
Для каждой зоны и каждой должности назначь ровно одну роль:
- R (Responsible) — исполняет работу
- A (Accountable) — отвечает за результат (один на зону)
- C (Consulted) — консультируется
- I (Informed) — уведомляется

Верни JSON: {"zones": [{"zone": "название зоны", "items": [{"positionId": "id", "role": "R|A|C|I"}]}]}`

    const userPrompt = `Должности и их ДИ:\n${JSON.stringify(positionsContext, null, 2)}`

    const client = await getProviderClient()
    const result = await client.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    let parsed: { zones: { zone: string; items: { positionId: string; role: string }[] }[] }
    try {
      parsed = JSON.parse(result.content)
    } catch {
      parsed = { zones: [] }
    }

    const zonesJson = JSON.stringify(parsed.zones)

    // Upsert матрицы
    const matrix = await db.rACIMatrix.upsert({
      where: { departmentId },
      create: {
        departmentId,
        zones: zonesJson,
        generatedBy: 'ai',
      },
      update: {
        zones: zonesJson,
        generatedBy: 'ai',
      },
    })

    log.info('RACI matrix generated', { departmentId, zones: parsed.zones.length })

    return NextResponse.json({
      ...matrix,
      zones: parsed.zones,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error generating RACI:', { error })
    return NextResponse.json({ error: 'Ошибка генерации RACI матрицы' }, { status: 500 })
  }
}

// PUT /api/raci/[departmentId] — ручное обновление RACI матрицы
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ departmentId: string }> }
) {
  try {
    await requireAuth()
    const { departmentId } = await params
    const body = await request.json()
    const { zones } = body

    if (!zones || !Array.isArray(zones)) {
      return NextResponse.json({ error: 'zones массив обязателен' }, { status: 400 })
    }

    const matrix = await db.rACIMatrix.upsert({
      where: { departmentId },
      create: {
        departmentId,
        zones: JSON.stringify(zones),
        generatedBy: 'manual',
      },
      update: {
        zones: JSON.stringify(zones),
      },
    })

    return NextResponse.json({
      ...matrix,
      zones,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка обновления RACI матрицы' }, { status: 500 })
  }
}
