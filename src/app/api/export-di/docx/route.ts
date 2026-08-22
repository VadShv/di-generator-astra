// Серверный экспорт ДИ в формате DOCX (Фаза 8: Product gaps).
// Ранее роут возвращал JSON для клиентской генерации.
// Теперь генерирует настоящий .docx на сервере через пакет `docx`.
//
// GET /api/export-di/docx?id=<generatedDIId>
// Возвращает бинарный .docx с корректным Content-Type.

import { NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  PageBreak,
} from 'docx'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

const logger = createLogger('export-docx')

function gradeLabel(grade: string | null | undefined): string {
  if (grade === 'руководитель') return 'Руководитель'
  if (grade === 'линейная') return 'Линейная позиция'
  return 'Не указан'
}

/** Преобразовать текст секции в массив параграфов (разделение по строкам). */
function contentToParagraphs(content: string): Paragraph[] {
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line.trim(), size: 24 })],
          spacing: { after: 120 },
        })
    )
}

export async function GET(request: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const di = await db.generatedDI.findUnique({
      where: { id },
      include: {
        position: {
          include: { department: true, businessFunction: true, project: true },
        },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    const pos = di.position
    const sections = di.sections.map((s) => ({
      title: s.sectionTitle,
      content: s.sectionContent,
    }))

    // Заголовок документа
    const titleParagraph = new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: di.title, bold: true, size: 32 })],
      spacing: { after: 200 },
    })

    // Метаданные
    const metaParagraphs: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: `Должность: ${pos?.title ?? '—'}`, size: 24 })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Подразделение: ${pos?.department?.name ?? '—'}`, size: 24 })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Грейд: ${gradeLabel(pos?.grade)}`, size: 24 })],
        spacing: { after: 80 },
      }),
      ...(pos?.businessFunction?.name
        ? [
            new Paragraph({
              children: [new TextRun({ text: `Бизнес-функция: ${pos.businessFunction.name}`, size: 24 })],
              spacing: { after: 80 },
            }),
          ]
        : []),
      new Paragraph({
        children: [
          new TextRun({
            text: `Статус: ${di.status}`,
            size: 24,
          }),
        ],
        spacing: { after: 200 },
      }),
    ]

    // Секции
    const sectionParagraphs: Paragraph[] = []
    sections.forEach((section, idx) => {
      sectionParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: section.title, bold: true, size: 28 })],
          spacing: { before: 240, after: 120 },
          ...(idx > 0 ? { pageBreakBefore: true } : {}),
        })
      )
      sectionParagraphs.push(...contentToParagraphs(section.content))
    })

    const doc = new Document({
      creator: 'Генератор ДИ — Группа Астра',
      title: di.title,
      description: `Должностная инструкция: ${di.title}`,
      styles: {
        default: {
          document: {
            run: { font: 'Times New Roman', size: 24 },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, bottom: 1134, left: 1701, right: 850 },
            },
          },
          children: [titleParagraph, ...metaParagraphs, ...sectionParagraphs],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const bytes = new Uint8Array(buffer)

    const safeTitle = di.title.replace(/[^a-zA-Zа-яА-Я0-9_\-\s]/g, '').trim() || 'DI'
    const fileName = `${safeTitle}.docx`

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': String(bytes.byteLength),
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    logger.error('Экспорт DOCX', error)
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 })
  }
}
