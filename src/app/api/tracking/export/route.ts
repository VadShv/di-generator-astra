import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// GET /api/tracking/export — экспорт отчёта покрытия ДИ в Excel (.xlsx).
// Параметры те же, что у /api/tracking/dashboard (companyId, departmentId).
// Возвращает бинарный .xlsx-файл.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const departmentId = searchParams.get('departmentId')

    const deptWhere: Record<string, unknown> = {}
    if (companyId) deptWhere.companyId = companyId
    if (departmentId) deptWhere.id = departmentId

    const departments = await db.department.findMany({
      where: deptWhere,
      include: {
        company: true,
        positions: {
          include: {
            generatedDIs: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: { title: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    const NOW = Date.now()
    const OUTDATED_MS = 180 * 24 * 60 * 60 * 1000

    const STATUS_LABEL: Record<string, string> = {
      actual: 'Актуальна',
      outdated: 'Требует обновления',
      audit: 'На аудите',
      missing: 'Отсутствует',
    }

    function calcDiStatus(latestDi: { status: string; updatedAt: Date } | null) {
      if (!latestDi) return 'missing'
      if (latestDi.status === 'review') return 'audit'
      const isApproved = ['approved', 'signed', 'exported'].includes(latestDi.status)
      const isOutdated = NOW - latestDi.updatedAt.getTime() > OUTDATED_MS
      if (isApproved && !isOutdated) return 'actual'
      return 'outdated'
    }

    // Строки отчёта: одна строка на должность.
    const rows: Record<string, string | number>[] = []
    for (const dept of departments) {
      for (const pos of dept.positions) {
        const latestDi = pos.generatedDIs[0] ?? null
        const diStatus = calcDiStatus(latestDi as never)
        rows.push({
          'Юр. лицо': dept.company?.name ?? '—',
          'Подразделение': dept.name,
          'Код подразделения': dept.code,
          'Должность': pos.title,
          'Код должности': pos.code,
          'Грейд': pos.grade ?? '—',
          'Статус ДИ': STATUS_LABEL[diStatus] ?? diStatus,
          'Название ДИ': latestDi?.title ?? '—',
          'Статус в БД': latestDi?.status ?? '—',
          'Обновлено': latestDi ? new Date(latestDi.updatedAt).toLocaleDateString('ru-RU') : '—',
        })
      }
    }

    if (rows.length === 0) {
      rows.push({
        'Юр. лицо': '—', 'Подразделение': 'Нет данных', 'Код подразделения': '',
        'Должность': '', 'Код должности': '', 'Грейд': '', 'Статус ДИ': '',
        'Название ДИ': '', 'Статус в БД': '', 'Обновлено': '',
      })
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    // Ширина колонок.
    ws['!cols'] = [
      { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
      { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Отчёт ДИ')

   const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    // Uint8Array совместим с BodyInit в отличие от Node.js Buffer
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="di-tracking-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Tracking export error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта отчёта' }, { status: 500 })
  }
}
