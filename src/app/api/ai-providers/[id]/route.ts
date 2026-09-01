// API: управление конкретным ИИ-провайдером (Фаза 2)
// GET    /api/ai-providers/[id] — получить провайдера
// PATCH  /api/ai-providers/[id] — обновить провайдера
// DELETE /api/ai-providers/[id] — удалить провайдера
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { encryptApiKey, maskApiKey } from '@/lib/ai-connector'
import { validateProviderUrl } from '@/lib/ai-connector/url-validator'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-providers')

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

type Params = { params: Promise<{ id: string }> }

// GET — получить одного провайдера (только admin: ресурс содержит API-ключи).
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireRole('admin')
    const { id } = await params
    const provider = await db.aIProvider.findUnique({ where: { id } })
    if (!provider) {
      return NextResponse.json({ error: 'Провайдер не найден' }, { status: 404 })
    }
    return NextResponse.json(toDto(provider))
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('GET /api/ai-providers/[id] error:', { error })
    return NextResponse.json({ error: 'Ошибка получения провайдера' }, { status: 500 })
  }
}

// PATCH — обновить провайдера
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireRole('admin')
    const { id } = await params
    const body = await request.json()
    const { name, type, baseUrl, apiKey, modelName, folderId, isActive, isDefault, config } = body

    const existing = await db.aIProvider.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Провайдер не найден' }, { status: 404 })
    }

  const validTypes = ['openai_compatible', 'yandex_cloud', 'cloud', 'klad', 'ollama', 'zai']
  if (type && !validTypes.includes(type)) {
     return NextResponse.json({ error: `Недопустимый тип: ${type}` }, { status: 400 })
   }
   // SSRF-защита: валидация baseUrl при обновлении (если передан).
   if (baseUrl !== undefined && baseUrl) {
     try {
       await validateProviderUrl(baseUrl)
     } catch (e) {
       const msg = e instanceof Error ? e.message : 'Некорректный baseUrl'
       return NextResponse.json({ error: msg }, { status: 400 })
     }
   }
   if (type === 'yandex_cloud' && !folderId && !existing.folderId) {
     return NextResponse.json(
       { error: 'folder_id обязателен для Yandex Cloud' },
       { status: 400 }
     )
   }

    // Обновление провайдера + снятие isDefault — атомарно (race condition).

    // Шифруем новый ключ, если передан. Пустая строка = очистить ключ.
    let apiKeyEncrypted: string | null | undefined = undefined
    if (apiKey !== undefined) {
      apiKeyEncrypted = apiKey ? encryptApiKey(apiKey) : null
    }

    const updated = await db.$transaction(async (tx) => {
      if (isDefault && !existing.isDefault) {
        await tx.aIProvider.updateMany({
          where: { isDefault: true, NOT: { id } },
          data: { isDefault: false },
        })
      }
      return tx.aIProvider.update({
        where: { id },
        data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(baseUrl !== undefined ? { baseUrl: baseUrl || null } : {}),
        ...(apiKeyEncrypted !== undefined ? { apiKeyEncrypted } : {}),
        ...(modelName !== undefined ? { modelName } : {}),
        ...(folderId !== undefined ? { folderId: folderId || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
        ...(config !== undefined
          ? { config: typeof config === 'string' ? config : JSON.stringify(config) }
          : {}),
      },
      })
    })
    return NextResponse.json(toDto(updated))
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('PATCH /api/ai-providers/[id] error:', { error })
    return NextResponse.json({ error: 'Ошибка обновления провайдера' }, { status: 500 })
  }
}

// DELETE — удалить провайдера
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireRole('admin')
    const { id } = await params
    const existing = await db.aIProvider.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Провайдер не найден' }, { status: 404 })
    }
    await db.aIProvider.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('DELETE /api/ai-providers/[id] error:', { error })
    return NextResponse.json({ error: 'Ошибка удаления провайдера' }, { status: 500 })
  }
}
