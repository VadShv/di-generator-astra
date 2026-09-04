import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveMasterPromptWithDetails,
  renderPrompt,
  buildContextFromPosition,
  type PromptCategory,
} from '@/lib/master-prompt'
import { getProviderClient, getZaiFallbackClient } from '@/lib/ai-connector/ai-provider-factory'
import type { GenerateRequest, ChatMessage } from '@/lib/ai-connector/types'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/rate-limit'
import { ApiError, errorResponse, parseBody } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

import { runPromptChainSchema } from '@/lib/validation/schemas'

const log = createLogger('prompt-chains-run')

// POST /api/prompt-chains/run — запуск цепочки промптов с прогрессом.
// Тело: { chainId, positionId?, providerId?, variables?: Record<string,string> }
// Выполняет шаги цепочки последовательно: generation → improvement → audit.
// Каждый шаг резолвит свой промпт по категории и критериям, передавая результат
// предыдущего шага как контекст. Возвращает массив результатов по шагам.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    checkRateLimit(request, 'prompt-chain-run', 5, 60_000, session?.user?.id)
    const body = await parseBody(request, runPromptChainSchema)
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
    if (steps.length > 20) {
      return NextResponse.json({ error: 'Слишком много шагов в цепочке (максимум 20)' }, { status: 400 })
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
    let resolvedProviderId: string | null = null
    try {
      client = providerId ? await getProviderClient(providerId) : await getProviderClient()
      resolvedProviderId = providerId || null
    } catch {
      client = getZaiFallbackClient()
      resolvedProviderId = null
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

      // Резолвим промпт через единый scoring-алгоритм.
      const resolvedResult = await resolveMasterPromptWithDetails(category, resolveCriteria)

      if (!resolvedResult) {
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

      const resolved = resolvedResult.prompt
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

      const STEP_TIMEOUT_MS = 120_000 // 2 min per step
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS)
      const generateRequest: GenerateRequest = { messages, signal: controller.signal, timeoutMs: STEP_TIMEOUT_MS }

      const startTime = Date.now()
      try {
        const response = await client.generate(generateRequest)
        clearTimeout(timer)
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
        clearTimeout(timer)
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

    // Сохраняем результат запуска цепочки в БД для истории (Фаза 3).
    let runResultId: string | null = null
    try {
      const saved = await db.promptChainRunResult.create({
        data: {
          chainId: chain.id,
          positionId: positionId || null,
          providerId: resolvedProviderId,
          totalSteps: steps.length,
          completedSteps: results.filter(r => !r.error).length,
          results: JSON.stringify(results),
          finalOutput: previousOutput || null,
        },
      })
      runResultId = saved.id
    } catch (saveErr) {
      log.error('Failed to save chain run result:', { error: saveErr })
    }

    return NextResponse.json({
      chainId: chain.id,
      chainName: chain.name,
      totalSteps: steps.length,
      completedSteps: results.length,
      results,
      finalOutput: previousOutput,
      runResultId,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PromptChains run error:', { error })
    return errorResponse(error, log, 'prompt-chains/run')
  }
}
