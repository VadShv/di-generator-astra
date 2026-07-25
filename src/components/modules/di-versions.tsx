'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  History, Loader2, GitCommit, RotateCcw, Eye, Calendar, User, Archive,
  GitCompareArrows, ChevronsUpDown, Sparkles, FileText, CheckCircle2,
} from 'lucide-react'
import { CascadePositionSelector } from './cascade-position-selector'

// ─── Типы данных ───────────────────────────────────────────────

interface GeneratedDI {
  id: string
  title: string
  positionId: string
  status: string
  currentVersion: number
  position: {
    id: string
    title: string
    department: {
      id: string
      name: string
      companyId?: string | null
      company?: { id: string; name: string } | null
    }
  }
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
  _count: { sections: number; versions: number }
}

// Архивная ДИ (старая/загруженная). Версий нет — только текст.
interface ArchiveDI {
  id: string
  title: string
  content: string
  positionId: string | null
  position: {
    id: string
    title: string
    department: { id: string; name: string; companyId?: string | null } | null
  } | null
  uploadedAt: string
  fileName: string | null
}

interface DIVersion {
  id: string
  generatedDIId: string
  content: string
  version: number
  isOriginal: boolean
  uploadedBy: string | null
  fileName: string | null
  diffSummary: string | null
  changeDescription: string | null
  createdAt: string
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified'
  line1?: string
  line2?: string
}

// Унифицированный элемент для сравнения: версия сгенерированной ДИ или архивная ДИ.
// Позволяет сравнивать любые типы ДИ и любые версии между собой.
interface CompareItem {
  key: string // уникальный: 'ver-<id>' или 'arc-<id>'
  kind: 'version' | 'archive'
  label: string
  text: string // сырой content
  meta: string
}

// ─── Метаданные типов ДИ ───────────────────────────────────────

