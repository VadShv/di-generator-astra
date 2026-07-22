'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { FileText, Plus, Pencil, Trash2, Copy, ArrowUp, ArrowDown, Eye, Star, StarOff, CheckCircle2, Crown } from 'lucide-react'

interface TemplateSection { id?: string; title: string; order: number; promptGuidance?: string | null; isRequired: boolean; content?: string | null }
interface Template { id: string; name: string; description?: string | null; isActive: boolean; isPrimary: boolean; sections: TemplateSection[]; createdAt: string; updatedAt: string }

const DEFAULT_SECTIONS: Omit<TemplateSection, 'id'>[] = [
  { title: 'Общие положения', order: 1, promptGuidance: 'Опишите общие положения: категория должности, порядок назначения и освобождения, подчинённость, замещение, требования к знаниям (законодательство, нормативные акты, правила делового общения).', isRequired: true, content: null },
  { title: 'Квалификационные требования и навыки', order: 2, promptGuidance: 'Укажите требования: образование (направления), опыт работы, профессиональные навыки, необходимые знания, сертификаты.', isRequired: true, content: null },
  { title: 'Должностные обязанности', order: 3, promptGuidance: 'Перечислите должностные обязанности: руководство, планирование, контроль, взаимодействие, отчётность и т.д.', isRequired: true, content: null },
  { title: 'Права', order: 4, promptGuidance: 'Опишите права работника: требование условий, запрос информации, внесение предложений, привлечение специалистов, визирование документов, принятие решений, представление интересов.', isRequired: true, content: null },
  { title: 'Ответственность', order: 5, promptGuidance: 'Укажите виды ответственности: за неисполнение обязанностей, правонарушения, материальный ущерб, разглашение коммерческой тайны.', isRequired: true, content: null },
  { title: 'Условия работы', order: 6, promptGuidance: 'Опишите условия работы: режим рабочего времени, командировки, оклад, премирование по KPI.', isRequired: true, content: null },
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
  const [confirmPrimaryOpen, setConfirmPrimaryOpen] = useState(false)
  const [setPrimaryId, setSetPrimaryId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try { const res = await fetch('/api/templates'); if (res.ok) setTemplates(await res.json()) }
    catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить шаблоны', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleCreateNew = () => { setCurrentTemplate({ name: '', description: '', isActive: true, isPrimary: false }); setEditingSections([]); setViewMode('edit') }
  const handleCreateDefault = () => {
    setCurrentTemplate({ name: 'Стандартный шаблон ДИ Группы Астра', description: 'Стандартный шаблон должностной инструкции Группы Астра с 6 разделами: Общие положения, Квалификационные требования, Должностные обязанности, Права, Ответственность, Условия работы', isActive: true, isPrimary: true })
    setEditingSections(DEFAULT_SECTIONS.map((s, i) => ({ ...s, id: `new-${Date.now()}-${i}` }))); setViewMode('edit')
  }

  const handleEdit = (t: Template) => { setCurrentTemplate({ id: t.id, name: t.name, description: t.description, isActive: t.isActive, isPrimary: t.isPrimary }); setEditingSections([...t.sections]); setViewMode('edit') }
  const handlePreview = (t: Template) => { setPreviewTemplate(t); setViewMode('preview') }

  const handleDuplicate = async (t: Template) => {
    try {
      setSaving(true)
      const res = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `${t.name} (копия)`, description: t.description, isPrimary: false, sections: t.sections.map(s => ({ title: s.title, order: s.order, promptGuidance: s.promptGuidance, isRequired: s.isRequired, content: s.content })) }) })
      if (res.ok) { toast({ title: 'Шаблон скопирован' }); fetchTemplates() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  // Set template as primary
  const handleSetPrimary = async () => {
    if (!setPrimaryId) return
    try {
      const res = await fetch('/api/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: setPrimaryId, isPrimary: true }) })
      if (res.ok) {
        toast({ title: 'Основной шаблон', description: 'Шаблон установлен как основной для ручной генерации' })
        fetchTemplates()
      } else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось установить основной шаблон', variant: 'destructive' })
    } finally {
      setConfirmPrimaryOpen(false); setSetPrimaryId(null)
    }
  }

  const confirmSetPrimary = (id: string) => {
    setSetPrimaryId(id)
    setConfirmPrimaryOpen(true)
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
      const payload = { ...(currentTemplate.id ? { id: currentTemplate.id } : {}), name: currentTemplate.name, description: currentTemplate.description, isActive: currentTemplate.isActive, isPrimary: currentTemplate.isPrimary, sections: editingSections.map((s, idx) => ({ title: s.title, order: idx, promptGuidance: s.promptGuidance, isRequired: s.isRequired, content: s.content })) }
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
  if (viewMode === 'list') {
    const primaryTemplate = templates.find(t => t.isPrimary)

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Шаблоны ДИ</h1>
            <p className="text-sm text-muted-foreground">Управление шаблонами и пресетами должностных инструкций</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreateDefault}><Plus className="h-4 w-4 mr-1" /> Стандартный</Button>
            <Button onClick={handleCreateNew}><Plus className="h-4 w-4 mr-1" /> Пустой</Button>
          </div>
        </div>

        {/* Primary template highlight */}
        {primaryTemplate && (
          <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 border border-amber-200">
                  <Crown className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-900">Основной шаблон (пресет)</span>
                    <Badge className="bg-amber-600 text-white">По умолчанию</Badge>
                  </div>
                  <p className="text-sm text-amber-700 mt-0.5">{primaryTemplate.name}</p>
                  <p className="text-xs text-amber-600 mt-0.5">{primaryTemplate.sections.length} секций — будет предвыбран при ручной генерации ДИ</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(primaryTemplate)}><Eye className="h-3 w-3 mr-1" /> Просмотр</Button>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(primaryTemplate)}><Pencil className="h-3 w-3 mr-1" /> Изменить</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!primaryTemplate && !loading && templates.length > 0 && (
          <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100 border border-gray-200">
                  <Star className="h-5 w-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Основной шаблон не выбран. Установите один из шаблонов как основной — он будет предвыбран при ручной генерации ДИ.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Загрузка...</p>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Нет шаблонов</p>
              <p className="text-sm mt-1">Создайте шаблон — он станет пресетом для ручной генерации ДИ</p>
              <div className="flex gap-2 justify-center mt-3">
                <Button variant="outline" onClick={handleCreateDefault}>Стандартный</Button>
                <Button onClick={handleCreateNew}>Пустой</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <Card key={t.id} className={`hover:shadow-sm transition-shadow ${t.isPrimary ? 'ring-1 ring-amber-200' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {t.name}
                      {t.isPrimary && <Crown className="h-4 w-4 text-amber-500" />}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      {t.isActive && <Badge className="bg-green-600">Активен</Badge>}
                      {t.isPrimary && <Badge className="bg-amber-600 text-white">Основной</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  <p className="text-sm">{t.sections.length} секций: {t.sections.slice(0, 3).map(s => s.title).join(', ')}{t.sections.length > 3 && '...'}</p>
                  <Separator className="my-2" />
                  <div className="flex gap-1 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(t)}><Eye className="h-3 w-3 mr-1" /> Просмотр</Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3 mr-1" /> Ред.</Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(t)}><Copy className="h-3 w-3" /></Button>
                    {!t.isPrimary && (
                      <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => confirmSetPrimary(t.id)}>
                        <Star className="h-3 w-3 mr-1" /> Основной
                      </Button>
                    )}
                    {t.isPrimary && (
                      <Button variant="outline" size="sm" className="text-amber-700 border-amber-300" onClick={() => {
                        fetch('/api/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, isPrimary: false }) })
                          .then(() => { toast({ title: 'Основной шаблон снят' }); fetchTemplates() })
                          .catch(() => toast({ title: 'Ошибка', variant: 'destructive' }))
                      }}>
                        <StarOff className="h-3 w-3 mr-1" /> Снять
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setTemplateToDelete(t.id); setDeleteDialogOpen(true) }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Удалить шаблон?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={confirmPrimaryOpen} onOpenChange={setConfirmPrimaryOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Установить как основной шаблон?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Этот шаблон будет предвыбран при ручной генерации ДИ. Текущий основной шаблон (если есть) будет заменён.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmPrimaryOpen(false)}>Отмена</Button>
              <Button onClick={handleSetPrimary} className="bg-amber-600 hover:bg-amber-700">
                <Crown className="h-4 w-4 mr-1.5" /> Установить основным
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // EDIT VIEW
  if (viewMode === 'edit') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button><h1 className="text-2xl font-bold">{currentTemplate?.id ? 'Редактирование' : 'Новый шаблон'}</h1></div>
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Название *</Label><Input value={currentTemplate?.name || ''} onChange={e => setCurrentTemplate(p => p ? { ...p, name: e.target.value } : null)} /></div>
          <div><Label>Описание</Label><Input value={currentTemplate?.description || ''} onChange={e => setCurrentTemplate(p => p ? { ...p, description: e.target.value } : null)} /></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Switch checked={currentTemplate?.isActive ?? true} onCheckedChange={v => setCurrentTemplate(p => p ? { ...p, isActive: v } : null)} /><Label>Активен</Label></div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2"><Switch checked={currentTemplate?.isPrimary ?? false} onCheckedChange={v => setCurrentTemplate(p => p ? { ...p, isPrimary: v } : null)} /><Label>Основной (пресет)</Label></div>
          {currentTemplate?.isPrimary && <Badge className="bg-amber-600 text-white"><Crown className="h-3 w-3 mr-1" /> Предвыбран при ручной генерации</Badge>}
        </div>
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
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setViewMode('list')}>← Назад</Button><h1 className="text-2xl font-bold flex items-center gap-2">{previewTemplate?.name} {previewTemplate?.isPrimary && <Crown className="h-5 w-5 text-amber-500" />}</h1></div>
      <Card><CardContent className="p-4 space-y-4">
        {previewTemplate?.description && <p className="text-muted-foreground">{previewTemplate.description}</p>}
        <div className="flex items-center gap-2">
          {previewTemplate?.isActive ? <Badge className="bg-green-600">Активен</Badge> : <Badge variant="secondary">Неактивен</Badge>}
          {previewTemplate?.isPrimary ? <Badge className="bg-amber-600 text-white"><Crown className="h-3 w-3 mr-1" /> Основной пресет</Badge> : null}
        </div>
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
