// Фабрика провайдеров ИИ по типу (Фаза 2)
// Создаёт конкретный клиент (OpenAI-compatible / Yandex / Ollama / Cloud.ru / zai)
// по AIProviderConfig. Это единая точка получения клиента для всех ИИ-роутов.

import type { AIProviderClient, AIProviderConfig, AIProviderType } from './types'
import { OpenAICompatibleProvider, OllamaProvider, CloudRuProvider } from './providers/openai-compatible'
import { YandexCloudProvider } from './providers/yandex-cloud'
import { ZaiProvider } from './providers/zai'
import { getZaiFallbackConfig } from './config'

/**
 * Создать клиент провайдера по конфигурации.
 * @throws Error если тип неизвестен или конфигурация неполна.
 */
export function createProvider(config: AIProviderConfig): AIProviderClient {
  // Приводим к строке, чтобы принимать устаревший 'klad' из старых записей БД.
  switch (config.type as string) {
    case 'openai_compatible':
      return new OpenAICompatibleProvider(config)
    case 'yandex_cloud':
      return new YandexCloudProvider(config)
    case 'ollama':
      return new OllamaProvider(config)
    case 'cloud':
      return new CloudRuProvider(config)
    case 'klad':
      // Алиас для старых записей в БД — используем клиент Cloud.ru
      return new CloudRuProvider(config)
    case 'zai':
      return new ZaiProvider(config)
    default:
      throw new Error(`Неизвестный тип ИИ-провайдера: "${config.type as AIProviderType}"`)
  }
}

/**
 * Удобный helper: получить клиент по providerId из БД.
 * Если провайдер не найден / не задан — возвращаем fallback zai.
 * Это основной метод для существующих ИИ-роутов (генерация/аудит/улучшение).
 *
 * Пример использования в роуте:
 *   const client = await getProviderClient()
 *   const response = await client.generate({ messages, temperature: 0.7 })
 */
export async function getProviderClient(providerId?: string): Promise<AIProviderClient> {
  // Динамический импорт config, чтобы избежать циклической зависимости при сборке.
  const { resolveProviderConfig } = await import('./config')
  const config = await resolveProviderConfig(providerId)
  return createProvider(config)
}

/**
 * Получить fallback-клиент z-ai-web-dev-sdk без обращения к БД.
 * Полезно для теста соединения встроенного провайдера.
 */
export function getZaiFallbackClient(): AIProviderClient {
  return createProvider(getZaiFallbackConfig())
}

/** Re-export типов для удобства (единая точка импорта из роутов). */
export type { AIProviderConfig, AIProviderType, GenerateRequest, GenerateResponse } from './types'
export { encryptApiKey, decryptApiKey, maskApiKey } from './crypto'
export { resolveProviderConfig, getActiveProviderConfig } from './config'
