import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('dashboard-stats')

export async function GET() {
  try {
    await requireAuth()
    const [
      departments,
      positions,
      archiveDIs,
      templates,
      masterPrompts,
      generatedDIs,
      pendingTracking,
      pendingComparison,
    ] = await Promise.all([
      db.department.count(),
      db.position.count(),
      db.archiveDI.count(),
      db.dITemplate.count(),
      db.masterPrompt.count(),
      db.generatedDI.count(),
      // ДИ на согласовании (статус 'review') — ранее считался по DITracking с несуществующим статусом 'sent_for_review'.
      db.generatedDI.count({ where: { status: 'review' } }),
      db.dIVersion.count({ where: { isOriginal: false } }),
    ])

    return NextResponse.json({
      departments,
      positions,
      archiveDIs,
      templates,
      masterPrompts,
      generatedDIs,
      pendingTracking,
      pendingComparison,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Dashboard stats error:', { error })
    return NextResponse.json(
      {
        departments: 0,
        positions: 0,
        archiveDIs: 0,
        templates: 0,
        masterPrompts: 0,
        generatedDIs: 0,
        pendingTracking: 0,
        pendingComparison: 0,
      },
      { status: 500 }
    )
  }
}
