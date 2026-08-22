// API: загрузка старых ДИ из PDF/DOCX (Фаза 4)
// POST /api/di-upload?mode=parse  — извлечение текста и разбивка на секции (предпросмотр)
// POST /api/di-upload?mode=save   — сохранение в UploadedDocument + создание ArchiveDI со статусом imported
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractDI } from '@/lib/di-parser'
import { requireAuth, requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 МБ

// POST — обработка запроса (parse или save)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode') || 'parse'
    const contentType = request.headers.get('content-type') || ''

    // ===== РЕЖИМ PARSE: принимаем FormData, извлекаем текст =====
    if (mode === 'parse') {
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json(
          { error: 'Для режима parse нужен FormData с файлом' },
          { status: 400 }
        )
      }
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
      }
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith('.pdf') && !fileName.endsWith('.docx')) {
        return NextResponse.json(
          { error: 'Поддерживаются только файлы .pdf и .docx' },
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
      const result = await extractDI(buffer, file.name)

      return NextResponse.json({
        success: true,
        mode: 'parse',
        fileName: result.fileName,
        fileType: result.fileType,
        rawText: result.rawText, // Полный текст для сохранения
        rawTextPreview: result.rawText.slice(0, 5000), // Обрезка для предпросмотра в UI
        rawTextFullLength: result.rawText.length,
        sections: result.sections,
        sectionCount: result.sections.length,
        textLength: result.rawText.length,
      })
    }

    // ===== РЕЖИМ SAVE: принимаем JSON, сохраняем в БД =====
    if (mode === 'save') {
      const body = await request.json()
      const { fileName, fileType, rawText, sections, positionId, companyId } = body as {
        fileName: string
        fileType: string
        rawText: string
        sections: { title: string; content: string }[]
        positionId?: string
        companyId?: string
      }

      if (!fileName || !rawText) {
        return NextResponse.json({ error: 'fileName и rawText обязательны' }, { status: 400 })
      }
      if (!positionId) {
        return NextResponse.json(
          { error: 'Для сохранения ДИ требуется привязка к должности (positionId)' },
          { status: 400 }
        )
      }

      // Проверяем существование должности.
      const position = await db.position.findUnique({ where: { id: positionId } })
      if (!position) {
        return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
      }

      // Сохраняем в UploadedDocument + создаём ArchiveDI (статус imported).
      const created = await db.uploadedDocument.create({
        data: {
          fileName,
          fileType: fileType || 'unknown',
          rawText,
          parsedSections: JSON.stringify(sections || []),
          positionId,
          companyId: companyId || null,
          status: 'linked', // Документ распознан и привязан к должности
        },
      })

      // Создаём ArchiveDI для использования в генерации (как reference).
      const title = `ДИ — ${position.title} (импорт: ${fileName})`
      const archiveDI = await db.archiveDI.create({
        data: {
          title,
          content: rawText,
          positionId,
          fileName,
        },
      })

      return NextResponse.json({
        success: true,
        mode: 'save',
        uploadedDocumentId: created.id,
        archiveDIId: archiveDI.id,
        positionTitle: position.title,
        sectionCount: sections?.length || 0,
      })
    }

    return NextResponse.json({ error: `Неизвестный режим: ${mode}` }, { status: 400 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('POST /api/di-upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ошибка обработки файла' },
      { status: 500 }
    )
  }
}

// GET — список загруженных документов (для UI)
export async function GET() {
  try {
    await requireAuth()
    const docs = await db.uploadedDocument.findMany({
      include: {
        position: { select: { id: true, title: true, department: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        status: d.status,
        positionTitle: d.position?.title || null,
        departmentName: d.position?.department?.name || null,
        sectionCount: (() => {
          try {
            return JSON.parse(d.parsedSections).length
          } catch {
            return 0
          }
        })(),
        textLength: d.rawText.length,
        createdAt: d.createdAt,
      }))
    )
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('GET /api/di-upload error:', error)
    return NextResponse.json({ error: 'Ошибка получения списка документов' }, { status: 500 })
  }
}
