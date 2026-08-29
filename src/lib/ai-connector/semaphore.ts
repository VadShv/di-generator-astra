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

// Глобальные семафоры конкурентности по провайдеру (singleton per providerId).
// Раньше семафор создавался per-instance провайдера → при 3 параллельных job'ах
// с одним провайдером суммарно могло быть до 9 одновременных запросов.
// Теперь все инстансы провайдера с одним id разделяют один семафор → общий лимит.
const providerSemaphores = new Map<string, Semaphore>()

/**
 * Получить глобальный семафор для провайдера по его id.
 * Создаётся один раз и разделяется всеми job'ами/инстансами провайдера.
 * @param providerId — идентификатор провайдера (AIProviderConfig.id)
 */
export function getProviderSemaphore(providerId: string): Semaphore {
  let sem = providerSemaphores.get(providerId)
  if (!sem) {
    sem = new Semaphore(getDefaultConcurrency())
    providerSemaphores.set(providerId, sem)
  }
  return sem
}

/** Сбросить глобальные семафоры (для тестов). */
export function resetProviderSemaphores(): void {
  providerSemaphores.clear()
}

/** Количество активных глобальных семафоров (для тестов/метрик). */
export function getProviderSemaphoreCount(): number {
  return providerSemaphores.size
}
