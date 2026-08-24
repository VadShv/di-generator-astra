import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// GET /api/export-di/pdf?id=... — print-optimized HTML для печати в PDF
// Пользователь открывает URL в браузере и нажимает Ctrl+P → "Сохранить как PDF"
export async function GET(request: NextRequest) {
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
          include: {
            department: { include: { company: true } },
          },
        },
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    const companyName = di.position?.department?.company?.name || ''
    const deptName = di.position?.department?.name || ''
    const posTitle = di.position?.title || ''

    const sectionsHtml = di.sections
      .map(
        (s) => `
      <div class="section">
        <h2>${escapeHtml(s.sectionTitle)}</h2>
        <div class="content">${escapeHtml(s.sectionContent).replace(/\n/g, '<br>')}</div>
      </div>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(di.title)}</title>
  <style>
    @page { margin: 2cm; size: A4; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 14pt; margin: 0 0 5px 0; }
    .header .meta { font-size: 10pt; color: #555; }
    .approve-table { width: 100%; border-collapse: collapse; margin: 30px 0; font-size: 10pt; }
    .approve-table td { border: 1px solid #000; padding: 8px; }
    .approve-table .label { background: #f5f5f5; font-weight: bold; width: 30%; }
    .section { margin-bottom: 15px; page-break-inside: avoid; }
    .section h2 { font-size: 12pt; margin: 0 0 8px 0; }
    .section .content { text-align: justify; }
    .footer { margin-top: 40px; font-size: 9pt; color: #777; text-align: center; }
    .print-btn { position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .print-btn:hover { background: #1d4ed8; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Печать / Сохранить в PDF</button>
  <div class="header">
    <h1>${escapeHtml(companyName)}</h1>
    <div class="meta">Подразделение: ${escapeHtml(deptName)}<br>Должность: ${escapeHtml(posTitle)}</div>
  </div>
  <h1 style="text-align: center; font-size: 13pt; margin-bottom: 20px;">${escapeHtml(di.title)}</h1>
  ${sectionsHtml}
  <table class="approve-table">
    <tr><td class="label">Должность</td><td>${escapeHtml(posTitle)}</td></tr>
    <tr><td class="label">Подразделение</td><td>${escapeHtml(deptName)}</td></tr>
    <tr><td class="label">Разработал</td><td></td></tr>
    <tr><td class="label">Согласовал</td><td></td></tr>
    <tr><td class="label">Утвердил</td><td></td></tr>
    <tr><td class="label">Сотрудник ознакомлен</td><td>${di.signedByEmployee ? 'Да, ' + (di.signedAt ? new Date(di.signedAt).toLocaleDateString('ru-RU') : '') : 'Нет'}</td></tr>
  </table>
  <div class="footer">Версия ${di.currentVersion} · Создано: ${new Date(di.createdAt).toLocaleDateString('ru-RU')} · Генератор ДИ Группы Астра</div>
  <script>
    // Авто-открытие диалога печати
    window.addEventListener('load', () => { setTimeout(() => window.print(), 500) })
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    return NextResponse.json({ error: 'Ошибка экспорта PDF' }, { status: 500 })
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
