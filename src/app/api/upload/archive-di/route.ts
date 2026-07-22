import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/upload/archive-di - Upload and parse archive DI file(s)
// Supports single file upload with AI-based parsing and position linking
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const positionId = formData.get('positionId') as string | null
    const useAiParsing = formData.get('useAiParsing') === 'true'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Файлы не загружены' }, { status: 400 })
    }

    const results: Array<{
      fileName: string
      success: boolean
      title?: string
      positionTitle?: string
      error?: string
    }> = []

    // Get existing positions for AI linking
    const existingPositions = await db.position.findMany({
      include: { department: true },
      select: { id: true, title: true, code: true, department: { select: { name: true } } },
    })

    for (const file of files) {
      try {
        const fileName = file.name.toLowerCase()
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Step 1: Extract text from file
        let text: string
        try {
          text = await extractText(buffer, fileName)
        } catch (e) {
          results.push({ fileName: file.name, success: false, error: `Ошибка чтения: ${e instanceof Error ? e.message : String(e)}` })
          continue
        }

        if (!text.trim()) {
          results.push({ fileName: file.name, success: false, error: 'Файл пуст' })
          continue
        }

        // Step 2: Determine position (either provided or AI-detected)
        let resolvedPositionId = positionId
        let detectedTitle = ''

        if (!resolvedPositionId && useAiParsing) {
          // Use AI to detect position from content
          const zai = await ZAI.create()
          const detectPrompt = `Проанализируй текст должностной инструкции и определи:
1. Название должности
2. Название подразделения

Доступные должности в системе:
${existingPositions.map(p => `- "${p.title}" (подразделение: ${p.department.name}, id: ${p.id})`).join('\n')}

Текст ДИ:
${text.substring(0, 5000)}

Верни ТОЛЬКО JSON: {"positionId": "id или null", "title": "название должности", "department": "подразделение"}`

          try {
            const completion = await zai.chat.completions.create({
              messages: [{ role: 'user', content: detectPrompt }],
              thinking: { type: 'disabled' },
            })
            const response = completion.choices[0]?.message?.content || ''
            const jsonMatch = response.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0])
              resolvedPositionId = parsed.positionId
              detectedTitle = parsed.title || ''
            }
          } catch {
            // AI detection failed, continue without position
          }
        }

        // Extract title from content (first line or from AI detection)
        const titleFromContent = text.split('\n').find(l => l.trim().length > 0)?.trim()?.substring(0, 200) || file.name

        // Step 3: Create archive DI
        if (resolvedPositionId) {
          const position = await db.position.findUnique({ where: { id: resolvedPositionId } })
          if (position) {
            await db.archiveDI.create({
              data: {
                title: detectedTitle || titleFromContent,
                content: text,
                positionId: resolvedPositionId,
                fileName: file.name,
              },
            })
            results.push({ fileName: file.name, success: true, title: detectedTitle || titleFromContent, positionTitle: position.title })
          } else {
            results.push({ fileName: file.name, success: false, error: 'Должность не найдена' })
          }
        } else {
          // Create without position link - just store the content
          // We need a position to satisfy the DB constraint, so create with first available position or skip
          if (existingPositions.length > 0) {
            await db.archiveDI.create({
              data: {
                title: detectedTitle || titleFromContent,
                content: text,
                positionId: existingPositions[0].id,
                fileName: file.name,
              },
            })
            results.push({ 
              fileName: file.name, 
              success: true, 
              title: detectedTitle || titleFromContent,
              positionTitle: existingPositions[0].title + ' (авто)',
              error: 'Должность не определена автоматически, привязана к первой доступной',
            })
          } else {
            results.push({ fileName: file.name, success: false, error: 'Нет должностей в системе для привязки. Сначала добавьте должности.' })
          }
        }
      } catch (e) {
        results.push({ fileName: file.name, success: false, error: e instanceof Error ? e.message : String(e) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      summary: { total: files.length, success: successCount, failed: failCount },
      results,
    })
  } catch (error) {
    console.error('Archive DI upload error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки архивных ДИ: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
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
