// Семафор конкурентности (rate-limit) для ИИ-провайдеров (Фаза 4).
// Ограничивает число одновременных запросов к одному провайдеру,
// чтобы не упереться в rate-limit внешнего API.

/** Простой семафор на Promise-очереди. */
export class Semaphore {
  private permits: number
  private readonly waiters: Array<() => void> = []

  constructor(permits: number) {
    this.permits = Math.max(1, permits)
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  release(): void {
    const next = this.waiters.shift()
    if (next) {
      next()
    } else {
      this.permits++
    }
  }

  /** Выполнить fn в рамках семафора (acquire/release с защитой от ошибок). */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

/** Дефолтный лимит конкурентности (из env или 3). */
export function getDefaultConcurrency(): number {
  const raw = process.env.AI_PROVIDER_MAX_CONCURRENCY
  const n = raw ? Number(raw) : 3
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3
}
