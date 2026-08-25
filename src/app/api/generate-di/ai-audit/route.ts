import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition } from '@/lib/master-prompt'
import { withErrorHandler, parseBody } from '@/lib/api-utils'
import { aiAuditSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { parseJsonOr } from '@/lib/json-safe'
import { buildPositionContext, buildLegalContext, type LegalRefForContext } from '@/lib/di/prompts'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { ApiError, errorResponse } from '@/lib/api-utils'

const log = createLogger('generate-di/ai-audit')

// POST /api/generate-di/ai-audit - AI audit of existing DI with 5 legal error classes
export const POST = withErrorHandler(async (request: Request) => {
  await requireAuth()
  const body = await parseBody(request, aiAuditSchema)
  const { generatedDIId, auditType } = body
  const type = auditType

  // Get the DI with full content
  const di = await db.generatedDI.findUnique({
    where: { id: generatedDIId },
    include: {
      position: { include: { department: { include: { company: true } }, businessFunction: true, project: true } },
      sections: { orderBy: { order: 'asc' } },
    },
  })

  if (!di) {
    return NextResponse.json({ error: 'ДИ не найдена' }, { status: 404 })
  }

  // Build the full DI text for audit
  const diText = di.sections.map((s) => `## ${s.sectionTitle}\n${s.sectionContent}`).join('\n\n')
  const positionContext = buildPositionContext(di.position)

  const client = await getProviderClient()

  // Резолвим промпт категории "audit" (если есть) и рендерим переменные.
  const auditPrompt = await resolveMasterPrompt('audit', {
    departmentId: di.position.departmentId,
    businessFunctionId: di.position.businessFunctionId,
    grade: di.position.grade,
  })
  const renderedAuditPrompt = auditPrompt
    ? renderPrompt(auditPrompt.content, buildContextFromPosition(di.position))
    : null

  // ─────────────────────────────────────────────────
  // ПРАВОВОЕ ЯДРО — 5 классов реальных ошибок
  // ─────────────────────────────────────────────────
  const fiveClassesPrompt = `
ПРАВОВОЕ ЯДРО АУДИТА — 5 КЛАССОВ ОШИБОК:

1. ДУБЛИРОВАНИЕ НОРМ ТК РФ
   — Копирование ст. 21 ТК РФ («соблюдать дисциплину», «беречь имущество», «добросовестно выполнять свои трудовые обязанности» и т.д.) в текст ДИ.
   — Эти нормы уже действуют автоматически для любого работника по силу закона.
   — Их включение в ДИ: (а) создаёт иллюзию полноты, (б) маскирует отсутствие реально значимых обязанностей, (в) при изменении ТК создаёт рассинхрон.
   — Ищи формулировки, которые практически дословно повторяют положения ст. 21, ст. 189, ст. 379, ст. 142 ТК РФ или других базовых обязанностей работника, закрепленных в законе.

2. РАСПЛЫВЧАТЫЕ ФОРМулировки
   — Формулировки, не позволяющие сотруднику понять границы своей функции: «выполнять иные поручения руководителя», «обеспечить эффективность работы», «принимать меры по улучшению», «участие в мероприятиях компании» и аналогичные.
   — Каждый такой пункт — потенциальный предмет трудового спора: работник не знает, что конкретно от него требуется, а работодатель может трактовать расширительно.
   — Ищи все пункты, где обязанность описана абстрактно, без конкретного результата, объёма, частоты или критерия оценки.

3. ПРОТИВОРЕЧИЯ ЗАКОНОДАТЕЛЬСТВУ
   — Пункты, прямо нарушающие ТК РФ или иные нормативные акты:
     - Штрафы как дисциплинарная мера (ст. 192 ТК РФ допускает только замечание, выговор, увольнение)
     - Ограничение оснований увольнения сверх ст. 81 ТК РФ
     - Изменение режима рабочего времени без соглашения (ст. 100, 101 ТК РФ)
     - Установление испытательного срока для беременных и лиц до 18 лет (ст. 70 ТК РФ)
     - Любые положения, ущемляющие права работника сверх закона
   — Для каждого такого пункта укажи конкретную статью ТК РФ или нормативного акта, которая нарушается.

4. ЗАВЫШЕННЫЕ / НЕРЕАЛИСТИЧНЫЕ ТРЕБОВАНИЯ
   — Требования, которые невозможно выполнить или которые несоразмерны должности:
     - «Нулевой процент брака», «100% выполнение плана» — недостижимые KPI
     - Квалификационные требования, не соответствующие грейду (например, «знание 5 языков» для линейной позиции)
     - Невыполнимые сроки («немедленное реагирование 24/7», «обработка всех запросов в течение 1 часа»)
     - Требования, не связанные с реальными функциями должности
   — Ищи все числовые/количественные показатели и требования, проверяй их реалистичность.

5. НЕПОЛНОТА ОБЯЗАТЕЛЬНЫХ РАЗДЕЛОВ
   — ДИ должна содержать минимум 5 обязательных разделов:
     1. Общие положения (кому подчиняется, порядок назначения и освобождения, квалификационные требования)
     2. Обязанности (конкретные, измеримые, без расплывчатых формулировок)
     3. Права (какие полномочия нужны для выполнения обязанностей)
     4. Ответственность (за что и в каких пределах, с указанием дисциплинарной, материальной, уголовной)
     5. Требования к квалификации (образование, опыт, знания, навыки — конкретные и соразмерные грейду)
   — Проверь наличие каждого раздела и его содержательность (не просто заголовок, но реальное содержание).
`

  // Type-specific focus
  const focusMap: Record<string, string> = {
    full: 'Анализируй ВСЕ 5 классов ошибок. Это полный аудит — проверь каждую категорию детально.',
    legal: 'ФОКУС на классах 1 (Дублирование ТК), 3 (Противоречия законодательству) и 5 (Неполнота разделов). Это юридический аудит — главное найти нарушения закона и дублирование норм ТК РФ.',
    consistency: 'ФОКУС на классах 2 (Расплывчатые формулировки) и 4 (Завышенные требования). Это аудит согласованности — главное найти неясные обязанности и нереалистичные показатели.',
  }

  // Загрузка правовой базы для аудита
  const legalRefs = await db.legalReference.findMany({
    where: { isActive: true, type: 'tk_rf' },
    select: { article: true, title: true, text: true, category: true },
  })
  const legalContext = buildLegalContext(legalRefs as LegalRefForContext[])

  const systemPrompt = `Ты — эксперт-юрист и HR-аналитик, специализирующийся на должностных инструкциях в Российской Федерации. Ты проводишь профессиональный аудит ДИ на основе правового ядра из 5 классов реальных ошибок, встречающихся в 80% инструкций.

ИНФОРМАЦИЯ О ДОЛЖНОСТИ:
${positionContext}
${legalContext ? `\n${legalContext}\n` : ''}
ПРАВИЛА:
- Анализируй каждое положение инструкции детально, применяя все 5 классов
- Приводи конкретные ссылки на статьи ТК РФ из правовой базы выше
- Сравнивай положения ДИ с текстами статей ТК РФ — находи дублирования и противоречия
- Для расплывчатых формулировок предлагай конкретную альтернативу
- Для завышенных требований предлагай реалистичный ориентир
- Для неполноты разделов описывай, что именно должно быть добавлено
- Ответ должен быть в формате JSON (строго)

${fiveClassesPrompt}

${focusMap[type]}`

  const userPrompt = `ТЕКСТ ДОЛЖНОСТНОЙ ИНСТРУКЦИИ:
${diText}

Важно: ответ должен быть строго в формате JSON со следующей структурой:
{
  "overallScore": число от 0 до 100,
  "categoryScores": {
    "duplicatedTk": число от 0 до 100,
    "vagueFormulations": число от 0 до 100,
    "legislativeConflicts": число от 0 до 100,
    "unrealisticRequirements": число от 0 до 100,
    "incompleteSections": число от 0 до 100
  },
  "duplicatedTkItems": [{"quote": "цитата из ДИ", "tkArticle": "статья ТК РФ (например, 'ст. 21 ТК РФ')", "tkText": "текст нормы ТК РФ которую дублирует", "explanation": "почему это дублирование — проблема", "recommendation": "рекомендация: удалить или заменить"}],
  "vagueFormulationItems": [{"quote": "расплывчатая формулировка из ДИ", "problemType": "тип проблемы (абстрактная обязанность / открытый перечень / неопределённый результат / неясный критерий)", "riskExplanation": "почему это создаёт риск трудового спора", "specificAlternative": "конкретная альтернативная формулировка"}],
  "legislativeConflictItems": [{"quote": "пункт из ДИ противоречащий закону", "violatedLaw": "конкретная статья/норма (например, 'ст. 192 ТК РФ')", "violationType": "тип нарушения (незаконный штраф / ограничение прав / незаконное условие / неправомерное требование)", "riskLevel": "высокий / средний / низкий", "explanation": "объяснение нарушения", "correctFormulation": "правильная формулировка по закону"}],
  "unrealisticRequirementItems": [{"quote": "завышенное/нереалистичное требование из ДИ", "requirementType": "тип (недостижимый KPI / квалификация вне грейда / невыполнимый срок / несоразмерное требование)", "currentValue": "текущее значение/формулировка", "realisticAlternative": "реалистичная альтернатива", "explanation": "почему это нереалистично"}],
  "incompleteSectionItems": [{"missingSection": "отсутствующий обязательный раздел (например, 'Обязанности' / 'Права' / 'Ответственность')", "requiredContent": "что должно содержаться в этом разделе", "currentState": "текущее состояние (отсутствует полностью / заголовок без содержания / содержание недостаточно)", "impactExplanation": "почему отсутствие этого раздела — проблема", "suggestedContent": "предлагаемое содержание раздела"}],
  "recommendations": [{"area": "область улучшения", "priority": "высокий/средний/низкий", "current": "текущее состояние", "suggested": "предлагаемое улучшение"}],
  "summary": "общее текстовое резюме аудита (2-3 предложения)"
}`

  const result = await client.generate({
    messages: [
      { role: 'system', content: renderedAuditPrompt ? `${systemPrompt}\n\nПРОМПТ АУДИТА:\n${renderedAuditPrompt}` : systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const aiResponse = result.content || ''

  // Безопасный парсинг JSON ответа ИИ (Фаза 1: json-safe.ts).
  const fallbackAudit = {
    overallScore: 50,
    categoryScores: { duplicatedTk: 50, vagueFormulations: 50, legislativeConflicts: 50, unrealisticRequirements: 50, incompleteSections: 50 },
    duplicatedTkItems: [],
    vagueFormulationItems: [],
    legislativeConflictItems: [],
    unrealisticRequirementItems: [],
    incompleteSectionItems: [],
    recommendations: [],
    summary: aiResponse,
  }
  const auditData = parseJsonOr<Record<string, unknown>>(aiResponse, fallbackAudit as unknown as Record<string, unknown>)

  // Compute legacy fields from new 5-class data for backward compatibility
  const legacyOutdated = [...((auditData.duplicatedTkItems as unknown[]) || [])]
  const legacyContradictory = [...((auditData.legislativeConflictItems as unknown[]) || []), ...((auditData.vagueFormulationItems as unknown[]) || [])]
  const legacyRisky = [...((auditData.legislativeConflictItems as unknown[]) || []), ...((auditData.unrealisticRequirementItems as unknown[]) || [])]

  // Save audit result to database
  const auditResult = await db.dIAuditResult.create({
    data: {
      generatedDIId,
      auditType: type,
      overallScore: Number(auditData.overallScore) || 0,
      duplicatedTkItems: JSON.stringify(auditData.duplicatedTkItems || []),
      vagueFormulationItems: JSON.stringify(auditData.vagueFormulationItems || []),
      legislativeConflictItems: JSON.stringify(auditData.legislativeConflictItems || []),
      unrealisticRequirementItems: JSON.stringify(auditData.unrealisticRequirementItems || []),
      incompleteSectionItems: JSON.stringify(auditData.incompleteSectionItems || []),
      outdatedItems: JSON.stringify(legacyOutdated),
      contradictoryItems: JSON.stringify(legacyContradictory),
      riskyItems: JSON.stringify(legacyRisky),
      recommendations: JSON.stringify(auditData.recommendations || []),
      summary: (auditData.summary as string) || null,
      auditedBy: 'ai-system',
    },
  })

  log.info('Audit completed', { generatedDIId, score: auditResult.overallScore })

  return NextResponse.json({
    ...auditResult,
    categoryScores: auditData.categoryScores || { duplicatedTk: 50, vagueFormulations: 50, legislativeConflicts: 50, unrealisticRequirements: 50, incompleteSections: 50 },
    duplicatedTkItems: JSON.parse(auditResult.duplicatedTkItems),
    vagueFormulationItems: JSON.parse(auditResult.vagueFormulationItems),
    legislativeConflictItems: JSON.parse(auditResult.legislativeConflictItems),
    unrealisticRequirementItems: JSON.parse(auditResult.unrealisticRequirementItems),
    incompleteSectionItems: JSON.parse(auditResult.incompleteSectionItems),
    outdatedItems: JSON.parse(auditResult.outdatedItems),
    contradictoryItems: JSON.parse(auditResult.contradictoryItems),
    riskyItems: JSON.parse(auditResult.riskyItems),
    recommendations: JSON.parse(auditResult.recommendations),
  })
}, 'generate-di/ai-audit')

// GET /api/generate-di/ai-audit - List audit results for a DI
export async function GET(request: Request) {
  try {
  await requireAuth()
  checkRateLimit(request, 'ai-audit', 20)
    const { searchParams } = new URL(request.url)
    const generatedDIId = searchParams.get('generatedDIId')

    if (!generatedDIId) {
      return NextResponse.json({ error: 'ID ДИ обязателен' }, { status: 400 })
    }

    const auditResults = await db.dIAuditResult.findMany({
      where: { generatedDIId },
      orderBy: { createdAt: 'desc' },
    })

    // Parse JSON fields for each result (safe against null/invalid legacy data)
    const safeParse = (s: string | null): unknown => { try { return JSON.parse(s ?? '[]') } catch { return [] } }
    const parsed = auditResults.map((r) => ({
      ...r,
      duplicatedTkItems: safeParse(r.duplicatedTkItems),
      vagueFormulationItems: safeParse(r.vagueFormulationItems),
      legislativeConflictItems: safeParse(r.legislativeConflictItems),
      unrealisticRequirementItems: safeParse(r.unrealisticRequirementItems),
      incompleteSectionItems: safeParse(r.incompleteSectionItems),
      outdatedItems: safeParse(r.outdatedItems),
      contradictoryItems: safeParse(r.contradictoryItems),
      riskyItems: safeParse(r.riskyItems),
      recommendations: safeParse(r.recommendations),
    }))

    return NextResponse.json(parsed)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('Audit GET error', { message: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Ошибка загрузки результатов аудита' }, { status: 500 })
  }
}
