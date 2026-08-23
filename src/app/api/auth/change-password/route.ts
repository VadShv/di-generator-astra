import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAppSession } from '@/lib/auth/session'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { ApiError, errorResponse } from '@/lib/api-utils'

// POST /api/auth/change-password — смена пароля текущим пользователем
export async function POST(request: NextRequest) {
  try {
    const session = await getAppSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Требуется аутентификация' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Текущий и новый пароль обязательны' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Новый пароль должен быть не менее 6 символов' }, { status: 400 })
    }

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
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error changing password:', error)
    return NextResponse.json({ error: 'Ошибка смены пароля' }, { status: 500 })
  }
}
