'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Eye, Loader2, Sparkles, FileText, PenLine, Wand2, Download, ChevronDown, ChevronRight, CheckCircle2, RotateCcw, BookOpen, Zap } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department; grade?: string | null; domain?: string | null; headcount: number; functions?: string | null }
interface TemplateSection { id: string; title: string; order: number; promptGuidance?: string | null; isRequired: boolean; content?: string | null }
interface Template { id: string; name: string; description?: string | null; isActive: boolean; sections: TemplateSection[] }
interface MasterPrompt { id: string; name: string; content: string; version: number; isActive: boolean; departmentId?: string | null; domain?: string | null; grade?: string | null; description?: string | null }
interface GeneratedDISection { id: string; sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean; editedBy?: string | null }
interface GeneratedDI { id: string; positionId: string; templateId?: string | null; title: string; status: string; position: Position & { department: Department }; template?: Template | null; sections: GeneratedDISection[]; createdAt: string; updatedAt: string }

// Standard DI sections from the user's provided template
const STANDARD_DI_SECTIONS = [
  { 
    title: 'ОБЩИЕ ПОЛОЖЕНИЯ', 
    order: 1, 
    promptGuidance: 'Опишите общие положения: категория должности, порядок назначения и освобождения, подчинённость, замещение, требования к знаниям (законодательство, нормативные акты, правила делового общения).',
  },
  { 
    title: 'КВАЛИФИКАЦИОННЫЕ ТРЕБОВАНИЯ И НАВЫКИ', 
    order: 2, 
    promptGuidance: 'Укажите требования: образование (направления), опыт работы, профессиональные навыки, необходимые знания, сертификаты и преимущества.',
  },
  { 
    title: 'ДОЛЖНОСТНЫЕ ОБЯЗАННОСТИ', 
    order: 3, 
    promptGuidance: 'Перечислите должностные обязанности: руководство, планирование, контроль, взаимодействие, отчётность и т.д.',
  },
  { 
    title: 'ПРАВА', 
    order: 4, 
    promptGuidance: 'Опишите права работника: требование условий, запрос информации, внесение предложений, привлечение специалистов, визирование документов, принятие решений, представление интересов.',
  },
  { 
    title: 'ОТВЕТСТВЕННОСТЬ', 
    order: 5, 
    promptGuidance: 'Укажите виды ответственности: за неисполнение обязанностей, правонарушения, материальный ущерб, разглашение коммерческой тайны.',
  },
  { 
    title: 'УСЛОВИЯ РАБОТЫ', 
    order: 6, 
    promptGuidance: 'Опишите условия работы: режим рабочего времени, командировки, оклад, премирование по KPI.',
  },
]

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  review: { label: 'На рассмотрении', variant: 'outline' },
  approved: { label: 'Утверждено', variant: 'default' },
  exported: { label: 'Экспортировано', variant: 'default' },
}

