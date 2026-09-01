// Fallback-провайдер на базе встроенного z-ai-web-dev-sdk (Фаза 2 + Фаза 4 + Фаза 6)
// Используется, когда в БД нет настроенного AIProvider или выбран тип 'zai'.
// Сохраняет обратную совместимость с существующими ИИ-роутами.
// ВАЖНО: исправляет баг старых роутов — role: 'assistant' для system-сообщения
// заменено на корректную роль 'system'.
// Фаза 4: вызов SDK обёрнут в withRetry для устойчивости к сбоям.
// Фаза 6, шаг 6.6: добавлен таймаут через Promise.race + AbortController,
// чтобы зависание SDK не блокировало воркер массовой генерации.

import type {
  AIProviderClient,
  AIProviderConfig,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResult,
} from '../types'
import { AIProviderError } from '../errors'
import { withRetry } from '../retry'
import { sanitizeProviderMessage } from '../errors'
import { createLogger } from '../../logger'

const log = createLogger('zai-provider')

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

const ZAI_DEFAULT_TIMEOUT_MS = 60_000

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

  /**
   * Обернуть промис в таймаут через Promise.race.
   * Если SDK не отвечает за timeoutMs — бросаем AIProviderError('timeout').
   * @param signal внешний сигнал отмены (от job-level AbortController).
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AIProviderError(`Таймаут запроса (${timeoutMs}мс)`, 'timeout', undefined, false))
      }, timeoutMs)

      // Пробрасываем внешний сигнал отмены (job-level abort).
      const onAbort = () => {
        clearTimeout(timer)
        reject(new AIProviderError('Запрос отменён', 'timeout', undefined, false))
      }
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer)
          reject(new AIProviderError('Запрос отменён', 'timeout', undefined, false))
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }

      promise
        .then((result) => {
          clearTimeout(timer)
          if (signal) signal.removeEventListener('abort', onAbort)
          resolve(result)
        })
        .catch((err) => {
          clearTimeout(timer)
          if (signal) signal.removeEventListener('abort', onAbort)
          reject(err)
        })
    })
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    // Создаём клиент один раз; retry применяется только к вызову completion.
    const zai = await this.getZai()

    // Таймаут: из запроса, из конфига, или дефолт 60 сек.
    const timeoutMs = request.timeoutMs ?? this.config.config.timeoutMs ?? ZAI_DEFAULT_TIMEOUT_MS

    const completion = await withRetry(async () => {
      // z-ai-web-dev-sdk использует свою сигнатуру. thinking отключаем для скорости.
      // Используем корректную роль 'system' (раньше в коде был баг с 'assistant').
      const promise = zai.chat.completions.create({
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        thinking: { type: 'disabled' },
      })
      // Оборачиваем в таймаут — SDK может не поддерживать signal напрямую,
      // поэтому используем Promise.race (см. withTimeout).
      return this.withTimeout(promise, timeoutMs, request.signal)
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
      if (e instanceof AIProviderError) {
        log.error('testConnection failed', {
          code: e.code,
          status: e.status,
          retryable: e.retryable,
          detail: e.message,
        })
      } else {
        log.error('testConnection failed', {
          detail: e instanceof Error ? e.message : String(e),
        })
      }
     return {
       ok: false,
        message:
          e instanceof AIProviderError
            ? e.code === 'auth'
              ? 'Неверный API-ключ. Проверьте ключ в настройках провайдера.'
              : sanitizeProviderMessage(e.code)
            : 'Не удалось подключиться к провайдеру',
       latencyMs: Date.now() - start,
     }
    }
  }
}
