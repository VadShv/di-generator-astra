// API: управление ИИ-провайдерами (Фаза 2)
// GET  /api/ai-providers          — список всех провайдеров (без ключей)
// POST /api/ai-providers          — создать провайдера
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptApiKey, maskApiKey } from '@/lib/ai-connector'
import { validateProviderUrl } from '@/lib/ai-connector/url-validator'
import { requireRole, requireAuth } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-providers')

/** Преобразовать запись БД в безопасный DTO (без расшифрованного ключа). */
function toDto(row: {
  id: string
  name: string
  type: string
  baseUrl: string | null
  apiKeyEncrypted: string | null
  modelName: string
  folderId: string | null
  isActive: boolean
  isDefault: boolean
  config: string
  lastTestedAt: Date | null
  lastTestStatus: string | null
  lastTestMessage: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.baseUrl,
    // Ключ не возвращаем в открытом виде — только маску.
    apiKeyMask: maskApiKey(row.apiKeyEncrypted),
    hasApiKey: !!row.apiKeyEncrypted,
    modelName: row.modelName,
    folderId: row.folderId,
    isActive: row.isActive,
    isDefault: row.isDefault,
    config: row.config,
    lastTestedAt: row.lastTestedAt,
    lastTestStatus: row.lastTestStatus,
    lastTestMessage: row.lastTestMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// GET — список всех провайдеров
export async function GET() {
  try {
    await requireAuth()
    const providers = await db.aIProvider.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(providers.map(toDto))
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GET /api/ai-providers error:', { error })
    return NextResponse.json({ error: 'Ошибка получения списка провайдеров' }, { status: 500 })
  }
}

// POST — создать провайдера
export async function POST(request: Request) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { name, type, baseUrl, apiKey, modelName, folderId, isActive, isDefault, config } = body

    // Валидация обязательных полей
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Название провайдера обязательно' }, { status: 400 })
    }
   const validTypes = ['openai_compatible', 'yandex_cloud', 'cloud', 'klad', 'ollama', 'zai']
   if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Тип провайдера должен быть одним из: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }
    if (!modelName || typeof modelName !== 'string') {
      return NextResponse.json({ error: 'Имя модели обязательно' }, { status: 400 })
    }

    // Для zai baseUrl/apiKey не требуются. Для остальных — baseUrl обязателен.
    const needsBaseUrl = type !== 'zai'
    if (needsBaseUrl && (!baseUrl || typeof baseUrl !== 'string')) {
      return NextResponse.json(
        { error: 'baseUrl обязателен для провайдеров, отличных от zai' },
        { status: 400 }
      )
    }
    // SSRF-защита: валидация baseUrl (схема, приватные IP, DNS-резолв).
    if (needsBaseUrl && baseUrl) {
      try {
        await validateProviderUrl(baseUrl)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Некорректный baseUrl'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }
    // Для yandex_cloud folderId обязателен.
    if (type === 'yandex_cloud' && !folderId) {
      return NextResponse.json(
        { error: 'folder_id обязателен для Yandex Cloud' },
        { status: 400 }
      )
    }

    // Шифруем ключ, если задан.
    const apiKeyEncrypted = apiKey ? encryptApiKey(apiKey) : null

    // Создание провайдера + снятие isDefault — атомарно (race condition).
    const created = await db.$transaction(async (tx) => {
      if (isDefault) {
        await tx.aIProvider.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
      }
      return tx.aIProvider.create({
      data: {
        name: name.trim(),
        type,
        baseUrl: baseUrl || null,
        apiKeyEncrypted,
        modelName,
        folderId: folderId || null,
        isActive: isActive ?? false,
        isDefault: isDefault ?? false,
        config: typeof config === 'string' ? config : JSON.stringify(config ?? {}),
      },
      })
    })
    return NextResponse.json(toDto(created), { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('POST /api/ai-providers error:', { error })
    return NextResponse.json({ error: 'Ошибка создания провайдера' }, { status: 500 })
  }
}
