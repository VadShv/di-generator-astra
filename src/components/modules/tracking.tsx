'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, GitBranch, Download, Loader2, Building2, ShieldAlert } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department }
interface GeneratedDI { id: string; positionId: string; title: string; status: string; position: Position; trackings: DITracking[]; createdAt: string; updatedAt: string }
interface DITracking { id: string; generatedDIId: string; status: string; assignee: string | null; notes: string | null; createdAt: string; generatedDI?: GeneratedDI }

// Типы дашборда покрытия.
interface Company { id: string; name: string }
interface DashboardPosition {
  positionId: string; positionTitle: string; positionCode: string; grade: string | null
  diStatus: 'actual' | 'outdated' | 'audit' | 'missing'
  diId: string | null; diTitle: string | null; diDbStatus: string | null; updatedAt: string | null
}
interface DashboardDepartment {
  departmentId: string; departmentName: string; departmentCode: string
  company: { id: string; name: string } | null
  summary: { total: number; actual: number; outdated: number; audit: number; missing: number }
  positions: DashboardPosition[]
}
interface DashboardData { overall: { total: number; actual: number; outdated: number; audit: number; missing: number }; departments: DashboardDepartment[] }

const STATUSES = [
  { value: 'draft', label: 'Черновик', color: 'bg-slate-200 text-slate-800' },
  { value: 'sent_for_review', label: 'На рассмотрении', color: 'bg-amber-100 text-amber-800' },
  { value: 'returned_with_comments', label: 'Возвращена с комментариями', color: 'bg-orange-100 text-orange-800' },
  { value: 'approved', label: 'Согласована', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'rejected', label: 'Отклонена', color: 'bg-red-100 text-red-800' },
  { value: 'signed', label: 'Подписана', color: 'bg-teal-100 text-teal-800' },
  { value: 'cancelled', label: 'Отменена', color: 'bg-gray-100 text-gray-800' },
]

