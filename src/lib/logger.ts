// Структурированный JSON-логгер на базе pino (спринт 5).
// В dev — pretty print, в prod — JSON для сбора в ELK/Loki.

import pino from 'pino'
import { getRequestContext } from './async-context'

const isDev = process.env.NODE_ENV !== 'production'

const rootLogger = pino({
  level: (process.env.LOG_LEVEL as string) || (isDev ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
})

export interface AppLogger {
  info(message: string, meta?: Record<string, unknown> | string): void
  warn(message: string, meta?: Record<string, unknown> | string): void
  error(message: string, meta?: Record<string, unknown> | string): void
  debug(message: string, meta?: Record<string, unknown> | string): void
}

/** Создать логгер с фиксированным scope и автоматическим requestId из AsyncLocalStorage. */
export function createLogger(scope: string): AppLogger {
  return {
    info(message: string, meta?: Record<string, unknown>) {
      rootLogger.info({ scope, ...getContextFields(), ...meta }, message)
    },
    warn(message: string, meta?: Record<string, unknown>) {
      rootLogger.warn({ scope, ...getContextFields(), ...meta }, message)
    },
    error(message: string, meta?: Record<string, unknown>) {
      rootLogger.error({ scope, ...getContextFields(), ...meta }, message)
    },
    debug(message: string, meta?: Record<string, unknown>) {
      rootLogger.debug({ scope, ...getContextFields(), ...meta }, message)
    },
  }
}

/** Глобальный логгер (для мест без явного scope). */
export const logger = createLogger('app')

function getContextFields(): Record<string, unknown> {
  const ctx = getRequestContext()
  const fields: Record<string, unknown> = {}
  if (ctx?.requestId) fields.requestId = ctx.requestId
  if (ctx?.userId) fields.userId = ctx.userId
  if (ctx?.path) fields.path = ctx.path
  return fields
}
