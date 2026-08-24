'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { wordDiff, type DiffSegment } from '@/lib/diff'

// ─── Типы ───────────────────────────────────────────────────────

interface ParsedSection {
  title: string
  content: string
  order: number
}

interface ParsedDI {
  title: string
  sections: ParsedSection[]
}

interface DIVersionDiffProps {
  oldVersion: { content: string }
  newVersion: { content: string }
  oldLabel?: string
  newLabel?: string
}

// ─── Разбор JSON-контента версии в секции ──────────────────────

// Поддерживает форматы:
//  - { title, sections: [{ title, content, order? }] }   (актуальный)
//  - [{ sectionTitle, sectionContent, order }]            (массив секций)
//  - произвольный текст                                   (одна секция)
function parseVersionContent(content: string): ParsedDI {
  if (!content) return { title: '', sections: [] }
  try {
    const p = JSON.parse(content)
    if (p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.sections)) {
      const sections: ParsedSection[] = p.sections.map((s: Record<string, unknown>, idx: number) => ({
        title: String(s.title ?? s.sectionTitle ?? `Раздел ${idx + 1}`),
        content: String(s.content ?? s.sectionContent ?? ''),
        order: typeof s.order === 'number' ? s.order : idx,
      }))
      sections.sort((a, b) => a.order - b.order)
      return {
        title: typeof p.title === 'string' ? p.title : '',
        sections,
      }
    }
    if (Array.isArray(p)) {
      const sections: ParsedSection[] = p.map((s: Record<string, unknown>, idx: number) => ({
        title: String(s.sectionTitle ?? s.title ?? `Раздел ${idx + 1}`),
        content: String(s.sectionContent ?? s.content ?? ''),
        order: typeof s.order === 'number' ? s.order : idx,
      }))
      sections.sort((a, b) => a.order - b.order)
      return { title: '', sections }
    }
  } catch {
    // не JSON — ниже обработаем как plain text
  }
  return { title: '', sections: [{ title: 'Содержимое', content, order: 0 }] }
}

// ─── Сопоставление секций старой и новой версий ────────────────

interface SectionPair {
  old?: ParsedSection
  new?: ParsedSection
}

function matchSections(oldSecs: ParsedSection[], newSecs: ParsedSection[]): SectionPair[] {
  const pairs: SectionPair[] = []
  const newUsed = new Set<number>()

  for (const o of oldSecs) {
    const nj = newSecs.findIndex((n, j) => !newUsed.has(j) && n.title === o.title)
    if (nj >= 0) {
      newUsed.add(nj)
      pairs.push({ old: o, new: newSecs[nj] })
    } else {
      pairs.push({ old: o })
    }
  }

  newSecs.forEach((n, j) => {
    if (!newUsed.has(j)) pairs.push({ new: n })
  })

  return pairs
}

// ─── Рендер сегментов одной стороны ────────────────────────────

function renderSide(segments: DiffSegment[], side: 'old' | 'new') {
  return segments.map((seg, i) => {
    if (side === 'old') {
      if (seg.type === 'add') return null
      return (
        <span
          key={i}
          className={seg.type === 'remove' ? 'bg-red-100 text-red-800 line-through rounded-sm' : ''}
        >
          {seg.text}
        </span>
      )
    }
    if (seg.type === 'remove') return null
    return (
      <span
        key={i}
        className={seg.type === 'add' ? 'bg-green-100 text-green-800 rounded-sm' : ''}
      >
        {seg.text}
      </span>
    )
  })
}

// ─── Компонент ─────────────────────────────────────────────────

export function DIVersionDiff({ oldVersion, newVersion, oldLabel, newLabel }: DIVersionDiffProps) {
  const { pairs, oldTitle, newTitle } = useMemo(() => {
    const oldParsed = parseVersionContent(oldVersion.content)
    const newParsed = parseVersionContent(newVersion.content)
    return {
      pairs: matchSections(oldParsed.sections, newParsed.sections),
      oldTitle: oldParsed.title,
      newTitle: newParsed.title,
    }
  }, [oldVersion.content, newVersion.content])

  const leftLabel = oldLabel || 'Было'
  const rightLabel = newLabel || 'Стало'

  return (
    <div className="space-y-4">
      {/* Легенда */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
          Добавлено
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
          Удалено
        </span>
      </div>

      {/* Заголовок ДИ, если есть */}
      {(oldTitle || newTitle) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="text-sm font-semibold truncate">{oldTitle || '—'}</div>
          <div className="text-sm font-semibold truncate">{newTitle || '—'}</div>
        </div>
      )}

      {/* Секции */}
      {pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Нет данных для сравнения
        </p>
      ) : (
        pairs.map((pair, idx) => {
          const sectionTitle = pair.old?.title || pair.new?.title || `Раздел ${idx + 1}`
          const segments = wordDiff(pair.old?.content || '', pair.new?.content || '')
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {sectionTitle}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Левая колонка — старая версия */}
                <div className="rounded-lg border bg-muted/30 p-3 min-h-[3rem]">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{leftLabel}</p>
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {pair.old
                      ? renderSide(segments, 'old')
                      : <span className="text-muted-foreground italic">— нет —</span>}
                  </div>
                </div>
                {/* Правая колонка — новая версия */}
                <div className="rounded-lg border bg-muted/30 p-3 min-h-[3rem]">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{rightLabel}</p>
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {pair.new
                      ? renderSide(segments, 'new')
                      : <span className="text-muted-foreground italic">— нет —</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
