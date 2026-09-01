import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

import { createLogger } from '@/lib/logger'

const log = createLogger('settings')

// GET /api/settings — все системные настройки (только admin)
export async function GET(request: NextRequest) {
  try {
    await requireRole('admin')
    const settings = await db.systemSettings.findMany()
    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching settings:', { error })
    return NextResponse.json({ error: 'Ошибка получения настроек' }, { status: 500 })
  }
}

// PUT /api/settings — обновление настройки (только admin)
export async function PUT(request: NextRequest) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key и value обязательны' }, { status: 400 })
    }

    const existing = await db.systemSettings.findUnique({ where: { key } })
    if (existing) {
      await db.systemSettings.update({ where: { key }, data: { value: String(value) } })
    } else {
      await db.systemSettings.create({ data: { key, value: String(value) } })
    }

    return NextResponse.json({ success: true, key, value: String(value) })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error updating settings:', { error })
    return NextResponse.json({ error: 'Ошибка обновления настроек' }, { status: 500 })
  }
}
