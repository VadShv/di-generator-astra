import { NextResponse } from 'next/server'

// POST /api/upload/parse-file - Parse uploaded file and extract text/data
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const parseMode = (formData.get('parseMode') as string) || 'text' // text, structured

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let result: { text: string; structured?: unknown; fileName: string; fileType: string; fileSize: number }

    if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      result = await parseDocx(buffer, file.name, file.size)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      result = await parseXlsx(buffer, file.name, file.size, parseMode)
    } else if (fileName.endsWith('.csv')) {
      result = await parseCsv(buffer, file.name, file.size, parseMode)
    } else if (fileName.endsWith('.pdf')) {
      result = await parsePdf(buffer, file.name, file.size)
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.rtf')) {
      result = await parseText(buffer, file.name, file.size)
    } else {
      return NextResponse.json({ error: `Неподдерживаемый формат файла: ${file.name}. Поддерживаются: DOCX, DOC, XLSX, XLS, CSV, PDF, TXT, MD` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('File parse error:', error)
    return NextResponse.json({ error: 'Ошибка обработки файла: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}

async function parseDocx(buffer: Buffer, fileName: string, fileSize: number) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: result.value,
    fileName,
    fileType: 'docx',
    fileSize,
  }
}

async function parseXlsx(buffer: Buffer, fileName: string, fileSize: number, parseMode: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  
  const allText: string[] = []
  const structuredSheets: Record<string, unknown[]> = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    
    // Get text version
    const csv = XLSX.utils.sheet_to_csv(sheet)
    allText.push(`=== ${sheetName} ===\n${csv}`)

    // Get structured version (JSON rows)
    if (parseMode === 'structured') {
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      structuredSheets[sheetName] = jsonData
    }
  }

  return {
    text: allText.join('\n\n'),
    structured: parseMode === 'structured' ? structuredSheets : undefined,
    fileName,
    fileType: 'xlsx',
    fileSize,
  }
}

async function parseCsv(buffer: Buffer, fileName: string, fileSize: number, parseMode: string) {
  const text = buffer.toString('utf-8')
  
  if (parseMode !== 'structured') {
    return { text, fileName, fileType: 'csv', fileSize }
  }

  // Parse CSV into structured rows
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    return { text, structured: [], fileName, fileType: 'csv', fileSize }
  }

  // Detect delimiter
  const firstLine = lines[0]
  let delimiter = ';'
  if (firstLine.includes('\t')) delimiter = '\t'
  else if (firstLine.split(',').length > firstLine.split(';').length) delimiter = ','

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })

  return {
    text,
    structured: rows,
    fileName,
    fileType: 'csv',
    fileSize,
  }
}

async function parsePdf(buffer: Buffer, fileName: string, fileSize: number) {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return {
    text: data.text,
    fileName,
    fileType: 'pdf',
    fileSize,
  }
}

async function parseText(buffer: Buffer, fileName: string, fileSize: number) {
  const text = buffer.toString('utf-8')
  return {
    text,
    fileName,
    fileType: 'txt',
    fileSize,
  }
}
