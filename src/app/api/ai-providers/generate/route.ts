// API: универсальная генерация текста через ИИ-провайдер (Фаза 2)
// POST /api/ai-providers/generate
// Тело: { providerId?: string, messages: ChatMessage[], temperature?, maxTokens? }
// Если providerId не задан — используется активный/дефолтный провайдер из БД,
// при отсутствии — fallback на z-ai-web-dev-sdk.
import { NextResponse } from 'next/server'
import { getProviderClient } from '@/lib/ai-connector'
import type { ChatMessage } from '@/lib/ai-connector'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { providerId, messages, temperature, maxTokens } = body

    // Валидация messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages должен быть непустым массивом' }, { status: 400 })
    }
    const validRoles = ['system', 'user', 'assistant']
    for (const msg of messages) {
      if (!msg || typeof msg.content !== 'string' || !validRoles.includes(msg.role)) {
        return NextResponse.json(
          { error: 'Каждое message должно иметь role (system|user|assistant) и content (string)' },
          { status: 400 }
        )
      }
    }

    const client = await getProviderClient(providerId)
    const response = await client.generate({
      messages: messages as ChatMessage[],
      temperature,
      maxTokens,
    })

    return NextResponse.json({
      content: response.content,
      provider: response.providerName,
      model: response.modelName,
      usage: response.usage,
    })
  } catch (error) {
    console.error('POST /api/ai-providers/generate error:', error)
    const message = error instanceof Error ? error.message : 'Ошибка генерации'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
