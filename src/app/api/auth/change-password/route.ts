import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { errorResponse, parseBody } from '@/lib/api-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { changePasswordSchema } from '@/lib/validation/schemas'

// POST /api/auth/change-password — смена пароля текущим пользователем
// Защита (Фаза 3, шаг 3.5):
//   - auth-gate через requireAuth() (консистентность с остальными роутами);
//   - Zod-валидация: минимум 8 символов, буква + цифра, отличие от текущего;
//   - rate-limit 5 попыток/час по пользователю — защита от brute-force
//     текущего пароля.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    // В режиме без auth (dev) смена пароля бессмысленна — нет пользователя.
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    // Rate-limit по пользователю: 5 попыток/час. Брутфорс текущего пароля
    // не должен позволить перебрать его за разумное время.
    checkRateLimit(request, 'change-password', 5, 60 * 60 * 1000, session.user.id)

    const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema)

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 })
    }

    const newHash = await hashPassword(newPassword)
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Единая обработка: errorResponse корректно форматирует ApiError (429
    // rate-limit, 401/403 auth) и ZodError (400 validation), логируя детали.
    return errorResponse(error, undefined, 'change-password')
  }
}
