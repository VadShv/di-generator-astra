import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/upload/staff-schedule - Upload and parse staff schedule file
// Accepts multipart form data with file, uses AI to intelligently parse structure
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) || 'auto' // auto, departments, positions

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Step 1: Extract text from file
    let text: string
    try {
      text = await extractText(buffer, fileName)
    } catch (e) {
      return NextResponse.json({ error: `Ошибка чтения файла: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Файл пуст или не содержит текста' }, { status: 400 })
    }

    // Step 2: Get existing departments for context
    const existingDepts = await db.department.findMany({ select: { id: true, name: true, code: true } })
    const existingPositions = await db.position.findMany({ select: { id: true, code: true } })
    const existingPositionCodes = new Set(existingPositions.map(p => p.code))

    // Step 3: Use AI to parse structured data from text
    const zai = await ZAI.create()

    const systemPrompt = `Ты — эксперт по разбору штатных расписаний. Тебе нужно проанализировать текст документа и извлечь из него структурированные данные о подразделениях и должностях.

Существующие подразделения в системе:
${existingDepts.map(d => `- ${d.name} (код: ${d.code}, id: ${d.id})`).join('\n') || 'Подразделений пока нет'}

ПРАВИЛА:
1. Если подразделение уже существует в системе, используй его id
2. Если подразделение новое — укажи code и name для создания
3. Для каждой должности укажи: title, code, departmentCode, grade (если есть), domain (если есть), headcount (по умолчанию 1), functions (если есть)
4. Код должности должен быть уникальным — если код уже существует, добавь суффикс
5. Выдавай результат ТОЛЬКО в формате JSON без лишнего текста`

    const userPrompt = `Проанализируй этот текст штатного расписания и извлеки из него все подразделения и должности:

---
${text.substring(0, 15000)}
---

Верни результат в формате JSON:
{
  "departments": [
    {"name": "Название", "code": "CODE", "existingId": null или "id если существует"}
  ],
  "positions": [
    {"title": "Название должности", "code": "POS_CODE", "departmentCode": "DEPT_CODE", "grade": "G1", "domain": "IT", "headcount": 1, "functions": "описание функций"}
  ]
}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const aiResponse = completion.choices[0]?.message?.content || ''
    
    // Parse AI response - extract JSON
    let parsedData: { departments: Array<{ name: string; code: string; existingId: string | null }>; positions: Array<{ title: string; code: string; departmentCode: string; grade?: string; domain?: string; headcount?: number; functions?: string }> }
    
    try {
      // Try to extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in AI response')
      parsedData = JSON.parse(jsonMatch[0])
    } catch {
      // Fallback: return the raw text for manual review
      return NextResponse.json({ 
        error: 'Не удалось автоматически разобрать файл',
        rawText: text.substring(0, 5000),
        aiResponse: aiResponse.substring(0, 3000),
      }, { status: 422 })
    }

    // Step 4: Create departments and positions
    const createdDepts: Array<{ id: string; name: string; code: string; isNew: boolean }> = []
    const deptCodeToId: Record<string, string> = {}

    // Map existing departments
    for (const dept of existingDepts) {
      deptCodeToId[dept.code] = dept.id
    }

    // Create new departments
    for (const dept of parsedData.departments || []) {
      if (dept.existingId) {
        deptCodeToId[dept.code] = dept.existingId
        createdDepts.push({ id: dept.existingId, name: dept.name, code: dept.code, isNew: false })
      } else if (!deptCodeToId[dept.code]) {
        try {
          const created = await db.department.create({
            data: { name: dept.name, code: dept.code },
          })
          deptCodeToId[dept.code] = created.id
          createdDepts.push({ id: created.id, name: created.name, code: created.code, isNew: true })
        } catch {
          // Department might already exist, try to find it
          const existing = await db.department.findUnique({ where: { code: dept.code } })
          if (existing) {
            deptCodeToId[dept.code] = existing.id
            createdDepts.push({ id: existing.id, name: existing.name, code: existing.code, isNew: false })
          }
        }
      }
    }

    // Create positions
    let createdCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const pos of parsedData.positions || []) {
      const deptId = deptCodeToId[pos.departmentCode]
      if (!deptId) {
        errors.push(`Подразделение не найдено для должности "${pos.title}" (код подразделения: ${pos.departmentCode})`)
        skippedCount++
        continue
      }

      // Ensure unique code
      let code = pos.code
      let suffix = 1
      while (existingPositionCodes.has(code)) {
        code = `${pos.code}-${suffix}`
        suffix++
      }
      existingPositionCodes.add(code)

      try {
        await db.position.create({
          data: {
            title: pos.title,
            code,
            departmentId: deptId,
            grade: pos.grade || null,
            domain: pos.domain || null,
            headcount: pos.headcount || 1,
            functions: pos.functions || null,
          },
        })
        createdCount++
      } catch (e) {
        errors.push(`Ошибка создания должности "${pos.title}": ${e instanceof Error ? e.message : String(e)}`)
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        departmentsFound: parsedData.departments?.length || 0,
        departmentsCreated: createdDepts.filter(d => d.isNew).length,
        departmentsExisting: createdDepts.filter(d => !d.isNew).length,
        positionsFound: parsedData.positions?.length || 0,
        positionsCreated: createdCount,
        positionsSkipped: skippedCount,
      },
      departments: createdDepts,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Staff schedule upload error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки штатного расписания: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
  }
}

async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const parts: string[] = []
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      parts.push(`=== ${sheetName} ===\n${csv}`)
    }
    return parts.join('\n\n')
  } else if (fileName.endsWith('.csv')) {
    return buffer.toString('utf-8')
  } else if (fileName.endsWith('.pdf')) {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return buffer.toString('utf-8')
  } else {
    throw new Error(`Неподдерживаемый формат: ${fileName}`)
  }
}
