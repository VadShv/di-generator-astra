import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
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
      db.dITracking.count({ where: { status: 'sent_for_review' } }),
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
    console.error('Dashboard stats error:', error)
    return NextResponse.json({
      departments: 0,
      positions: 0,
      archiveDIs: 0,
      templates: 0,
      masterPrompts: 0,
      generatedDIs: 0,
      pendingTracking: 0,
      pendingComparison: 0,
    })
  }
}
