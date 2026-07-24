import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/generate-di/ai-improve - Improve existing section content with AI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sectionId, instruction } = body

    if (!sectionId || typeof sectionId !== 'string') {
      return NextResponse.json({ error: 'ID секции обязателен' }, { status: 400 })
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim() === '') {
      return NextResponse.json({ error: 'Инструкция для улучшения обязательна' }, { status: 400 })
    }

    // Get the section
    const section = await db.generatedDISection.findUnique({
      where: { id: sectionId },
      include: {
        generatedDI: {
          include: {
            position: { include: { department: true, businessFunction: true, project: true } },
          },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ error: 'Секция не найдена' }, { status: 404 })
    }

    if (!section.sectionContent || section.sectionContent.trim() === '') {
      return NextResponse.json({ error: 'Секция пуста, улучшение невозможно' }, { status: 400 })
    }

    const positionContext = `Должность: ${section.generatedDI.position.title}
Подразделение: ${section.generatedDI.position.department.name}
Грейд: ${section.generatedDI.position.grade || 'Не указан'}
Бизнес-функция: ${section.generatedDI.position.businessFunction?.name || 'Не указана'}
Проект: ${section.generatedDI.position.project?.name || 'Не указан'}`

    const systemPrompt = `Ты — эксперт по созданию и улучшению должностных инструкций для компании Группа Астра.
Ты работаетешь с существующим текстом секции должностной инструкции и улучшаешь его по указанию пользователя.

КОНТЕКСТ:
${positionContext}
Секция: ${section.sectionTitle}

ПРАВИЛА:
- Улучшай только указанную секцию, сохраняя её общую структуру и смысл
- Следуй инструкции пользователя точно
- Сохраняй формально-деловой стиль
- Не добавляй заголовок секции в начало текста
- Возвращай только улучшенный текст без пояснений`

    const userPrompt = `Текущий текст секции "${section.sectionTitle}":

${section.sectionContent}

Инструкция по улучшению: ${instruction.trim()}

Верни улучшенный текст секции.`

    // Call AI
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const response = completion.choices[0]?.message?.content || ''

    // Update the section in the database
    const updatedSection = await db.generatedDISection.update({
      where: { id: sectionId },
      data: {
        sectionContent: response.trim(),
        editedBy: 'ai-improve',
      },
    })

    return NextResponse.json(updatedSection)
  } catch (error) {
    console.error('AI Improve error:', error)
    return NextResponse.json({ error: 'Ошибка AI-улучшения секции' }, { status: 500 })
  }
}
