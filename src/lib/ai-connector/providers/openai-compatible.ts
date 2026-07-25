// Универсальный OpenAI-совместимый провайдер ИИ (Фаза 2)
// Покрывает: OpenAI, Klad.ru, Ollama, vLLM, LiteLLM и любые API,
// реализующие стандартный формат /v1/chat/completions.

import type {
  AIProviderClient,
  AIProviderConfig,
  AIProviderType,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResult,
  ChatMessage,
} from '../types'

/**
 * Нормализует baseUrl: убирает trailing slash и суффиксы /chat/completions,
 * чтобы корректно склеить путь. Для zai/Ollama без /v1 — добавляем.
 */
function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '')
  // Убираем суффиксы путей, если пользователь вставил полный endpoint.
  url = url.replace(/\/v1\/chat\/completions\/?$/i, '')
  url = url.replace(/\/chat\/completions\/?$/i, '')
  url = url.replace(/\/v1\/?$/i, '')
  return url
}

/** Склеивает baseUrl с /v1/chat/completions. */
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

export class OpenAICompatibleProvider implements AIProviderClient {
  readonly name: string
  readonly type: AIProviderType
  protected config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.name = config.name
    this.config = config
    this.type = config.type
  }

  protected get endpoint(): string {
    if (!this.config.baseUrl) {
      throw new Error(`Провайдер "${this.name}" не имеет baseUrl`)
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

  protected async doFetch(body: Record<string, unknown>, timeoutMs: number): Promise<OpenAIResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await res.text()
      if (!res.ok) {
        // Пытаемся распарсить ошибку в формате OpenAI, иначе отдаём сырой текст.
        let detail = text
        try {
          const parsed = JSON.parse(text) as OpenAIResponse
          if (parsed.error?.message) detail = parsed.error.message
        } catch {
          // оставляем сырой текст
        }
        throw new Error(`HTTP ${res.status}: ${detail}`)
      }
      return JSON.parse(text) as OpenAIResponse
    } finally {
      clearTimeout(timer)
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const timeoutMs = request.timeoutMs ?? this.config.config.timeoutMs ?? 60000
    const data = await this.doFetch(this.buildBody(request), timeoutMs)

    const content = data.choices?.[0]?.message?.content ?? ''
    if (!content) {
      throw new Error('Пустой ответ от модели (нет content в choices[0])')
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
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      }
    }
  }
}

/** Специализация для Ollama (OpenAI-совместимый endpoint /v1/chat/completions, ключ не нужен). */
export class OllamaProvider extends OpenAICompatibleProvider {}

/** Специализация для Klad.ru (OpenAI-совместимый, ключ обязателен). */
export class KladProvider extends OpenAICompatibleProvider {}
