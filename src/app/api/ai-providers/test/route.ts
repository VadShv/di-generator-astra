// API: тест соединения с ИИ-провайдером (Фаза 2)
// POST /api/ai-providers/test
// Тело: { providerId?: string, type?, baseUrl?, apiKey?, modelName?, folderId?, config? }
// Если передан providerId — тестируем сохранённого провайдера из БД.
// Иначе — тестируем «на лету» по переданным полям (до сохранения).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createProvider, toProviderConfig } from '@/lib/ai-connector'
import { validateProviderUrl } from '@/lib/ai-connector/url-validator'
import type { AIProviderConfig } from '@/lib/ai-connector'
import { requireRole } from '@/lib/auth/session'
import { ApiError, errorResponse } from '@/lib/api-utils'
import { createLogger } from '@/lib/logger'

const log = createLogger('ai-providers-test')

export async function POST(request: Request) {
  try {
    await requireRole('admin')
    const body = await request.json()
    const { providerId, type, baseUrl, apiKey, modelName, folderId, config } = body

    let configObj: AIProviderConfig

    if (providerId) {
      // Тестируем сохранённого провайдера.
      const row = await db.aIProvider.findUnique({ where: { id: providerId } })
      if (!row) {
        return NextResponse.json({ error: 'Провайдер не найден' }, { status: 404 })
      }
      configObj = toProviderConfig(row)
    } else {
      // Тестируем «на лету»: собираем конфиг из тела запроса.
      if (!type) {
        return NextResponse.json({ error: 'Не указан type провайдера' }, { status: 400 })
      }
      if (!modelName) {
        return NextResponse.json({ error: 'Не указано modelName' }, { status: 400 })
      }
      // Для теста ключ передаётся в открытом виде (не шифруется в БД).
      const extraConfig = (() => {
        if (!config) return {}
        if (typeof config === 'string') {
          try {
            return JSON.parse(config)
          } catch {
            return {}
          }
        }
        return config
      })()
      // SSRF-защита: валидация baseUrl перед тестом «на лету».
      if (baseUrl) {
        try {
          await validateProviderUrl(baseUrl)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Некорректный baseUrl'
          return NextResponse.json({ ok: false, message: msg }, { status: 400 })
        }
      }
      configObj = {
        id: 'test',
        name: 'Тест провайдера',
        type,
        baseUrl: baseUrl || null,
        apiKey: apiKey || null,
        modelName,
        folderId: folderId || null,
        config: extraConfig,
      }
    }

    const client = createProvider(configObj)
    const result = await client.testConnection()

    // Если тестируем сохранённого провайдера — обновляем статус в БД.
    if (providerId) {
      await db.aIProvider.update({
        where: { id: providerId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: result.ok ? 'ok' : 'error',
          lastTestMessage: result.message.slice(0, 500),
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error)
    log.error('POST /api/ai-providers/test error:', { error })
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Ошибка теста соединения',
      },
      { status: 500 }
    )
  }
}
