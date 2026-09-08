import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAICompatibleProvider } from './openai-compatible'
import type { AIProviderConfig } from '../types'

// Тестовый подкласс: открывает доступ к protected buildBody для проверки тела запроса.
class TestableProvider extends OpenAICompatibleProvider {
  public buildBodyPublic(request: Parameters<OpenAICompatibleProvider['generate']>[0]) {
    return this.buildBody(request)
  }
}

function makeConfig(overrides: Partial<AIProviderConfig> = {}): AIProviderConfig {
  return {
    id: 'test-id',
    name: 'Test',
    type: 'openai_compatible',
    baseUrl: 'https://example.com/v1',
    apiKey: 'k',
    modelName: 'gpt-4o',
    folderId: null,
    config: { temperature: 0.7, maxTokens: 2048, timeoutMs: 60000 },
    ...overrides,
  }
}

const req = { messages: [{ role: 'user' as const, content: 'hi' }] }

describe('OpenAICompatibleProvider.buildBody — reasoning/thinking', () => {
  it('НЕ отключает thinking для обычной модели (gpt-4o)', () => {
    const p = new TestableProvider(makeConfig({ modelName: 'gpt-4o' }))
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toBeUndefined()
    expect(body.chat_template_kwargs).toBeUndefined()
  })

  it('по умолчанию отключает thinking для GLM-5.2 (reasoning-модель)', () => {
    const p = new TestableProvider(makeConfig({ modelName: 'zai-org/GLM-5.2' }))
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  it('отключает thinking для GLM/QwQ/DeepSeek/thinking-моделей', () => {
    for (const model of ['GLM-4.6', 'zai-org/GLM-6', 'deepseek-r1', 'QwQ-32B', 'qwen3-thinking']) {
      const p = new TestableProvider(makeConfig({ modelName: model }))
      const body = p.buildBodyPublic(req)
      expect(body.thinking, `${model} должна отключать thinking`).toEqual({ type: 'disabled' })
      expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
    }
  })

  it('НЕ отправляет thinking/chat_template_kwargs для OpenAI o-серии (строгий API)', () => {
    for (const model of ['o1', 'o3-mini', 'o4-mini']) {
      const p = new TestableProvider(makeConfig({ modelName: model }))
      const body = p.buildBodyPublic(req)
      expect(body.thinking, `${model} не должна слать thinking`).toBeUndefined()
      expect(body.chat_template_kwargs, `${model} не должна слать chat_template_kwargs`).toBeUndefined()
    }
  })

  it('для o-серии с reasoningEffort шлёт reasoning_effort, а не thinking', () => {
    const p = new TestableProvider(
      makeConfig({ modelName: 'o3-mini', config: { reasoningEffort: 'low' } })
    )
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toBeUndefined()
    expect(body.reasoning_effort).toBe('low')
  })

  it('НЕ ложно срабатывает на имена вида llama-o2-custom', () => {
    const p = new TestableProvider(makeConfig({ modelName: 'llama-o2-custom' }))
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toBeUndefined()
    expect(body.chat_template_kwargs).toBeUndefined()
    expect(body.reasoning_effort).toBeUndefined()
  })

  it('config.disableThinking=false переопределяет эвристику для reasoning-модели', () => {
    const p = new TestableProvider(
      makeConfig({ modelName: 'GLM-5.2', config: { disableThinking: false } })
    )
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toBeUndefined()
    expect(body.chat_template_kwargs).toBeUndefined()
  })

  it('config.disableThinking=true включает отключение для обычной модели', () => {
    const p = new TestableProvider(
      makeConfig({ modelName: 'gpt-4o', config: { disableThinking: true } })
    )
    const body = p.buildBodyPublic(req)
    expect(body.thinking).toEqual({ type: 'disabled' })
  })

  it('reasoningEffort добавляется, когда thinking не отключён', () => {
    const p = new TestableProvider(
      makeConfig({ modelName: 'gpt-4o', config: { reasoningEffort: 'low' } })
    )
    const body = p.buildBodyPublic(req)
    expect(body.reasoning_effort).toBe('low')
  })
})

describe('OpenAICompatibleProvider.generate — fallback на reasoning_content', () => {
  const origFetch = globalThis.fetch

  beforeEach(() => {
    // Отключаем реальную сетевую валидацию URL/DNS через мок fetch.
  })
  afterEach(() => {
    globalThis.fetch = origFetch
    vi.restoreAllMocks()
  })

  function mockResponse(body: unknown) {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch
  }

  it('использует reasoning_content, если content пуст И finish_reason=length', async () => {
    const p = new OpenAICompatibleProvider(
      makeConfig({ baseUrl: 'https://example.com/v1', modelName: 'gpt-4o' })
    )
    mockResponse({
      choices: [
        {
          message: { role: 'assistant', content: '', reasoning_content: 'РАЗМЫШЛЕНИЕ' },
          finish_reason: 'length',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    })

    const res = await p.generate({ messages: [{ role: 'user', content: 'hi' }], timeoutMs: 5000 })
    expect(res.content).toBe('РАЗМЫШЛЕНИЕ')
  })

  it('НЕ использует reasoning_content при finish_reason=stop (бросает empty_response)', async () => {
    const p = new OpenAICompatibleProvider(
      makeConfig({ baseUrl: 'https://example.com/v1', modelName: 'gpt-4o' })
    )
    mockResponse({
      choices: [
        {
          message: { role: 'assistant', content: '', reasoning_content: 'ЧЕРНОВИК' },
          finish_reason: 'stop',
        },
      ],
    })

    await expect(
      p.generate({ messages: [{ role: 'user', content: 'hi' }], timeoutMs: 5000 })
    ).rejects.toThrow(/Пустой ответ/)
  })
})
