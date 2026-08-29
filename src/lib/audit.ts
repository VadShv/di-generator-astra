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
          metadata: metadata ? JSON.stringify(metadata) : null,
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
