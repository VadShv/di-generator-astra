import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/metrics'
import { requireRole } from '@/lib/auth/session'

// GET /api/metrics — Prometheus-метрики сервиса (только для админов)
export async function GET() {
  try {
    await requireRole('admin')
    const metrics = await getMetrics()
    return new NextResponse(metrics, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 })
  }
}
