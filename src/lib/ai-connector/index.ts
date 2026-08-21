// Barrel-файл модуля ai-connector (Фаза 2)
// Единая точка импорта для роутов и компонентов.
//
// Пример:
//   import { getProviderClient } from '@/lib/ai-connector'
//   const client = await getProviderClient()
//   const response = await client.generate({ messages: [...] })

export * from './types'
export { encryptApiKey, decryptApiKey, maskApiKey } from './crypto'
export {
  resolveProviderConfig,
  getActiveProviderConfig,
  getZaiFallbackConfig,
  toProviderConfig,
} from './config'
export {
  createProvider,
  getProviderClient,
  getZaiFallbackClient,
} from './ai-provider-factory'
export { OpenAICompatibleProvider, OllamaProvider, CloudRuProvider, KladProvider } from './providers/openai-compatible'
export { AIProviderError, classifyError, isRetryable, type AIErrorCode } from './errors'
export { Semaphore, getDefaultConcurrency } from './semaphore'
export { withRetry, type RetryOptions } from './retry'
export { YandexCloudProvider } from './providers/yandex-cloud'
export { ZaiProvider } from './providers/zai'
