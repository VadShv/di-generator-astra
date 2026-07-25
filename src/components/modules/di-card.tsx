'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Archive,
  Sparkles,
  Clock,
  CheckCircle2,
  Building2,
  Users,
  Briefcase,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// Тип ДИ: archive | draft | review | approved.
// Соответствует ТЗ TZ_DI_CARDS.md §2 (4 типа ДИ).
export type DIType = 'archive' | 'draft' | 'review' | 'approved'

// Единая карточка ДИ. Используется во всех вкладках (ТЗ §3).
export interface DICardData {
  id: string
  type: DIType
  title: string
  // Привязка к должности/подразделению/компании (может быть null у непривязанной архивной ДИ).
  companyName?: string | null
  departmentName?: string | null
  positionTitle?: string | null
  positionCode?: string | null
  // Дата создания/загрузки.
  date: string
  // Текст ДИ (полный или собранный из секций).
  content: string
  // Опциональные поля.
  version?: number | null
  templateName?: string | null
  fileName?: string | null
  author?: string | null
  auditScore?: number | null
  sourceArchiveTitle?: string | null
  derivedCount?: number | null
}

// Конфигурация типа: цвет, иконка, подпись (ТЗ §2.1).
const TYPE_CONFIG: Record<
  DIType,
  { label: string; icon: React.ElementType; badge: string; iconColor: string; iconBg: string }
> = {
  archive: {
    label: 'Архивная',
    icon: Archive,
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
  },
  draft: {
    label: 'Сгенерированная',
    icon: Sparkles,
    badge: 'bg-violet-50 text-violet-700 border-violet-300',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
  },
  review: {
    label: 'На согласовании',
    icon: Clock,
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  approved: {
    label: 'Согласованная',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
  },
}

// Форматирование даты в формате ДД.ММ.ГГГГ.
function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d
  }
}

// Сокращённый идентификатор (последние 8 символов cuid).
function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-8)}` : id
}

export interface DICardProps {
  di: DICardData
  // Показывать ли кнопки действий (по умолчанию true).
  actions?: boolean
  // Компактный режим: меньше текста, без предпросмотра.
  compact?: boolean
  // Действия (прокидываются снаружи, т.к. зависят от вкладки).
  onOpen?: (di: DICardData) => void
  onEdit?: (di: DICardData) => void
  onSendForReview?: (di: DICardData) => void
  onApprove?: (di: DICardData) => void
  onReturn?: (di: DICardData) => void
  onUploadRevision?: (di: DICardData) => void
  onCompare?: (di: DICardData) => void
  onExport?: (di: DICardData) => void
  onCreateFromArchive?: (di: DICardData) => void
  onDelete?: (di: DICardData) => void
}

/**
 * Единая карточка должностной инструкции (ТЗ §3).
 *
 * Содержит обязательные поля: идентификатор, тип-бейдж, название,
 * компания/подразделение/должность, дата, текст. Действия зависят от типа
 * и прокидываются снаружи через колбэки.
 */
export function DICard({
  di,
  actions = true,
  compact = false,
  onOpen,
  onEdit,
  onSendForReview,
  onApprove,
  onReturn,
  onUploadRevision,
  onCompare,
  onExport,
  onCreateFromArchive,
  onDelete,
}: DICardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const cfg = TYPE_CONFIG[di.type]
  const Icon = cfg.icon

  // Копирование полного ID в буфер обмена.
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(di.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Буфер обмена недоступен — игнорируем.
    }
  }

  const previewText = compact ? '' : expanded ? di.content : di.content.slice(0, 500) + (di.content.length > 500 ? '…' : '')

  return (
    <Card className="w-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className={`flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 ${cfg.iconBg}`}>
            <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                {cfg.label}
              </Badge>
              {di.version != null && (
                <Badge variant="outline" className="text-xs text-muted-foreground">v{di.version}</Badge>
              )}
              {di.sourceArchiveTitle && (
                <Badge variant="outline" className="text-xs text-slate-500">
                  <Archive className="h-3 w-3 mr-1" /> на базе архивной
                </Badge>
              )}
              {di.derivedCount != null && di.derivedCount > 0 && (
                <Badge variant="outline" className="text-xs text-slate-500">
                  {di.derivedCount} произв.
                </Badge>
              )}
              {di.auditScore != null && (
                <Badge variant="outline" className="text-xs">
                  аудит: {di.auditScore}/100
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold mt-1.5 truncate" title={di.title}>
              {di.title}
            </h3>
          </div>
          {/* Идентификатор с копированием */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={copyId}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                  title="Скопировать ID"
                >
                  {shortId(di.id)}
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-mono text-xs">{di.id}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Привязка: компания · подразделение · должность */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {di.companyName ? (
            <span className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {di.companyName}
            </span>
          ) : (
            <span className="flex items-center gap-1 italic">
              <Building2 className="h-3.5 w-3.5" /> не привязана
            </span>
          )}
          {di.departmentName && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {di.departmentName}
            </span>
          )}
          {di.positionTitle && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" /> {di.positionTitle}
              {di.positionCode && <span className="opacity-60">({di.positionCode})</span>}
            </span>
          )}
        </div>

        {/* Метаданные: дата, автор, файл, шаблон */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>📅 {formatDate(di.date)}</span>
          {di.author && <span>✍ {di.author}</span>}
          {di.fileName && <span className="truncate max-w-[180px]">📎 {di.fileName}</span>}
          {di.templateName && <span>📋 {di.templateName}</span>}
        </div>

        {/* Текст ДИ (предпросмотр/полный) */}
        {!compact && di.content && (
          <div>
            <div className={`text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed ${expanded ? '' : 'line-clamp-[10]'}`}>
              {previewText}
            </div>
            {di.content.length > 500 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
              >
                {expanded ? <><ChevronUp className="h-3 w-3" /> Свернуть</> : <><ChevronDown className="h-3 w-3" /> Развернуть</>}
              </button>
            )}
          </div>
        )}

        {/* Действия */}
        {actions && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
            {onOpen && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpen(di)}>
                Открыть
              </Button>
            )}
            {di.type === 'draft' && onEdit && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(di)}>
                Редактировать
              </Button>
            )}
            {di.type === 'draft' && onSendForReview && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700" onClick={() => onSendForReview(di)}>
                На согласование
              </Button>
            )}
            {di.type === 'review' && onApprove && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700" onClick={() => onApprove(di)}>
                Утвердить
              </Button>
            )}
            {di.type === 'review' && onReturn && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReturn(di)}>
                Вернуть
              </Button>
            )}
            {(di.type === 'draft' || di.type === 'review') && onUploadRevision && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUploadRevision(di)}>
                Загрузить с правками
              </Button>
            )}
            {onCompare && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCompare(di)}>
                Сравнить
              </Button>
            )}
            {onExport && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onExport(di)}>
                Выгрузить
              </Button>
            )}
            {di.type === 'archive' && onCreateFromArchive && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-violet-700" onClick={() => onCreateFromArchive(di)}>
                Создать на базе
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={() => onDelete(di)}>
                Удалить
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Утилита: вычислить тип ДИ по статусу GeneratedDI (для маппинга в DICardData).
export function diTypeFromStatus(status: string): DIType {
  if (status === 'review') return 'review'
  if (status === 'approved') return 'approved'
  return 'draft'
}
