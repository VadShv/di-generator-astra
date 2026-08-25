'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Trash2, ClipboardList, Tag, Loader2, Building2, Users, Briefcase,
  FileText, GitCommitVertical, ShieldCheck, Archive, GitBranch, CheckCircle2,
  Clock, AlertTriangle, MessageSquarePlus, Flag,
} from 'lucide-react'
import { TableSkeleton } from '@/components/skeletons'
import { CascadePositionSelector } from './cascade-position-selector'

// ============ Типы ============
interface Company { id: string; name: string }
interface TrackingTag {
  id: string
  entityType: string
  entityId: string
  label: string
  kind: string
  color: string
  assignee: string | null
  dueDate: string | null
  note: string | null
  isResolved: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  _count?: { activityLogs: number }
}
interface FeedEvent {
  id: string
  type: string
  title: string
  description: string | null
  author: string | null
  createdAt: string
  entityType: string | null
  entityId: string | null
  diId: string | null
  diTitle: string | null
  tagId: string | null
  metadata: Record<string, unknown>
}
interface ActivityLog {
  id: string
  actionType: string
  entityType: string | null
  entityId: string | null
  tagId: string | null
  title: string
  description: string | null
  author: string | null
  createdAt: string
  tag?: { id: string; label: string } | null
}
interface AuditLogEntry {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  method: string
  path: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

// ============ Конфигурация меток ============
const TAG_KINDS = [
  { value: 'status', label: 'Статус процесса' },
  { value: 'priority', label: 'Приоритет' },
  { value: 'watch', label: 'На контроле' },
  { value: 'milestone', label: 'Веха' },
]
const TAG_COLORS = [
  { value: 'slate', label: 'Серый', badge: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500' },
  { value: 'amber', label: 'Янтарный', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  { value: 'red', label: 'Красный', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  { value: 'emerald', label: 'Зелёный', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  { value: 'blue', label: 'Синий', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  { value: 'violet', label: 'Фиолетовый', badge: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  { value: 'orange', label: 'Оранжевый', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
]
function colorMeta(c: string) { return TAG_COLORS.find(x => x.value === c) ?? TAG_COLORS[1] }
function kindLabel(k: string) { return TAG_KINDS.find(x => x.value === k)?.label ?? k }

// ============ Конфигурация ленты событий ============
const EVENT_META: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  di_created: { icon: FileText, color: 'text-blue-600', label: 'Создание ДИ' },
  di_updated: { icon: GitCommitVertical, color: 'text-slate-600', label: 'Обновление ДИ' },
  version_created: { icon: GitCommitVertical, color: 'text-violet-600', label: 'Версия ДИ' },
  audit: { icon: ShieldCheck, color: 'text-amber-600', label: 'Аудит' },
  archive_uploaded: { icon: Archive, color: 'text-teal-600', label: 'Архив' },
  status_change: { icon: GitBranch, color: 'text-indigo-600', label: 'Смена статуса' },
  tag_created: { icon: Tag, color: 'text-orange-600', label: 'Метка' },
  tag_resolved: { icon: CheckCircle2, color: 'text-emerald-600', label: 'Метка закрыта' },
  note: { icon: MessageSquarePlus, color: 'text-slate-600', label: 'Заметка' },
  comment: { icon: MessageSquarePlus, color: 'text-slate-600', label: 'Комментарий' },
  milestone: { icon: Flag, color: 'text-violet-600', label: 'Веха' },
  reminder: { icon: Clock, color: 'text-amber-600', label: 'Напоминание' },
}
function eventMeta(t: string) { return EVENT_META[t] ?? { icon: ClipboardList, color: 'text-slate-600', label: t } }

// ============ Сущность: подпись выбранного уровня ============
function entityMeta(type: string | null) {
  if (type === 'company') return { icon: Building2, label: 'Организация' }
  if (type === 'department') return { icon: Users, label: 'Подразделение' }
  if (type === 'position') return { icon: Briefcase, label: 'Должность' }
  return { icon: ClipboardList, label: 'Все' }
}

function formatAuditDate(iso: string) {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} ${timeStr}`
}

function methodBadgeClass(method: string) {
  switch (method) {
    case 'GET': return 'bg-blue-100 text-blue-800'
    case 'POST': return 'bg-emerald-100 text-emerald-800'
    case 'PUT': return 'bg-amber-100 text-amber-800'
    case 'DELETE': return 'bg-red-100 text-red-800'
    default: return 'bg-slate-100 text-slate-800'
  }
}

const ACTION_TYPES = [
  { value: 'note', label: 'Заметка' },
  { value: 'comment', label: 'Комментарий' },
  { value: 'status_change', label: 'Смена статуса' },
  { value: 'milestone', label: 'Веха' },
  { value: 'reminder', label: 'Напоминание' },
]

export function TrackingModule() {
  const { toast } = useToast()

  // Выбор сущности через каскадный селектор.
  const [selCompanyId, setSelCompanyId] = useState('')
  const [selDepartmentId, setSelDepartmentId] = useState('')
  const [selPositionId, setSelPositionId] = useState('')

  // Текущий фокус меток: наиболее конкретная выбранная сущность.
  const focus = useMemo(() => {
    if (selPositionId) return { entityType: 'position', entityId: selPositionId }
    if (selDepartmentId) return { entityType: 'department', entityId: selDepartmentId }
    if (selCompanyId) return { entityType: 'company', entityId: selCompanyId }
    return null
  }, [selPositionId, selDepartmentId, selCompanyId])

  // Данные.
  const [tags, setTags] = useState<TrackingTag[]>([])
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])

  // Фильтр ленты: всё или только по текущему фокусу.
  const [feedScope, setFeedScope] = useState<'focus' | 'all'>('all')

  // Диалог метки.
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TrackingTag | null>(null)
  const [tagForm, setTagForm] = useState({ label: '', kind: 'status', color: 'amber', assignee: '', dueDate: '', note: '' })

  // Диалог записи журнала.
  const [logDialogOpen, setLogDialogOpen] = useState(false)
  const [logForm, setLogForm] = useState({ actionType: 'note', title: '', description: '', author: '' })

  // Удаление.
  const [tagToDelete, setTagToDelete] = useState<TrackingTag | null>(null)

  // Журнал всех действий (audit log).
  const [auditPage, setAuditPage] = useState(1)
  const [auditItems, setAuditItems] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)
  const auditPageSize = 50

  // ============ Загрузка ============
  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch('/api/companies'); if (res.ok) setCompanies(await res.json()) } catch { /* silent */ }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      setTagsLoading(true)
      const params = new URLSearchParams()
      if (focus) { params.set('entityType', focus.entityType); params.set('entityId', focus.entityId) }
      const res = await fetch(`/api/tracking-tags?${params.toString()}`)
      if (!res.ok) throw new Error()
      setTags(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить метки', variant: 'destructive' })
    } finally {
      setTagsLoading(false)
    }
  }, [focus, toast])

  const fetchFeed = useCallback(async () => {
    try {
      setFeedLoading(true)
      const params = new URLSearchParams({ limit: '150' })
      if (feedScope === 'focus' && focus) {
        params.set('entityType', focus.entityType)
        params.set('entityId', focus.entityId)
      }
      const res = await fetch(`/api/activity-feed?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFeed(data.events ?? [])
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить ленту действий', variant: 'destructive' })
    } finally {
      setFeedLoading(false)
    }
  }, [feedScope, focus, toast])

  const fetchAuditLog = useCallback(async () => {
    try {
      setAuditLoading(true)
      const res = await fetch(`/api/audit-log?page=${auditPage}&pageSize=${auditPageSize}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAuditItems(data.items ?? [])
      setAuditTotal(data.total ?? 0)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить журнал действий', variant: 'destructive' })
    } finally {
      setAuditLoading(false)
    }
  }, [auditPage, toast])

  useEffect(() => { fetchCompanies() }, [fetchCompanies])
  useEffect(() => { fetchTags() }, [fetchTags])
  useEffect(() => { fetchFeed() }, [fetchFeed])
  useEffect(() => { fetchAuditLog() }, [fetchAuditLog])

  // ============ Действия с метками ============
  const openCreateTag = () => {
    setEditingTag(null)
    setTagForm({ label: '', kind: 'status', color: 'amber', assignee: '', dueDate: '', note: '' })
    setTagDialogOpen(true)
  }
  const openEditTag = (t: TrackingTag) => {
    setEditingTag(t)
    setTagForm({
      label: t.label,
      kind: t.kind,
      color: t.color,
      assignee: t.assignee || '',
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
      note: t.note || '',
    })
    setTagDialogOpen(true)
  }

  const handleSaveTag = async () => {
    if (!focus) { toast({ title: 'Выберите сущность', description: 'Сначала выберите организацию, подразделение или должность', variant: 'destructive' }); return }
    if (!tagForm.label.trim()) { toast({ title: 'Ошибка', description: 'Введите название метки', variant: 'destructive' }); return }
    try {
      const payload = {
        entityType: focus.entityType,
        entityId: focus.entityId,
        label: tagForm.label.trim(),
        kind: tagForm.kind,
        color: tagForm.color,
        assignee: tagForm.assignee || null,
        dueDate: tagForm.dueDate || null,
        note: tagForm.note || null,
      }
      if (editingTag) {
        const res = await fetch('/api/tracking-tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingTag.id, ...payload }) })
        if (!res.ok) throw new Error()
        toast({ title: 'Метка обновлена' })
      } else {
        const res = await fetch('/api/tracking-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error()
        toast({ title: 'Метка добавлена' })
      }
      setTagDialogOpen(false)
      fetchTags()
      fetchFeed()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить метку', variant: 'destructive' })
    }
  }

  const toggleTagResolved = async (t: TrackingTag) => {
    try {
      const res = await fetch('/api/tracking-tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, isResolved: !t.isResolved }) })
      if (!res.ok) throw new Error()
      fetchTags()
      fetchFeed()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось изменить статус метки', variant: 'destructive' })
    }
  }

  const handleDeleteTag = async () => {
    if (!tagToDelete) return
    try {
      const res = await fetch('/api/tracking-tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tagToDelete.id }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Метка удалена' })
      setTagToDelete(null)
      fetchTags()
      fetchFeed()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить метку', variant: 'destructive' })
    }
  }

  // ============ Действия с журналом ============
  const openCreateLog = () => {
    setLogForm({ actionType: 'note', title: '', description: '', author: '' })
    setLogDialogOpen(true)
  }

  const handleSaveLog = async () => {
    if (!logForm.title.trim()) { toast({ title: 'Ошибка', description: 'Введите заголовок записи', variant: 'destructive' }); return }
    try {
      const payload = {
        actionType: logForm.actionType,
        title: logForm.title.trim(),
        description: logForm.description || null,
        author: logForm.author || null,
        entityType: focus?.entityType || null,
        entityId: focus?.entityId || null,
      }
      const res = await fetch('/api/activity-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      toast({ title: 'Запись добавлена в журнал' })
      setLogDialogOpen(false)
      fetchFeed()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось добавить запись', variant: 'destructive' })
    }
  }

  // ============ Производные метрики ============
  const now = Date.now()
  const activeTags = tags.filter(t => !t.isResolved)
  const overdueTags = activeTags.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now)
  const focusMeta = entityMeta(focus?.entityType ?? null)

  // Группировка ленты по дням.
  const feedByDay = useMemo(() => {
    const groups: Record<string, FeedEvent[]> = {}
    for (const ev of feed) {
      const day = new Date(ev.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
      if (!groups[day]) groups[day] = []
      groups[day].push(ev)
    }
    return groups
  }, [feed])

  return (
    <div className="space-y-4">
      <Tabs defaultValue="tracking">
        <TabsList>
          <TabsTrigger value="tracking">Отслеживание</TabsTrigger>
          <TabsTrigger value="audit">Все действия</TabsTrigger>
        </TabsList>
        <TabsContent value="tracking" className="space-y-4">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Журнал действий</h1>
          <p className="text-sm text-muted-foreground">История создания и изменений ДИ, метки отслеживания процесса</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateLog}><MessageSquarePlus className="h-4 w-4 mr-1" /> Запись в журнал</Button>
          <Button onClick={openCreateTag}><Tag className="h-4 w-4 mr-1" /> Добавить метку</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Левая колонка: выбор сущности + метки */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Область отслеживания</CardTitle></CardHeader>
            <CardContent>
              <CascadePositionSelector
                positionId={selPositionId}
                onPositionChange={setSelPositionId}
                companyId={selCompanyId}
                departmentId={selDepartmentId}
                onCompanyChange={setSelCompanyId}
                onDepartmentChange={setSelDepartmentId}
                companies={companies}
                compact
              />
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <focusMeta.icon className="h-3.5 w-3.5" />
                <span>Фокус: {focusMeta.label.toLowerCase()}{focus ? '' : ' (не выбран)'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" /> Метки отслеживания</CardTitle>
                {focus && <Button size="sm" variant="ghost" onClick={openCreateTag}><Plus className="h-3.5 w-3.5" /></Button>}
              </div>
            </CardHeader>
            <CardContent>
              {!focus ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Выберите организацию, подразделение или должность, чтобы накидывать метки
                </div>
              ) : tagsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : tags.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Меток пока нет
                  <Button size="sm" variant="outline" className="mt-3" onClick={openCreateTag}><Plus className="h-3.5 w-3.5 mr-1" /> Добавить метку</Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[420px]">
                  <div className="space-y-2 pr-2">
                    {tags.map(t => {
                      const cm = colorMeta(t.color)
                      const overdue = !t.isResolved && t.dueDate && new Date(t.dueDate).getTime() < now
                      return (
                        <div key={t.id} className={`rounded-lg border p-3 ${t.isResolved ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2.5 w-2.5 rounded-full ${cm.dot} flex-shrink-0`} />
                              <span className="font-medium text-sm truncate">{t.label}</span>
                            </div>
                            <Badge variant="outline" className="text-xs flex-shrink-0">{kindLabel(t.kind)}</Badge>
                          </div>
                          {t.note && <p className="text-xs text-muted-foreground mt-1">{t.note}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge className={`text-xs ${cm.badge} border-0`}>{t.entityType === 'company' ? 'Орг.' : t.entityType === 'department' ? 'Подразд.' : 'Должн.'}</Badge>
                            {t.assignee && <Badge variant="secondary" className="text-xs">{t.assignee}</Badge>}
                            {t.dueDate && (
                              <Badge variant={overdue ? 'destructive' : 'outline'} className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />{new Date(t.dueDate).toLocaleDateString('ru-RU')}
                              </Badge>
                            )}
                            {overdue && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Просрочено</Badge>}
                            {t.isResolved && <Badge className="text-xs bg-emerald-100 text-emerald-800 border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Закрыта</Badge>}
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Button variant="outline" size="sm" className="h-7" onClick={() => toggleTagResolved(t)}>
                              {t.isResolved ? 'Открыть' : 'Закрыть'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-7" onClick={() => openEditTag(t)}>Изменить</Button>
                            <Button variant="outline" size="sm" className="h-7 text-destructive" onClick={() => setTagToDelete(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Правая колонка: метрики + лента */}
        <div className="lg:col-span-7 space-y-4">
          {/* Метрики */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Всего меток</p><p className="text-2xl font-bold">{tags.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Активных</p><p className="text-2xl font-bold text-blue-600">{activeTags.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Просрочено</p><p className="text-2xl font-bold text-red-600">{overdueTags.length}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Событий в ленте</p><p className="text-2xl font-bold text-violet-600">{feed.length}</p></CardContent></Card>
          </div>

          {/* Лента действий */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Лента действий</CardTitle>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={feedScope === 'all' ? 'default' : 'outline'} onClick={() => setFeedScope('all')}>Все</Button>
                  <Button size="sm" variant={feedScope === 'focus' ? 'default' : 'outline'} onClick={() => setFeedScope('focus')} disabled={!focus}>По фокусу</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <TableSkeleton rows={6} cols={4} />
              ) : feed.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Пока нет событий</p>
                  <p className="text-xs mt-1">Создавайте ДИ, запускайте аудиты, добавляйте метки и записи — они появятся здесь</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[560px]">
                  <div className="space-y-4 pr-2">
                    {Object.entries(feedByDay).map(([day, evs]) => (
                      <div key={day}>
                        <div className="sticky top-0 bg-card py-1 z-10">
                          <p className="text-xs font-medium text-muted-foreground">{day}</p>
                          <Separator className="mt-1" />
                        </div>
                        <div className="space-y-1 mt-2">
                          {evs.map(ev => {
                            const em = eventMeta(ev.type)
                            const Icon = em.icon
                            return (
                              <div key={ev.id} className="flex gap-3 py-2">
                                <div className="flex-shrink-0 mt-0.5">
                                  <Icon className={`h-4 w-4 ${em.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate">{ev.title}</p>
                                    <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(ev.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <Badge variant="outline" className="text-xs">{em.label}</Badge>
                                    {ev.author && <Badge variant="secondary" className="text-xs">{ev.author}</Badge>}
                                    {ev.diTitle && <Badge variant="outline" className="text-xs truncate max-w-[200px]">{ev.diTitle}</Badge>}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Журнал всех действий</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : auditItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Записей пока нет</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата/Время</TableHead>
                        <TableHead>Пользователь</TableHead>
                        <TableHead>Действие</TableHead>
                        <TableHead>Метод</TableHead>
                        <TableHead>Путь</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{formatAuditDate(item.createdAt)}</TableCell>
                          <TableCell>{item.userEmail || item.userId || '—'}</TableCell>
                          <TableCell>{item.action}</TableCell>
                          <TableCell><Badge className={`text-xs border-0 ${methodBadgeClass(item.method)}`}>{item.method}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{item.path}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Страница {auditPage} · всего {auditTotal}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={auditPage <= 1 || auditLoading} onClick={() => setAuditPage(p => Math.max(1, p - 1))}>Назад</Button>
                      <Button size="sm" variant="outline" disabled={auditPage * auditPageSize >= auditTotal || auditLoading} onClick={() => setAuditPage(p => p + 1)}>Далее</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Диалог метки */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTag ? 'Редактировать метку' : 'Новая метка отслеживания'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!focus && <p className="text-sm text-amber-600">Сначала выберите сущность в области отслеживания.</p>}
            <div><Label>Название *</Label><Input value={tagForm.label} onChange={e => setTagForm({ ...tagForm, label: e.target.value })} placeholder="Напр. «Согласование с юр.отделом»" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Категория</Label><Select value={tagForm.kind} onValueChange={v => setTagForm({ ...tagForm, kind: v })}><SelectTrigger /><SelectContent>{TAG_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Цвет</Label><Select value={tagForm.color} onValueChange={v => setTagForm({ ...tagForm, color: v })}><SelectTrigger /><SelectContent>{TAG_COLORS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ответственный</Label><Input value={tagForm.assignee} onChange={e => setTagForm({ ...tagForm, assignee: e.target.value })} /></div>
              <div><Label>Дедлайн</Label><Input type="date" value={tagForm.dueDate} onChange={e => setTagForm({ ...tagForm, dueDate: e.target.value })} /></div>
            </div>
            <div><Label>Пояснение</Label><Textarea value={tagForm.note} onChange={e => setTagForm({ ...tagForm, note: e.target.value })} className="min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveTag} disabled={!focus}>{editingTag ? 'Сохранить' : 'Добавить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог записи журнала */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Запись в журнал</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Тип записи</Label><Select value={logForm.actionType} onValueChange={v => setLogForm({ ...logForm, actionType: v })}><SelectTrigger /><SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Заголовок *</Label><Input value={logForm.title} onChange={e => setLogForm({ ...logForm, title: e.target.value })} placeholder="Краткое описание действия" /></div>
            <div><Label>Описание</Label><Textarea value={logForm.description} onChange={e => setLogForm({ ...logForm, description: e.target.value })} className="min-h-[80px]" /></div>
            <div><Label>Автор</Label><Input value={logForm.author} onChange={e => setLogForm({ ...logForm, author: e.target.value })} /></div>
            {focus && <p className="text-xs text-muted-foreground">Запись будет привязана к выбранной {focusMeta.label.toLowerCase()}.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSaveLog}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Удаление метки */}
      <AlertDialog open={!!tagToDelete} onOpenChange={(o) => !o && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить метку?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Метка «{tagToDelete?.label}» будет удалена безвозвратно.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