// Цветовая индикация статуса покрытия ДИ.
const DI_STATUS_META: Record<string, { label: string; dot: string; badge: string }> = {
  actual: { label: 'Актуальна', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
  outdated: { label: 'Требует обновления', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  audit: { label: 'На аудите', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  missing: { label: 'Отсутствует', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
}

function getStatusInfo(status: string) { return STATUSES.find(s => s.value === status) ?? STATUSES[0] }

export function TrackingModule() {
  const { toast } = useToast()
  const [trackings, setTrackings] = useState<DITracking[]>([])
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Дашборд покрытия.
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashCompanyFilter, setDashCompanyFilter] = useState<string>('all')
  const [dashStatusFilter, setDashStatusFilter] = useState<string>('all')
  const [companies, setCompanies] = useState<Company[]>([])
  const [exporting, setExporting] = useState(false)
  const [batchAuditOpen, setBatchAuditOpen] = useState(false)
  const [batchAuditLoading, setBatchAuditLoading] = useState(false)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchTarget, setBatchTarget] = useState<{ ids: string[]; label: string }>({ ids: [], label: '' })

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Form
  const [formDIId, setFormDIId] = useState('')
  const [formStatus, setFormStatus] = useState('sent_for_review')
  const [formAssignee, setFormAssignee] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [selectedTracking, setSelectedTracking] = useState<DITracking | null>(null)
  const [timelineDIId, setTimelineDIId] = useState<string | null>(null)

  const fetchTrackings = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`/api/tracking?${params.toString()}`)
      if (!res.ok) throw new Error()
      setTrackings(await res.json())
    } catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить данные', variant: 'destructive' }) }
  }, [filterStatus, toast])

  const fetchDIs = useCallback(async () => {
    try { const res = await fetch('/api/generated-di'); if (!res.ok) throw new Error(); setGeneratedDIs(await res.json()) } catch { /* silent */ }
  }, [])

  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch('/api/companies'); if (res.ok) setCompanies(await res.json()) } catch { /* silent */ }
  }, [])

  const fetchDashboard = useCallback(async () => {
    try {
      setDashboardLoading(true)
      const params = new URLSearchParams()
      if (dashCompanyFilter !== 'all') params.set('companyId', dashCompanyFilter)
      if (dashStatusFilter !== 'all') params.set('status', dashStatusFilter)
      const res = await fetch(`/api/tracking/dashboard?${params.toString()}`)
      if (!res.ok) throw new Error()
      setDashboard(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить дашборд', variant: 'destructive' })
    } finally {
      setDashboardLoading(false)
    }
  }, [dashCompanyFilter, dashStatusFilter, toast])

  useEffect(() => { (async () => { setLoading(true); await Promise.all([fetchTrackings(), fetchDIs(), fetchCompanies()]); setLoading(false) })() }, [fetchTrackings, fetchDIs, fetchCompanies])
  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const resetForm = () => { setFormDIId(''); setFormStatus('sent_for_review'); setFormAssignee(''); setFormNotes('') }

  const handleCreate = async () => {
    if (!formDIId || !formStatus) { toast({ title: 'Ошибка', description: 'Выберите ДИ и статус', variant: 'destructive' }); return }
    try {
      const res = await fetch('/api/tracking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: formDIId, status: formStatus, assignee: formAssignee || null, notes: formNotes || null }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Запись добавлена' }); resetForm(); setAddDialogOpen(false); fetchTrackings(); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось создать запись', variant: 'destructive' }) }
  }

  const handleStatusChange = async () => {
    if (!selectedTracking) return
    try {
      const res = await fetch('/api/tracking', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedTracking.id, status: formStatus, assignee: formAssignee || selectedTracking.assignee, notes: formNotes || selectedTracking.notes }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Статус обновлён' }); setStatusDialogOpen(false); setSelectedTracking(null); resetForm(); fetchTrackings(); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось обновить', variant: 'destructive' }) }
  }

  const handleDelete = async () => {
    if (!selectedTracking) return
    try {
      const res = await fetch('/api/tracking', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedTracking.id }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Удалено' }); setDeleteDialogOpen(false); setSelectedTracking(null); fetchTrackings()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' }) }
  }

  const handleUpdateDIStatus = async (diId: string, status: string) => {
    try {
      const res = await fetch('/api/tracking/update-di-status', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: diId, status }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Статус ДИ обновлён' }); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось обновить статус ДИ', variant: 'destructive' }) }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (dashCompanyFilter !== 'all') params.set('companyId', dashCompanyFilter)
      const res = await fetch(`/api/tracking/export?${params.toString()}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `di-tracking-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Успешно', description: 'Отчёт экспортирован в Excel' })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось экспортировать отчёт', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // Пакетный аудит ДИ выбранных подразделений.
  const handleBatchAudit = async () => {
    try {
      setBatchAuditLoading(true)
      const res = await fetch('/api/generate-di/batch-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diIds: batchTarget.ids }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast({ title: 'Аудит завершён', description: `Проверено ${data.successCount} из ${data.total}. Ошибок: ${data.failCount}` })
      setBatchAuditOpen(false)
      fetchDashboard()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить пакетный аудит', variant: 'destructive' })
    } finally {
      setBatchAuditLoading(false)
    }
  }

  // Пакетное удаление ДИ.
  const handleBatchDelete = async () => {
    try {
      setBatchAuditLoading(true)
      const res = await fetch('/api/generate-di/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diIds: batchTarget.ids, confirm: true }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast({ title: 'Удаление завершено', description: `Удалено ${data.successCount} из ${data.total}. Ошибок: ${data.failCount}` })
      setBatchDeleteOpen(false)
      fetchDashboard()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить ДИ', variant: 'destructive' })
    } finally {
      setBatchAuditLoading(false)
    }
  }

  // Get latest tracking per DI
  const latestPerDI: Record<string, DITracking> = {}
  for (const t of trackings) { if (!latestPerDI[t.generatedDIId] || new Date(t.createdAt) > new Date(latestPerDI[t.generatedDIId].createdAt)) latestPerDI[t.generatedDIId] = t }

  const disWithTracking = generatedDIs.filter(di => latestPerDI[di.id]).map(di => ({ ...di, latestTracking: latestPerDI[di.id] }))
  const filteredDIs = disWithTracking.filter(di => {
    if (searchQuery) { const q = searchQuery.toLowerCase(); return di.title.toLowerCase().includes(q) || di.position?.title?.toLowerCase().includes(q) || (di.latestTracking.assignee && di.latestTracking.assignee.toLowerCase().includes(q)) }
    return true
  })

  // Kanban columns
  const kanbanColumns = STATUSES.map(s => ({ ...s, items: filteredDIs.filter(di => di.latestTracking.status === s.value) }))

  // Stats
  const stats = STATUSES.map(s => ({ ...s, count: disWithTracking.filter(di => di.latestTracking.status === s.value).length }))

  const ov = dashboard?.overall
  const pct = (n: number) => (ov && ov.total > 0 ? Math.round((n / ov.total) * 100) : 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><GitBranch className="h-6 w-6" /> Отслеживание</h1><p className="text-sm text-muted-foreground">Покрытие ДИ и согласование</p></div>
        <Button onClick={() => { resetForm(); setAddDialogOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Добавить запись</Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Дашборд покрытия</TabsTrigger>
          <TabsTrigger value="approval">Согласование</TabsTrigger>
        </TabsList>

        {/* Дашборд покрытия */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Фильтры */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={dashCompanyFilter} onValueChange={setDashCompanyFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Юр. лицо" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все юр. лица</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dashStatusFilter} onValueChange={setDashStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус ДИ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="actual">Актуальна</SelectItem>
                <SelectItem value="outdated">Требует обновления</SelectItem>
                <SelectItem value="audit">На аудите</SelectItem>
                <SelectItem value="missing">Отсутствует</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Excel
            </Button>
          </div>

          {/* Сводка */}
          {dashboardLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : ov ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Всего должностей</p><p className="text-2xl font-bold">{ov.total}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Актуальны</p><p className="text-2xl font-bold text-emerald-600">{ov.actual}</p><Progress value={pct(ov.actual)} className="h-1 mt-1" /></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Требуют обновления</p><p className="text-2xl font-bold text-amber-600">{ov.outdated}</p><Progress value={pct(ov.outdated)} className="h-1 mt-1" /></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">На аудите</p><p className="text-2xl font-bold text-blue-600">{ov.audit}</p><Progress value={pct(ov.audit)} className="h-1 mt-1" /></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Отсутствуют</p><p className="text-2xl font-bold text-red-600">{ov.missing}</p><Progress value={pct(ov.missing)} className="h-1 mt-1" /></CardContent></Card>
              </div>

              {/* Дерево подразделений */}
              {dashboard && dashboard.departments.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {dashboard.departments.map(dept => {
                    const diIds = dept.positions.filter(p => p.diId).map(p => p.diId as string)
                    return (
                      <AccordionItem key={dept.departmentId} value={dept.departmentId} className="border rounded-lg">
                        <AccordionTrigger className="px-4 py-2 hover:no-underline">
                          <div className="flex items-center gap-2 flex-1 text-left">
                            <Building2 className="h-4 w-4" />
                            <span className="font-semibold">{dept.departmentName}</span>
                            {dept.company && <Badge variant="outline" className="text-xs">{dept.company.name}</Badge>}
                            <span className={`h-2.5 w-2.5 rounded-full ${dept.summary.missing > 0 ? 'bg-red-500' : dept.summary.outdated > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <Badge variant="secondary" className="text-xs">{dept.summary.total} должн.</Badge>
                            {dept.summary.actual > 0 && <Badge className="text-xs bg-emerald-100 text-emerald-800">{dept.summary.actual} ✅</Badge>}
                            {dept.summary.outdated > 0 && <Badge className="text-xs bg-amber-100 text-amber-800">{dept.summary.outdated} ⚠️</Badge>}
                            {dept.summary.audit > 0 && <Badge className="text-xs bg-blue-100 text-blue-800">{dept.summary.audit} 🔍</Badge>}
                            {dept.summary.missing > 0 && <Badge className="text-xs bg-red-100 text-red-800">{dept.summary.missing} ❌</Badge>}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <Table>
                            <TableHeader><TableRow>
                              <TableHead>Должность</TableHead><TableHead>Грейд</TableHead><TableHead>Статус ДИ</TableHead><TableHead>ДИ</TableHead><TableHead>Обновлено</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {dept.positions.map(p => {
                                const meta = DI_STATUS_META[p.diStatus]
                                return (
                                  <TableRow key={p.positionId}>
                                    <TableCell className="text-sm font-medium">{p.positionTitle}<div className="text-xs text-muted-foreground">{p.positionCode}</div></TableCell>
                                    <TableCell className="text-sm">{p.grade || '—'}</TableCell>
                                    <TableCell><Badge className={`${meta.badge} border-0`}><span className={`h-1.5 w-1.5 rounded-full ${meta.dot} mr-1 inline-block`} />{meta.label}</Badge></TableCell>
                                    <TableCell className="text-sm">{p.diTitle || '—'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ru-RU') : '—'}</TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                          {diIds.length > 0 && (
                            <div className="flex gap-2 mt-2 pt-2 border-t">
                              <Button variant="outline" size="sm" onClick={() => { setBatchTarget({ ids: diIds, label: dept.departmentName }); setBatchAuditOpen(true) }}><ShieldAlert className="h-4 w-4 mr-1" /> Аудит всех ({diIds.length})</Button>
                              <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setBatchTarget({ ids: diIds, label: dept.departmentName }); setBatchDeleteOpen(true) }}><Trash2 className="h-4 w-4 mr-1" /> Удалить все ({diIds.length})</Button>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              ) : (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Нет данных для отображения</p>
                </CardContent></Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* Канбан согласования */}
        <TabsContent value="approval" className="space-y-4">
          {/* Stats */}
          <div className="flex flex-wrap gap-2">{stats.map(s => s.count > 0 && <Badge key={s.value} className={`${s.color} border-0`}>{s.label}: {s.count}</Badge>)}</div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="max-w-xs" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Все статусы</SelectItem>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kanbanColumns.map(col => col.items.length > 0 && (
                <div key={col.value}>
                  <div className="flex items-center gap-2 mb-2"><Badge className={`${col.color} border-0`}>{col.label}</Badge><span className="text-sm text-muted-foreground">{col.items.length}</span></div>
                  <div className="space-y-2">
                    {col.items.map(di => (
                      <Card key={di.id} className="cursor-pointer hover:shadow-sm" onClick={() => { setTimelineDIId(di.id); setTimelineDialogOpen(true) }}>
                        <CardContent className="p-3">
                          <p className="font-medium text-sm">{di.title}</p>
                          <p className="text-xs text-muted-foreground">{di.position?.title}</p>
                          {di.latestTracking.assignee && <p className="text-xs mt-1">Исполнитель: {di.latestTracking.assignee}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{new Date(di.latestTracking.createdAt).toLocaleDateString('ru-RU')}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Добавить запись отслеживания</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ДИ *</Label><Select value={formDIId} onValueChange={setFormDIId}><SelectTrigger><SelectValue placeholder="Выберите ДИ" /></SelectTrigger><SelectContent>{generatedDIs.map(di => <SelectItem key={di.id} value={di.id}>{di.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Статус *</Label><Select value={formStatus} onValueChange={setFormStatus}><SelectTrigger /><SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Исполнитель</Label><Input value={formAssignee} onChange={e => setFormAssignee(e.target.value)} /></div>
            <div><Label>Примечание</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="min-h-[60px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddDialogOpen(false)}>Отмена</Button><Button onClick={handleCreate}>Добавить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Изменить статус</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Новый статус</Label><Select value={formStatus} onValueChange={setFormStatus}><SelectTrigger /><SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Исполнитель</Label><Input value={formAssignee} onChange={e => setFormAssignee(e.target.value)} /></div>
            <div><Label>Примечание</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="min-h-[60px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Отмена</Button><Button onClick={handleStatusChange}>Обновить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={timelineDialogOpen} onOpenChange={setTimelineDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>История согласования</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {timelineDIId && trackings.filter(t => t.generatedDIId === timelineDIId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(t => (
              <div key={t.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between"><Badge className={`${getStatusInfo(t.status).color} border-0`}>{getStatusInfo(t.status).label}</Badge><span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString('ru-RU')}</span></div>
                {t.assignee && <p className="text-sm">Исполнитель: {t.assignee}</p>}
                {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
                <div className="flex gap-1 mt-1">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedTracking(t); setFormStatus(t.status); setFormAssignee(t.assignee || ''); setFormNotes(''); setStatusDialogOpen(true) }}>Изменить</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setSelectedTracking(t); setDeleteDialogOpen(true) }}>Удалить</Button>
                </div>
              </div>
            ))}
            {timelineDIId && (
              <Button className="mt-2" size="sm" onClick={() => { setTimelineDialogOpen(false); handleUpdateDIStatus(timelineDIId, 'approved') }}>Утвердить ДИ</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tracking Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить запись?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Batch Audit Dialog */}
      <AlertDialog open={batchAuditOpen} onOpenChange={setBatchAuditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Пакетный аудит ДИ?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Будет запущен аудит {batchTarget.ids.length} ДИ подразделения «{batchTarget.label}». Это может занять время.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchAudit} disabled={batchAuditLoading}>
              {batchAuditLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Запустить аудит
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Dialog */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить все ДИ подразделения?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Будет безвозвратно удалено {batchTarget.ids.length} ДИ подразделения «{batchTarget.label}» вместе со всеми версиями, секциями и результатами аудита.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} disabled={batchAuditLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {batchAuditLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
