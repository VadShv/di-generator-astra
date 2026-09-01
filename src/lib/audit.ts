// Fire-and-forget аудит действий пользователей.
// Не блокирует основной поток — логирование происходит после возврата response.
//
// Защита (Фаза 4, шаг 4.2):
//   - IP извлекается с учётом доверенного прокси (getClientIp), а не из
//     x-forwarded-for напрямую — атакующий не может подделать заголовок.
//   - Ошибки записи в аудит-лог логируются warn-уровнем, а не глотаются
//     silently через .catch(() => {}): потеря аудита — заметное событие.

import { db } from '@/lib/db'
import { getAppSession } from '@/lib/auth/session'
import { getClientIp } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

/** Ключи, значения которых не должны попадать в audit-лог в открытом виде. */
const SENSITIVE_KEYS = /^(api[_-]?key|secret|password|passwd|token|authorization|auth[_-]?header|private[_-]?key)$/i

/**
 * Рекурсивно маскирует sensitive-поля в metadata перед сериализацией.
 * Защищает от случайной утечки API-ключей, паролей и токенов в audit-лог.
 */
function sanitizeMetadata(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sanitizeMetadata)
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = sanitizeMetadata(val)
    }
  }
  return result
}

const auditLogger = createLogger('audit')

/**
 * Записать действие в аудит-лог (fire-and-forget).
 *
 * Ошибки БД не пробрасываются (аудит не должен ронять основной запрос),
 * но логируются на warn-уровне с контекстом действия — чтобы потеря
 * аудита не осталась незамеченной.
 */
export function logAudit(
  action: string,
  request: Request,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): void {
  const path = new URL(request.url).pathname
  const method = request.method
  // IP только через getClientIp: доверяем x-forwarded-for лишь за
  // доверенным прокси (TRUSTED_PROXY_IP), иначе — прямой socket-адрес.
  const ip = getClientIp(request)

  getAppSession()
    .then((session) => {
      return db.auditLog.create({
        data: {
          userId: session?.user?.id || null,
          userEmail: session?.user?.email || null,
          action,
          method,
          path,
          entityType: entityType || null,
          entityId: entityId || null,
          metadata: metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null,
          // unknown приходит из getClientIp, если заголовков нет; храним как есть.
          ip: ip === 'unknown' ? null : ip,
        },
      })
    })
    .catch((error) => {
      // Не роняем основной запрос, но логируем потерю аудита на warn-уровне.
      // error-уровень избыточен (аудит — не критичная операция), warn — заметно.
      auditLogger.warn('Не удалось записать действие в аудит-лог', {
        action,
        method,
        path,
        entityType,
        entityId,
        error: error instanceof Error ? error.message : String(error),
      })
    })
}
