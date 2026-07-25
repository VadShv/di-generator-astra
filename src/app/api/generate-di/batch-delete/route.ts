import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/generate-di/batch-delete — пакетное удаление сгенерированных ДИ.
// Тело: { diIds: string[], confirm: boolean } — список ID и флаг подтверждения.
// Каскадное удаление (sections, versions, auditResults, trackings) обеспечено схемой.
// Возвращает сводку.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { diIds, confirm } = body as { diIds?: string[]; confirm?: boolean }

    if (!confirm) {
      return NextResponse.json({ error: 'Требуется подтверждение (confirm=true)' }, { status: 400 })
    }

    if (!diIds || !Array.isArray(diIds) || diIds.length === 0) {
      return NextResponse.json({ error: 'Список ID ДИ (diIds) обязателен' }, { status: 400 })
    }

    const results: { diId: string; success: boolean; error?: string }[] = []
    let successCount = 0
    let failCount = 0

    for (const diId of diIds) {
      try {
        const existing = await db.generatedDI.findUnique({ where: { id: diId } })
        if (!existing) {
          results.push({ diId, success: false, error: 'ДИ не найдена' })
          failCount++
          continue
        }
        await db.generatedDI.delete({ where: { id: diId } })
        results.push({ diId, success: true })
        successCount++
      } catch (err) {
        console.error(`Batch delete error for DI ${diId}:`, err)
        results.push({ diId, success: false, error: 'Ошибка удаления' })
        failCount++
      }
    }

    return NextResponse.json({ total: diIds.length, successCount, failCount, results })
  } catch (error) {
    console.error('Batch delete error:', error)
    return NextResponse.json({ error: 'Ошибка пакетного удаления' }, { status: 500 })
  }
}
