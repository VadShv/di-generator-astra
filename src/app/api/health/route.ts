import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/health — проверка здоровья системы
export async function GET() {
  const checks: { name: string; status: 'ok' | 'error'; latency?: number; detail?: string }[] = []

  // 1. Database connectivity
  try {
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    checks.push({ name: 'database', status: 'ok', latency })
  } catch (e) {
    checks.push({ name: 'database', status: 'error', detail: e instanceof Error ? e.message : 'Unknown' })
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

  // 3. Uptime
  const uptimeSec = Math.round(process.uptime())
  checks.push({ name: 'uptime', status: 'ok', detail: `${uptimeSec}s` })

  const allOk = checks.every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      version: '2.0.0',
      checks,
      timestamp: new Date().toISOString(),
      metricsEndpoint: '/api/metrics',
      docsEndpoint: '/api/docs',
    },
    { status: allOk ? 200 : 503 }
  )
}
