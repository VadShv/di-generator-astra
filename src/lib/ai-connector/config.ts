// Чтение конфигурации провайдеров из БД (Фаза 2)
// Загружает модель AIProvider, расшифровывает ключ, возвращает AIProviderConfig.

import { db } from '@/lib/db'
import { decryptApiKey } from './crypto'
import type { AIProviderConfig, AIProviderExtraConfig, AIProviderType } from './types'

/** Дефолтные настройки генерации, если config пуст. */
const DEFAULT_EXTRA_CONFIG: AIProviderExtraConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  timeoutMs: 60000,
}

/** Безопасно распарсить JSON-конфиг из поля AIProvider.config. */
function parseExtraConfig(raw: string | null | undefined): AIProviderExtraConfig {
  if (!raw) return { ...DEFAULT_EXTRA_CONFIG }
  try {
    const parsed = JSON.parse(raw) as Partial<AIProviderExtraConfig>
    return { ...DEFAULT_EXTRA_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_EXTRA_CONFIG }
  }
}

/** Преобразовать запись БД AIProvider в AIProviderConfig (с расшифровкой ключа). */
export function toProviderConfig(row: {
  id: string
  name: string
  type: string
  baseUrl: string | null
  apiKeyEncrypted: string | null
  modelName: string
  folderId: string | null
  config: string
}): AIProviderConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AIProviderType,
    baseUrl: row.baseUrl,
    apiKey: decryptApiKey(row.apiKeyEncrypted),
    modelName: row.modelName,
    folderId: row.folderId,
    config: parseExtraConfig(row.config),
  }
}

/**
 * Получить активный провайдер для генерации.
 * Логика:
 *   1. Если передан providerId — берём конкретного провайдера.
 *   2. Иначе — провайдера с isDefault=true.
 *   3. Иначе — любого активного (isActive=true).
 *   4. Если в БД никого нет — возвращаем null (вызывающий код использует fallback zai).
 */
export async function getActiveProviderConfig(
  providerId?: string
): Promise<AIProviderConfig | null> {
  let row: {
    id: string
    name: string
    type: string
    baseUrl: string | null
    apiKeyEncrypted: string | null
    modelName: string
    folderId: string | null
    config: string
  } | null = null

  if (providerId) {
    row = await db.aIProvider.findUnique({ where: { id: providerId } })
    if (!row) {
      throw new Error(`ИИ-провайдер с id="${providerId}" не найден`)
    }
  } else {
    // Приоритет: isDefault=true → isActive=true → первый попавшийся.
    row = await db.aIProvider.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!row) {
      row = await db.aIProvider.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      })
    }
  }

  return row ? toProviderConfig(row) : null
}

/**
 * Конфигурация fallback-провайдера z-ai-web-dev-sdk.
 * Используется, когда в БД нет настроенных провайдеров,
 * чтобы генерация продолжала работать (обратная совместимость).
 */
export function getZaiFallbackConfig(): AIProviderConfig {
  return {
    id: 'zai-fallback',
    name: 'z-ai-web-dev-sdk (встроенный)',
    type: 'zai',
    baseUrl: null,
    apiKey: null,
    modelName: 'zai-default',
    folderId: null,
    config: { ...DEFAULT_EXTRA_CONFIG },
  }
}

/**
 * Гарантированно вернуть конфигурацию провайдера.
 * Если в БД никого нет — возвращаем fallback zai.
 * Это основной метод для существующих ИИ-роутов (генерация, аудит и т.д.).
 */
export async function resolveProviderConfig(
  providerId?: string
): Promise<AIProviderConfig> {
  const config = await getActiveProviderConfig(providerId)
  return config ?? getZaiFallbackConfig()
}
