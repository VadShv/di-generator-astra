// Парсинг штатного расписания из Excel (Фаза 3)
// Использует библиотеку xlsx (уже в package.json).
// Маппинг колонок: Подразделение → Должность → Кол-во ставок → Категория
// Поддерживает гибкое сопоставление заголовков (русские/английские варианты).

import * as XLSX from 'xlsx'

/** Одна распознанная строка штатного расписания. */
export interface ParsedStaffingRow {
  /** Название подразделения. */
  departmentName: string
  /** Код подразделения (если есть в файле). */
  departmentCode: string | null
  /** Название должности. */
  positionTitle: string
  /** Код должности (если есть). */
  positionCode: string | null
  /** Количество ставок. */
  headcount: number
  /** Категория: руководители/специалисты/служащие/рабочие. */
  category: string | null
  /** Грейд (если есть). */
  grade: string | null
  /** Исходный номер строки в Excel (для сообщений об ошибках). */
  rowNumber: number
}

/** Результат парсинга: валидные строки + ошибки. */
export interface ParseResult {
  rows: ParsedStaffingRow[]
  errors: { rowNumber: number; message: string }[]
  /** Заголовки, найденные в первой строке. */
  detectedHeaders: string[]
  /** Какая колонка сопоставлена с каким полем. */
  columnMapping: Record<string, string>
}

// Защита от zip-bomb / чрезмерно больших таблиц (Фаза 3, шаг 3.3).
// 10000 строк — разумный потолок для штатного расписания; превышение
// считается злоупотреблением и прерывает обработку.
const MAX_EXCEL_ROWS = 10000
// Лимит на размер сырого буфера файла (defense-in-depth: даже если middleware
// пропустит большой файл, парсер отклонит его до распаковки XLSX).
const MAX_BUFFER_SIZE = 12 * 1024 * 1024

// Возможные варианты названий колонок (lowercase, без пробелов) для каждого поля.
const COLUMN_ALIASES: Record<string, string[]> = {
  departmentName: [
    'подразделение', 'отдел', 'структурноеподразделение', 'наименованиеподразделения',
    'department', 'departmentname', 'dept',
  ],
  departmentCode: ['кодподразделения', 'кодотдела', 'deptcode', 'departmentcode'],
  positionTitle: [
    'должность', 'наименованиедолжности', 'профессия', 'position', 'positionname',
    'jobtitle', 'title',
  ],
  positionCode: ['коддолжности', 'кодпрофессии', 'positioncode', 'jobcode'],
  headcount: [
    'кол-воставок', 'колвоставок', 'количествоставок', 'штатныхединиц', 'ставок',
    'headcount', 'quantity', 'штед',
  ],
  category: ['категория', 'category'],
  grade: ['грейд', 'разряд', 'grade', 'level'],
}

/** Найти индекс колонки по заголовку и списку алиасов. */
function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().replace(/\s+/g, '').trim())
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias)
    if (idx >= 0) return idx
  }
  // Частичное совпадение (например, «Кол-во штатных единиц» содержит «штатных»).
  for (const alias of aliases) {
    const idx = normalized.findIndex((n) => n.includes(alias))
    if (idx >= 0) return idx
  }
  return -1
}

/**
 * Распарсить Excel-файл (ArrayBuffer) в структурированные строки ШР.
 * @param buffer содержимое .xlsx файла
 */
export function parseStaffingExcel(buffer: ArrayBuffer): ParseResult {
  if (buffer.byteLength > MAX_BUFFER_SIZE) {
    return {
      rows: [],
      errors: [{
        rowNumber: 0,
        message: `Файл слишком велик (${Math.round(buffer.byteLength / 1024 / 1024)} МБ). ` +
          `Максимум ${Math.round(MAX_BUFFER_SIZE / 1024 / 1024)} МБ.`,
      }],
      detectedHeaders: [],
      columnMapping: {},
    }
  }
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array' })
  } catch {
    return { rows: [], errors: [{ rowNumber: 0, message: 'Файл повреждён или не является валидной Excel-таблицей' }], detectedHeaders: [], columnMapping: {} }
  }
  // Берём первый лист.
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], errors: [{ rowNumber: 0, message: 'Файл не содержит листов' }], detectedHeaders: [], columnMapping: {} }
  }
  const sheet = workbook.Sheets[sheetName]
  // sheet_to_json с header:1 возвращает массив массивов (без объектов).
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })

  if (raw.length === 0) {
    return { rows: [], errors: [{ rowNumber: 0, message: 'Лист пуст' }], detectedHeaders: [], columnMapping: {} }
  }

  // Защита от zip-bomb: отклоняем слишком большие таблицы.
  if (raw.length > MAX_EXCEL_ROWS + 1) {
    return {
      rows: [],
      errors: [{
        rowNumber: 0,
        message: `Слишком много строк в файле (${raw.length}). Максимум ${MAX_EXCEL_ROWS}.`,
      }],
      detectedHeaders: [],
      columnMapping: {},
    }
  }

  // Первая строка — заголовки.
  const headers = (raw[0] as unknown[]).map((h) => String(h ?? '').trim())
  const mapping: Record<string, number> = {}
  for (const field of Object.keys(COLUMN_ALIASES)) {
    const idx = findColumnIndex(headers, COLUMN_ALIASES[field])
    if (idx >= 0) mapping[field] = idx
  }

  // Обязательное поле — название должности.
  if (mapping.positionTitle === undefined) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'Не найдена колонка «Должность» (или её аналоги)' }],
      detectedHeaders: headers,
      columnMapping: {},
    }
  }

  const rows: ParsedStaffingRow[] = []
  const errors: { rowNumber: number; message: string }[] = []

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    const rowNumber = i + 1 // 1-индексация для пользователя

    const positionTitle = String(row[mapping.positionTitle] ?? '').trim()
    if (!positionTitle) {
      // Пустая строка — пропускаем (не ошибка, могут быть пустые строки в конце).
      continue
    }

    const departmentName = mapping.departmentName !== undefined
      ? String(row[mapping.departmentName] ?? '').trim()
      : ''
    if (!departmentName) {
      errors.push({ rowNumber, message: 'Не указано подразделение' })
      continue
    }

    const departmentCode = mapping.departmentCode !== undefined
      ? String(row[mapping.departmentCode] ?? '').trim() || null
      : null
    const positionCode = mapping.positionCode !== undefined
      ? String(row[mapping.positionCode] ?? '').trim() || null
      : null

    // Парсим headcount (может быть дробным, например 0.5 ставки).
    let headcount = 1
    if (mapping.headcount !== undefined) {
      const cellValue = String(row[mapping.headcount] ?? '').trim().replace(',', '.')
      const parsed = parseFloat(cellValue)
      if (!isNaN(parsed) && parsed > 0) {
        headcount = parsed
      } else if (cellValue) {
        errors.push({ rowNumber, message: `Некорректное количество ставок: «${cellValue}», использовано 1` })
      }
    }

    const category = mapping.category !== undefined
      ? String(row[mapping.category] ?? '').trim() || null
      : null
    const grade = mapping.grade !== undefined
      ? String(row[mapping.grade] ?? '').trim() || null
      : null

    rows.push({
      departmentName,
      departmentCode,
      positionTitle,
      positionCode,
      headcount,
      category,
      grade,
      rowNumber,
    })
  }

  // columnMapping для отчёта (имя колонки → поле)
  const columnMapping: Record<string, string> = {}
  for (const [field, idx] of Object.entries(mapping)) {
    columnMapping[headers[idx] || field] = field
  }

  return { rows, errors, detectedHeaders: headers, columnMapping }
}
