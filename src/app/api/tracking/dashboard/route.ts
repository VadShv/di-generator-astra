import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('tracking-dashboard')

// GET /api/tracking/dashboard — агрегированный обзор покрытия ДИ.
// Возвращает дерево: юр. лицо → подразделения → должности с расчётным статусом ДИ.
//
// Параметры:
//   companyId    — фильтр по юр. лицу
//   departmentId — фильтр по подразделению
//   status       — фильтр по расчётному статусу (actual|outdated|audit|missing)
//
// Расчётный статус ДИ для должности:
//   missing   — ДИ отсутствует (нет GeneratedDI)
//   actual    — есть ДИ в статусе approved/signed/exported
//   outdated  — есть ДИ, но старая (обновлена > 180 дней) либо draft/returned
//   audit     — ДИ на аудите (есть DIAuditResult без признака «ок» или статус review)
export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const departmentId = searchParams.get('departmentId')
    const statusFilter = searchParams.get('status')

    // Фильтр подразделений.
    const deptWhere: Record<string, unknown> = {}
    if (companyId) deptWhere.companyId = companyId
    if (departmentId) deptWhere.id = departmentId

    // Подразделения с должностями и связанными ДИ + аудитами.
    const departments = await db.department.findMany({
      where: deptWhere,
      include: {
        company: true,
        positions: {
          include: {
            generatedDIs: {
              include: { auditResults: true },
              orderBy: { updatedAt: 'desc' },
              take: 1, // Берём самую свежую ДИ для должности.
            },
          },
          orderBy: { title: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const NOW = Date.now()
    const OUTDATED_MS = 180 * 24 * 60 * 60 * 1000 // 180 дней.

    // Расчёт статуса ДИ для конкретной должности.
    function calcDiStatus(latestDi: {
      status: string
      updatedAt: Date
      auditResults: { id: string }[]
    } | null): 'actual' | 'outdated' | 'audit' | 'missing' {
      if (!latestDi) return 'missing'
      // На аудите: есть результаты аудита либо статус review.
      if (latestDi.auditResults.length > 0 || latestDi.status === 'review') return 'audit'
      // Актуальна: согласована/подписана/экспортирована и не устарела по дате.
      const isApproved = ['approved', 'signed', 'exported'].includes(latestDi.status)
      const isOutdated = NOW - latestDi.updatedAt.getTime() > OUTDATED_MS
      if (isApproved && !isOutdated) return 'actual'
      return 'outdated'
    }

    // Сборка результата по подразделениям.
    const grouped = departments.map((dept) => {
      const positions = dept.positions.map((pos) => {
        const latestDi = pos.generatedDIs[0] ?? null
        const diStatus = calcDiStatus(latestDi as never)
        return {
          positionId: pos.id,
          positionTitle: pos.title,
          positionCode: pos.code,
          grade: pos.grade,
          diStatus,
          diId: latestDi?.id ?? null,
          diTitle: latestDi?.title ?? null,
          diDbStatus: latestDi?.status ?? null,
          updatedAt: latestDi?.updatedAt ?? null,
        }
      })

      // Сводка по подразделению.
      const summary = {
        total: positions.length,
        actual: positions.filter((p) => p.diStatus === 'actual').length,
        outdated: positions.filter((p) => p.diStatus === 'outdated').length,
        audit: positions.filter((p) => p.diStatus === 'audit').length,
        missing: positions.filter((p) => p.diStatus === 'missing').length,
      }

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        departmentCode: dept.code,
        company: dept.company ? { id: dept.company.id, name: dept.company.name } : null,
        summary,
        positions,
      }
    })

    // Фильтр по статусу ДИ на уровне должностей (если задан).
    const filtered = statusFilter
      ? grouped.map((g) => ({
          ...g,
          positions: g.positions.filter((p) => p.diStatus === statusFilter),
        })).filter((g) => g.positions.length > 0)
      : grouped

    // Общая сводка по всем данным.
    const overall = filtered.reduce(
      (acc, g) => {
        acc.total += g.summary.total
        acc.actual += g.summary.actual
        acc.outdated += g.summary.outdated
        acc.audit += g.summary.audit
        acc.missing += g.summary.missing
        return acc
      },
      { total: 0, actual: 0, outdated: 0, audit: 0, missing: 0 }
    )

    return NextResponse.json({ overall, departments: filtered })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Tracking dashboard error:', { error })
    return NextResponse.json({ error: 'Ошибка загрузки дашборда отслеживания' }, { status: 500 })
  }
}
