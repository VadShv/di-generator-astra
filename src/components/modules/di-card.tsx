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
import { motion } from 'framer-motion'
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
  Shield,
} from 'lucide-react'

export type DIType = 'archive' | 'draft' | 'review' | 'approved'

export interface DICardData {
  id: string
  type: DIType
  title: string
  companyName?: string | null
  departmentName?: string | null
  positionTitle?: string | null
  positionCode?: string | null
  date: string
  content: string
  version?: number | null
  templateName?: string | null
  fileName?: string | null
  author?: string | null
  auditScore?: number | null
  sourceArchiveTitle?: string | null
  derivedCount?: number | null
  filledSections?: number | null
  totalSections?: number | null
}

const TYPE_CONFIG: Record<
  DIType,
  { label: string; icon: React.ElementType; badge: string; iconColor: string; iconBg: string; strip: string }
> = {
  archive: {
    label: 'Архивная',
    icon: Archive,
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    iconColor: 'text-slate-600',
    iconBg: 'bg-slate-100',
    strip: 'bg-slate-400',
  },
  draft: {
    label: 'Сгенерированная',
    icon: Sparkles,
    badge: 'bg-violet-50 text-violet-700 border-violet-300',
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-100',
    strip: 'bg-violet-500',
  },
  review: {
    label: 'На согласовании',
    icon: Clock,
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    strip: 'bg-amber-500',
  },
  approved: {
    label: 'Согласованная',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    strip: 'bg-emerald-500',
  },
}

const WORKFLOW_STEPS: { key: string; label: string }[] = [
  { key: 'draft', label: 'Черновик' },
  { key: 'review', label: 'Согласование' },
  { key: 'approved', label: 'Утверждено' },
]

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d
  }
}

function relativeTime(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    const min = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (min < 1) return 'только что'
    if (min < 60) return `${min} мин назад`
    if (hrs < 24) return `${hrs} ч назад`
    if (days === 1) return 'вчера'
    if (days < 7) return `${days} дн назад`
    return formatDate(d)
  } catch {
    return d
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `…${id.slice(-8)}` : id
}

function AuditRing({ score }: { score: number }) {
  const r = 14
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="relative flex-shrink-0" title={`Аудит: ${score}/100`}>
      <svg width="36" height="36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

function WorkflowStepper({ type }: { type: DIType }) {
  if (type === 'archive') return null
  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.key === type)
  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                done ? 'bg-emerald-500' : active ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              title={step.label}
            />
            {i < WORKFLOW_STEPS.length - 1 && (
              <div className={`h-px w-3 ${done ? 'bg-emerald-500/50' : 'bg-muted-foreground/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((filled / total) * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{filled}/{total}</span>
    </div>
  )
}

export interface DICardProps {
  di: DICardData
  actions?: boolean
  compact?: boolean
  index?: number
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

export function DICard({
  di,
  actions = true,
  compact = false,
  index = 0,
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

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(di.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const previewText = compact ? '' : expanded ? di.content : di.content.slice(0, 500) + (di.content.length > 500 ? '…' : '')
  const filled = di.filledSections ?? 0
  const total = di.totalSections ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4), ease: 'easeOut' }}
    >
      <Card className="w-full transition-shadow hover:shadow-lg group relative overflow-hidden">
        {/* 1.1 — Цветной статус-стрип слева */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.strip}`} />

        <CardHeader className="pb-3 pl-4">
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
              </div>
              <h3 className="text-sm font-semibold mt-1.5 truncate" title={di.title}>
                {di.title}
              </h3>
            </div>
            {/* 1.5 — Аудит-скор как кольцо */}
            {di.auditScore != null ? (
              <AuditRing score={di.auditScore} />
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted/50 flex-shrink-0">
                      <Shield className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Аудит не проводился</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* ID с копированием */}
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

        <CardContent className="pt-0 space-y-3 pl-4">
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

          {/* Метаданные + 1.3 workflow stepper + 1.4 относительное время */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">{relativeTime(di.date)}</span>
                  </TooltipTrigger>
                  <TooltipContent>{formatDate(di.date)}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {di.author && <span>✍ {di.author}</span>}
              {di.fileName && <span className="truncate max-w-[180px]">📎 {di.fileName}</span>}
              {di.templateName && <span>📋 {di.templateName}</span>}
            </div>
            <WorkflowStepper type={di.type} />
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

          {/* 1.2 — Прогресс-бар заполнения */}
          {total > 0 && <FillBar filled={filled} total={total} />}

          {/* 1.6 — Действия с fade-in на hover */}
          {actions && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t opacity-60 group-hover:opacity-100 transition-opacity duration-200">
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
    </motion.div>
  )
}

// 1.7 — Скелетон-лоадер карточки ДИ
export function DICardSkeleton() {
  return (
    <Card className="w-full overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted" />
      <CardHeader className="pb-3 pl-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted animate-pulse flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 pl-4">
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        <div className="h-16 w-full rounded bg-muted animate-pulse" />
        <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
        <div className="flex gap-2 pt-1">
          <div className="h-7 w-20 rounded bg-muted animate-pulse" />
          <div className="h-7 w-20 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

export function diTypeFromStatus(status: string): DIType {
  if (status === 'review') return 'review'
  if (status === 'approved') return 'approved'
  return 'draft'
}
