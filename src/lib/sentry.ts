// Конфигурация Sentry (спринт 5).
// DSN берётся из окружения; без DSN Sentry не инициализируется.

export const SENTRY_DSN = process.env.SENTRY_DSN
export const SENTRY_ENV = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'

export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN && SENTRY_DSN.startsWith('https://'))
}
