import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { errorResponse, parseBody } from '@/lib/api-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { changePasswordSchema } from '@/lib/validation/schemas'
import { invalidateUserStatusCache } from '@/lib/auth/auth-options'

// POST /api/auth/change-password — смена пароля текущим пользователем
// Защита (Фаза 3, шаг 3.5 + Фаза 6, шаг 6.3):
//   - auth-gate через requireAuth() (консистентность с остальными роутами);
//   - Zod-валидация: минимум 8 символов, буква + цифра, отличие от текущего;
//   - rate-limit 5 попыток/час по пользователю — защита от brute-force
//     текущего пароля;
//   - транзакция verify+update (защита от TOCTOU);
//   - passwordChangedAt инвалидирует все ранее выданные JWT.
export async function POST(request: NextRequest) {
  try {
   const session = await requireAuth()
   // В режиме без auth (dev) смена пароля бессмысленна — нет пользователя.
   if (!session?.user?.id) {
     return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
   }
    const userId = session.user.id

    // Rate-limit по пользователю: 5 попыток/час. Брутфорс текущего пароля
    // не должен позволить перебрать его за разумное время.
    checkRateLimit(request, 'change-password', 5, 60 * 60 * 1000, userId)

    const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema)

    // Транзакция: проверка текущего пароля + обновление — защита от TOCTOU.
    // passwordChangedAt инвалидирует все ранее выданные JWT (Фаза 6, шаг 6.3):
    // jwt callback сравнивает token.issuedAt с passwordChangedAt.
   let passwordError = false
   await db.$transaction(async (tx) => {
     const current = await tx.user.findUnique({
        where: { id: userId },
       select: { passwordHash: true },
     })
      if (!current) {
        throw new Error('Пользователь не найден')
      }
      const isValid = await verifyPassword(currentPassword, current.passwordHash)
      if (!isValid) {
        passwordError = true
        return
      }
     await tx.user.update({
        where: { id: userId },
       data: {
         passwordHash: await hashPassword(newPassword),
         passwordChangedAt: new Date(),
       },
     })
   })

   if (passwordError) {
     return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 })
   }

   // Мгновенная инвалидация кэша статуса — чтобы отзыв сессий вступил в силу
   // без ожидания TTL (60 сек).
    invalidateUserStatusCache(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    // Единая обработка: errorResponse корректно форматирует ApiError (429
    // rate-limit, 401/403 auth) и ZodError (400 validation), логируя детали.
    return errorResponse(error, undefined, 'change-password')
  }
}
