import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('master-prompts-versions')

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
    }

    const versions = await db.masterPrompt.findMany({
      where: { name },
      include: {
        department: true,
      },
      orderBy: { version: 'desc' },
    })

    return NextResponse.json(versions)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Error fetching prompt versions:', { error })
    return NextResponse.json({ error: 'Ошибка при получении версий промпта' }, { status: 500 })
  }
}
