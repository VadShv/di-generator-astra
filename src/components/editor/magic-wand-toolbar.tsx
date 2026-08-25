'use client'

// Magic Wand Toolbar — inline-панель AI-пресетов для редактирования секций ДИ.
// Появляется под Textarea при фокусе / по требованию.
// Каждая кнопка = 1-кликовое улучшение текста через AI.

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2 } from 'lucide-react'

/** Доступные пресеты Magic Wand. */
export type MagicWandPreset =
  | 'detail'
  | 'shorten'
  | 'formalize'
  | 'simplify'
  | 'kpi'
  | 'style'

interface PresetConfig {
  id: MagicWandPreset
  label: string
  icon: React.ReactNode
  description: string
  shortcut?: string
}

const PRESETS: PresetConfig[] = [
  {
    id: 'detail',
    label: 'Усилить детали',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    ),
    description: 'Добавь конкретики: примеры, критерии, системы, нормативы',
    shortcut: 'Ctrl+1',
  },
  {
    id: 'shorten',
    label: 'Сократить',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14"/><path d="m15 16-4-4 4-4"/>
      </svg>
    ),
    description: 'Сократи на 25–35%, убери повторы и избыточность',
    shortcut: 'Ctrl+2',
  },
  {
    id: 'formalize',
    label: 'Формализовать',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
    description: 'Строго формально-деловой стиль, терминология ТК РФ',
    shortcut: 'Ctrl+3',
  },
  {
    id: 'simplify',
    label: 'Упростить',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    description: 'Простой язык, короткие предложения, без канцеляризмов',
    shortcut: 'Ctrl+4',
  },
  {
    id: 'kpi',
    label: '+ KPI',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
      </svg>
    ),
    description: 'Добавь измеримые показатели эффективности к обязанностям',
    shortcut: 'Ctrl+5',
  },
  {
    id: 'style',
    label: 'Единый стиль',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 12 2.1 9.9"/><path d="M12 12v10"/>
      </svg>
    ),
    description: 'Приведи к корпоративному стилю Группы Астра',
    shortcut: 'Ctrl+6',
  },
]

export interface MagicWandToolbarProps {
  /** Текущая секция редактируется? Блокирует кнопки. */
  loading?: boolean
  /** Какой пресет сейчас обрабатывается (показывает spinner на конкретной кнопке). */
  activePreset?: MagicWandPreset | null
  /** Колбэк при клике на пресет. */
  onPreset: (preset: MagicWandPreset) => void
  /** Опциональный колбэк для произвольной инструкции (чат). */
  onCustom?: () => void
  /** Показывать ли кнопку произвольной инструкции. */
  showCustom?: boolean
  /** Доп. класс для контейнера. */
  className?: string
}

export function MagicWandToolbar({
  loading = false,
  activePreset = null,
  onPreset,
  onCustom,
  showCustom = true,
  className = '',
}: MagicWandToolbarProps) {
  const [hovered, setHovered] = useState<MagicWandPreset | null>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, preset: MagicWandPreset) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!loading) onPreset(preset)
      }
    },
    [loading, onPreset]
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border bg-gradient-to-r from-violet-50/60 to-cyan-50/60 px-2 py-1.5 ${className}`}
        role="toolbar"
        aria-label="Magic Wand — AI-улучшения секции"
      >
        <span className="text-[11px] text-muted-foreground font-medium mr-1 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-500">
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72z"/>
            <path d="m14 7 3 3"/>
            <path d="M5 6v4"/>
            <path d="M19 14v4"/>
          </svg>
          🪄
        </span>

        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id
          const isDisabled = loading && !isActive

          return (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs gap-1.5 px-2.5 transition-all ${
                    isActive
                      ? 'bg-violet-100 text-violet-700 border border-violet-200'
                      : 'hover:bg-violet-50/80 hover:text-violet-700'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && onPreset(preset.id)}
                  onKeyDown={(e) => handleKeyDown(e, preset.id)}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  aria-label={`${preset.label}: ${preset.description}`}
                  onMouseEnter={() => setHovered(preset.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {isActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="opacity-70">{preset.icon}</span>
                  )}
                  <span className="hidden sm:inline">{preset.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <div className="space-y-1">
                  <p className="font-medium">{preset.label}</p>
                  <p className="text-muted-foreground">{preset.description}</p>
                  {preset.shortcut && (
                    <p className="text-[10px] text-violet-600">{preset.shortcut}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}

        {showCustom && onCustom && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 px-2.5 hover:bg-cyan-50/80 hover:text-cyan-700"
                  onClick={onCustom}
                  disabled={loading}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span className="hidden sm:inline">Своя инструкция</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Задать AI произвольную инструкцию по улучшению
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
