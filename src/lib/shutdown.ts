/**
 * Graceful shutdown: корректная остановка фоновых задач при SIGTERM/SIGINT.
 *
 * При получении сигнала:
 *   1. Останавливает queue poller (mass-generate-worker).
 *   2. Ждёт завершения активных job (с таймаутом).
 *   3. Логирует результат и выходит.
 *
 * Предотвращает потерю данных при деплое/рестарте в k8s/systemd.
 */

import { stopQueuePoller, getActiveJobsCount } from './di/mass-generate-worker'
import { createLogger } from './logger'

const log = createLogger('shutdown')

const SHUTDOWN_TIMEOUT_MS = 15_000

let isShuttingDown = false

/**
 * Ожидать, пока activeJobs не станет 0, с таймаутом.
 */
function waitForActiveJobs(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const check = () => {
      const remaining = getActiveJobsCount()
      if (remaining <= 0 || Date.now() >= deadline) {
        resolve()
      } else {
        setTimeout(check, 500)
      }
    }
    check()
  })
}

/**
 * Зарегистрировать обработчики SIGTERM/SIGINT.
 * Вызывается один раз при старте приложения (instrumentation.ts).
 */
export function registerShutdownHandlers(): void {
  if (isShuttingDown) return

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true
    log.info(`Received ${signal}, starting graceful shutdown`)

    const activeJobs = stopQueuePoller()
    if (activeJobs > 0) {
      log.info(`Waiting for ${activeJobs} active job(s) to finish`, { timeoutMs: SHUTDOWN_TIMEOUT_MS })
      await waitForActiveJobs(SHUTDOWN_TIMEOUT_MS)
    }

    log.info('Graceful shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
  process.on('SIGINT', () => handleShutdown('SIGINT'))
}
