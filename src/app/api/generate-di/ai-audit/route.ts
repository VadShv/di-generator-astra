import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// POST /api/generate-di/ai-audit - AI audit of existing DI
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { generatedDIId, auditType } = body

    if (!generatedDIId || typeof generatedDIId !== 'string') {
      return NextResponse.json({ error: 'ID ДИ обязателен' }, { status: 400 })
    }

    const type = auditType || 'full'
    const validTypes = ['full', 'legal', 'consistency']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Недопустимый тип аудита. Используйте: full, legal, consistency' }, { status: 400 })
    }

    // Get the DI with full content
    const di = await db.generatedDI.findUnique({
      where: { id: generatedDIId },
      include: {
        position: { include: { department: true, businessFunction: true, project: true } },
        sections: { orderBy: { order: 'asc' } },
      },
    })

    if (!di) {
      return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
    }

    // Build the full DI text for audit
    const diText = di.sections.map(s => `## ${s.sectionTitle}\n${s.sectionContent}`).join('\n\n')
    const positionContext = `Должность: ${di.position.title}
Подразделение: ${di.position.department?.name || 'Не указано'}
Грейд: ${di.position.grade || 'Не указан'}
Бизнес-функция: ${di.position.businessFunction?.name || 'Не указана'}
Проект: ${di.position.project?.name || 'Не указан'}`

    // Initialize AI
    const zai = await ZAI.create()

    const auditPromptMap: Record<string, string> = {
      full: `Проведи полный аудит должностной инструкции. Найди:
1. Устаревшие пункты — положения, которые не соответствуют современным требованиям законодательства или практики
2. Противоречивые пункты — положения, которые противоречат друг другу внутри документа
3. Юридически рискованные пункты — положения, которые могут создать правовые риски для компании или сотрудника

Для каждого найденного пункта укажи:
- Текст пункта (цитата из документа)
- Категорию проблемы (устаревшее / противоречивое / рискованное)
- Объяснение проблемы
- Рекомендацию по исправлению

Также поставь общую оценку качества документа от 0 до 100.`,
      legal: `Проведи юридический аудит должностной инструкции с точки зрения трудового законодательства РФ. Найди:
1. Пункты, нарушающие ТК РФ или иные нормативные акты
2. Пункты, создающие юридические риски для работодателя
3. Пункты, ущемляющие права работника

Для каждого найденного пункта укажи:
- Текст пункта (цитата)
- Конкретная норма закона, которая нарушается или может быть нарушена
- Уровень риска (высокий / средний / низкий)
- Рекомендация по исправлению с указанием правильной формулировки

Также поставь общую оценку юридической безопасности документа от 0 до 100.`,
      consistency: `Проведи аудит внутренней согласованности должностной инструкции. Найди:
1. Противоречия между разными разделами документа
2. Дублирование функций и обязанностей
3. Отсутствие логических связей между разделами (например, права не соответствуют обязанностям)
4. Неясные или двусмысленные формулировки

Для каждого найденного пункта укажи:
- Текст проблемного пункта (цитата)
- Какой пункт противоречит этому (если есть)
- Тип проблемы (противоречие / дублирование / отсутствие связи / неясность)
- Рекомендация по исправлению

Также поставь общую оценку внутренней согласованности от 0 до 100.`,
    }

    const systemPrompt = `Ты — эксперт-юрист и HR-аналитик, специализирующийся на должностных инструкциях в Российской Федерации.
Ты проводишь профессиональный аудит должностных инструкций с точки зрения трудового законодательства, внутренней согласованности и актуальности.

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${positionContext}

ПРАВИЛА:
- Анализируй каждое положение инструкции детально
- Приводи конкретные ссылки на нормы ТК РФ когда это уместно
- Формулируй рекомендации чётко и конкретно
- Ответ должен быть в формате JSON (строго)`
    const userPrompt = `${auditPromptMap[type]}

ТЕКСТ ДОЛЖНОСТНОЙ ИНСТРУКЦИИ:
${diText}

Важно: ответ должен быть строго в формате JSON со следующей структурой:
{
  "overallScore": число от 0 до 100,
  "outdatedItems": [{"quote": "цитата", "explanation": "объяснение", "recommendation": "рекомендация"}],
  "contradictoryItems": [{"quote": "цитата", "conflictsWith": "с чем противоречит", "explanation": "объяснение", "recommendation": "рекомендация"}],
  "riskyItems": [{"quote": "цитата", "riskLevel": "высокий/средний/низкий", "legalReference": "ссылка на закон", "explanation": "объяснение", "recommendation": "рекомендация"}],
  "recommendations": [{"area": "область", "current": "текущее состояние", "suggested": "предлагаемое улучшение"}],
  "summary": "общее текстовое резюме аудита"
}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const aiResponse = completion.choices[0]?.message?.content || ''

    // Parse AI response - try to extract JSON
    let auditData: Record<string, unknown>
    try {
      // Try direct parse
      auditData = JSON.parse(aiResponse)
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = aiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        try {
          auditData = JSON.parse(jsonMatch[1])
        } catch {
          // Fallback: create structured data from raw text
          auditData = {
            overallScore: 50,
            outdatedItems: [],
            contradictoryItems: [],
            riskyItems: [],
            recommendations: [],
            summary: aiResponse,
          }
        }
      } else {
        auditData = {
          overallScore: 50,
          outdatedItems: [],
          contradictoryItems: [],
          riskyItems: [],
          recommendations: [],
          summary: aiResponse,
        }
      }
    }

    // Save audit result to database
    const auditResult = await db.dIAuditResult.create({
      data: {
        generatedDIId,
        auditType: type,
        overallScore: Number(auditData.overallScore) || 0,
        outdatedItems: JSON.stringify(auditData.outdatedItems || []),
        contradictoryItems: JSON.stringify(auditData.contradictoryItems || []),
        riskyItems: JSON.stringify(auditData.riskyItems || []),
        recommendations: JSON.stringify(auditData.recommendations || []),
        summary: (auditData.summary as string) || null,
        auditedBy: 'ai-system',
      },
    })

    return NextResponse.json({
      ...auditResult,
      outdatedItems: JSON.parse(auditResult.outdatedItems),
      contradictoryItems: JSON.parse(auditResult.contradictoryItems),
      riskyItems: JSON.parse(auditResult.riskyItems),
      recommendations: JSON.parse(auditResult.recommendations),
    })
  } catch (error) {
    console.error('AI Audit error:', error)
    return NextResponse.json({ error: 'Ошибка AI-аудита ДИ' }, { status: 500 })
  }
}

// GET /api/generate-di/ai-audit - List audit results for a DI
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const generatedDIId = searchParams.get('generatedDIId')

    if (!generatedDIId) {
      return NextResponse.json({ error: 'ID ДИ обязателен' }, { status: 400 })
    }

    const auditResults = await db.dIAuditResult.findMany({
      where: { generatedDIId },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields for each result
    const parsed = auditResults.map(r => ({
      ...r,
      outdatedItems: JSON.parse(r.outdatedItems),
      contradictoryItems: JSON.parse(r.contradictoryItems),
      riskyItems: JSON.parse(r.riskyItems),
      recommendations: JSON.parse(r.recommendations),
    }))

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI Audit GET error:', error)
    return NextResponse.json({ error: 'Ошибка загрузки результатов аудита' }, { status: 500 })
  }
}
