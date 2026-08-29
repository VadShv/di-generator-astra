// Типы универсального ИИ-коннектора (Фаза 2)
// Покрывает: OpenAI-compatible (OpenAI, Cloud.ru, Ollama, локальные LLM),
// Yandex Cloud (YandexGPT), и встроенный z-ai-web-dev-sdk как fallback.

/** Тип ИИ-провайдера. Соответствует полю AIProvider.type в Prisma-схеме. */
export type AIProviderType =
  | 'openai_compatible' // OpenAI-совместимый API (OpenAI, Cloud.ru, Ollama, vLLM, LiteLLM)
  | 'yandex_cloud' // Yandex Cloud YandexGPT (IAM-токен + folder_id)
  | 'cloud' // Cloud.ru (OpenAI-совместимый, но вынесен в отдельный тип для удобства)
  | 'ollama' // Локальная LLM через Ollama (OpenAI-совместимый endpoint)
  | 'zai' // Встроенный z-ai-web-dev-sdk (fallback, не требует настроек)

/** Конфигурация провайдера, получаемая из БД (модель AIProvider). */
export interface AIProviderConfig {
  id: string
  name: string
  type: AIProviderType
  /** Базовый URL API (без /v1/chat/completions). Может быть null для zai. */
  baseUrl: string | null
  /** Расшифрованный API-ключ. Для zai/ollama может быть null. */
  apiKey: string | null
  /** Имя модели: gpt-4o, yandexgpt, qwen2.5 и т.д. */
  modelName: string
  /** folder_id для Yandex Cloud. */
  folderId: string | null
  /** Доп. настройки (temperature, maxTokens, topP). */
  config: AIProviderExtraConfig
}

/** Дополнительные параметры генерации, хранятся в AIProvider.config как JSON. */
export interface AIProviderExtraConfig {
  temperature?: number
  maxTokens?: number
  topP?: number
  /** Таймаут запроса в миллисекундах. */
  timeoutMs?: number
  /** Количество вариантов ответа (для OpenAI-compatible). */
  n?: number
}

/** Сообщение в чате. Унифицированный формат (role: system|user|assistant). */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Запрос на генерацию текста. */
export interface GenerateRequest {
  /** Список сообщений (system + user). Первым обычно идёт system. */
  messages: ChatMessage[]
  /** Переопределение температуры (опционально). */
  temperature?: number
  /** Переопределение max_tokens (опционально). */
  maxTokens?: number
  /** Таймаут запроса (опционально). */
  timeoutMs?: number
  /** Сигнал отмены (опционально) — для per-job таймаута массовой генерации. */
  signal?: AbortSignal
}

/** Ответ генерации. */
export interface GenerateResponse {
  /** Сгенерированный текст. */
  content: string
  /** Сырой ответ провайдера (для отладки). */
  raw: unknown
  /** Использованный провайдер. */
  providerName: string
  /** Использованная модель. */
  modelName: string
  /** Приблизительная оценка количества токенов (если провайдер вернул). */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/** Результат теста соединения с провайдером. */
export interface TestConnectionResult {
  ok: boolean
  message: string
  /** Время отклика в мс. */
  latencyMs?: number
  /** Пример ответа модели на тестовый промпт. */
  sampleResponse?: string
}

/**
 * Универсальный интерфейс провайдера ИИ.
 * Каждый конкретный провайдер реализует этот интерфейс.
 */
export interface AIProviderClient {
  /** Имя провайдера (для логирования). */
  readonly name: string
  /** Тип провайдера. */
  readonly type: AIProviderType
  /** Генерация текста по запросу. */
  generate(request: GenerateRequest): Promise<GenerateResponse>
  /** Тест соединения — короткий запрос для проверки доступности. */
  testConnection(): Promise<TestConnectionResult>
}
