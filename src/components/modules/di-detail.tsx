'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, Pencil, Download, GitCompare, Trash2, CheckCircle2,
  Sparkles, FileText, Clock, Shield, Loader2, ChevronDown, ChevronRight,
  Building2, Users, Briefcase, Crown, AlertTriangle, MessageSquare,
  Maximize2, Minimize2, Home, ChevronRight as ChevronR,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Department { id: string; name: string; company?: { id: string; name: string } | null }
interface BusinessFunction { id: string; name: string }
interface Position { id: string; title: string; code: string; department: Department; grade?: string | null; businessFunction?: BusinessFunction | null }
interface Template { id: string; name: string; isPrimary: boolean }
interface DISection { id: string; sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean; editedBy?: string | null }
interface GeneratedDI {
  id: string; positionId: string; templateId?: string | null; title: string; status: string
  currentVersion: number; signedByEmployee: boolean; signedAt?: string | null
  position: Position; template?: Template | null; sections: DISection[]
  createdAt: string; updatedAt: string
}
interface StatusChange { id: string; fromStatus: string; toStatus: string; comment: string | null; userEmail: string | null; createdAt: string }
interface AuditResult {
  id: string; auditType: string; overallScore: number; summary: string | null
  duplicatedTkItems: unknown[]; vagueFormulationItems: unknown[]
  legislativeConflictItems: unknown[]; unrealisticRequirementItems: unknown[]
  incompleteSectionItems: unknown[]; recommendations: unknown[]; createdAt: string
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', review: 'На согласовании', approved: 'Согласована', exported: 'Экспортирована' }
const STATUS_COLORS: Record<string, string> = { draft: 'bg-gray-100 text-gray-700 border-gray-300', review: 'bg-amber-100 text-amber-700 border-amber-300', approved: 'bg-emerald-100 text-emerald-700 border-emerald-300', exported: 'bg-blue-100 text-blue-700 border-blue-300' }
const GRADE_LABELS: Record<string, string> = { 'линейная': 'Линейная', 'руководитель': 'Руководитель' }

function formatDate(d: string): string { try { return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d } }
function formatDateTime(d: string): string { try { return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return d } }

const AUDIT_CATEGORIES = [
  { key: 'duplicatedTkItems', label: 'Дублирование норм ТК РФ' },
  { key: 'vagueFormulationItems', label: 'Расплывчатые формулировки' },
  { key: 'legislativeConflictItems', label: 'Противоречия законодательству' },
  { key: 'unrealisticRequirementItems', label: 'Завышенные требования' },
  { key: 'incompleteSectionItems', label: 'Неполнота разделов' },
] as const

export interface DIDetailProps {
  di: GeneratedDI
  onBack: () => void
  onEdit: (di: GeneratedDI) => void
  onDelete: (id: string) => void
  onCompare: () => void
  onRefresh: () => void
}

export function DIDetail({ di, onBack, onEdit, onDelete, onCompare, onRefresh }: DIDetailProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('sections')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [statusHistory, setStatusHistory] = useState<StatusChange[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [auditResults, setAuditResults] = useState<AuditResult[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [changingStatus, setChangingStatus] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [currentDI, setCurrentDI] = useState(di)
  const [fullscreen, setFullscreen] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string>('')
  const [scrollProgress, setScrollProgress] = useState(0)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const fetchStatusHistory = useCallback(async () => {
    setHistoryLoading(true)
    try { const res = await fetch(`/api/generate-di/${currentDI.id}/status`); if (res.ok) setStatusHistory(await res.json()) } catch { /* silent */ } finally { setHistoryLoading(false) }
  }, [currentDI.id])

  const fetchAuditResults = useCallback(async () => {
    setAuditLoading(true)
    try { const res = await fetch(`/api/generate-di/ai-audit?generatedDIId=${currentDI.id}`); if (res.ok) setAuditResults(await res.json()) } catch { /* silent */ } finally { setAuditLoading(false) }
  }, [currentDI.id])

  useEffect(() => { fetchStatusHistory() }, [fetchStatusHistory])
  useEffect(() => { if (activeTab === 'audit' && auditResults.length === 0) fetchAuditResults() }, [activeTab, auditResults.length, fetchAuditResults])

  // 2.3 — Reading progress + 2.2 active section tracking
  useEffect(() => {
    if (activeTab !== 'sections') return
    const handler = () => {
      const sc = scrollContainerRef.current
      if (!sc) return
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0)
      // Find active section
      for (const s of currentDI.sections) {
        const el = sectionRefs.current[s.id]
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top > 120) break
          setActiveSectionId(s.id)
        }
      }
    }
    window.addEventListener('scroll', handler, { passive: true })
    handler()
    return () => window.removeEventListener('scroll', handler)
  }, [activeTab, currentDI.sections])

