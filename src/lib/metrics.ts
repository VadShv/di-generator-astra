// Prometheus-метрики сервиса (спринт 5).

import { register, Counter, Histogram, Gauge } from 'prom-client'

// Счётчики
export const aiRequestsTotal = new Counter({
  name: 'di_ai_requests_total',
  help: 'Total AI generation requests',
  labelNames: ['provider', 'model', 'status'],
})

export const aiRequestDuration = new Histogram({
  name: 'di_ai_request_duration_seconds',
  help: 'AI request duration in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
})

export const apiRequestsTotal = new Counter({
  name: 'di_api_requests_total',
  help: 'Total API requests',
  labelNames: ['method', 'path', 'status'],
})

export const apiRequestDuration = new Histogram({
  name: 'di_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
})

export const dbQueryDuration = new Histogram({
  name: 'di_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['table', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
})

export const massGenQueueSize = new Gauge({
  name: 'di_mass_gen_queue_size',
  help: 'Current mass generation queue size',
})

export const massGenActiveJobs = new Gauge({
  name: 'di_mass_gen_active_jobs',
  help: 'Currently active mass generation jobs',
})

/** Получить метрики в формате Prometheus. */
export async function getMetrics(): Promise<string> {
  return register.metrics()
}

/** Сбросить метрики (полезно для тестов). */
export function resetMetrics(): void {
  register.resetMetrics()
}
