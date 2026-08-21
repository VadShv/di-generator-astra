import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getProviderClient } from '@/lib/ai-connector'
import { resolveMasterPrompt, renderPrompt, buildContextFromPosition } from '@/lib/master-prompt'
import { withErrorHandler, parseBody, ApiError } from '@/lib/api-utils'
import { aiSectionSchema } from '@/lib/validation/schemas'
import { createLogger } from '@/lib/logger'
import { buildGenerationSystemPrompt, buildSectionUserPrompt, buildArchiveContext, type ArchiveDIRef } from '@/lib/di/prompts'

const log = createLogger('generate-di/ai-section')

// POST /api/generate-di/ai-section - Generate a SINGLE section with AI
// Supports two modes:
// 1. Existing DI: { generatedDIId, sectionOrder, customPrompt }
// 2. Manual mode: { positionId, sectionTitle, sectionOrder, promptGuidance, manualMode: true }
export const POST = withErrorHandler(async (request: Request) => {
  const body = await parseBody(request, aiSectionSchema)
  const { generatedDIId, sectionOrder, customPrompt, manualMode, positionId, sectionTitle, promptGuidance } = body

  // ===== MANUAL MODE: Generate section for a new/manual DI without a DB record =====
  if (manualMode && positionId) {
    const position = await db.position.findUnique({
      where: { id: positionId },
      include: { department: { include: { company: true } }, businessFunction: true, project: true },
    })
    if (!position) {
      throw new ApiError('Должность не найдена', 404, 'not_found')
    }

    const masterPrompt = await resolveMasterPrompt('generation', {
      departmentId: position.departmentId,
      businessFunctionId: position.businessFunctionId,
      grade: position.grade,
    })
    const renderedMasterPrompt = masterPrompt
      ? renderPrompt(masterPrompt.content, buildContextFromPosition(position))
      : null

    const archiveDIs = await db.archiveDI.findMany({
      where: { positionId },
      orderBy: { uploadedAt: 'desc' },
      take: 3,
    })
    const archiveRefs: ArchiveDIRef[] = archiveDIs.map((di) => ({ title: di.title, content: di.content }))

    const systemPrompt = buildGenerationSystemPrompt(position, renderedMasterPrompt, buildArchiveContext(archiveRefs))

    const title = sectionTitle || 'Секция'
    let userPrompt = `Сгенерируй содержание секции "${title}" для должностной инструкции.`
    if (promptGuidance) userPrompt += `\nРуководство для генерации: ${promptGuidance}`
    userPrompt += '\n\nСгенерируй подробное, профессиональное содержание для этой секции.'

    const client = await getProviderClient()
    const result = await client.generate({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const response = result.content || ''
    return NextResponse.json({
      content: response.trim(),
      sectionTitle: title,
      sectionOrder: sectionOrder ?? 0,
    })
  }

  // ===== EXISTING DI MODE =====
  if (!generatedDIId) {
    throw new ApiError('Требуется generatedDIId (или manualMode+positionId)', 400, 'validation_error')
  }

  const generatedDI = await db.generatedDI.findUnique({
    where: { id: generatedDIId },
    include: {
      position: { include: { department: { include: { company: true } }, businessFunction: true, project: true } },
      template: { include: { sections: true } },
      sections: { orderBy: { order: 'asc' } },
    },
  })
  if (!generatedDI) {
    throw new ApiError('Сгенерированная ДИ не найдена', 404, 'not_found')
  }

  const section = generatedDI.sections.find((s) => s.order === sectionOrder)
  if (!section) {
    throw new ApiError('Секция не найдена', 404, 'not_found')
  }

  const templateSection = generatedDI.template?.sections.find((s) => s.title === section.sectionTitle)

  const masterPrompt = await resolveMasterPrompt('generation', {
    departmentId: generatedDI.position.departmentId,
    businessFunctionId: generatedDI.position.businessFunctionId,
    grade: generatedDI.position.grade,
  })
  const renderedMasterPrompt = masterPrompt
    ? renderPrompt(masterPrompt.content, buildContextFromPosition(generatedDI.position))
    : null

  const archiveDIs = await db.archiveDI.findMany({
    where: { positionId: generatedDI.positionId },
    orderBy: { uploadedAt: 'desc' },
    take: 3,
  })
  const archiveRefs: ArchiveDIRef[] = archiveDIs.map((di) => ({ title: di.title, content: di.content }))

  // Build context of other sections
  const otherSections = generatedDI.sections
    .filter((s) => s.order !== sectionOrder)
    .map((s) => `=== ${s.sectionTitle} ===\n${s.sectionContent.substring(0, 500)}...`)
    .join('\n\n')

  const systemPrompt = buildGenerationSystemPrompt(
    generatedDI.position,
    renderedMasterPrompt,
    buildArchiveContext(archiveRefs),
    `ДРУГИЕ СЕКЦИИ ЭТОЙ ДИ (для контекста):\n${otherSections || 'Другие секции ещё не сгенерированы.'}`
  )

  let userPrompt = `Сгенерируй содержание секции "${section.sectionTitle}" для должностной инструкции.`
  if (templateSection?.promptGuidance) userPrompt += `\nРуководство для генерации: ${templateSection.promptGuidance}`
  if (customPrompt && customPrompt.trim()) userPrompt += `\n\nДополнительные указания пользователя: ${customPrompt.trim()}`
  userPrompt += '\n\nСгенерируй подробное, профессиональное содержание для этой секции.'

  const client = await getProviderClient()
  const result = await client.generate({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const response = result.content || ''

  const updatedSection = await db.generatedDISection.update({
    where: { id: section.id },
    data: {
      sectionContent: response.trim(),
      aiGenerated: true,
      editedBy: null,
    },
  })

  log.info('Section regenerated', { sectionId: section.id, generatedDIId })
  return NextResponse.json(updatedSection)
}, 'generate-di/ai-section')
