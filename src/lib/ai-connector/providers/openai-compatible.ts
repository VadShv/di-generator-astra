// Универсальный OpenAI-совместимый провайдер ИИ (Фаза 2 + Фаза 4).
// Покрывает: OpenAI, Cloud.ru, Ollama, vLLM, LiteLLM и любые API,
// реализующие стандартный формат /v1/chat/completions.
// Фаза 4: добавлены retry с экспоненциальным backoff, rate-limit (семафор),
// структурированные ошибки AIProviderError.

import type {
  AIProviderClient,
  AIProviderConfig,
  AIProviderType,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResult,
} from '../types'
import { classifyError, isRetryable, AIProviderError } from '../errors'
import { Semaphore, getProviderSemaphore } from '../semaphore'
import { validateProviderUrlSync, validateProviderUrl } from '../url-validator'
import { createLogger } from '../../logger'
import { sanitizeProviderMessage } from '../errors'

const log = createLogger('openai-provider')

/** Конфигурация retry. */
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const BACKOFF_MULTIPLIER = 2
const BACKOFF_MAX_MS = 8000

/** Нормализует baseUrl. */
function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '')
  url = url.replace(/\/v1\/chat\/completions\/?$/i, '')
  url = url.replace(/\/chat\/completions\/?$/i, '')
  url = url.replace(/\/v1\/?$/i, '')
  return url
}

