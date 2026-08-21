// Специализированный провайдер Yandex Cloud YandexGPT (Фаза 2 + Фаза 4)
// Документация: https://cloud.yandex.ru/docs/yandexgpt/api-ref/TextGeneration/
// Endpoint: https://llm.api.cloud.yandex.net/foundationModels/v1/completion
// Особенности:
//   - Авторизация: OAuth-токен обменивается на IAM-токен (с кэшированием)
//   - folder_id обязателен и передаётся в теле запроса
//   - Формат сообщений отличается от OpenAI (нет system-роли — используется systemMessage)
// Фаза 4: добавлен retry с экспоненциальным backoff для запроса completion.

import type {
  AIProviderClient,
  AIProviderConfig,
  GenerateRequest,
  GenerateResponse,
  TestConnectionResult,
  ChatMessage,
} from '../types'
import { AIProviderError, classifyError, isRetryable } from '../errors'
import { withRetry } from '../retry'

const YANDEX_ENDPOINT =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
const YANDEX_IAM_URL = 'https://iam.api.cloud.yandex.net/iam/v1/tokens'

interface IAMTokenCache {
  token: string
  expiresAt: number // timestamp в мс
}

// Кэш IAM-токенов по apiKey (OAuth), чтобы не запрашивать каждый раз.
// IAM-токен живёт 12 часов, обновляем за 5 минут до истечения.
const iamCache = new Map<string, IAMTokenCache>()

interface YandexAlternative {
  message?: { role?: string; text?: string }
}
interface YandexResult {
  alternatives?: YandexAlternative[]
  usage?: {
    inputTextTokens?: string
    completionTokens?: string
    totalTokens?: string
  }
  error?: { message?: string; code?: number }
}

export class YandexCloudProvider implements AIProviderClient {
  readonly name: string
  readonly type = 'yandex_cloud' as const
  private config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.name = config.name
    this.config = config
  }

  /** Получить IAM-токен из OAuth-токена (apiKey), с кэшированием. */
  private async getIamToken(): Promise<string> {
    const oauthToken = this.config.apiKey
    if (!oauthToken) {
      throw new AIProviderError('Yandex Cloud: OAuth-токен не задан (поле apiKey)', 'auth', undefined, false)
    }
    if (!this.config.folderId) {
      throw new AIProviderError('Yandex Cloud: folder_id не задан', 'bad_request', undefined, false)
    }

    const cached = iamCache.get(oauthToken)
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.token
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(YANDEX_IAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yandexPassportOauthToken: oauthToken }),
        signal: controller.signal,
      })
      const data = (await res.json()) as { iamToken?: string; expiresAt?: string; error?: string }
      if (!res.ok || !data.iamToken) {
        throw new AIProviderError(
          `Yandex IAM: ${res.status} ${data.error || 'не удалось получить IAM-токен'}`,
          classifyError(res.status),
          res.status,
          false
        )
      }
      // expiresAt приходит в RFC3339. Парсим; если не вышло — ставим 11 часов.
      let expiresAt = Date.now() + 11 * 60 * 60 * 1000
      if (data.expiresAt) {
        const parsed = Date.parse(data.expiresAt)
        if (!Number.isNaN(parsed)) expiresAt = parsed
      }
      iamCache.set(oauthToken, { token: data.iamToken, expiresAt })
      return data.iamToken
    } catch (e) {
      if (e instanceof AIProviderError) throw e
      const isAbort = e instanceof Error && e.name === 'AbortError'
      const isNetwork = e instanceof TypeError
      const code = classifyError(undefined, isAbort, isNetwork)
      throw new AIProviderError(
        isAbort
          ? 'Yandex IAM: таймаут запроса токена'
          : e instanceof Error
            ? `Yandex IAM: сетевая ошибка: ${e.message}`
            : 'Yandex IAM: неизвестная ошибка',
        code,
        undefined,
        false
      )
    } finally {
      clearTimeout(timer)
    }
  }

  /** Разбить сообщения: system → systemMessage, остальные → messages[]. */
  private splitMessages(messages: ChatMessage[]): {
    systemMessage?: string
    messages: { role: 'user' | 'assistant'; text: string }[]
  } {
    const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content)
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.content }))
    return {
      systemMessage: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages: rest,
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const iamToken = await this.getIamToken()
    const { systemMessage, messages } = this.splitMessages(request.messages)
    if (messages.length === 0) {
      throw new AIProviderError('Yandex Cloud: нужен хотя бы один user/assistant message', 'bad_request', undefined, false)
    }
    // folderId проверяется в getIamToken, но для сужения типа дублируем guard.
    const folderId = this.config.folderId
    if (!folderId) {
      throw new AIProviderError('Yandex Cloud: folder_id не задан', 'bad_request', undefined, false)
    }

    const body = {
      modelUri: `gpt://${folderId}/${this.config.modelName}`,
      completionOptions: {
        stream: false,
        temperature: String(request.temperature ?? this.config.config.temperature ?? 0.7),
        maxTokens: String(request.maxTokens ?? this.config.config.maxTokens ?? 2048),
      },
      messages: messages,
      ...(systemMessage ? { systemMessage } : {}),
    }

    const timeoutMs = request.timeoutMs ?? this.config.config.timeoutMs ?? 60000

    return withRetry(async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(YANDEX_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${iamToken}`,
            'x-folder-id': folderId,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const text = await res.text()
        if (!res.ok) {
          let detail = text
          try {
            const parsed = JSON.parse(text) as YandexResult
            if (parsed.error?.message) detail = parsed.error.message
          } catch {
            // сырой текст
          }
          const code = classifyError(res.status)
          throw new AIProviderError(`YandexGPT HTTP ${res.status}: ${detail}`, code, res.status, isRetryable(code))
        }
        const data = JSON.parse(text) as YandexResult
        const content = data.alternatives?.[0]?.message?.text ?? ''
        if (!content) {
          throw new AIProviderError('YandexGPT: пустой ответ (нет alternatives[0].message.text)', 'empty_response', undefined, false)
        }
        return {
          content: content.trim(),
          raw: data,
          providerName: this.name,
          modelName: this.config.modelName,
          usage: data.usage
            ? {
                promptTokens: data.usage.inputTextTokens
                  ? Number(data.usage.inputTextTokens)
                  : undefined,
                completionTokens: data.usage.completionTokens
                  ? Number(data.usage.completionTokens)
                  : undefined,
                totalTokens: data.usage.totalTokens ? Number(data.usage.totalTokens) : undefined,
              }
            : undefined,
        }
      } finally {
        clearTimeout(timer)
      }
    })
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
        timeoutMs: 20000,
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
