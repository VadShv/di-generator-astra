// Fire-and-forget создание уведомлений.
import { db } from '@/lib/db'

export function createNotification(params: {
  userId?: string | null
  type: string
  title: string
  message: string
  entityType?: string
  entityId?: string
}): void {
  db.notification
    .create({
      data: {
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
      },
    })
    .catch(() => {})
}
