import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { hashPassword } from '@/lib/auth/password'
import { getPresetForRole, ALL_TABS, type Permissions } from '@/lib/auth/permissions'

// GET /api/users — список пользователей (только admin)
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin')
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(users)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Ошибка получения списка пользователей' }, { status: 500 })
  }
}

// POST /api/users — создание пользователя (только admin)
export async function POST(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { email, name, password, role, permissions } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const finalRole = role || 'user'

    // Если permissions не переданы — используем preset для роли
    let permissionsJson: string | null = null
    if (permissions) {
      permissionsJson = JSON.stringify(permissions)
    } else if (finalRole !== 'admin') {
      permissionsJson = JSON.stringify(getPresetForRole(finalRole))
    }

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        role: finalRole,
        permissions: permissionsJson,
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true, name: true, role: true, permissions: true, isActive: true, createdAt: true },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Ошибка создания пользователя' }, { status: 500 })
  }
}
