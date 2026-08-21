import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const log = createLogger('generate-di/batch-delete')

const batchDeleteBodySchema = z
  .object({
    diIds: z.array(z.string().trim().min(1)).min(1, 'Список ID ДИ (diIds) обязателен'),
    confirm: z.boolean(),
  })
  .refine((data) => data.confirm === true, {
    message: 'Требуется подтверждение (confirm=true)',
    path: ['confirm'],
  })

// POST /api/generate-di/batch-delete — пакетное удаление сгенерированных ДИ.
export const POST = withErrorHandler(async (request: Request) => {
  const { diIds } = await parseBody(request, batchDeleteBodySchema)

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
      log.error(`Batch delete error for DI ${diId}`, { message: err instanceof Error ? err.message : String(err) })
      results.push({ diId, success: false, error: 'Ошибка удаления' })
      failCount++
    }
  }

  log.info('Batch delete completed', { total: diIds.length, successCount, failCount })
  return NextResponse.json({ total: diIds.length, successCount, failCount, results })
}, 'generate-di/batch-delete')
