import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { errorResponse } from '@/lib/api-utils'

// GET /api/health/ready — readiness-проверка (для k8s readiness probe).
// Требует аутентификации (admin): раскрывает детали состояния зависимостей
// (БД, память), поэтому не должен быть публично доступен.
//
// Логика:
//   - 200 healthy / 503 degraded по результатам проверок.
//   - При ошибке БД отдаём generic-сообщение без e.message (не утекают детали).
export async function GET() {
  try {
    await requireRole('admin')
  } catch (error) {
    return errorResponse(error)
  }

  const checks: { name: string; status: 'ok' | 'error'; latency?: number; detail?: string }[] = []

  // 1. Database connectivity
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    checks.push({ name: 'database', status: 'ok', latency })
  } catch {
    // Не раскрываем детали ошибки БД (e.message) — только generic-статус.
    checks.push({ name: 'database', status: 'error', detail: 'database unavailable' })
  }

  // 2. Memory usage
  const memUsage = process.memoryUsage()
  const memMb = Math.round(memUsage.rss / 1024 / 1024)
  const memMax = 1024 // MemoryMax from systemd = 1G
  checks.push({
    name: 'memory',
    status: memMb > memMax * 0.9 ? 'error' : 'ok',
    detail: `${memMb} MB / ${memMax} MB`,
  })

  const allOk = checks.every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
