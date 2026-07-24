import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { positionId } = body

    if (!positionId) {
      return NextResponse.json({ error: 'ID должности обязателен' }, { status: 400 })
    }

    const position = await db.position.findUnique({
      where: { id: positionId },
      include: { department: true, businessFunction: true, project: true },
    })

    if (!position) {
      return NextResponse.json({ error: 'Должность не найдена' }, { status: 404 })
    }

    // Get all active master prompts
    const activePrompts = await db.masterPrompt.findMany({
      where: { isActive: true },
      include: { department: true, businessFunction: true },
    })

    if (activePrompts.length === 0) {
      return NextResponse.json({ prompt: null, resolution: null })
    }

    // Priority logic: departmentId match > businessFunctionId match > grade match > functionType match > global
    // Score each prompt based on how specifically it matches the position
    const scored = activePrompts.map((prompt) => {
      let score = 0
      const matchDetails: string[] = []

      // Department match (highest priority)
      if (prompt.departmentId === position.departmentId) {
        score += 1000
        matchDetails.push('Подразделение')
      } else if (prompt.departmentId !== null) {
        // Prompt has a department requirement that doesn't match
        return { prompt, score: -1, matchDetails: [] }
      }

      // Business function match
      if (prompt.businessFunctionId && position.businessFunctionId && prompt.businessFunctionId === position.businessFunctionId) {
        score += 100
        matchDetails.push('Бизнес-функция')
      } else if (prompt.businessFunctionId !== null && prompt.businessFunctionId !== position.businessFunctionId) {
        return { prompt, score: -1, matchDetails: [] }
      }

      // Grade match
      if (prompt.grade && position.grade && prompt.grade === position.grade) {
        score += 10
        matchDetails.push('Грейд')
      } else if (prompt.grade !== null && prompt.grade !== position.grade) {
        return { prompt, score: -1, matchDetails: [] }
      }

      // Function type match
      if (prompt.functionType && position.functions) {
        try {
          const positionFunctions = JSON.parse(position.functions) as string[]
          if (positionFunctions.includes(prompt.functionType)) {
            score += 1
            matchDetails.push('Функция')
          } else {
            return { prompt, score: -1, matchDetails: [] }
          }
        } catch {
          // If functions can't be parsed, try string comparison
          if (position.functions.includes(prompt.functionType)) {
            score += 1
            matchDetails.push('Функция')
          } else {
            return { prompt, score: -1, matchDetails: [] }
          }
        }
      } else if (prompt.functionType !== null) {
        // Prompt has a function requirement but position has no functions
        return { prompt, score: -1, matchDetails: [] }
      }

      return { prompt, score, matchDetails }
    })

    // Filter out non-matching prompts and find the best match
    const matching = scored.filter((s) => s.score >= 0)

    if (matching.length === 0) {
      return NextResponse.json({ prompt: null, resolution: null })
    }

    // Sort by score descending, then by version descending (prefer latest version)
    matching.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.prompt.version - a.prompt.version
    })

    const bestMatch = matching[0]

    return NextResponse.json({
      prompt: bestMatch.prompt,
      resolution: {
        score: bestMatch.score,
        matchDetails: bestMatch.matchDetails,
        position: {
          id: position.id,
          title: position.title,
          departmentId: position.departmentId,
          departmentName: position.department?.name,
          businessFunctionId: position.businessFunctionId,
          businessFunctionName: position.businessFunction?.name,
          grade: position.grade,
          functions: position.functions,
        },
        evaluatedPrompts: matching.map((m) => ({
          id: m.prompt.id,
          name: m.prompt.name,
          version: m.prompt.version,
          score: m.score,
          matchDetails: m.matchDetails,
        })),
      },
    })
  } catch (error) {
    console.error('Error resolving master prompt:', error)
    return NextResponse.json({ error: 'Ошибка при разрешении мастер-промпта' }, { status: 500 })
  }
}