export function GenerationModule() {
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'list' | 'generate' | 'manual' | 'editor'>('list')
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [masterPrompts, setMasterPrompts] = useState<MasterPrompt[]>([])
  const [loading, setLoading] = useState(true)

  // Generate form (AI)
  const [selPositionId, setSelPositionId] = useState('')
  const [selTemplateId, setSelTemplateId] = useState('')
  const [generating, setGenerating] = useState(false)

  // Manual creation form
  const [manualTitle, setManualTitle] = useState('')
  const [manualPositionId, setManualPositionId] = useState('')
  const [manualDepartment, setManualDepartment] = useState('')
  const [manualCategory, setManualCategory] = useState('Руководители')
  const [manualSections, setManualSections] = useState(STANDARD_DI_SECTIONS.map(s => ({ ...s, content: '', aiGenerated: false, isGenerating: false })))
  const [manualSaving, setManualSaving] = useState(false)
  const [manualGeneratingAll, setManualGeneratingAll] = useState(false)
  const [manualProgress, setManualProgress] = useState(0)
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]))

  // Editor state
  const [editingDI, setEditingDI] = useState<GeneratedDI | null>(null)
  const [editSections, setEditSections] = useState<GeneratedDISection[]>([])
  const [editTitle, setEditTitle] = useState('')
  const [sectionGenerating, setSectionGenerating] = useState<Record<number, boolean>>({})
  const [improveDialogOpen, setImproveDialogOpen] = useState(false)
  const [improveSectionId, setImproveSectionId] = useState('')
  const [improveInstruction, setImproveInstruction] = useState('')
  const [improving, setImproving] = useState(false)

  // View/delete
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingDI, setViewingDI] = useState<GeneratedDI | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDIs = useCallback(async () => {
    try { const res = await fetch('/api/generate-di'); if (res.ok) setGeneratedDIs(await res.json()) } catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' }) }
  }, [toast])
  const fetchPositions = useCallback(async () => {
    try { const res = await fetch('/api/positions'); if (res.ok) setPositions(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchTemplates = useCallback(async () => {
    try { const res = await fetch('/api/templates'); if (res.ok) setTemplates((await res.json()).filter((t: Template) => t.isActive)) } catch { /* silent */ }
  }, [])
  const fetchPrompts = useCallback(async () => {
    try { const res = await fetch('/api/master-prompts?active=true'); if (res.ok) setMasterPrompts(Array.isArray(await res.json()) ? await res.json() : []) } catch { setMasterPrompts([]) }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await Promise.all([fetchDIs(), fetchPositions(), fetchTemplates(), fetchPrompts()]); setLoading(false) })() }, [fetchDIs, fetchPositions, fetchTemplates, fetchPrompts])

  const startGenerate = () => { setSelPositionId(''); setSelTemplateId(''); setGenerating(false); setViewMode('generate') }

  const startManual = () => {
    setManualTitle(''); setManualPositionId(''); setManualDepartment(''); setManualCategory('Руководители')
    setManualSections(STANDARD_DI_SECTIONS.map(s => ({ ...s, content: '', aiGenerated: false, isGenerating: false })))
    setExpandedSections(new Set([0]))
    setViewMode('manual')
  }

  // AI Generate ALL sections at once
  const handleGenerateAll = async () => {
    if (!selPositionId || !selTemplateId) { toast({ title: 'Ошибка', description: 'Выберите должность и шаблон', variant: 'destructive' }); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-di/ai-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: selPositionId, templateId: selTemplateId }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      const data = await res.json()
      setEditingDI(data); setEditSections(data.sections || []); setEditTitle(data.title)
      toast({ title: 'Успех', description: 'ДИ сгенерирована' }); setViewMode('editor')
    } catch (e) {
      toast({ title: 'Ошибка генерации', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally { setGenerating(false) }
  }

  // Manual: Generate single section with AI
  const handleManualSectionGenerate = async (sectionIndex: number) => {
    const section = manualSections[sectionIndex]
    if (!manualPositionId && !manualTitle) {
      toast({ title: 'Ошибка', description: 'Укажите должность или название', variant: 'destructive' }); return
    }
    
    setManualSections(prev => prev.map((s, i) => i === sectionIndex ? { ...s, isGenerating: true } : s))
    
    try {
      // Create DI first if it doesn't exist, or use existing one
      const position = positions.find(p => p.id === manualPositionId)
      
      const res = await fetch('/api/generate-di/ai-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: manualPositionId,
          sectionTitle: section.title,
          sectionOrder: section.order,
          promptGuidance: section.promptGuidance,
          manualMode: true,
          positionContext: position ? {
            title: position.title,
            department: position.department?.name,
            grade: position.grade,
            domain: position.domain,
            functions: position.functions,
          } : null,
        }),
      })

      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      const data = await res.json()
      
      setManualSections(prev => prev.map((s, i) => i === sectionIndex ? { ...s, content: data.content || data.sectionContent || '', aiGenerated: true, isGenerating: false } : s))
      toast({ title: 'Секция сгенерирована', description: section.title })
    } catch (e) {
      toast({ title: 'Ошибка генерации', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
      setManualSections(prev => prev.map((s, i) => i === sectionIndex ? { ...s, isGenerating: false } : s))
    }
  }

  // Manual: Generate ALL sections sequentially
  const handleManualGenerateAll = async () => {
    if (!manualPositionId && !manualTitle) {
      toast({ title: 'Ошибка', description: 'Укажите должность или название', variant: 'destructive' }); return
    }
    
    setManualGeneratingAll(true); setManualProgress(0)
    
    for (let i = 0; i < manualSections.length; i++) {
      setManualProgress(Math.round((i / manualSections.length) * 100))
      await handleManualSectionGenerate(i)
    }
    
    setManualProgress(100)
    setManualGeneratingAll(false)
    toast({ title: 'Все секции сгенерированы' })
  }

  // Manual: Save DI
  const handleManualSave = async () => {
    if (!manualTitle.trim()) { toast({ title: 'Ошибка', description: 'Укажите название ДИ', variant: 'destructive' }); return }
    if (!manualPositionId) { toast({ title: 'Ошибка', description: 'Выберите должность', variant: 'destructive' }); return }
    
    setManualSaving(true)
    try {
      const res = await fetch('/api/generate-di', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: manualPositionId,
          title: manualTitle.trim(),
          sections: manualSections.map(s => ({
            sectionTitle: s.title,
            sectionContent: s.content,
            order: s.order,
            aiGenerated: s.aiGenerated,
            editedBy: s.aiGenerated ? null : 'manual',
          })),
        }),
      })
      
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      const data = await res.json()
      
      toast({ title: 'ДИ сохранена', description: manualTitle })
      setEditingDI(data); setEditSections(data.sections || []); setEditTitle(data.title)
      setViewMode('editor')
      fetchDIs()
    } catch (e) {
      toast({ title: 'Ошибка сохранения', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally { setManualSaving(false) }
  }

  // Editor: Generate single section
  const handleGenerateSection = async (sectionOrder: number) => {
    if (!editingDI) return
    setSectionGenerating(p => ({ ...p, [sectionOrder]: true }))
    try {
      let diId = editingDI.id
      if (!diId) {
        const position = positions.find(p => p.id === selPositionId)
        const sections = templates.find(t => t.id === selTemplateId)?.sections.map(s => ({ sectionTitle: s.title, sectionContent: '', order: s.order })) || []
        const cr = await fetch('/api/generate-di', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: selPositionId, templateId: selTemplateId, title: `ДИ — ${position?.title || ''}`, sections }) })
        if (!cr.ok) throw new Error('Не удалось создать ДИ')
        const created = await cr.json(); diId = created.id; setEditingDI(created); setEditSections(created.sections || []); setEditTitle(created.title)
      }
      const res = await fetch('/api/generate-di/ai-section', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: diId, sectionOrder }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      const updated = await res.json()
      setEditSections(prev => prev.map(s => s.order === sectionOrder ? { ...s, ...updated } : s))
      toast({ title: 'Секция сгенерирована' })
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка генерации секции', variant: 'destructive' })
    } finally { setSectionGenerating(p => ({ ...p, [sectionOrder]: false })) }
  }

  // Editor: Improve section
  const handleImprove = async () => {
    if (!improveSectionId || !improveInstruction.trim()) return
    setImproving(true)
    try {
      const res = await fetch('/api/generate-di/ai-improve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionId: improveSectionId, instruction: improveInstruction }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Ошибка') }
      const updated = await res.json()
      setEditSections(prev => prev.map(s => s.id === improveSectionId ? { ...s, ...updated } : s))
      toast({ title: 'Секция улучшена' }); setImproveDialogOpen(false); setImproveInstruction('')
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally { setImproving(false) }
  }

  const handleSaveDI = async () => {
    if (!editingDI) return
    try {
      const res = await fetch('/api/generate-di', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingDI.id, title: editTitle, sections: editSections.map(s => ({ sectionTitle: s.sectionTitle, sectionContent: s.sectionContent, order: s.order, aiGenerated: s.aiGenerated, editedBy: s.editedBy })) }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Сохранено' }); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' }) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch('/api/generate-di', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Удалено' }); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' }) }
    finally { setDeleteId(null) }
  }

  const openEditor = (di: GeneratedDI) => { setEditingDI(di); setEditSections([...di.sections]); setEditTitle(di.title); setViewMode('editor') }

  const filteredDIs = generatedDIs.filter(di => !searchQuery || di.title.toLowerCase().includes(searchQuery.toLowerCase()) || di.position?.title?.toLowerCase().includes(searchQuery.toLowerCase()))

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const n = new Set(prev)
      if (n.has(index)) n.delete(index); else n.add(index)
      return n
    })
  }

  const expandAllSections = () => setExpandedSections(new Set(manualSections.map((_, i) => i)))
  const collapseAllSections = () => setExpandedSections(new Set())

  // ===================== LIST VIEW =====================
  if (viewMode === 'list') return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-cyan-600" /> Генерация ДИ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Создание должностных инструкций с ИИ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={startManual}>
            <PenLine className="h-4 w-4 mr-1.5" /> Создать вручную
          </Button>
          <Button onClick={startGenerate} className="bg-cyan-600 hover:bg-cyan-700">
            <Wand2 className="h-4 w-4 mr-1.5" /> Сгенерировать
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick Action Cards */}
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200/50 cursor-pointer hover:shadow-md transition-shadow" onClick={startManual}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-100">
                <PenLine className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <h3 className="font-semibold text-cyan-900">Создать вручную</h3>
                <p className="text-sm text-cyan-700 mt-1">Заполните секции вручную или сгенерируйте каждую с помощью ИИ</p>
                <div className="flex gap-1 mt-2">
                  {STANDARD_DI_SECTIONS.slice(0, 3).map(s => (
                    <Badge key={s.order} variant="secondary" className="text-xs bg-cyan-200/60">{s.title.substring(0, 12)}...</Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs bg-cyan-200/60">+3</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50 cursor-pointer hover:shadow-md transition-shadow" onClick={startGenerate}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100">
                <Wand2 className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-900">Полная ИИ-генерация</h3>
                <p className="text-sm text-purple-700 mt-1">Выберите должность и шаблон — ИИ сгенерирует все секции автоматически</p>
                <Badge variant="secondary" className="text-xs bg-purple-200/60 mt-2">AI Powered</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Input placeholder="Поиск по названию..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredDIs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Нет сгенерированных ДИ</p>
            <div className="flex gap-2 justify-center mt-3">
              <Button variant="outline" onClick={startManual}>Создать вручную</Button>
              <Button onClick={startGenerate}>Сгенерировать</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="hidden sm:table-cell">Дата</TableHead>
                  <TableHead className="w-24 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDIs.map(di => (
                  <TableRow key={di.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">{di.title}</TableCell>
                    <TableCell className="text-sm">{di.position?.title}</TableCell>
                    <TableCell><Badge variant={STATUS_MAP[di.status]?.variant || 'secondary'}>{STATUS_MAP[di.status]?.label || di.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{new Date(di.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingDI(di); setViewDialogOpen(true) }}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditor(di)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(di.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingDI?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">{viewingDI?.sections.map(s => (
            <div key={s.id} className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                {s.sectionTitle}
                {s.aiGenerated && <Badge variant="outline" className="text-xs">ИИ</Badge>}
              </h4>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{s.sectionContent || '—'}</p>
            </div>
          ))}</div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить ДИ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )

  // ===================== AI GENERATE VIEW =====================
  if (viewMode === 'generate') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wand2 className="h-6 w-6 text-purple-600" /> ИИ-генерация ДИ</h1>
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Должность *</Label>
            <Select value={selPositionId} onValueChange={setSelPositionId}>
              <SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger>
              <SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.department?.name})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Шаблон *</Label>
            <Select value={selTemplateId} onValueChange={setSelTemplateId}>
              <SelectTrigger><SelectValue placeholder="Выберите шаблон" /></SelectTrigger>
              <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerateAll} disabled={generating} className="bg-purple-600 hover:bg-purple-700">
            {generating ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Генерация всех секций...</> : <><Wand2 className="h-4 w-4 mr-1.5" /> Сгенерировать всё</>}
          </Button>
        </CardContent>
      </Card>
      {selTemplateId && templates.find(t => t.id === selTemplateId) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Секции шаблона</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {templates.find(t => t.id === selTemplateId)!.sections.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2.5 border rounded-lg">
                <div>
                  <span className="text-sm font-medium">{s.title}</span>
                  {s.isRequired && <span className="text-destructive ml-1">*</span>}
                </div>
                {s.promptGuidance && <Badge variant="outline" className="text-xs">Промпт</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )

  // ===================== MANUAL CREATION VIEW =====================
  if (viewMode === 'manual') {
    const generatedCount = manualSections.filter(s => s.content.trim()).length
    const aiGeneratedCount = manualSections.filter(s => s.aiGenerated).length
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button>
            <h1 className="text-2xl font-bold flex items-center gap-2"><PenLine className="h-6 w-6 text-cyan-600" /> Создание ДИ вручную</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAllSections}>Развернуть все</Button>
            <Button variant="outline" size="sm" onClick={collapseAllSections}>Свернуть все</Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-cyan-800">Прогресс заполнения</span>
              <span className="text-sm text-cyan-700">{generatedCount} / {manualSections.length} секций</span>
            </div>
            <Progress value={(generatedCount / manualSections.length) * 100} className="h-2" />
            {aiGeneratedCount > 0 && (
              <p className="text-xs text-cyan-600 mt-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {aiGeneratedCount} секций сгенерировано ИИ
              </p>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Основные данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Название ДИ *</Label>
                <Input value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="ДИ — Руководитель отдела продаж" />
              </div>
              <div>
                <Label>Должность *</Label>
                <Select value={manualPositionId} onValueChange={setManualPositionId}>
                  <SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger>
                  <SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.department?.name})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Подразделение</Label>
                <Input value={manualDepartment} onChange={e => setManualDepartment(e.target.value)} placeholder="Отдел продаж" />
              </div>
              <div>
                <Label>Категория</Label>
                <Select value={manualCategory} onValueChange={setManualCategory}>
                  <SelectTrigger /><SelectContent>
                    <SelectItem value="Руководители">Руководители</SelectItem>
                    <SelectItem value="Специалисты">Специалисты</SelectItem>
                    <SelectItem value="Служащие">Служащие</SelectItem>
                    <SelectItem value="Рабочие">Рабочие</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Generate All Button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleManualGenerateAll} disabled={manualGeneratingAll || !manualPositionId} className="bg-purple-600 hover:bg-purple-700">
            {manualGeneratingAll ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Генерация... ({manualProgress}%)</> : <><Zap className="h-4 w-4 mr-1.5" /> Сгенерировать все секции ИИ</>}
          </Button>
          {manualGeneratingAll && <Progress value={manualProgress} className="flex-1 max-w-xs h-2" />}
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {manualSections.map((section, index) => {
            const isExpanded = expandedSections.has(index)
            const hasContent = section.content.trim().length > 0
            
            return (
              <Card key={section.order} className={`transition-all ${isExpanded ? 'ring-1 ring-cyan-200/50' : ''}`}>
                <div 
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30"
                  onClick={() => toggleSection(index)}
                >
                  <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted flex-shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">{index + 1}.</span>
                      <span className="font-semibold text-sm">{section.title}</span>
                    </div>
                    {section.promptGuidance && !isExpanded && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{section.promptGuidance}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {hasContent ? (
                      <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
                        <CheckCircle2 className="h-3 w-3" /> {section.aiGenerated ? 'ИИ' : 'Вручную'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Пусто</Badge>
                    )}
                    {section.isGenerating && <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{section.promptGuidance}</p>
                    <Textarea 
                      value={section.content} 
                      onChange={e => setManualSections(prev => prev.map((s, i) => i === index ? { ...s, content: e.target.value, aiGenerated: false } : s))}
                      className="min-h-[200px] text-sm"
                      placeholder={`Введите содержание секции "${section.title}" или сгенерируйте с помощью ИИ...`}
                    />
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); handleManualSectionGenerate(index) }}
                        disabled={section.isGenerating || !manualPositionId}
                        className="gap-1.5"
                      >
                        {section.isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {section.isGenerating ? 'Генерация...' : 'Сгенерировать ИИ'}
                      </Button>
                      {hasContent && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); setManualSections(prev => prev.map((s, i) => i === index ? { ...s, content: '', aiGenerated: false } : s)) }}
                          className="gap-1.5 text-muted-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Очистить
                        </Button>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Save */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Заполнено {generatedCount} из {manualSections.length} секций
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setViewMode('list')}>Отмена</Button>
              <Button onClick={handleManualSave} disabled={manualSaving || !manualTitle.trim() || !manualPositionId} className="bg-cyan-600 hover:bg-cyan-700">
                {manualSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Сохранение...</> : 'Сохранить ДИ'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ===================== EDITOR VIEW =====================
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => { setViewMode('list'); fetchDIs() }}>← Назад</Button>
        <h1 className="text-2xl font-bold">Редактор ДИ</h1>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="mb-4"><Label>Название</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
          <div className="space-y-3">
            {editSections.map(section => (
              <div key={section.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-medium flex items-center gap-2">
                    {section.sectionTitle}
                    {section.aiGenerated && <Badge variant="outline" className="text-xs">ИИ</Badge>}
                    {!section.aiGenerated && section.sectionContent && <Badge variant="secondary" className="text-xs">Вручную</Badge>}
                  </Label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleGenerateSection(section.order)} disabled={sectionGenerating[section.order]}>
                      {sectionGenerating[section.order] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setImproveSectionId(section.id); setImproveInstruction(''); setImproveDialogOpen(true) }}><FileText className="h-3 w-3" /></Button>
                  </div>
                </div>
                <Textarea value={section.sectionContent} onChange={e => setEditSections(prev => prev.map(s => s.id === section.id ? { ...s, sectionContent: e.target.value } : s))} className="min-h-[120px] text-sm" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSaveDI}>Сохранить</Button>
          </div>
        </CardContent>
      </Card>

      {/* Improve Dialog */}
      <Dialog open={improveDialogOpen} onOpenChange={setImproveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Улучшить секцию</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Инструкция для ИИ</Label><Textarea value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)} placeholder="Например: Улучши текст, добавь детали..." className="min-h-[80px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImproveDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleImprove} disabled={improving}>{improving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Улучшить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
