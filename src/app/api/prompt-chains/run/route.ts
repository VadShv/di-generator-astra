import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveMasterPrompt,
  renderPrompt,
  buildContextFromPosition,
  type PromptCategory,
} from '@/lib/master-prompt'
import { getProviderClient, getZaiFallbackClient } from '@/lib/ai-connector/ai-provider-factory'
import type { GenerateRequest, ChatMessage } from '@/lib/ai-connector/types'
import { requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'

// POST /api/prompt-chains/run — запуск цепочки промптов с прогрессом.
// Тело: { chainId, positionId?, providerId?, variables?: Record<string,string> }
// Выполняет шаги цепочки последовательно: generation → improvement → audit.
// Каждый шаг резолвит свой промпт по категории и критериям, передавая результат
// предыдущего шага как контекст. Возвращает массив результатов по шагам.
export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()
    const { chainId, positionId, providerId, variables } = body

    if (!chainId || typeof chainId !== 'string') {
      return NextResponse.json({ error: 'ID цепочки обязателен' }, { status: 400 })
    }

    const chain = await db.promptChain.findUnique({ where: { id: chainId } })
    if (!chain) {
      return NextResponse.json({ error: 'Цепочка не найдена' }, { status: 404 })
    }

    // Парсим шаги цепочки.
    let steps: Array<{ category: string; order: number; stopOnError?: boolean }> = []
    try {
      const parsed = JSON.parse(chain.steps)
      if (Array.isArray(parsed)) steps = parsed.sort((a, b) => (a.order || 0) - (b.order || 0))
    } catch {
      steps = []
    }

    if (steps.length === 0) {
      return NextResponse.json({ error: 'Цепочка не содержит шагов' }, { status: 400 })
    }

    // Строим контекст переменных из позиции.
    let positionContext: Record<string, unknown> = {}
    let resolveCriteria: {
      positionId?: string | null
      companyId?: string | null
      departmentId?: string | null
      businessFunctionId?: string | null
      grade?: string | null
      functionType?: string | null
    } = { positionId: positionId || null }

    if (positionId) {
      const position = await db.position.findUnique({
        where: { id: positionId },
        include: {
          department: { include: { company: true } },
          businessFunction: true,
        },
      })
      if (position) {
        positionContext = buildContextFromPosition(position)
        resolveCriteria = {
          positionId: position.id,
          companyId: position.department?.companyId || null,
          departmentId: position.departmentId,
          businessFunctionId: position.businessFunctionId,
          grade: position.grade,
          functionType: position.functions,
        }
      }
    }
    if (variables && typeof variables === 'object') {
      for (const [key, value] of Object.entries(variables)) {
        positionContext[key] = value
      }
    }

    // Получаем клиент ИИ.
    let client
    try {
      client = providerId ? await getProviderClient(providerId) : await getProviderClient()
    } catch {
      client = getZaiFallbackClient()
    }

    // Выполняем шаги последовательно, накапливая результат.
    const results: Array<{
      step: number
      category: string
      promptId: string | null
      promptName: string | null
      content: string
      durationMs: number
      error: string | null
    }> = []

    let previousOutput = ''

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const category = (step.category || 'generation') as PromptCategory

      // Резолвим промпт для текущей категории и критериев.
      const resolved = await resolveMasterPrompt(category, resolveCriteria)

      if (!resolved) {
        const errorMsg = `Не найден активный промпт категории "${category}"`
        results.push({
          step: i + 1,
          category,
          promptId: null,
          promptName: null,
          content: '',
          durationMs: 0,
          error: errorMsg,
        })
        if (step.stopOnError !== false) {
          break
        }
        continue
      }

      // Рендерим промпт с подстановкой переменных + результата предыдущего шага.
      const fullContext = { ...positionContext, предыдущий_результат: previousOutput || null }
      const renderedPrompt = renderPrompt(resolved.content, fullContext)

      const messages: ChatMessage[] = [
        { role: 'system', content: renderedPrompt },
        {
          role: 'user',
          content: previousOutput
            ? `Результат предыдущего шага:\n\n${previousOutput}\n\nВыполни инструкции промпта для этого текста.`
            : 'Выполни инструкции промпта.',
        },
      ]

      const generateRequest: GenerateRequest = { messages }

      const startTime = Date.now()
      try {
        const response = await client.generate(generateRequest)
        const durationMs = Date.now() - startTime

        previousOutput = response.content

        results.push({
          step: i + 1,
          category,
          promptId: resolved.id,
          promptName: resolved.name,
          content: response.content,
          durationMs,
          error: null,
        })
      } catch (genError) {
        const durationMs = Date.now() - startTime
        const errorMsg = genError instanceof Error ? genError.message : 'Ошибка генерации'
        results.push({
          step: i + 1,
          category,
          promptId: resolved.id,
          promptName: resolved.name,
          content: '',
          durationMs,
          error: errorMsg,
        })
        if (step.stopOnError !== false) {
          break
        }
      }
    }

    return NextResponse.json({
      chainId: chain.id,
      chainName: chain.name,
      totalSteps: steps.length,
      completedSteps: results.length,
      results,
      finalOutput: previousOutput,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    console.error('PromptChains run error:', error)
    const message = error instanceof Error ? error.message : 'Ошибка запуска цепочки промптов'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
