// Next.js instrumentation hook — запускается один раз при старте сервера.

import { isSentryEnabled, SENTRY_DSN, SENTRY_ENV } from './lib/sentry'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sentry server-side init
    if (isSentryEnabled()) {
      const Sentry = await import('@sentry/node')
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      })
    }

    // Запуск опросчика очереди массовой генерации
    const { startQueuePoller } = await import('./lib/di/mass-generate-worker')
    startQueuePoller()

    // Graceful shutdown: обработчики SIGTERM/SIGINT
    const { registerShutdownHandlers } = await import('./lib/shutdown')
    registerShutdownHandlers()
  }
}
