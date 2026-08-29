import { NextResponse } from 'next/server'

// GET /api/health — liveness-проверка (для k8s liveness probe).
// Минимальный, без auth и без проверки зависимостей: отвечает, жив ли процесс.
// Проверка готовности к трафику (readiness) с деталями БД/памяти — на /api/health/ready.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}
