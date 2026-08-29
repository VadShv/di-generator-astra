// Тесты liveness-эндпоинта /api/health (Фаза 2, шаг 2.2).
// Liveness не требует auth и не проверяет зависимости — только живость процесса.

import { describe, it, expect } from 'vitest'
import { GET } from './route'

describe('GET /api/health (liveness)', () => {
  it('возвращает 200 без auth', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('возвращает status ok и uptime', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.uptime).toBe('number')
    expect(body.uptime).toBeGreaterThanOrEqual(0)
    expect(body.timestamp).toBeTruthy()
  })

  it('не раскрывает детали БД/памяти', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body).not.toHaveProperty('checks')
    expect(body).not.toHaveProperty('database')
    expect(body).not.toHaveProperty('memory')
  })
})