function buildEndpoint(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/chat/completions`
}

interface OpenAIChoice {
  message?: { role?: string; content?: string }
  finish_reason?: string
}
interface OpenAIUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}
interface OpenAIResponse {
  id?: string
  choices?: OpenAIChoice[]
  usage?: OpenAIUsage
  error?: { message?: string; type?: string; code?: string }
}

/** Сон на N мс. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class OpenAICompatibleProvider implements AIProviderClient {
  readonly name: string
  readonly type: AIProviderType
  protected config: AIProviderConfig
  private readonly semaphore: Semaphore

  constructor(config: AIProviderConfig) {
    this.name = config.name
    this.config = config
    this.type = config.type
    // Глобальный семафор по id провайдера: все job'ы с одним провайдером
    // разделяют общий лимит конкурентности (защита от DoS провайдера).
    this.semaphore = getProviderSemaphore(config.id)
    // SSRF-защита: валидация baseUrl при создании провайдера.
    if (this.config.baseUrl) {
      validateProviderUrlSync(this.config.baseUrl)
    }
  }

  protected get endpoint(): string {
    if (!this.config.baseUrl) {
      throw new AIProviderError(`Провайдер "${this.name}" не имеет baseUrl`, 'bad_request')
    }
    return buildEndpoint(this.config.baseUrl)
  }

  protected get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    return headers
  }

  protected buildBody(request: GenerateRequest): Record<string, unknown> {
    return {
      model: this.config.modelName,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? this.config.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.config.maxTokens ?? 2048,
      ...(this.config.config.topP ? { top_p: this.config.config.topP } : {}),
      ...(this.config.config.n ? { n: this.config.config.n } : {}),
    }
  }

  /**
   * Выполнить HTTP-запрос с retry и экспоненциальным backoff.
   * Ретраит только ретряемые ошибки (timeout, 429, 5xx, network).
   * @param externalSignal — сигнал отмены от per-job таймаута массовой генерации.
   */
 protected async doFetch(
   body: Record<string, unknown>,
   timeoutMs: number,
   externalSignal?: AbortSignal
 ): Promise<OpenAIResponse> {
   return this.semaphore.run(async () => {
     // Если внешний сигнал уже абортирован — выходим сразу.
     if (externalSignal?.aborted) {
       throw new AIProviderError('Запрос отменён до начала (job timeout)', 'timeout', undefined, false)
     }
     // SSRF-защита: полная async-валидация URL с DNS-резолвом перед каждым
     // запросом. Защищает от DNS-rebinding (TOCTOU): домен, прошедший проверку
     // при создании провайдера, мог начать резолвиться в приватный IP.
     if (this.config.baseUrl) {
       await validateProviderUrl(this.config.baseUrl)
     }
     let lastError: unknown = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        // Связываем внешний сигнал отмены с локальным контроллером:
        // при abort внешнего сигнала прерываем текущий fetch.
        const onExternalAbort = () => controller.abort()
        externalSignal?.addEventListener('abort', onExternalAbort, { once: true })
        try {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body),
            signal: controller.signal,
            // SSRF-защита: не следовать редиректам автоматически.
            redirect: 'manual',
          })
          // Блокируем редиректы: провайдер не должен перенаправлять запрос
          // (включая возможный редирект на внутренние адреса).
          if (res.status >= 300 && res.status < 400) {
            throw new AIProviderError(
              `Провайдер вернул редирект (статус ${res.status}). Редиректы запрещены в целях безопасности.`,
              'bad_request',
              res.status,
              false
            )
          }
          const text = await res.text()
          if (!res.ok) {
            let detail = text
            try {
              const parsed = JSON.parse(text) as OpenAIResponse
              if (parsed.error?.message) detail = parsed.error.message
            } catch {
              // оставляем сырой текст
            }
            const code = classifyError(res.status)
            if (isRetryable(code) && attempt < MAX_RETRIES) {
              lastError = new AIProviderError(`HTTP ${res.status}: ${detail}`, code, res.status, true)
              await sleep(Math.min(INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** attempt, BACKOFF_MAX_MS))
              continue
            }
            throw new AIProviderError(`HTTP ${res.status}: ${detail}`, code, res.status, false)
          }
          return JSON.parse(text) as OpenAIResponse
        } catch (e) {
          clearTimeout(timer)
          const isAbort = e instanceof Error && e.name === 'AbortError'
          const isNetwork = e instanceof TypeError // fetch бросает TypeError на сетевых сбоях
          if (e instanceof AIProviderError && !e.retryable) throw e
          const code = classifyError(undefined, isAbort, isNetwork)
          if (isRetryable(code) && attempt < MAX_RETRIES) {
            lastError = new AIProviderError(
              isAbort ? `Таймаут запроса (${timeoutMs}мс)` : e instanceof Error ? e.message : String(e),
              code,
              undefined,
              true
            )
            await sleep(Math.min(INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** attempt, BACKOFF_MAX_MS))
            continue
          }
          if (isAbort) {
            throw new AIProviderError(`Таймаут запроса (${timeoutMs}мс)`, 'timeout', undefined, false)
          }
          if (isNetwork) {
            throw new AIProviderError(
              e instanceof Error ? `Сетевая ошибка: ${e.message}` : 'Сетевая ошибка',
              'network',
              undefined,
              false
            )
          }
          throw e
        } finally {
          clearTimeout(timer)
          externalSignal?.removeEventListener('abort', onExternalAbort)
        }
      }
      // Исчерпаны попытки.
      if (lastError instanceof AIProviderError) throw lastError
      throw new AIProviderError('Не удалось выполнить запрос после всех попыток', 'unknown', undefined, false)
    })
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const timeoutMs = request.timeoutMs ?? this.config.config.timeoutMs ?? 60000
    const data = await this.doFetch(this.buildBody(request), timeoutMs, request.signal)

    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new AIProviderError('Пустой ответ от модели (нет content в choices[0])', 'empty_response', undefined, false)
    }

    return {
      content: content.trim(),
      raw: data,
      providerName: this.name,
      modelName: this.config.modelName,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
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
        timeoutMs: 15000,
      })
      return {
        ok: true,
        message: 'Соединение установлено',
        latencyMs: Date.now() - start,
        sampleResponse: response.content,
      }
    } catch (e) {
      // Санитизация: детали ошибки провайдера (URL, тело ответа) — только в логи,
      // клиенту возвращаем generic-сообщение.
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
            ? sanitizeProviderMessage(e.code)
            : 'Не удалось подключиться к провайдеру',
        latencyMs: Date.now() - start,
      }
    }
  }
}

/** Специализация для Ollama (OpenAI-совместимый endpoint, ключ не нужен). */
export class OllamaProvider extends OpenAICompatibleProvider {}

/** Специализация для Cloud.ru (OpenAI-совместимый, ключ обязателен). */
export class CloudRuProvider extends OpenAICompatibleProvider {}

/** @deprecated Алиас для обратной совместимости — используйте CloudRuProvider. */
export const KladProvider = CloudRuProvider