  // 2.5 — Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onBack(); return }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); onEdit(currentDI) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack, onEdit, currentDI])

  const toggleSection = (id: string) => {
    setExpandedSections(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const expandAll = () => setExpandedSections(new Set(currentDI.sections.map(s => s.id)))
  const collapseAll = () => setExpandedSections(new Set())

  const handleStatusChange = async () => {
    if (!newStatus) return
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/generate-di/${currentDI.id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toStatus: newStatus, comment: statusComment }) })
      if (res.ok) { toast({ title: 'Статус изменён', description: STATUS_LABELS[newStatus] }); setCurrentDI(prev => ({ ...prev, status: newStatus })); setNewStatus(''); setStatusComment(''); fetchStatusHistory(); onRefresh() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Не удалось сменить статус', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) } finally { setChangingStatus(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/export-di/docx?id=${currentDI.id}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = `${currentDI.title}.docx`; a.click(); URL.revokeObjectURL(url)
      toast({ title: 'Экспортировано', description: 'DOCX файл загружен' })
    } catch { toast({ title: 'Ошибка', description: 'Не удалось экспортировать', variant: 'destructive' }) } finally { setExporting(false) }
  }

  const handleToggleSigned = async (value: boolean) => {
    try {
      const res = await fetch('/api/generate-di', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentDI.id, signedByEmployee: value }) })
      if (!res.ok) throw new Error()
      setCurrentDI(prev => ({ ...prev, signedByEmployee: value })); toast({ title: value ? 'Подписана сотрудником' : 'Подпись снята' }); onRefresh()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось обновить', variant: 'destructive' }) }
  }

  const gLabel = currentDI.position.grade ? GRADE_LABELS[currentDI.position.grade] || currentDI.position.grade : null
  const aiCount = currentDI.sections.filter(s => s.aiGenerated).length
  const filledCount = currentDI.sections.filter(s => s.sectionContent.trim()).length
  const fillPct = currentDI.sections.length > 0 ? Math.round((filledCount / currentDI.sections.length) * 100) : 0
  const companyName = currentDI.position?.department?.company?.name
  const deptName = currentDI.position?.department?.name

  return (
    <div ref={scrollContainerRef} className="space-y-4">
      {/* 2.3 — Reading progress bar */}
      {activeTab === 'sections' && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-transparent">
          <div className="h-full bg-cyan-500 transition-all" style={{ width: `${scrollProgress}%` }} />
        </div>
      )}

      {/* 2.4 — Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" /> Генерация ДИ
        </button>
        {companyName && (<><ChevronR className="h-3 w-3" /><span>{companyName}</span></>)}
        {deptName && (<><ChevronR className="h-3 w-3" /><span>{deptName}</span></>)}
        <ChevronR className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-[300px]">{currentDI.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-600" /> {currentDI.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={STATUS_COLORS[currentDI.status] || 'bg-gray-100 text-gray-700'}>{STATUS_LABELS[currentDI.status] || currentDI.status}</Badge>
          <Badge variant="outline">v{currentDI.currentVersion}</Badge>
          {currentDI.signedByEmployee && (<Badge className="bg-emerald-600 text-white text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Подписана</Badge>)}
          {/* 2.6 — Fullscreen toggle */}
          {activeTab === 'sections' && (
            <Button variant="ghost" size="icon" onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Position context */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {companyName && (<span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-muted-foreground" /> {companyName}</span>)}
            {deptName && (<span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" /> {deptName}</span>)}
            <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-muted-foreground" /> {currentDI.position?.title}</span>
            {gLabel && <Badge variant="secondary" className="text-xs">{gLabel}</Badge>}
            {currentDI.position?.businessFunction && <Badge variant="outline" className="text-xs">БФ: {currentDI.position.businessFunction.name}</Badge>}
            {currentDI.template && (<span className="flex items-center gap-1.5 text-xs text-muted-foreground">{currentDI.template.isPrimary && <Crown className="h-3 w-3 text-amber-500" />}{currentDI.template.name}</span>)}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground mt-2">
            <span>Создана: {formatDate(currentDI.createdAt)}</span>
            <span>Обновлена: {formatDate(currentDI.updatedAt)}</span>
            <span>{filledCount} / {currentDI.sections.length} секций ({fillPct}%)</span>
            {aiCount > 0 && <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {aiCount} ИИ</span>}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={() => onEdit(currentDI)} className="bg-cyan-600 hover:bg-cyan-700"><Pencil className="h-4 w-4 mr-1.5" /> Редактировать</Button>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} Экспорт DOCX</Button>
        <Button variant="outline" onClick={onCompare}><GitCompare className="h-4 w-4 mr-1.5" /> Сравнить</Button>
        <Button variant="ghost" className="text-destructive ml-auto" onClick={() => onDelete(currentDI.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Удалить</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sections"><FileText className="h-4 w-4 mr-1.5" /> Секции</TabsTrigger>
          <TabsTrigger value="status"><Clock className="h-4 w-4 mr-1.5" /> Статусы {statusHistory.length > 0 && `(${statusHistory.length})`}</TabsTrigger>
          <TabsTrigger value="audit"><Shield className="h-4 w-4 mr-1.5" /> Аудит</TabsTrigger>
        </TabsList>

        {/* 2.1+2.2 — Sections tab with two-column layout + sticky TOC */}
        <TabsContent value="sections">
          {currentDI.sections.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Нет секций</CardContent></Card>
          ) : fullscreen ? (
            <div className="space-y-3">
              {currentDI.sections.map((section, idx) => {
                const isExpanded = expandedSections.has(section.id) || section.sectionContent.length < 500
                return (
                  <Card key={section.id} ref={(el) => { sectionRefs.current[section.id] = el }}>
                    <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30" onClick={() => toggleSection(section.id)}>
                      <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted flex-shrink-0">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">{idx + 1}.</span>
                          <span className="font-semibold text-sm">{section.sectionTitle}</span>
                          {section.aiGenerated && <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> ИИ</Badge>}
                          {section.editedBy === 'manual' && <Badge variant="outline" className="text-xs">ручн.</Badge>}
                        </div>
                      </div>
                      <div className="flex-shrink-0">{section.sectionContent.trim() ? <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50 gap-1"><CheckCircle2 className="h-3 w-3" /> {section.sectionContent.length} симв.</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Пусто</Badge>}</div>
                    </div>
                    {isExpanded && section.sectionContent && (<CardContent className="pt-0 px-4 pb-4"><div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 p-4 rounded-lg">{section.sectionContent}</div></CardContent>)}
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: sections (2/3) */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">Развернуть все</Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">Свернуть все</Button>
                </div>
                {currentDI.sections.map((section, idx) => {
                  const isExpanded = expandedSections.has(section.id) || section.sectionContent.length < 500
                  return (
                    <Card key={section.id} ref={(el) => { sectionRefs.current[section.id] = el }} className={activeSectionId === section.id ? 'ring-2 ring-cyan-300' : ''}>
                      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30" onClick={() => toggleSection(section.id)}>
                        <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted flex-shrink-0">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono">{idx + 1}.</span>
                            <span className="font-semibold text-sm">{section.sectionTitle}</span>
                            {section.aiGenerated && <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> ИИ</Badge>}
                            {section.editedBy === 'manual' && <Badge variant="outline" className="text-xs">ручн.</Badge>}
                          </div>
                        </div>
                        <div className="flex-shrink-0">{section.sectionContent.trim() ? <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 bg-emerald-50 gap-1"><CheckCircle2 className="h-3 w-3" /> {section.sectionContent.length} симв.</Badge> : <Badge variant="outline" className="text-xs text-muted-foreground">Пусто</Badge>}</div>
                      </div>
                      {isExpanded && section.sectionContent && (<CardContent className="pt-0 px-4 pb-4"><div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/50 p-4 rounded-lg">{section.sectionContent}</div></CardContent>)}
                    </Card>
                  )
                })}
              </div>

              {/* Right: sticky sidebar (1/3) */}
              <div className="hidden lg:block">
                <div className="sticky top-4 space-y-3">
                  {/* 2.2 — TOC */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Содержание</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-0.5">
                        {currentDI.sections.map((s, i) => (
                          <button
                            key={s.id}
                            onClick={() => scrollToSection(s.id)}
                            className={`flex items-center gap-2 w-full text-left text-xs rounded px-2 py-1.5 transition-colors ${activeSectionId === s.id ? 'bg-cyan-50 text-cyan-700 font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            <span className="font-mono opacity-60">{i + 1}.</span>
                            <span className="truncate">{s.sectionTitle}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick facts */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Быстрые факты</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Заполнено</span><span className="font-medium">{fillPct}%</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Секций</span><span className="font-medium">{currentDI.sections.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">ИИ-сгенерировано</span><span className="font-medium">{aiCount}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Версия</span><span className="font-medium">v{currentDI.currentVersion}</span></div>
                      <Separator />
                      <div className="flex items-center gap-2 pt-1">
                        <Switch checked={currentDI.signedByEmployee} onCheckedChange={handleToggleSigned} />
                        <Label className="text-xs cursor-pointer">Подписана</Label>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Status history tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Изменить статус</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Новый статус</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue placeholder="Выберите статус" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Черновик</SelectItem>
                      <SelectItem value="review">На согласование</SelectItem>
                      <SelectItem value="approved">Согласована</SelectItem>
                      <SelectItem value="exported">Экспортирована</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleStatusChange} disabled={!newStatus || changingStatus}>{changingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Применить'}</Button>
              </div>
              <div>
                <Label>Комментарий (необязательно)</Label>
                <input type="text" value={statusComment} onChange={e => setStatusComment(e.target.value)} placeholder="Комментарий к смене статуса" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">История изменений</CardTitle></CardHeader>
            <CardContent>
              {historyLoading ? (<div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>)
              : statusHistory.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4">Нет истории изменений</p>)
              : (<div className="space-y-3">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="flex gap-3 items-start">
                      <div className="flex flex-col items-center"><div className="h-2 w-2 rounded-full bg-primary mt-1.5" /><div className="w-px h-full bg-border flex-1" /></div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 text-sm"><Badge variant="outline" className="text-xs">{STATUS_LABELS[h.fromStatus] || h.fromStatus}</Badge><span className="text-muted-foreground">→</span><Badge variant="outline" className="text-xs">{STATUS_LABELS[h.toStatus] || h.toStatus}</Badge></div>
                        {h.comment && <p className="text-sm text-muted-foreground mt-1">{h.comment}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(h.createdAt)}{h.userEmail && ` · ${h.userEmail}`}</p>
                      </div>
                    </div>
                  ))}
                </div>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit tab */}
        <TabsContent value="audit" className="space-y-3">
          {auditLoading ? (<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>)
          : auditResults.length === 0 ? (<Card><CardContent className="p-8 text-center text-muted-foreground"><Shield className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Аудит ещё не проводился</p><p className="text-sm mt-1">Запустите аудит во вкладке «AI-аудит»</p></CardContent></Card>)
          : auditResults.map((audit) => (
              <Card key={audit.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Аудит от {formatDateTime(audit.createdAt)}</CardTitle>
                    <Badge className={audit.overallScore >= 80 ? 'bg-emerald-600 text-white' : audit.overallScore >= 50 ? 'bg-amber-600 text-white' : 'bg-red-600 text-white'}>{audit.overallScore}/100</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {audit.summary && <p className="text-sm text-muted-foreground">{audit.summary}</p>}
                  {AUDIT_CATEGORIES.map((cat) => {
                    const items = (audit[cat.key] as unknown[]) || []
                    if (items.length === 0) return null
                    return (
                      <div key={cat.key}>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1"><AlertTriangle className="h-4 w-4 text-amber-600" />{cat.label} ({items.length})</div>
                        <ul className="text-xs text-muted-foreground ml-6 space-y-0.5">
                          {items.slice(0, 5).map((item, i) => (<li key={i}>• {typeof item === 'string' ? item : JSON.stringify(item)}</li>))}
                          {items.length > 5 && <li className="italic">…и ещё {items.length - 5}</li>}
                        </ul>
                      </div>
                    )
                  })}
                  {Array.isArray(audit.recommendations) && audit.recommendations.length > 0 && (
                    <><Separator /><div><div className="flex items-center gap-2 text-sm font-medium mb-1"><MessageSquare className="h-4 w-4 text-blue-600" /> Рекомендации</div><ul className="text-xs text-muted-foreground ml-6 space-y-0.5">{audit.recommendations.slice(0, 5).map((r, i) => (<li key={i}>• {typeof r === 'string' ? r : JSON.stringify(r)}</li>))}</ul></div></>
                  )}
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {/* 2.5 — Keyboard hint */}
      <div className="fixed bottom-4 right-4 text-[10px] text-muted-foreground/60 hidden lg:flex items-center gap-2">
        <kbd className="px-1.5 py-0.5 rounded border bg-muted">Esc</kbd> назад
        <kbd className="px-1.5 py-0.5 rounded border bg-muted">E</kbd> редактировать
      </div>
    </div>
  )
}
