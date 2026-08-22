// Серверная утилита получения сессии (Фаза 5).
// Используется в server components и API-роутах для проверки аутентификации.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import type { Session } from 'next-auth'
import { ApiError } from '@/lib/api-utils'

export type AppSession = Session & {
  user?: {
    id?: string
    name?: string | null
    email?: string | null
    role?: string
  }
}

/** Получить текущую сессию на сервере. */
export async function getAppSession(): Promise<AppSession | null> {
  return (await getServerSession(authOptions)) as AppSession | null
}

/**
 * Проверить, что запрос аутентифицирован.
 * @returns сессию если аутентификация включена и пользователь залогинен;
 *          null если аутентификация отключена (открытый доступ).
 * @throws ApiError 401 если аутентификация включена, но пользователь не залогинен.
 */
export async function requireAuth(): Promise<AppSession | null> {
  const { isAuthEnabled } = await import('@/lib/auth/auth-options')
  if (!isAuthEnabled()) return null // аутентификация отключена — открытый доступ
  const session = await getAppSession()
  if (!session?.user) {
    throw new ApiError('Требуется аутентификация', 401, 'unauthorized')
  }
  return session
}

/**
 * Проверить, что пользователь имеет указанную роль.
 * @returns сессию если аутентификация включена и роль совпадает;
 *          null если аутентификация отключена (открытый доступ).
 * @throws ApiError 401 если не залогинен; 403 если роль не совпадает.
 */
export async function requireRole(role: string): Promise<AppSession | null> {
  const session = await requireAuth()
  if (session && session.user?.role !== role) {
    throw new ApiError('Недостаточно прав', 403, 'forbidden')
  }
  return session
}
