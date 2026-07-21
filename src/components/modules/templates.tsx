'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileText, Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Eye } from 'lucide-react'

interface TemplateSection { id?: string; title: string; order: number; promptGuidance?: string | null; isRequired: boolean; content?: string | null }
interface Template { id: string; name: string; description?: string | null; isActive: boolean; sections: TemplateSection[]; createdAt: string; updatedAt: string }

const DEFAULT_SECTIONS: Omit<TemplateSection, 'id'>[] = [
  { title: 'Общие положения', order: 1, promptGuidance: 'Опишите общие положения должностной инструкции', isRequired: true, content: null },
  { title: 'Квалификационные требования', order: 2, promptGuidance: 'Укажите требования к квалификации', isRequired: true, content: null },
  { title: 'Должностные обязанности', order: 3, promptGuidance: 'Перечислите должностные обязанности', isRequired: true, content: null },
  { title: 'Права', order: 4, promptGuidance: 'Опишите права работника', isRequired: true, content: null },
  { title: 'Ответственность', order: 5, promptGuidance: 'Укажите виды ответственности', isRequired: true, content: null },
  { title: 'Взаимоотношения по должности', order: 6, promptGuidance: 'Опишите систему взаимодействий', isRequired: true, content: null },
]

export function TemplatesModule() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'edit' | 'preview'>('list')
  const [currentTemplate, setCurrentTemplate] = useState<Partial<Template> | null>(null)
  const [editingSections, setEditingSections] = useState<TemplateSection[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  const fetchTemplates = useCallback(async () => {
    try { const res = await fetch('/api/templates'); if (res.ok) setTemplates(await res.json()) }
    catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить шаблоны', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleCreateNew = () => { setCurrentTemplate({ name: '', description: '', isActive: true }); setEditingSections([]); setViewMode('edit') }
  const handleCreateDefault = () => {
    setCurrentTemplate({ name: 'Стандартный шаблон ДИ', description: 'Стандартный шаблон должностной инструкции', isActive: true })
    setEditingSections(DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: `new-${Date.now()}-${i}` }))); setViewMode('edit')
  }

  const handleEdit = (t: Template) => { setCurrentTemplate({ id: t.id, name: t.name, description: t.description, isActive: t.isActive }); setEditingSections([...t.sections]); setViewMode('edit') }
  const handlePreview = (t: Template) => { setPreviewTemplate(t); setViewMode('preview') }

  const handleDuplicate = async (t: Template) => {
    try {
      setSaving(true)
      const res = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${t.name} (копия)`, description: t.description, sections: t.sections.map(s => ({ title: s.title, order: s.order, promptGuidance: s.promptGuidance, isRequired: s.isRequired, content: s.content })) }) })
      if (res.ok) { toast({ title: 'Шаблон скопирован' }); fetchTemplates() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!templateToDelete) return
    try {
      const res = await fetch('/api/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: templateToDelete }) })
      if (res.ok) { toast({ title: 'Удалено' }); fetchTemplates() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' }) }
    finally { setDeleteDialogOpen(false); setTemplateToDelete(null) }
  }

  const handleSave = async () => {
    if (!currentTemplate?.name?.trim()) { toast({ title: 'Ошибка', description: 'Укажите название', variant: 'destructive' }); return }
    if (editingSections.length === 0) { toast({ title: 'Ошибка', description: 'Добавьте секции', variant: 'destructive' }); return }
    for (const s of editingSections) { if (!s.title.trim()) { toast({ title: 'Ошибка', description: 'Все секции должны иметь название', variant: 'destructive' }); return } }
    setSaving(true)
    try {
      const payload = { ...(currentTemplate.id ? { id: currentTemplate.id } : {}), name: currentTemplate.name, description: currentTemplate.description, isActive: currentTemplate.isActive, sections: editingSections.map((s, idx) => ({ title: s.title, order: idx, promptGuidance: s.promptGuidance, isRequired: s.isRequired, content: s.content })) }
      const method = currentTemplate.id ? 'PUT' : 'POST'
      const res = await fetch('/api/templates', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast({ title: currentTemplate.id ? 'Обновлён' : 'Создан' }); setViewMode('list'); fetchTemplates() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const addSection = () => setEditingSections([...editingSections, { id: `new-${Date.now()}`, title: '', order: editingSections.length, promptGuidance: null, isRequired: false, content: null }])
  const removeSection = (i: number) => setEditingSections(editingSections.filter((_, idx) => idx !== i))
  const moveUp = (i: number) => { if (i === 0) return; const arr = [...editingSections]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setEditingSections(arr) }
  const moveDown = (i: number) => { if (i === editingSections.length - 1) return; const arr = [...editingSections]; [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; setEditingSections(arr) }
  const updateSection = (i: number, field: keyof TemplateSection, value: unknown) => setEditingSections(editingSections.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  // LIST VIEW
  if (viewMode === 'list') return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Шаблоны ДИ</h1><p className="text-sm text-muted-foreground">Управление шаблонами должностных инструкций</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={handleCreateDefault}><Plus className="h-4 w-4 mr-1" /> Стандартный</Button><Button onClick={handleCreateNew}><Plus className="h-4 w-4 mr-1" /> Пустой</Button></div>
      </div>
      {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : templates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Нет шаблонов</p><div className="flex gap-2 justify-center mt-2"><Button variant="outline" onClick={handleCreateDefault}>Стандартный</Button><Button onClick={handleCreateNew}>Пустой</Button></div></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-sm">
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">{t.name}</CardTitle>{t.isActive && <Badge className="bg-green-600">Активен</Badge>}</div></CardHeader>
              <CardContent className="space-y-2">
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <p className="text-sm">{t.sections.length} секций: {t.sections.slice(0, 3).map(s => s.title).join(', ')}{t.sections.length > 3 && '...'}</p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(t)}><Eye className="h-3 w-3 mr-1" /> Просмотр</Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Редактировать</Button>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(t)}><Copy className="h-3 w-3" /></Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setTemplateToDelete(t.id); setDeleteDialogOpen(true) }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить шаблон?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )

  // EDIT VIEW
  if (viewMode === 'edit') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button><h1 className="text-2xl font-bold">{currentTemplate?.id ? 'Редактирование' : 'Новый шаблон'}</h1></div>
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Название *</Label><Input value={currentTemplate?.name || ''} onChange={e => setCurrentTemplate(p => p ? { ...p, name: e.target.value } : null)} /></div>
          <div><Label>Описание</Label><Input value={currentTemplate?.description || ''} onChange={e => setCurrentTemplate(p => p ? { ...p, description: e.target.value } : null)} /></div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={currentTemplate?.isActive ?? true} onCheckedChange={v => setCurrentTemplate(p => p ? { ...p, isActive: v } : null)} /><Label>Активен</Label></div>
        <div className="flex items-center justify-between"><h3 className="font-medium">Секции ({editingSections.length})</h3><Button variant="outline" size="sm" onClick={addSection}><Plus className="h-3 w-3 mr-1" /> Добавить</Button></div>
        <div className="space-y-2">
          {editingSections.map((s, i) => (
            <div key={s.id || i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(i)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(i)} disabled={i === editingSections.length - 1}><ArrowDown className="h-3 w-3" /></Button></div>
                <span className="text-sm text-muted-foreground">{i + 1}.</span>
                <Input value={s.title} onChange={e => updateSection(i, 'title', e.target.value)} placeholder="Название секции" className="flex-1" />
                <div className="flex items-center gap-1"><Label className="text-xs">Обяз.</Label><Switch checked={s.isRequired} onCheckedChange={v => updateSection(i, 'isRequired', v)} /></div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSection(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <Textarea value={s.promptGuidance || ''} onChange={e => updateSection(i, 'promptGuidance', e.target.value || null)} placeholder="Подсказка для ИИ..." className="min-h-[60px] text-sm" />
            </div>
          ))}
        </div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setViewMode('list')}>Отмена</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button></div>
      </CardContent></Card>
    </div>
  )

  // PREVIEW VIEW
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button><h1 className="text-2xl font-bold">{previewTemplate?.name}</h1></div>
      <Card><CardContent className="p-4 space-y-4">
        {previewTemplate?.description && <p className="text-muted-foreground">{previewTemplate.description}</p>}
        <div className="flex items-center gap-2">{previewTemplate?.isActive ? <Badge className="bg-green-600">Активен</Badge> : <Badge variant="secondary">Неактивен</Badge>}</div>
        <div className="space-y-3">
          {previewTemplate?.sections.map((s, i) => (
            <div key={s.id || i} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1"><span className="font-medium">{i + 1}. {s.title}</span>{s.isRequired && <Badge variant="destructive" className="text-xs">Обяз.</Badge>}</div>
              {s.promptGuidance && <p className="text-sm text-muted-foreground">Подсказка: {s.promptGuidance}</p>}
              {s.content && <p className="text-sm mt-1">{s.content}</p>}
            </div>
          ))}
        </div>
      </CardContent></Card>
    </div>
  )
}
