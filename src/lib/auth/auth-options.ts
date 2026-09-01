// Конфигурация next-auth v4 (Фаза 5: Auth & production prep).
// Провайдер Credentials: email + password, проверка через Prisma + scrypt.
// Стратегия сессии — JWT (без адаптера Prisma для сессий).
//
// Аутентификация активируется только если задан AUTH_SECRET.
// Без AUTH_SECRET next-auth бросит ошибку при инициализации — это намеренно:
// в dev-окружении без секрета доступ остаётся открытым (middleware гейтит по env).
//
// Фаза 6: isActive + passwordChangedAt проверяются на каждый вызов jwt callback
// (с TTL-кэшем 60 сек), чтобы деактивированные пользователи и старые сессии
// после смены пароля отзывались в течение минуты, а не 7 дней.

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

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Cookie secure flag: true только если приложение доступно по HTTPS.
 * В production за приложением обычно стоит reverse-proxy (Caddy/nginx) с TLS —
 * тогда secure-cookик работают корректно. Но если прод работает по голому HTTP
 * (без TLS-прокси), secure-cookie браузером отбрасываются и сессия не сохраняется.
 * Переменная AUTH_COOKIE_SECURE позволяет явно управлять этим (по умолчанию = isProduction).
 */
const cookieSecure = process.env.AUTH_COOKIE_SECURE === undefined
  ? isProduction
  : process.env.AUTH_COOKIE_SECURE === 'true'

/**
 * TTL-кэш для per-user проверки isActive/passwordChangedAt.
 * Избегает DB-запроса на каждый запрос — обновляется раз в 60 секунд.
 * Фаза 6, шаг 6.2: деактивированный пользователь теряет доступ в течение TTL,
 * а не через 7 дней (maxAge JWT).
 */
const USER_STATUS_TTL_MS = 60_000
interface UserStatus {
  isActive: boolean
  passwordChangedAt: number | null
  role: string
  permissions: string | null
}
const userStatusCache = new Map<string, { status: UserStatus; expiresAt: number }>()

/**
 * Получить актуальный статус пользователя с TTL-кэшем.
 * @returns null если пользователь не найден (был удалён).
 */
async function getUserStatus(userId: string): Promise<UserStatus | null> {
  const cached = userStatusCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.status
  }
  const fresh = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      permissions: true,
      passwordChangedAt: true,
    },
  })
  if (!fresh) return null
  const status: UserStatus = {
    isActive: fresh.isActive,
    passwordChangedAt: fresh.passwordChangedAt ? fresh.passwordChangedAt.getTime() : null,
    role: fresh.role,
    permissions: fresh.permissions,
  }
  userStatusCache.set(userId, { status, expiresAt: Date.now() + USER_STATUS_TTL_MS })
  return status
}

/**
 * Инвалидировать кэш статуса пользователя (вызывается при смене пароля,
 * деактивации и т.п. — чтобы отзыв вступил в силу мгновенно, а не через TTL).
 */
export function invalidateUserStatusCache(userId: string): void {
  userStatusCache.delete(userId)
}

