// Fallback-провайдер на базе встроенного z-ai-web-dev-sdk (Фаза 2 + Фаза 4)
// Используется, когда в БД нет настроенного AIProvider или выбран тип 'zai'.
// Сохраняет обратную совместимость с существующими ИИ-роутами.
// ВАЖНО: исправляет баг старых роутов — role: 'assistant' для system-сообщения
// заменено на корректную роль 'system'.
// Фаза 4: вызов SDK обёрнут в withRetry для устойчивости к сбоям.

import type {
  AIProviderClient,
  AIProviderConfig,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResult,
} from '../types'
import { AIProviderError } from '../errors'
import { withRetry } from '../retry'

// Тип модуля z-ai-web-dev-sdk (упрощённое описание нужного API).
interface ZAICompletion {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

interface ZAIClient {
  chat: {
    completions: {
      create: (opts: {
        messages: { role: string; content: string }[]
        thinking?: { type: string }
      }) => Promise<ZAICompletion>
    }
  }
}

interface ZAIModule {
  create: () => Promise<ZAIClient>
}

export class ZaiProvider implements AIProviderClient {
  readonly name: string
  readonly type = 'zai' as const
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.name = config.name
    this.config = config
  }

  private async getZai(): Promise<ZAIClient> {
    // Динамический импорт, чтобы не падать, если пакет недоступен.
    // z-ai-web-dev-sdk экспортирует только default (класс ZAI со статическим create()).
    // Turbopack/Next может оборачивать модуль, поэтому поддерживаем оба варианта:
    //   - ESM default: imported.default.create()
    //   - CJS-интероп: imported.create()
    const imported = (await import('z-ai-web-dev-sdk')) as unknown as {
      create?: () => Promise<ZAIClient>
      default?: { create?: () => Promise<ZAIClient> }
    }
    const ZAI = imported.default ?? (imported as unknown as ZAIModule)
    if (typeof ZAI.create !== 'function') {
      throw new AIProviderError(
        'z-ai-web-dev-sdk: create() недоступен. Проверьте установку пакета и .z-ai-config.',
        'bad_request',
        undefined,
        false
      )
    }
    return ZAI.create()
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Создаём клиент один раз; retry применяется только к вызову completion.
    const zai = await this.getZai()

    const completion = await withRetry(async () => {
      // z-ai-web-dev-sdk использует свою сигнатуру. thinking отключаем для скорости.
      // Используем корректную роль 'system' (раньше в коде был баг с 'assistant').
      return zai.chat.completions.create({
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        thinking: { type: 'disabled' },
      })
    })

    const content = completion.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new AIProviderError('z-ai-web-dev-sdk: пустой ответ', 'empty_response', undefined, false)
    }
    return {
      content: content.trim(),
      raw: completion,
      providerName: this.name,
      modelName: this.config.modelName || 'zai-default',
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      const response = await this.generate({
        messages: [
          { role: 'system', content: 'Ты — тестовый помощник. Ответь одной фразой.' },
          { role: 'user', content: 'Ответь: "Соединение установлено"' },
        ],
        maxTokens: 32,
        temperature: 0,
        timeoutMs: 30000,
      })
      return {
        ok: true,
        message: 'Соединение установлено (z-ai-web-dev-sdk)',
        latencyMs: Date.now() - start,
        sampleResponse: response.content,
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      }
    }
  }
}
