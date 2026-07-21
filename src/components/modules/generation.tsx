'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Eye, Loader2, Sparkles, FileText } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department; grade?: string | null; domain?: string | null; headcount: number; functions?: string | null }
interface TemplateSection { id: string; title: string; order: number; promptGuidance?: string | null; isRequired: boolean; content?: string | null }
interface Template { id: string; name: string; description?: string | null; isActive: boolean; sections: TemplateSection[] }
interface MasterPrompt { id: string; name: string; content: string; version: number; isActive: boolean; departmentId?: string | null; domain?: string | null; grade?: string | null; description?: string | null }
interface GeneratedDISection { id: string; sectionTitle: string; sectionContent: string; order: number; aiGenerated: boolean; editedBy?: string | null }
interface GeneratedDI { id: string; positionId: string; templateId?: string | null; title: string; status: string; position: Position & { department: Department }; template?: Template | null; sections: GeneratedDISection[]; createdAt: string; updatedAt: string }

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  review: { label: 'На рассмотрении', variant: 'outline' },
  approved: { label: 'Утверждено', variant: 'default' },
  exported: { label: 'Экспортировано', variant: 'default' },
}

export function GenerationModule() {
  const { toast } = useToast()
  const [viewMode, setViewMode] = useState<'list' | 'generate' | 'editor'>('list')
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [masterPrompts, setMasterPrompts] = useState<MasterPrompt[]>([])
  const [loading, setLoading] = useState(true)

  // Generate form
  const [selPositionId, setSelPositionId] = useState('')
  const [selTemplateId, setSelTemplateId] = useState('')
  const [generating, setGenerating] = useState(false)

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

  // LIST VIEW
  if (viewMode === 'list') return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-6 w-6" /> Генерация ДИ</h1><p className="text-sm text-muted-foreground">Создание должностных инструкций с ИИ</p></div>
        <Button onClick={startGenerate}><Plus className="h-4 w-4 mr-1" /> Сгенерировать</Button>
      </div>
      <Input placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="max-w-xs" />
      {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : filteredDIs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Sparkles className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Нет сгенерированных ДИ</p><Button className="mt-2" onClick={startGenerate}>Сгенерировать</Button></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Должность</TableHead><TableHead>Статус</TableHead><TableHead>Дата</TableHead><TableHead className="text-right">Действия</TableHead></TableRow></TableHeader>
          <TableBody>{filteredDIs.map(di => (
            <TableRow key={di.id}>
              <TableCell className="font-medium">{di.title}</TableCell>
              <TableCell className="text-sm">{di.position?.title}</TableCell>
              <TableCell><Badge variant={STATUS_MAP[di.status]?.variant || 'secondary'}>{STATUS_MAP[di.status]?.label || di.status}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(di.createdAt).toLocaleDateString('ru-RU')}</TableCell>
              <TableCell><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingDI(di); setViewDialogOpen(true) }}><Eye className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditor(di)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(di.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div></TableCell>
            </TableRow>
          ))}</TableBody></Table>
        </CardContent></Card>
      )}
      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingDI?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">{viewingDI?.sections.map(s => <div key={s.id}><h4 className="font-medium text-sm mb-1">{s.sectionTitle}</h4><p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{s.sectionContent || '—'}</p></div>)}</div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить ДИ?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )

  // GENERATE VIEW
  if (viewMode === 'generate') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button><h1 className="text-2xl font-bold">Генерация ДИ</h1></div>
      <Card><CardContent className="p-4 space-y-4">
        <div><Label>Должность *</Label><Select value={selPositionId} onValueChange={setSelPositionId}><SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.department?.name})</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Шаблон *</Label><Select value={selTemplateId} onValueChange={setSelTemplateId}><SelectTrigger><SelectValue placeholder="Выберите шаблон" /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateAll} disabled={generating}>{generating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Генерация...</> : <><Sparkles className="h-4 w-4 mr-1" /> Сгенерировать всё</>}</Button>
        </div>
      </CardContent></Card>
      {selTemplateId && templates.find(t => t.id === selTemplateId) && (
        <Card><CardHeader><CardTitle className="text-base">Секции шаблона</CardTitle></CardHeader><CardContent className="space-y-2">
          {templates.find(t => t.id === selTemplateId)!.sections.map(s => (
            <div key={s.id} className="flex items-center justify-between p-2 border rounded"><span className="text-sm">{s.title} {s.isRequired && <span className="text-destructive">*</span>}</span></div>
          ))}
        </CardContent></Card>
      )}
    </div>
  )

  // EDITOR VIEW
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => { setViewMode('list'); fetchDIs() }}>← Назад</Button><h1 className="text-2xl font-bold">Редактор ДИ</h1></div>
      <Card><CardContent className="p-4">
        <div className="mb-4"><Label>Название</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
        <div className="space-y-3">
          {editSections.map(section => (
            <div key={section.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{section.sectionTitle} {section.aiGenerated && <Badge variant="outline" className="ml-1 text-xs">ИИ</Badge>}</Label>
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
        <div className="flex gap-2 mt-4"><Button onClick={handleSaveDI}>Сохранить</Button></div>
      </CardContent></Card>

      {/* Improve Dialog */}
      <Dialog open={improveDialogOpen} onOpenChange={setImproveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Улучшить секцию</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Инструкция для ИИ</Label><Textarea value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)} placeholder="Например: Улучши текст, добавь детали..." className="min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImproveDialogOpen(false)}>Отмена</Button><Button onClick={handleImprove} disabled={improving}>{improving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Улучшить'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
