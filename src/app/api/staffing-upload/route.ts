// API: загрузка штатного расписания из Excel (Фаза 3)
// POST /api/staffing-upload
// Режимы (поле mode):
//   1. mode=parse (по умолчанию) — принимает FormData с .xlsx, возвращает распарсенные строки
//      для предпросмотра БЕЗ записи в БД.
//   2. mode=import — принимает JSON с подтверждёнными строками + companyId, выполняет
//      bulk insert: создаёт недостающие Department/Position и записи StaffingTable.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseStaffingExcel, type ParsedStaffingRow } from '@/lib/staffing-parser'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 МБ

// Нормализация названия подразделения для дедупликации.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Генерация кода подразделения из названия, если кода нет в файле.
function generateDeptCode(name: string, index: number): string {
  // Транслитерация не нужна — код генерируем как DEPT-<порядковый>.
  return `DEPT-${String(index).padStart(4, '0')}`
}

// Генерация кода должности, если нет в файле.
function generatePosCode(title: string, index: number): string {
  return `POS-${String(index).padStart(5, '0')}`
}

// POST — обработка запроса (parse или import)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const contentType = request.headers.get('content-type') || ''
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') || 'parse'

    // ===== РЕЖИМ PARSE: принимаем FormData с .xlsx =====
    if (mode === 'parse') {
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json(
          { error: 'Для режима parse нужен FormData с .xlsx файлом' },
          { status: 400 }
        )
      }
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
      }
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        return NextResponse.json(
          { error: 'Поддерживаются только файлы .xlsx и .xls' },
          { status: 400 }
        )
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ.` },
          { status: 413 }
        )
      }

      const buffer = await file.arrayBuffer()
      const result = parseStaffingExcel(buffer)

      if (result.rows.length === 0 && result.errors.length > 0) {
        return NextResponse.json(
          { error: 'Не удалось распознать данные', details: result.errors },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'parse',
        fileName: file.name,
        detectedHeaders: result.detectedHeaders,
        columnMapping: result.columnMapping,
        rows: result.rows,
        errors: result.errors,
        summary: {
          totalRows: result.rows.length,
          errorCount: result.errors.length,
          uniqueDepartments: new Set(result.rows.map((r) => normalizeName(r.departmentName))).size,
          uniquePositions: new Set(result.rows.map((r) => normalizeName(r.positionTitle))).size,
        },
      })
    }

    // ===== РЕЖИМ IMPORT: принимаем JSON с подтверждёнными строками =====
    if (mode === 'import') {
      const body = await request.json()
      const { companyId, rows } = body as { companyId?: string; rows: ParsedStaffingRow[] }

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: 'Нет строк для импорта' }, { status: 400 })
      }

      // Проверка компании, если указана.
      if (companyId) {
        const company = await db.company.findUnique({ where: { id: companyId } })
        if (!company) {
          return NextResponse.json({ error: 'Юридическое лицо не найдено' }, { status: 404 })
        }
      }

      // Транзакция: создаём подразделения и должности, затем записи ШР.
      const result = await db.$transaction(async (tx) => {
        let departmentsCreated = 0
        let positionsCreated = 0
        let staffingCreated = 0
        const importErrors: { rowNumber: number; message: string }[] = []

        // Кэш подразделений по нормализованному имени (в рамках транзакции).
        const deptCache = new Map<
          string,
          { id: string; name: string; code: string }
        >()

        // Предзагружаем существующие подразделения (по имени), чтобы не дублировать.
        const existingDepts = await tx.department.findMany({
          where: companyId ? { companyId } : undefined,
          select: { id: true, name: true, code: true },
        })
        for (const d of existingDepts) {
          deptCache.set(normalizeName(d.name), d)
        }

        // Кэш должностей по коду (код уникален глобально).
        const posCacheByCode = new Map<string, string>()
        const existingPositions = await tx.position.findMany({
          select: { id: true, code: true },
        })
        for (const p of existingPositions) {
          if (p.code) posCacheByCode.set(p.code, p.id)
        }

        let deptCounter = existingDepts.length
        let posCounter = existingPositions.length

        for (const row of rows) {
          try {
            // 1. Находим или создаём подразделение.
            const deptKey = normalizeName(row.departmentName)
            let dept = deptCache.get(deptKey)
            if (!dept) {
              const code = row.departmentCode || generateDeptCode(row.departmentName, ++deptCounter)
              // Проверяем уникальность кода.
              const codeConflict = await tx.department.findUnique({ where: { code } })
              const finalCode = codeConflict ? generateDeptCode(row.departmentName, ++deptCounter) : code
              dept = await tx.department.create({
                data: {
                  name: row.departmentName,
                  code: finalCode,
                  ...(companyId ? { companyId } : {}),
                },
              })
              deptCache.set(deptKey, dept)
              departmentsCreated++
            }

            // 2. Находим или создаём должность.
            let positionId: string | null = null
            const posCode = row.positionCode || generatePosCode(row.positionTitle, ++posCounter)
            const existingPosId = posCacheByCode.get(posCode)
            if (existingPosId) {
              positionId = existingPosId
            } else {
              // Проверяем код на уникальность.
              const codeConflict = await tx.position.findUnique({ where: { code: posCode } })
              const finalPosCode = codeConflict
                ? generatePosCode(row.positionTitle, ++posCounter)
                : posCode
              const newPos = await tx.position.create({
                data: {
                  title: row.positionTitle,
                  code: finalPosCode,
                  departmentId: dept.id,
                  headcount: Math.max(1, Math.round(row.headcount)),
                  grade: row.grade,
                  ...(companyId ? { companyId } : {}),
                },
              })
              posCacheByCode.set(finalPosCode, newPos.id)
              positionId = newPos.id
              positionsCreated++
            }

            // 3. Создаём запись штатного расписания.
            await tx.staffingTable.create({
              data: {
                departmentId: dept.id,
                positionTitle: row.positionTitle,
                positionCode: row.positionCode,
                positionId,
                headcount: row.headcount,
                category: row.category,
                source: 'excel',
                ...(companyId ? { companyId } : {}),
              },
            })
            staffingCreated++
          } catch (e) {
            importErrors.push({
              rowNumber: row.rowNumber,
              message: e instanceof Error ? e.message : 'Ошибка импорта строки',
            })
          }
        }

        return { departmentsCreated, positionsCreated, staffingCreated, importErrors }
      })

      return NextResponse.json({
        success: true,
        mode: 'import',
        summary: {
          departmentsCreated: result.departmentsCreated,
          positionsCreated: result.positionsCreated,
          staffingCreated: result.staffingCreated,
          errorCount: result.importErrors.length,
        },
        errors: result.importErrors,
      })
    }

    return NextResponse.json({ error: `Неизвестный режим: ${mode}` }, { status: 400 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('POST /api/staffing-upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка обработки файла' },
      { status: 500 }
    )
  }
}