/**
 * Параметры cookie next-auth (Фаза 3, шаг 3.2 — Cookie security flags).
 *   httpOnly: true  — cookie недоступен из JS, защита от кражи сессии через XSS.
 *   sameSite: 'lax' — cookie не отправляется при cross-site запросах (CSRF).
 *   secure: true только если есть HTTPS (reverse-proxy с TLS) — см. cookieSecure.
 * Имена cookies оставлены стандартными (без __Secure- префикса), чтобы не
 * инвалидировать уже выданные сессии при развёртывании.
 */
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: cookieSecure,
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7 дней
  },
  pages: {
    signIn: '/login',
  },
  useSecureCookies: cookieSecure,
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: cookieOptions,
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: cookieOptions,
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: cookieOptions,
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code-verifier',
      options: cookieOptions,
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase().normalize('NFC')
        const password = credentials?.password
        if (!email || !password) return null

        // Brute-force-защита: лимит на email+10 мин (5 попыток).
        // Без раскрытия факта lockout — возвращаем null как при неверном пароле.
        // Ленивый импорт: избегаем загрузки тяжёлого графа модулей (api-utils →
        // ai-connector/errors) при инициализации auth-options, что замедляет
        // динамический re-import в тестах с vi.resetModules().
        const { rateLimit } = await import('@/lib/rate-limit')
        const { ok: loginAllowed } = rateLimit(`login:${email}`, 5, 10 * 60 * 1000)
        if (!loginAllowed) {
          db.auditLog.create({
            data: { userId: null, userEmail: email, action: 'login_failed', method: 'POST', path: '/api/auth/callback/credentials', entityType: 'user', entityId: null, metadata: JSON.stringify({ reason: 'rate_limited' }), ip: null },
          }).catch(() => {})
          return null
        }

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true, permissions: true },
        })
        if (!user || !user.isActive) {
          db.auditLog.create({
            data: { userId: user?.id ?? null, userEmail: email, action: 'login_failed', method: 'POST', path: '/api/auth/callback/credentials', entityType: 'user', entityId: user?.id ?? null, metadata: JSON.stringify({ reason: user ? 'inactive' : 'user_not_found' }), ip: null },
          }).catch(() => {})
          return null
        }

        const ok = await verifyPassword(password, user.passwordHash)
        if (!ok) {
          db.auditLog.create({
            data: { userId: user.id, userEmail: email, action: 'login_failed', method: 'POST', path: '/api/auth/callback/credentials', entityType: 'user', entityId: user.id, metadata: JSON.stringify({ reason: 'wrong_password' }), ip: null },
          }).catch(() => {})
          return null
        }

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
  events: {
    // Успешный вход: записываем в AuditLog.
    async signIn(message) {
      const user = message.user as { id?: string; email?: string } | undefined
      db.auditLog.create({
        data: {
          userId: user?.id ?? null,
          userEmail: user?.email ?? null,
          action: 'login',
          method: 'POST',
          path: '/api/auth/callback/credentials',
          entityType: 'user',
          entityId: user?.id ?? null,
          metadata: JSON.stringify({ source: 'credentials' }),
          ip: null,
        },
      }).catch(() => {})
    },
    // Выход: записываем в AuditLog.
    async signOut(message) {
      const token = message.token as { id?: string; email?: string } | undefined
      db.auditLog.create({
        data: {
          userId: token?.id ?? null,
          userEmail: token?.email ?? null,
          action: 'logout',
          method: 'POST',
          path: '/api/auth/signout',
          entityType: 'user',
          entityId: token?.id ?? null,
          metadata: JSON.stringify({ source: 'signout' }),
          ip: null,
        },
      }).catch(() => {})
    },
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Первичный логин: берём роль/права из объекта user (только что проверены).
      // Записываем issuedAt — время создания токена (для сравнения с passwordChangedAt).
      if (user) {
        token.id = (user as unknown as { id: string }).id
        token.role = (user as unknown as { role: string }).role
        token.permissions = (user as unknown as { permissions: Permissions }).permissions
        token.issuedAt = Date.now()
      }

      // Проверка на каждый вызов jwt callback (а не только при trigger='update'):
      // перечитываем isActive/passwordChangedAt из БД с TTL-кэшем 60 сек.
      // Фаза 6, шаги 6.2 + 6.3.
      if (token.id) {
        const status = await getUserStatus(token.id as string)

        // Пользователь удалён или деактивирован — инвалидируем токен.
        if (!status || !status.isActive) {
          return { ...token, role: undefined, permissions: undefined } as typeof token
        }

        // Смена пароля после выдачи токена → отзыв старых сессий.
        const issuedAt = (token.issuedAt as number | undefined) ?? 0
        if (status.passwordChangedAt && status.passwordChangedAt > issuedAt) {
          return { ...token, role: undefined, permissions: undefined } as typeof token
        }

        // При trigger='update' — принудительно перечитываем роль/права (минуя кэш).
        if (trigger === 'update') {
          token.role = status.role
          token.permissions = parsePermissions(status.role, status.permissions)
        }
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
