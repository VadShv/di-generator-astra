import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 })
    }

    const di = await db.generatedDI.findUnique({
      where: { id },
      include: {
        position: { include: { department: true } },
        template: true,
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    // Return the DI data as JSON for client-side DOCX generation
    // The actual DOCX generation is complex and requires the docx npm package
    return NextResponse.json({
      id: di.id,
      title: di.title,
      position: di.position?.title,
      department: di.position?.department?.name,
      grade: di.position?.grade,
      status: di.status,
      createdAt: di.createdAt,
      sections: di.sections.map((s: any) => ({
        title: s.sectionTitle,
        content: s.sectionContent,
        order: s.order,
      })),
    })
  } catch (error) {
    console.error('Export DOCX error:', error)
    return NextResponse.json({ error: 'Ошибка экспорта' }, { status: 500 })
  }
}
