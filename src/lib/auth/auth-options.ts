// Конфигурация next-auth v4 (Фаза 5: Auth & production prep).
// Провайдер Credentials: email + password, проверка через Prisma + scrypt.
// Стратегия сессии — JWT (без адаптера Prisma для сессий).
//
// Аутентификация активируется только если задан AUTH_SECRET.
// Без AUTH_SECRET next-auth бросит ошибку при инициализации — это намеренно:
// в dev-окружении без секрета доступ остаётся открытым (middleware гейтит по env).

import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { parsePermissions, type Permissions } from '@/lib/auth/permissions'

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    // В dev без секрета — возвращаем пустую строку, чтобы модуль загрузился.
    // isAuthEnabled() вернёт false → requireAuth() откроет доступ (dev-only).
    // assertAuthConfigured() на верхнем уровне уже заблокировал production.
    if (process.env.NODE_ENV !== 'production') {
      return ''
    }
    throw new Error(
      'AUTH_SECRET (или NEXTAUTH_SECRET) не задан. Установите его в .env для включения аутентификации.'
    )
  }
  return secret
}

/** Активна ли аутентификация (задан ли секрет). */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
}

/**
 * Проверка fail-closed: в production отсутствие AUTH_SECRET — критическая ошибка.
 * Сервер не должен запускаться без аутентификации в production-окружении.
 * @throws Error если NODE_ENV === 'production' и секрет не задан.
 */
export function assertAuthConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !isAuthEnabled()) {
    throw new Error(
      'AUTH_SECRET (или NEXTAUTH_SECRET) не задан в production. ' +
        'Аутентификация обязательна — сервер не может работать в открытом режиме. ' +
        'Сгенерируйте секрет: openssl rand -base64 32'
    )
  }
}

// Проверка при загрузке модуля: fail-closed в production.
assertAuthConfigured()

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true, permissions: true },
        })
        if (!user || !user.isActive) return null

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) return null

        // Обновляем время последнего входа (fire-and-forget).
        db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined)

        const permissions = parsePermissions(user.role, user.permissions)

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          permissions,
        } as unknown as { id: string; email: string; name?: string | null; role: string; permissions: Permissions }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as unknown as { id: string }).id
        token.role = (user as unknown as { role: string }).role
        token.permissions = (user as unknown as { permissions: Permissions }).permissions
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as { id?: string }).id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { permissions?: Permissions }).permissions = token.permissions as Permissions
      }
      return session
    },
  },
}
