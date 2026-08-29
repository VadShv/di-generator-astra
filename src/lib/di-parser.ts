// Извлечение текста из PDF/DOCX и разбивка на секции ДИ (Фаза 4)
// Использует: pdf-parse (PDF→текст), mammoth (DOCX→текст).
// Разбивка на секции по типовым заголовкам должностных инструкций.

/** Распознанная секция ДИ. */
export interface DISection {
  title: string
  content: string
}

/** Результат извлечения и разбивки. */
export interface DIExtractResult {
  rawText: string
  sections: DISection[]
  fileType: 'pdf' | 'docx'
  fileName: string
}

// Защита от zip-bomb / огромных распакованных документов (Фаза 3, шаг 3.3).
// 5 МБ распакованного текста — более чем достаточно для любой должностной
// инструкции; превышение считается злоупотреблением и отклоняется.
const MAX_EXTRACTED_TEXT_LENGTH = 5 * 1024 * 1024

// Типовые заголовки секций должностной инструкции (варианты написания).
// Ключ — каноническое название секции, значение — массив regex-паттернов.
const SECTION_PATTERNS: Record<string, RegExp[]> = {
  'Общие положения': [
    /^общие\s+положения/i,
    /^1\.\s*общие\s+положения/i,
    /^раздел\s+1/i,
    /^i\.\s*общие/i,
  ],
  'Должностные обязанности': [
    /^должностные\s+обязанности/i,
    /^обязанности/i,
    /^функции/i,
    /^должностные\s+обязанности\s+и\s+права/i,
    /^2\.\s*должностные/i,
    /^основные\s+обязанности/i,
  ],
  'Права': [
    /^права/i,
    /^права\s+работника/i,
    /^3\.\s*права/i,
  ],
  'Ответственность': [
    /^ответственность/i,
    /^виды\s+и\s+порядок\s+несения\s+ответственности/i,
    /^4\.\s*ответственность/i,
  ],
  'Квалификационные требования': [
    /^квалификационные\s+требования/i,
    /^требования\s+к\s+квалификации/i,
    /^квалификация/i,
    /^5\.\s*квалификацион/i,
    /^требования/i,
  ],
  'Взаимодействие с системами ИИ': [
    /^взаимодействие\s+с\s+системами\s+ии/i,
    /^работа\s+с\s+ии/i,
    /^использование\s+ии/i,
  ],
  'Заключительные положения': [
    /^заключительные\s+положения/i,
    /^заключение/i,
    /^прочие\s+условия/i,
    /^6\.\s*заключ/i,
  ],
}

/** Проверить, является ли строка заголовком секции. Возвращает каноническое имя или null. */
function matchSectionHeader(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 3 || trimmed.length > 80) return null
  for (const [canonical, patterns] of Object.entries(SECTION_PATTERNS)) {
    if (patterns.some((p) => p.test(trimmed))) {
      return canonical
    }
  }
  return null
}

/**
 * Разбить текст ДИ на секции по заголовкам.
 * Если заголовки не найдены — возвращает одну секцию с полным текстом.
 */
export function splitDISections(rawText: string): DISection[] {
  const lines = rawText.split(/\r?\n/)
  const sections: DISection[] = []
  let currentTitle: string | null = null
  let currentContent: string[] = []

  for (const line of lines) {
    const header = matchSectionHeader(line)
    if (header) {
      // Сохраняем предыдущую секцию.
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() })
      } else if (currentContent.length > 0 && currentContent.join('\n').trim()) {
        // Текст до первого заголовка — в «Общие положения» (обычно это шапка).
        sections.push({ title: 'Общие положения', content: currentContent.join('\n').trim() })
      }
      currentTitle = header
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  // Последняя секция.
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() })
  } else if (currentContent.length > 0) {
    // Заголовков не найдено — весь текст как одна секция.
    sections.push({ title: 'Полный текст', content: currentContent.join('\n').trim() })
  }

  // Фильтруем пустые секции.
  return sections.filter((s) => s.content.length > 0)
}

/**
* Извлечь текст из PDF (ArrayBuffer) через pdf-parse.
*/
async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  // pdf-parse v2: класс PDFParse с методом getText().
  const { PDFParse } = await import('pdf-parse')
  // В Next.js/Turbopack pdfjs не может автоматически резолвить worker-модуль,
  // поэтому явно указываем путь к pdf.worker.mjs через file URL.
  const { pathToFileURL } = await import('url')
  const { resolve } = await import('path')
  const workerPath = resolve(
    process.cwd(),
    'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs'
  )
  try {
    PDFParse.setWorker(pathToFileURL(workerPath).href)
  } catch {
    // Если setWorker недоступен — продолжаем (pdfjs поднимёт fake worker).
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const textResult = await parser.getText()
    return textResult.text || ''
  } finally {
    await parser.destroy()
  }
}

/**
 * Извлечь текст из DOCX (ArrayBuffer) через mammoth.
 */
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
  return result.value || ''
}

/**
 * Главная функция: извлечь текст из файла и разбить на секции.
 * @param buffer содержимое файла
 * @param fileName имя файла (для определения типа)
 */
export async function extractDI(
  buffer: ArrayBuffer,
  fileName: string
): Promise<DIExtractResult> {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  let rawText: string
  let fileType: 'pdf' | 'docx'

  if (ext === 'pdf') {
    fileType = 'pdf'
    rawText = await extractPdf(buffer)
  } else if (ext === 'docx') {
    fileType = 'docx'
    rawText = await extractDocx(buffer)
  } else {
    throw new Error(`Неподдерживаемый тип файла: .${ext}. Поддерживаются .pdf и .docx`)
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Не удалось извлечь текст из файла (возможно, файл пуст или это скан)')
  }
  // Защита от zip-bomb: отклоняем слишком большой распакованный текст.
  if (rawText.length > MAX_EXTRACTED_TEXT_LENGTH) {
    throw new Error(
      `Извлечённый текст слишком велик (${Math.round(rawText.length / 1024 / 1024)} МБ). ` +
        'Максимум 5 МБ — возможно, файл поврежден или это zip-bomb.'
    )
  }

  const sections = splitDISections(rawText)
  return { rawText: rawText.trim(), sections, fileType, fileName }
}
