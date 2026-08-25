import { NextResponse } from 'next/server'
import { getMetrics } from '@/lib/metrics'

// GET /api/metrics — Prometheus-метрики сервиса
export async function GET() {
  try {
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
