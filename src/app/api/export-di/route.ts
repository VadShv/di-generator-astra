import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const di = await db.generatedDI.findUnique({
      where: { id },
      include: {
        position: { include: { department: true, businessFunction: true, project: true } },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    // Generate DOCX-compatible HTML for export
    const html = generateDIHtml(di)
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(di.title)}.html"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 })
  }
}

function generateDIHtml(di: any): string {
  const sections = di.sections
    .map((s: any) => `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 8px; color: #1a1a1a;">${s.sectionTitle}</h2>
        <div style="font-size: 14px; line-height: 1.6; color: #333; white-space: pre-wrap;">${s.sectionContent}</div>
      </div>
    `)
    .join('')

  const gradeLabel = di.position?.grade === 'руководитель' ? 'Руководитель' : di.position?.grade === 'линейная' ? 'Линейная позиция' : 'Не указан'

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${di.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.5; }
    h1 { text-align: center; font-size: 20px; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 32px; }
    .meta { margin-bottom: 24px; color: #555; font-size: 14px; }
    .footer { margin-top: 48px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <h1>${di.title}</h1>
  <div class="subtitle">Должностная инструкция</div>
  <div class="meta">
    <p><strong>Должность:</strong> ${di.position?.title || ''}</p>
    <p><strong>Подразделение:</strong> ${di.position?.department?.name || ''}</p>
    <p><strong>Грейд:</strong> ${gradeLabel}</p>
    <p><strong>Бизнес-функция:</strong> ${di.position?.businessFunction?.name || 'Не указана'}</p>
    <p><strong>Проект:</strong> ${di.position?.project?.name || 'Не указан'}</p>
    <p><strong>Дата создания:</strong> ${new Date(di.createdAt).toLocaleDateString('ru-RU')}</p>
    ${di.signedByEmployee ? '<p><strong>Подписана сотрудником:</strong> ✓ Да</p>' : ''}
    ${di.signedAt ? `<p><strong>Дата подписания:</strong> ${new Date(di.signedAt).toLocaleDateString('ru-RU')}</p>` : ''}
  </div>
  <hr/>
  ${sections}
  <div class="footer">
    <p>Сгенерировано в системе «Генератор ДИ» Группы Астра</p>
    <p>ID: ${di.id}</p>
  </div>
</body>
</html>`
}
