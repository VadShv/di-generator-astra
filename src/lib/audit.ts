// Fire-and-forget аудит действий пользователей.
// Не блокирует основной поток — логирование происходит после возврата response.

import { db } from '@/lib/db'
import { getAppSession } from '@/lib/auth/session'

/**
 * Записать действие в аудит-лог (fire-and-forget).
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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() || null

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
          ip,
        },
      })
    })
    .catch(() => {})
}
