// Серверная утилита получения сессии (Фаза 5).
// Используется в server components и API-роутах для проверки аутентификации.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import type { Session } from 'next-auth'

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
 * @throws Response 401 если аутентификация включена, но пользователь не залогинен.
 */
export async function requireAuth(): Promise<AppSession | null> {
  const { isAuthEnabled } = await import('@/lib/auth/auth-options')
  if (!isAuthEnabled()) return null // аутентификация отключена — открытый доступ
  const session = await getAppSession()
  if (!session?.user) {
    const res = new Response(JSON.stringify({ error: 'Требуется аутентификация' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    throw res
  }
  return session
}