const DI_TYPE_META: Record<string, { label: string; className: string }> = {
  archive: { label: 'Архивная', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  draft: { label: 'Сгенерированная', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  review: { label: 'На согласовании', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  approved: { label: 'Согласованная', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
}

function diTypeLabel(status: string): string {
  if (status === 'review') return 'review'
  if (status === 'approved') return 'approved'
  return 'draft'
}

// ─── Утилиты ───────────────────────────────────────────────────

function computeDiff(text1: string, text2: string): DiffLine[] {
  const l1 = text1.split('\n')
  const l2 = text2.split('\n')
  const result: DiffLine[] = []
  const maxLen = Math.max(l1.length, l2.length)
  for (let i = 0; i < maxLen; i++) {
    const a = i < l1.length ? l1[i] : undefined
    const b = i < l2.length ? l2[i] : undefined
    if (a !== undefined && b !== undefined) {
      result.push(a === b ? { type: 'same', line1: a, line2: b } : { type: 'modified', line1: a, line2: b })
    } else if (a !== undefined) {
      result.push({ type: 'removed', line1: a })
    } else if (b !== undefined) {
      result.push({ type: 'added', line2: b })
    }
  }
  return result
}

// Разворачивает JSON-секции в читаемый текст; при неудаче возвращает исходную строку.
function parseContent(content: string): string {
  try {
    const p = JSON.parse(content)
    const parts: string[] = []
    if (p.title) parts.push(`# ${p.title}`)
    if (p.sections) for (const s of p.sections) { parts.push(`\n## ${s.title}`); parts.push(s.content) }
    return parts.join('\n')
  } catch {
    return content
  }
}

function uploadByLabel(u: string | null): string {
  if (!u) return '—'
  const map: Record<string, string> = {
    'manual': 'Ручное создание',
    'manual-edit': 'Ручное редактирование',
    'ai-generate': 'AI-генерация',
    'ai-mass-generate': 'AI массовая генерация',
    'system': 'Авто-сохранение',
  }
  return map[u] || u
}

// ─── Компонент блока ───────────────────────────────────────────

interface SectionBlockProps {
  title: string
  description?: string
  icon: React.ReactNode
  defaultOpen?: boolean
  disabled?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}

function SectionBlock({ title, description, icon, defaultOpen = true, disabled, badge, children }: SectionBlockProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className={disabled ? 'opacity-60' : ''}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {icon}
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{title}</CardTitle>
                  {description && <CardDescription className="truncate">{description}</CardDescription>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {badge}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={disabled}>
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ─── Основной модуль ───────────────────────────────────────────

export function DIVersionsModule() {
  const { toast } = useToast()
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [archiveDIs, setArchiveDIs] = useState<ArchiveDI[]>([])
  // Версии по ДИ: diId -> версии (ленивая подгрузка при выборе должности).
  const [versionsByDI, setVersionsByDI] = useState<Record<string, DIVersion[]>>({})
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)

  const [selectedDI, setSelectedDI] = useState<GeneratedDI | null>(null)
  const [selectedArchiveDI, setSelectedArchiveDI] = useState<ArchiveDI | null>(null)

  // Единый каскадный фильтр «компания → подразделение → должность».
  const [filterCompanyId, setFilterCompanyId] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('')
  const [filterPositionId, setFilterPositionId] = useState('')

  // Выбранные для сравнения элементы (унифицированный пул).
  const [selectedCompareKeys, setSelectedCompareKeys] = useState<string[]>([])

  // Сравнение: два слота.
  const [compareKey1, setCompareKey1] = useState('')
  const [compareKey2, setCompareKey2] = useState('')
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])
  const [showDiff, setShowDiff] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Диалоги.
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState<{ title: string; text: string } | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<DIVersion | null>(null)

  // ─── Загрузка данных ────────────────────────────────────────

  const fetchDIs = useCallback(async () => {
    try {
      setLoading(true)
      const [genRes, archRes] = await Promise.all([
        fetch('/api/generate-di'),
        fetch('/api/archive-di?linkStatus=all'),
      ])
      if (!genRes.ok || !archRes.ok) throw new Error()
      setGeneratedDIs(await genRes.json())
      setArchiveDIs(await archRes.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Подгрузка версий для конкретной ДИ.
  const fetchVersions = useCallback(async (diId: string) => {
    try {
      const res = await fetch(`/api/compare?generatedDIId=${diId}`)
      if (!res.ok) throw new Error()
      const vers: DIVersion[] = await res.json()
      setVersionsByDI(prev => ({ ...prev, [diId]: vers }))
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить версии', variant: 'destructive' })
    }
  }, [toast])

  // При смене должности — сбрасываем выбор и подгружаем версии всех ДИ этой должности.
  useEffect(() => {
    setSelectedDI(null)
    setSelectedArchiveDI(null)
    setSelectedCompareKeys([])
    setCompareKey1('')
    setCompareKey2('')
    setShowDiff(false)
    setAiSummary(null)
    if (!filterPositionId) {
      setVersionsByDI({})
      return
    }
    // Подгружаем версии для всех сгенерированных ДИ выбранной должности (обычно 1-3 шт.).
    const disForPos = generatedDIs.filter(d => d.positionId === filterPositionId)
    if (disForPos.length > 0) {
      setVersionsLoading(true)
      Promise.all(disForPos.map(d => fetchVersions(d.id))).finally(() => setVersionsLoading(false))
    }
  }, [filterPositionId, generatedDIs, fetchVersions])

  useEffect(() => { fetchDIs() }, [fetchDIs])

  // ─── Фильтрация по каскаду ─────────────────────────────────

  const filteredDIs = useMemo(() => {
    return generatedDIs.filter(d => {
      if (filterPositionId && d.positionId !== filterPositionId) return false
      if (filterDepartmentId && d.position?.department?.id !== filterDepartmentId) return false
      if (filterCompanyId && d.position?.department?.companyId !== filterCompanyId && d.position?.department?.company?.id !== filterCompanyId) return false
      return true
    })
  }, [generatedDIs, filterPositionId, filterDepartmentId, filterCompanyId])

  const filteredArchiveDIs = useMemo(() => {
    return archiveDIs.filter(d => {
      if (filterPositionId && d.positionId !== filterPositionId) return false
      if (filterDepartmentId && d.position?.department?.id !== filterDepartmentId) return false
      if (filterCompanyId && d.position?.department?.companyId !== filterCompanyId) return false
      return true
    })
  }, [archiveDIs, filterPositionId, filterDepartmentId, filterCompanyId])

  // ─── Унифицированный пул сравниваемых элементов ────────────

  // Все сравниваемые элементы для выбранной должности: архивные ДИ + все версии
  // всех сгенерированных ДИ. Позволяет сравнивать любые типы и версии между собой.
  const compareItems = useMemo<CompareItem[]>(() => {
    const items: CompareItem[] = []
    // Архивные ДИ — каждая целиком (без версий).
    for (const a of filteredArchiveDIs) {
      items.push({
        key: `arc-${a.id}`,
        kind: 'archive',
        label: a.title,
        text: a.content,
        meta: 'Архивная',
      })
    }
    // Версии сгенерированных ДИ — каждая версия отдельно.
    for (const d of filteredDIs) {
      const vers = versionsByDI[d.id] || []
      for (const v of vers) {
        items.push({
          key: `ver-${v.id}`,
          kind: 'version',
          label: `${d.title} · v${v.version}${v.isOriginal ? ' (оригинал)' : ''}`,
          text: v.content,
          meta: `${DI_TYPE_META[diTypeLabel(d.status)].label} — ${uploadByLabel(v.uploadedBy)}`,
        })
      }
    }
    return items
  }, [filteredArchiveDIs, filteredDIs, versionsByDI])

  const positionSelected = Boolean(filterPositionId)

  // ─── Обработчики ───────────────────────────────────────────

  const handleSelectDI = (di: GeneratedDI) => {
    setSelectedDI(di)
    setSelectedArchiveDI(null)
  }

  const handleSelectArchiveDI = (di: ArchiveDI) => {
    setSelectedArchiveDI(di)
    setSelectedDI(null)
  }

  const toggleCompare = (key: string) => {
    setSelectedCompareKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= 2) {
        // Заменяем второй слот.
        return [prev[0], key]
      }
      return [...prev, key]
    })
    setShowDiff(false)
    setAiSummary(null)
  }

  const handleCompare = () => {
    const item1 = compareItems.find(i => i.key === compareKey1)
    const item2 = compareItems.find(i => i.key === compareKey2)
    if (!item1 || !item2) {
      toast({ title: 'Ошибка', description: 'Выберите два элемента для сравнения', variant: 'destructive' })
      return
    }
    setDiffLines(computeDiff(parseContent(item1.text), parseContent(item2.text)))
    setShowDiff(true)
    setAiSummary(null)
  }

  const handleAIDiff = async () => {
    const item1 = compareItems.find(i => i.key === compareKey1)
    const item2 = compareItems.find(i => i.key === compareKey2)
    if (!item1 || !item2) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/compare/ai-text-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text1: item1.text,
          text2: item2.text,
          title1: item1.label,
          title2: item2.label,
          context: 'Сравнение должностных инструкций',
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAiSummary(data.aiSummary)
      if (data.diff) setDiffLines(data.diff)
      toast({ title: 'ИИ-анализ готов', description: data.aiSummary ? 'Сравнение выполнено' : 'ИИ-провайдер недоступен — показан текстовый diff' })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить ИИ-анализ', variant: 'destructive' })
    } finally {
      setAiLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!restoringVersion || !selectedDI) return
    try {
      const versionData = JSON.parse(restoringVersion.content)
      const res = await fetch('/api/generate-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDI.id,
          title: versionData.title || selectedDI.title,
          sections: versionData.sections || [],
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Версия восстановлена', description: `Восстановлена версия v${restoringVersion.version}` })
      setRestoreDialogOpen(false)
      setRestoringVersion(null)
      await fetchDIs()
      await fetchVersions(selectedDI.id)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось восстановить версию', variant: 'destructive' })
    }
  }

  const openView = (title: string, text: string) => {
    setViewingItem({ title, text })
    setViewDialogOpen(true)
  }

  // ─── Рендер ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" /> Версии и сравнение ДИ
        </h1>
        <p className="text-sm text-muted-foreground">
          История версий, восстановление и сравнение любых типов должностных инструкций
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Блок 1: Выбор должности */}
          <SectionBlock
            title="1. Выбор должности"
            description="Выберите организацию, подразделение и должность — ДИ появятся после выбора"
            icon={<FileText className="h-5 w-5 text-indigo-600" />}
            badge={
              filterPositionId ? (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Должность выбрана
                </Badge>
              ) : undefined
            }
          >
            <CascadePositionSelector
              positionId={filterPositionId}
              onPositionChange={setFilterPositionId}
              companyId={filterCompanyId}
              departmentId={filterDepartmentId}
              onCompanyChange={setFilterCompanyId}
              onDepartmentChange={setFilterDepartmentId}
            />
            {!positionSelected && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Должностные инструкции появятся после выбора компании, подразделения и должности
              </p>
            )}
          </SectionBlock>

          {/* Блок 2: Список ДИ — только после выбора должности */}
          <SectionBlock
            title="2. Должностные инструкции"
            description={positionSelected ? `Сгенерированные: ${filteredDIs.length} · Архивные: ${filteredArchiveDIs.length}` : 'Недоступно — сначала выберите должность'}
            icon={<Archive className="h-5 w-5 text-violet-600" />}
            defaultOpen={true}
            disabled={!positionSelected}
          >
            {!positionSelected ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Выберите должность в блоке выше
              </p>
            ) : filteredDIs.length === 0 && filteredArchiveDIs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Для выбранной должности нет должностных инструкций
              </p>
            ) : (
              <div className="space-y-3">
                {/* Сгенерированные ДИ (с версиями) */}
                {filteredDIs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">
                      Сгенерированные ({filteredDIs.length})
                    </p>
                    <div className="space-y-1.5">
                      {filteredDIs.map(di => {
                        const t = diTypeLabel(di.status)
                        const meta = DI_TYPE_META[t]
                        const vers = versionsByDI[di.id]
                        return (
                          <div
                            key={di.id}
                            className={`p-3 rounded-lg cursor-pointer text-sm transition-colors border ${
                              selectedDI?.id === di.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-transparent'
                            }`}
                            onClick={() => handleSelectDI(di)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium truncate">{di.title}</p>
                              <Badge variant="outline" className={`text-xs shrink-0 ${meta.className}`}>{meta.label}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <GitCommit className="h-3 w-3" />
                                {vers ? `${vers.length} версий` : '…'}
                              </span>
                              {di.currentVersion && <span>v{di.currentVersion}</span>}
                              {versionsLoading && !vers && <Loader2 className="h-3 w-3 animate-spin" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Архивные ДИ (без версий) */}
                {filteredArchiveDIs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 pb-2 border-t">
                      Архивные ({filteredArchiveDIs.length})
                    </p>
                    <div className="space-y-1.5">
                      {filteredArchiveDIs.map(di => (
                        <div
                          key={di.id}
                          className={`p-3 rounded-lg cursor-pointer text-sm transition-colors border ${
                            selectedArchiveDI?.id === di.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-transparent'
                          }`}
                          onClick={() => handleSelectArchiveDI(di)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{di.title}</p>
                            <Badge variant="outline" className="text-xs shrink-0 bg-slate-100 text-slate-700 border-slate-300">
                              <Archive className="h-3 w-3 mr-1" />Архивная
                            </Badge>
                          </div>
                          {di.fileName && <p className="text-xs text-muted-foreground mt-1">{di.fileName}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionBlock>

          {/* Блок 3: Детали и версии выбранной ДИ */}
          <SectionBlock
            title="3. Детали и версии"
            description={selectedDI ? `${selectedDI.title} · v${selectedDI.currentVersion}` : selectedArchiveDI ? selectedArchiveDI.title : 'Недоступно — выберите ДИ'}
            icon={<GitCommit className="h-5 w-5 text-blue-600" />}
            disabled={!selectedDI && !selectedArchiveDI}
          >
            {selectedDI ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`text-xs ${DI_TYPE_META[diTypeLabel(selectedDI.status)].className}`}>
                    {DI_TYPE_META[diTypeLabel(selectedDI.status)].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{selectedDI.position?.title}</span>
                </div>

                {versionsLoading && !versionsByDI[selectedDI.id] ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                    Отметьте до двух версий для сравнения между собой
                  </p>
                  <div className="space-y-1.5">
                    {(versionsByDI[selectedDI.id] || [])
                      .slice()
                      .sort((a, b) => b.version - a.version)
                      .map(v => {
                        const key = `ver-${v.id}`
                        const checked = selectedCompareKeys.includes(key)
                        return (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between p-2.5 border rounded-lg text-sm transition-colors ${
                              checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleCompare(key)}
                              />
                              <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                              {v.isOriginal && <Badge variant="outline" className="text-xs">Оригинал</Badge>}
                              {v.changeDescription && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {v.changeDescription}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {uploadByLabel(v.uploadedBy)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(v.createdAt).toLocaleDateString('ru-RU')}
                              </div>
                              <Button variant="ghost" size="sm" className="h-7"
                                onClick={() => openView(`Версия v${v.version}`, parseContent(v.content))}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {v.version !== selectedDI.currentVersion && (
                                <Button variant="ghost" size="sm" className="h-7"
                                  onClick={() => { setRestoringVersion(v); setRestoreDialogOpen(true) }}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    {(versionsByDI[selectedDI.id] || []).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Нет сохранённых версий. Версия создаётся автоматически при редактировании ДИ.
                      </p>
                    )}
                  </div>
                  </>
                )}
              </div>
            ) : selectedArchiveDI ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                    <Archive className="h-3 w-3 mr-1" />Архивная
                  </Badge>
                  {selectedArchiveDI.fileName && (
                    <span className="text-xs text-muted-foreground">{selectedArchiveDI.fileName}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Архивные ДИ не имеют истории версий. Текст сохранён как есть и может служить базой для генерации новых ДИ.
                  Отметьте для включения в сравнение.
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCompareKeys.includes(`arc-${selectedArchiveDI.id}`)}
                    onCheckedChange={() => toggleCompare(`arc-${selectedArchiveDI.id}`)}
                  />
                  <span className="text-sm">Добавить в сравнение</span>
                </div>
                <div className="rounded-md border bg-muted/30 p-3 max-h-[300px] overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{selectedArchiveDI.content}</pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Выберите ДИ в блоке выше
              </p>
            )}
          </SectionBlock>

          {/* Блок 4: Сравнение */}
          <SectionBlock
            title="4. Сравнение"
            description={compareItems.length > 0 ? `Доступно элементов: ${compareItems.length}` : 'Недоступно — нет элементов для сравнения'}
            icon={<GitCompareArrows className="h-5 w-5 text-pink-600" />}
            disabled={compareItems.length < 2}
            defaultOpen={false}
          >
            {compareItems.length < 2 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Для сравнения нужно минимум два элемента (версии или архивные ДИ). Отметьте их в блоке «Детали и версии».
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Элемент 1</p>
                    <Select value={compareKey1} onValueChange={v => { setCompareKey1(v); setShowDiff(false); setAiSummary(null) }}>
                      <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                      <SelectContent>
                        {compareItems.map(it => (
                          <SelectItem key={it.key} value={it.key}>
                            {it.label} ({it.meta})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Элемент 2</p>
                    <Select value={compareKey2} onValueChange={v => { setCompareKey2(v); setShowDiff(false); setAiSummary(null) }}>
                      <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                      <SelectContent>
                        {compareItems.map(it => (
                          <SelectItem key={it.key} value={it.key}>
                            {it.label} ({it.meta})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCompare} disabled={!compareKey1 || !compareKey2}>Сравнить</Button>
                </div>

                {showDiff && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Результат сравнения</h4>
                      <Button variant="outline" size="sm" onClick={handleAIDiff} disabled={aiLoading}>
                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        ИИ-анализ
                      </Button>
                    </div>
                    {aiSummary && (
                      <Card><CardContent className="p-3"><p className="text-sm whitespace-pre-wrap">{aiSummary}</p></CardContent></Card>
                    )}
                    <div className="border rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                      {diffLines.map((line, i) => (
                        <div key={i} className={`px-2 py-0.5 ${
                          line.type === 'removed' ? 'bg-red-100 text-red-800' :
                          line.type === 'added' ? 'bg-green-100 text-green-800' :
                          line.type === 'modified' ? 'bg-yellow-100' : ''
                        }`}>
                          {line.type === 'removed' && <span>- {line.line1}</span>}
                          {line.type === 'added' && <span>+ {line.line2}</span>}
                          {line.type === 'same' && <span className="text-muted-foreground">  {line.line1}</span>}
                          {line.type === 'modified' && (
                            <>
                              <div className="text-red-800">- {line.line1}</div>
                              <div className="text-green-800">+ {line.line2}</div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionBlock>
        </>
      )}

      {/* Диалог просмотра */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> {viewingItem?.title}
            </DialogTitle>
            <DialogDescription>Содержание выбранного элемента</DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">
            {viewingItem?.text}
          </pre>
        </DialogContent>
      </Dialog>

      {/* Диалог восстановления версии */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Восстановление версии
            </DialogTitle>
            <DialogDescription>Восстановление предыдущей версии с сохранением текущей в истории</DialogDescription>
          </DialogHeader>
          {restoringVersion && (
            <div className="space-y-3">
              <p className="text-sm">
                Вы собираетесь восстановить <strong>версию v{restoringVersion.version}</strong> должностной инструкции.
              </p>
              {restoringVersion.changeDescription && (
                <p className="text-xs text-muted-foreground">Описание: {restoringVersion.changeDescription}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Текущая версия (v{selectedDI?.currentVersion}) будет сохранена в истории, а содержимое заменится на версию v{restoringVersion.version}.
              </p>
              <Separator />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleRestore}>Восстановить</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
