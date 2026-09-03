import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSectionsForPosition, generateAiCultureSection } from './generate-core'
import type { AIProviderClient } from '@/lib/ai-connector'

const tokenUsageCreateMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  db: {
    tokenUsage: {
      create: tokenUsageCreateMock,
    },
  },
}))

function createMockClient(): AIProviderClient {
  return {
    name: 'TestProvider',
    type: 'openai_compatible',
    generate: vi.fn(),
    testConnection: vi.fn(),
  }
}

describe('generateSectionsForPosition', () => {
  let client: AIProviderClient

  beforeEach(() => {
    client = createMockClient()
    tokenUsageCreateMock.mockResolvedValue({ id: 'tu-1' })
    vi.clearAllMocks()
  })

  it('генерирует все секции при успешных запросах', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      content: 'Сгенерированный текст секции',
      raw: {},
      providerName: 'TestProvider',
      modelName: 'test-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    })
    client.generate = mockGenerate

    const result = await generateSectionsForPosition({
      position: { title: 'Инженер', code: 'ING-001', grade: 'линейная' },
      templateSections: [
        { id: 's1', title: 'Общие положения', order: 1 },
        { id: 's2', title: 'Обязанности', order: 2 },
      ],
      client,
      renderedMasterPrompt: null,
      archiveDIs: [],
    })

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].sectionTitle).toBe('Общие положения')
    expect(result.sections[0].sectionContent).toBe('Сгенерированный текст секции')
    expect(result.sections[0].aiGenerated).toBe(true)
    expect(mockGenerate).toHaveBeenCalledTimes(2)
  })

  it('вставляет placeholder при ошибке генерации секции', async () => {
    const mockGenerate = vi.fn().mockRejectedValue(new Error('AI timeout'))
    client.generate = mockGenerate

    const result = await generateSectionsForPosition({
      position: { title: 'Менеджер', code: 'M-001', grade: null },
      templateSections: [
        { id: 's1', title: 'Общие положения', order: 1 },
      ],
      client,
      renderedMasterPrompt: null,
      archiveDIs: [],
      errorPlaceholder: '[Ошибка — тест]',
    })

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].sectionContent).toBe('[Ошибка — тест]')
    expect(result.sections[0].aiGenerated).toBe(false)
  })

  it('вызывает onProgress с правильными аргументами', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      content: 'ok',
      raw: {},
      providerName: 'TestProvider',
      modelName: 'test-model',
    })
    client.generate = mockGenerate

    const onProgress = vi.fn()
    await generateSectionsForPosition({
      position: { title: 'Тест', code: 'T-1', grade: null },
      templateSections: [
        { id: 's1', title: 'A', order: 1 },
        { id: 's2', title: 'B', order: 2 },
        { id: 's3', title: 'C', order: 3 },
      ],
      client,
      renderedMasterPrompt: null,
      archiveDIs: [],
      onProgress,
    })

    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3)
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
  })

  it('передаёт legalContext и extraContext в системный промпт', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      content: 'ok',
      raw: {},
      providerName: 'TestProvider',
      modelName: 'test-model',
    })
    client.generate = mockGenerate

    await generateSectionsForPosition({
      position: { title: 'Тест', code: 'T-1', grade: null },
      templateSections: [{ id: 's1', title: 'A', order: 1 }],
      client,
      renderedMasterPrompt: 'Мастер-промпт',
      archiveDIs: [{ title: 'Архив', content: 'Текст архива' }],
      legalContext: 'Правовая база: ТК РФ',
      extraContext: 'Доп. контекст',
    })

    const call = mockGenerate.mock.calls[0][0]
    const systemMsg = call.messages.find((m: { role: string }) => m.role === 'system')
    expect(systemMsg.content).toContain('Мастер-промпт')
    expect(systemMsg.content).toContain('Текст архива')
    expect(systemMsg.content).toContain('Правовая база: ТК РФ')
    expect(systemMsg.content).toContain('Доп. контекст')
  })
})

describe('generateAiCultureSection', () => {
  let client: AIProviderClient

  beforeEach(() => {
    client = createMockClient()
    tokenUsageCreateMock.mockResolvedValue({ id: 'tu-culture' })
    vi.clearAllMocks()
  })

  it('возвращает null если промпт не передан', async () => {
    const result = await generateAiCultureSection(client, null, null)
    expect(result.section).toBeNull()
  })

  it('возвращает null если renderedCulturePrompt пуст', async () => {
    const result = await generateAiCultureSection(
      client,
      { id: '1', name: 'AI Culture', content: 'тест' },
      null
    )
    expect(result.section).toBeNull()
  })

  it('генерирует секцию культуры ИИ при успехе', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      content: 'Культура ИИ — важна',
      raw: {},
      providerName: 'TestProvider',
      modelName: 'test-model',
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    })
    client.generate = mockGenerate

    const result = await generateAiCultureSection(
      client,
      { id: '1', name: 'AI Culture', content: 'system prompt' },
      'rendered system prompt'
    )

    expect(result.section).not.toBeNull()
    expect(result.section?.sectionTitle).toBe('Взаимодействие с системами ИИ')
    expect(result.section?.sectionContent).toBe('Культура ИИ — важна')
    expect(result.section?.aiGenerated).toBe(true)
  })

  it('возвращает fallback content при пустом ответе ИИ', async () => {
    const mockGenerate = vi.fn().mockResolvedValue({
      content: '',
      raw: {},
      providerName: 'TestProvider',
      modelName: 'test-model',
    })
    client.generate = mockGenerate

    const result = await generateAiCultureSection(
      client,
      { id: '1', name: 'AI Culture', content: 'system prompt' },
      'rendered system prompt'
    )

    expect(result.section?.sectionContent).toBe('[Раздел не сгенерирован]')
  })

  it('возвращает null при ошибке генерации', async () => {
    const mockGenerate = vi.fn().mockRejectedValue(new Error('AI fail'))
    client.generate = mockGenerate

    const result = await generateAiCultureSection(
      client,
      { id: '1', name: 'AI Culture', content: 'system prompt' },
      'rendered system prompt'
    )

    expect(result.section).toBeNull()
  })
})
