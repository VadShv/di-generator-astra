import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

import { createLogger } from '@/lib/logger'

const log = createLogger('token-usage')

// GET /api/token-usage — агрегированная статистика потребления токенов
export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10)

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [totalAgg, byDayRaw, byProviderRaw, byCategoryRaw, diCount, recent] = await Promise.all([
      db.tokenUsage.aggregate({ _sum: { totalTokens: true }, _count: true }),
      db.tokenUsage.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, totalTokens: true },
      }),
      db.tokenUsage.groupBy({
        by: ['providerName'],
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      }),
      db.tokenUsage.groupBy({
        by: ['category'],
        _sum: { totalTokens: true },
        orderBy: { _sum: { totalTokens: 'desc' } },
      }),
      db.generatedDI.count(),
      db.tokenUsage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, providerName: true, modelName: true, category: true, promptTokens: true, completionTokens: true, totalTokens: true, createdAt: true },
      }),
    ])

    // Группировка по дням для графика
    const dayMap = new Map<string, number>()
    for (const r of byDayRaw) {
      const day = r.createdAt.toISOString().slice(0, 10)
      dayMap.set(day, (dayMap.get(day) || 0) + r.totalTokens)
    }
    const byDay = Array.from(dayMap.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const avgPerDI = diCount > 0 ? Math.round((totalAgg._sum.totalTokens || 0) / diCount) : 0

    return NextResponse.json({
      total: totalAgg._sum.totalTokens || 0,
      totalRequests: totalAgg._count,
      avgPerDI,
      byDay,
      byProvider: byProviderRaw.map((p) => ({ provider: p.providerName, tokens: p._sum.totalTokens || 0 })),
      byCategory: byCategoryRaw.map((c) => ({ category: c.category, tokens: c._sum.totalTokens || 0 })),
      recent,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching token usage:', { error })
    return NextResponse.json({ error: 'Ошибка получения статистики токенов' }, { status: 500 })
  }
}
