// Единый логгер сервиса (Фаза 1).
// Обёртка над console с уровнями и контекстом роута/модуля.
// В проде можно расширить отправкой в систему мониторинга / БД (ActivityLog).

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const LEVEL_PRIORITY: Record< LogLevel, number > = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

function format(level: LogLevel, scope: string, message: string, meta?: unknown): string {
  const ts = new Date().toISOString()
  const metaStr = meta !== undefined ? ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : ''
  return `[${ts}] ${level.toUpperCase()} (${scope}) ${message}${metaStr}`
}

export interface AppLogger {
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
  debug(message: string, meta?: unknown): void
}

/** Создать логгер с фиксированным scope (обычно имя роута/модуля). */
export function createLogger(scope: string): AppLogger {
  return {
    info(message: string, meta?: unknown) {
      if (shouldLog('info')) console.log(format('info', scope, message, meta))
    },
    warn(message: string, meta?: unknown) {
      if (shouldLog('warn')) console.warn(format('warn', scope, message, meta))
    },
    error(message: string, meta?: unknown) {
      if (shouldLog('error')) console.error(format('error', scope, message, meta))
    },
    debug(message: string, meta?: unknown) {
      if (shouldLog('debug')) console.debug(format('debug', scope, message, meta))
    },
  }
}

/** Логгер по умолчанию (для мест без явного scope). */
export const logger = createLogger('app')
