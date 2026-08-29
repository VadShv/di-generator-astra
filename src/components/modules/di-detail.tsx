'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft, Pencil, Download, GitCompare, Trash2, CheckCircle2,
  Sparkles, FileText, Clock, Shield, Loader2, ChevronDown, ChevronRight,
  Building2, Users, Briefcase, Crown, AlertTriangle, MessageSquare,
  Maximize2, Minimize2, Home, ChevronRight as ChevronR, Save,
  Play, Copy, AlertCircle, CheckCircle2 as Check2, Printer, Share2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionContent, setEditingSectionContent] = useState('')
  const [savingSection, setSavingSection] = useState(false)
  const [runningAudit, setRunningAudit] = useState(false)
  const [versions, setVersions] = useState<{ id: string; version: number; isOriginal: boolean; createdAt: string; changeDescription?: string | null; diffSummary?: string | null; uploadedBy?: string | null }[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionContent, setVersionContent] = useState<{ sections: { sectionTitle: string; sectionContent: string }[] } | null>(null)
  const [diffData, setDiffData] = useState<{ aiSummary: string; diff: { type: string; text: string }[] } | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [sectionSearch, setSectionSearch] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [applyingRec, setApplyingRec] = useState<number | null>(null)

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

  // B1 — Versions fetch
  const fetchVersions = useCallback(async () => {
    setVersionsLoading(true)
    try { const res = await fetch(`/api/compare?generatedDIId=${currentDI.id}`); if (res.ok) { const d = await res.json(); setVersions(d.items || []) } } catch { /* silent */ } finally { setVersionsLoading(false) }
  }, [currentDI.id])
  useEffect(() => { if (activeTab === 'versions' && versions.length === 0) fetchVersions() }, [activeTab, versions.length, fetchVersions])

  // B1 — Version content preview
  const fetchVersionContent = async (versionId: string) => {
    try { const res = await fetch(`/api/compare/${versionId}`); if (res.ok) { const d = await res.json(); setVersionContent(JSON.parse(d.content)) } } catch { /* silent */ }
  }

  // B2 — Diff between versions
  const handleDiff = async (v1Id: string, v2Id: string) => {
    setDiffLoading(true); setDiffData(null)
    try { const res = await fetch('/api/compare/ai-diff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version1Id: v1Id, version2Id: v2Id }) }); if (res.ok) setDiffData(await res.json()) } catch { /* silent */ } finally { setDiffLoading(false) }
  }

  // B3 — Restore version
  const handleRestore = async (versionId: string) => {
    try {
      const res = await fetch(`/api/compare/${versionId}`)
      if (!res.ok) throw new Error()
      const v = await res.json()
      const content = JSON.parse(v.content)
      const sections = Array.isArray(content?.sections) ? content.sections : Array.isArray(content) ? content : null
      if (!sections) throw new Error('Invalid version format')
      const putRes = await fetch('/api/generate-di', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentDI.id, title: currentDI.title, sections: sections.map((s: { sectionTitle: string; sectionContent: string; order?: number; aiGenerated?: boolean; editedBy?: string | null }) => ({ sectionTitle: s.sectionTitle, sectionContent: s.sectionContent, order: s.order ?? 0, aiGenerated: s.aiGenerated ?? false, editedBy: s.editedBy ?? null })) }) })
      if (!putRes.ok) throw new Error()
      toast({ title: 'Версия восстановлена' }); onRefresh(); fetchVersions()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось восстановить', variant: 'destructive' }) }
  }

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

  // 3.3 — Inline section editing with autosave
  const startEditSection = (section: DISection) => {
    setEditingSectionId(section.id)
    setEditingSectionContent(section.sectionContent)
  }
  const saveSection = async () => {
    if (!editingSectionId) return
    setSavingSection(true)
    const updatedSections = currentDI.sections.map(s =>
      s.id === editingSectionId ? { ...s, sectionContent: editingSectionContent, aiGenerated: false, editedBy: 'manual' } : s
    )
    setCurrentDI(prev => ({ ...prev, sections: updatedSections }))
    try {
      await fetch('/api/generate-di', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentDI.id, sections: updatedSections.map(s => ({ sectionTitle: s.sectionTitle, sectionContent: s.sectionContent, order: s.order, aiGenerated: s.aiGenerated, editedBy: s.editedBy })) }),
      })
      toast({ title: 'Секция сохранена' }); onRefresh()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' }) }
    finally { setSavingSection(false); setEditingSectionId(null) }
  }

  // 3.2 — Section metrics
  function sectionMetrics(content: string) {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const readTime = Math.max(1, Math.ceil(words / 150))
    return { words, readTime }
  }

  // 4.1 — Run audit from detail view
  const handleRunAudit = async () => {
    setRunningAudit(true)
    try {
      const res = await fetch('/api/generate-di/ai-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: currentDI.id }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      toast({ title: 'Аудит завершён' })
      fetchAuditResults()
    } catch (e) { toast({ title: 'Ошибка аудита', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setRunningAudit(false) }
  }

  // 6.5 — Copy full DI text
  const handleCopyText = async () => {
    const text = currentDI.sections.map(s => `${s.sectionTitle}\n\n${s.sectionContent}`).join('\n\n---\n\n')
    try { await navigator.clipboard.writeText(text); toast({ title: 'Скопировано', description: 'Текст ДИ в буфере обмена' }) } catch { toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' }) }
  }

  // 7.1 — Compliance check
  const allFilled = currentDI.sections.length > 0 && currentDI.sections.every(s => s.sectionContent.trim())
  // 7.4 — Warning badges
  const daysSinceUpdate = Math.floor((Date.now() - new Date(currentDI.updatedAt).getTime()) / 86400000)
  const isStale = daysSinceUpdate > 30

  // D2 — Apply recommendation to a section
  const handleApplyRec = async (sectionId: string, instruction: string, recIndex: number) => {
    setApplyingRec(recIndex)
    try {
      const res = await fetch('/api/generate-di/ai-improve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionId, instruction }) })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setCurrentDI(prev => ({ ...prev, sections: prev.sections.map(s => s.id === sectionId ? { ...s, sectionContent: updated.sectionContent || updated.content || s.sectionContent } : s) }))
      toast({ title: 'Рекомендация применена' }); onRefresh()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось применить (нужен ИИ-провайдер)', variant: 'destructive' }) }
    finally { setApplyingRec(null) }
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
        <Button variant="outline" onClick={handleExport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />} DOCX</Button>
        <Button variant="outline" onClick={() => window.open(`/api/export-di/pdf?id=${currentDI.id}`, '_blank')}><FileText className="h-4 w-4 mr-1.5" /> PDF</Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}><FileText className="h-4 w-4 mr-1.5" /> Превью</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Печать</Button>
        <Button variant="outline" onClick={onCompare}><GitCompare className="h-4 w-4 mr-1.5" /> Сравнить</Button>
        <Button variant="outline" onClick={handleCopyText}><Copy className="h-4 w-4 mr-1.5" /> Копировать</Button>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/di/${currentDI.id}`); toast({ title: 'Ссылка скопирована' }) } catch {} }}><Share2 className="h-4 w-4 mr-1.5" /> Поделиться</Button>
        <Button variant="ghost" className="text-destructive ml-auto" onClick={() => onDelete(currentDI.id)}><Trash2 className="h-4 w-4 mr-1.5" /> Удалить</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sections"><FileText className="h-4 w-4 mr-1.5" /> Секции</TabsTrigger>
          <TabsTrigger value="status"><Clock className="h-4 w-4 mr-1.5" /> Статусы {statusHistory.length > 0 && `(${statusHistory.length})`}</TabsTrigger>
          <TabsTrigger value="audit"><Shield className="h-4 w-4 mr-1.5" /> Аудит</TabsTrigger>
          <TabsTrigger value="versions"><GitCompare className="h-4 w-4 mr-1.5" /> Версии {versions.length > 0 && `(${versions.length})`}</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-1.5" /> История</TabsTrigger>
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
                    {isExpanded && (editingSectionId === section.id ? (
                      <CardContent className="pt-0 px-4 pb-4 space-y-2">
                        <textarea
                          value={editingSectionContent}
                          onChange={e => setEditingSectionContent(e.target.value)}
                          className="w-full min-h-[200px] text-sm rounded-lg border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveSection} disabled={savingSection} className="bg-cyan-600 hover:bg-cyan-700">
                            {savingSection ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Сохранить
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSectionId(null)}>Отмена</Button>
                        </div>
                      </CardContent>
                    ) : section.sectionContent ? (
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="text-sm leading-relaxed bg-muted/50 p-4 rounded-lg prose prose-sm max-w-none">
                          <ReactMarkdown>{section.sectionContent}</ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{sectionMetrics(section.sectionContent).words} слов</span>
                          <span>~{sectionMetrics(section.sectionContent).readTime} мин чтения</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => startEditSection(section)}>
                            <Pencil className="h-3 w-3 mr-1" /> Править
                          </Button>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg italic">Секция пуста</div>
                        <Button variant="ghost" size="sm" className="h-6 text-xs mt-2" onClick={() => startEditSection(section)}>
                          <Pencil className="h-3 w-3 mr-1" /> Заполнить
                        </Button>
                      </CardContent>
                    ))}
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: sections (2/3) */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <input type="text" value={sectionSearch} onChange={e => setSectionSearch(e.target.value)} placeholder="Поиск по секциям..." className="flex-1 h-8 rounded-md border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                  {sectionSearch && <Button variant="ghost" size="sm" onClick={() => setSectionSearch('')} className="text-xs h-7">Очистить</Button>}
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">Развернуть</Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">Свернуть</Button>
                </div>
                {currentDI.sections.filter(s => !sectionSearch || s.sectionTitle.toLowerCase().includes(sectionSearch.toLowerCase()) || s.sectionContent.toLowerCase().includes(sectionSearch.toLowerCase())).map((section, idx) => {
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
                      {isExpanded && (editingSectionId === section.id ? (
                      <CardContent className="pt-0 px-4 pb-4 space-y-2">
                        <textarea
                          value={editingSectionContent}
                          onChange={e => setEditingSectionContent(e.target.value)}
                          className="w-full min-h-[200px] text-sm rounded-lg border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveSection} disabled={savingSection} className="bg-cyan-600 hover:bg-cyan-700">
                            {savingSection ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Сохранить
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSectionId(null)}>Отмена</Button>
                        </div>
                      </CardContent>
                    ) : section.sectionContent ? (
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="text-sm leading-relaxed bg-muted/50 p-4 rounded-lg prose prose-sm max-w-none">
                          <ReactMarkdown>{section.sectionContent}</ReactMarkdown>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{sectionMetrics(section.sectionContent).words} слов</span>
                          <span>~{sectionMetrics(section.sectionContent).readTime} мин чтения</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => startEditSection(section)}>
                            <Pencil className="h-3 w-3 mr-1" /> Править
                          </Button>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent className="pt-0 px-4 pb-4">
                        <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg italic">Секция пуста</div>
                        <Button variant="ghost" size="sm" className="h-6 text-xs mt-2" onClick={() => startEditSection(section)}>
                          <Pencil className="h-3 w-3 mr-1" /> Заполнить
                        </Button>
                      </CardContent>
                    ))}
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

                  {/* 7.1 — Compliance + 7.5 fill map */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Структура</CardTitle></CardHeader>
                    <CardContent className="pt-0 space-y-2">
                      <div className={`flex items-center gap-2 text-xs ${allFilled ? 'text-emerald-600' : 'text-red-600'}`}>
                        {allFilled ? <Check2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {allFilled ? 'Все секции заполнены' : 'Есть пустые секции'}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {currentDI.sections.map((s, i) => (
                          <div
                            key={s.id}
                            className={`h-4 w-4 rounded ${s.sectionContent.trim() ? 'bg-emerald-400' : 'bg-muted-foreground/20'}`}
                            title={`${i + 1}. ${s.sectionTitle}: ${s.sectionContent.trim() ? 'заполнено' : 'пусто'}`}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 7.4 — Warnings */}
                  {(isStale || !currentDI.signedByEmployee) && (
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardContent className="p-3 space-y-1.5">
                        {isStale && (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" /> Не обновлялась {daysSinceUpdate} дн
                          </div>
                        )}
                        {!currentDI.signedByEmployee && (
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" /> Не подписана сотрудником
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
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
          <Button onClick={handleRunAudit} disabled={runningAudit} className="bg-red-600 hover:bg-red-700">
            {runningAudit ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />} Запустить аудит
          </Button>
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
                  {/* C2 — Score breakdown radar chart */}
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={[
                        { cat: 'ТК РФ', score: Math.max(0, 100 - (audit.duplicatedTkItems?.length || 0) * 10) },
                        { cat: 'Формул.', score: Math.max(0, 100 - (audit.vagueFormulationItems?.length || 0) * 10) },
                        { cat: 'Законы', score: Math.max(0, 100 - (audit.legislativeConflictItems?.length || 0) * 10) },
                        { cat: 'Требов.', score: Math.max(0, 100 - (audit.unrealisticRequirementItems?.length || 0) * 10) },
                        { cat: 'Полнота', score: Math.max(0, 100 - (audit.incompleteSectionItems?.length || 0) * 10) },
                      ]}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="cat" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar dataKey="score" stroke="#0891b2" fill="#0891b2" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
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
                    <><Separator /><div>
                      <div className="flex items-center gap-2 text-sm font-medium mb-2"><MessageSquare className="h-4 w-4 text-blue-600" /> Рекомендации</div>
                      <div className="space-y-2">
                        {audit.recommendations.slice(0, 5).map((r, i) => {
                          const recText = typeof r === 'string' ? r : JSON.stringify(r)
                          return (
                            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                              <span className="text-xs text-muted-foreground flex-1">{recText}</span>
                              <Select onValueChange={(sectionId) => handleApplyRec(sectionId, recText, i)}>
                                <SelectTrigger className="h-7 text-xs w-40 flex-shrink-0"><SelectValue placeholder="К секции..." /></SelectTrigger>
                                <SelectContent>
                                  {currentDI.sections.map(s => <SelectItem key={s.id} value={s.id}>{s.sectionTitle}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {applyingRec === i && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 flex-shrink-0" />}
                            </div>
                          )
                        })}
                      </div>
                    </div></>
                  )}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* B1-B3 — Versions tab */}
        <TabsContent value="versions" className="space-y-3">
          {versionsLoading ? (<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>)
          : versions.length === 0 ? (<Card><CardContent className="p-8 text-center text-muted-foreground"><GitCompare className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Нет сохранённых версий</p></CardContent></Card>)
          : (<>
            {versions.map((v) => (
              <Card key={v.id}>
                <div className="flex items-center gap-3 p-4">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 ${v.isOriginal ? 'bg-blue-100' : 'bg-violet-100'}`}>
                    <span className={`text-sm font-bold ${v.isOriginal ? 'text-blue-600' : 'text-violet-600'}`}>v{v.version}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Версия {v.version}</span>
                      {v.isOriginal && <Badge variant="outline" className="text-xs">Оригинал</Badge>}
                      {v.diffSummary && <span className="text-xs text-muted-foreground truncate">{v.diffSummary}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(v.createdAt)}{v.uploadedBy && ` · ${v.uploadedBy}`}</p>
                    {v.changeDescription && <p className="text-xs text-muted-foreground mt-0.5">{v.changeDescription}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fetchVersionContent(v.id)}>Превью</Button>
                    {v.version !== currentDI.currentVersion && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleDiff(v.id, versions[0]?.id || v.id)} disabled={diffLoading}>
                        {diffLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Diff'}
                      </Button>
                    )}
                    {v.version !== currentDI.currentVersion && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-700" onClick={() => handleRestore(v.id)}>Восстановить</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {/* Version content preview */}
            {versionContent && (
              <Card className="border-cyan-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Превью версии</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {versionContent.sections?.map((s, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <p className="font-semibold text-xs mb-1">{s.sectionTitle}</p>
                      <p className="text-xs whitespace-pre-wrap text-muted-foreground">{s.sectionContent || '—'}</p>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setVersionContent(null)}>Закрыть превью</Button>
                </CardContent>
              </Card>
            )}
            {/* B2 — Diff display */}
            {diffData && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Сравнение версий</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {diffData.aiSummary && <p className="text-sm text-muted-foreground">{diffData.aiSummary}</p>}
                  <div className="font-mono text-xs space-y-0.5 max-h-96 overflow-y-auto">
                    {diffData.diff?.map((line, i) => (
                      <div key={i} className={`px-2 py-0.5 rounded ${line.type === 'added' ? 'bg-emerald-50 text-emerald-800' : line.type === 'removed' ? 'bg-red-50 text-red-800' : 'text-muted-foreground'}`}>
                        {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDiffData(null)}>Закрыть diff</Button>
                </CardContent>
              </Card>
            )}
          </>)}
        </TabsContent>

        {/* B4 — Unified activity feed */}
        <TabsContent value="history" className="space-y-3">
          {(() => {
            const events: { type: string; date: string; title: string; desc?: string }[] = [
              ...statusHistory.map(h => ({ type: 'status', date: h.createdAt, title: `${STATUS_LABELS[h.fromStatus] || h.fromStatus} → ${STATUS_LABELS[h.toStatus] || h.toStatus}`, desc: h.comment || undefined })),
              ...auditResults.map(a => ({ type: 'audit', date: a.createdAt, title: `Аудит: ${a.overallScore}/100`, desc: a.summary || undefined })),
              ...versions.map(v => ({ type: 'version', date: v.createdAt, title: `Версия v${v.version}${v.isOriginal ? ' (оригинал)' : ''}`, desc: v.changeDescription || v.diffSummary || undefined })),
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            if (events.length === 0) return <Card><CardContent className="p-8 text-center text-muted-foreground"><p>Нет событий</p></CardContent></Card>
            return events.map((e, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div className={`h-2.5 w-2.5 rounded-full ${e.type === 'status' ? 'bg-blue-500' : e.type === 'audit' ? 'bg-red-500' : 'bg-violet-500'}`} />
                  {i < events.length - 1 && <div className="w-px h-full bg-border flex-1" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    {e.type === 'status' && <Clock className="h-3.5 w-3.5 text-blue-500" />}
                    {e.type === 'audit' && <Shield className="h-3.5 w-3.5 text-red-500" />}
                    {e.type === 'version' && <GitCompare className="h-3.5 w-3.5 text-violet-500" />}
                    <span className="font-medium">{e.title}</span>
                  </div>
                  {e.desc && <p className="text-xs text-muted-foreground mt-0.5">{e.desc}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(e.date)}</p>
                </div>
              </div>
            ))
          })()}
        </TabsContent>
      </Tabs>

      {/* E1 — Preview modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Предпросмотр ДИ</DialogTitle>
          </DialogHeader>
          <iframe src={`/api/export-di/pdf?id=${currentDI.id}`} className="w-full h-[70vh] border rounded-lg" title="Предпросмотр" />
        </DialogContent>
      </Dialog>

      {/* 2.5 — Keyboard hint */}
      <div className="fixed bottom-4 right-4 text-[10px] text-muted-foreground/60 hidden lg:flex items-center gap-2">
        <kbd className="px-1.5 py-0.5 rounded border bg-muted">Esc</kbd> назад
        <kbd className="px-1.5 py-0.5 rounded border bg-muted">E</kbd> редактировать
      </div>
    </div>
  )
}
