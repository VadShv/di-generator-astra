'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import { Brain, Plus, Eye, Pencil, Trash2, GitBranch, Copy, CheckCircle2, XCircle, Sparkles } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface BusinessFunctionItem { id: string; name: string }
interface MasterPrompt {
  id: string; name: string; content: string; version: number; isActive: boolean
  departmentId: string | null; department: Department | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  grade: string | null; functionType: string | null; description: string | null
  createdAt: string; updatedAt: string
}
interface Position {
  id: string; title: string; code: string; departmentId: string; department: Department
  grade: string | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  projectId: string | null; project: { id: string; name: string } | null
  functions: string | null
}
interface PromptGroup { name: string; prompts: MasterPrompt[]; activeVersion: MasterPrompt | undefined; latestVersion: MasterPrompt }

const gradeLabel = (grade: string | null): string | null => {
  if (!grade) return null
  if (grade === 'линейная') return 'Линейная'
  if (grade === 'руководитель') return 'Руководитель'
  return grade
}

export function MasterPromptsModule() {
  const { toast } = useToast()
  const [prompts, setPrompts] = useState<MasterPrompt[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [businessFunctions, setBusinessFunctions] = useState<BusinessFunctionItem[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('all')
  const [filterIsActive, setFilterIsActive] = useState<string>('all')

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resolverDialogOpen, setResolverDialogOpen] = useState(false)

  const [editingPrompt, setEditingPrompt] = useState<MasterPrompt | null>(null)
  const [viewingPrompt, setViewingPrompt] = useState<MasterPrompt | null>(null)
  const [versionPromptName, setVersionPromptName] = useState('')
  const [versionHistory, setVersionHistory] = useState<MasterPrompt[]>([])
  const [deletingPrompt, setDeletingPrompt] = useState<MasterPrompt | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [formBusinessFunctionId, setFormBusinessFunctionId] = useState('')
  const [formGrade, setFormGrade] = useState('')
  const [formFunctionType, setFormFunctionType] = useState('')

  // Resolver
  const [resolverPositionId, setResolverPositionId] = useState('')
  const [resolverResult, setResolverResult] = useState<{ prompt: MasterPrompt | null; resolution: { score: number; matchDetails: string[] } | null } | null>(null)
  const [resolverLoading, setResolverLoading] = useState(false)

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterName) params.set('name', filterName)
      if (filterDepartmentId && filterDepartmentId !== 'all') params.set('departmentId', filterDepartmentId)
      if (filterIsActive !== 'all') params.set('isActive', filterIsActive)
      const res = await fetch(`/api/master-prompts?${params.toString()}`)
      if (!res.ok) throw new Error()
      setPrompts(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить мастер-промпты', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filterName, filterDepartmentId, filterIsActive, toast])

  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch('/api/departments'); if (res.ok) setDepartments(await res.json()) } catch { /* silent */ }
  }, [])

  const fetchBusinessFunctions = useCallback(async () => {
    try { const res = await fetch('/api/business-functions'); if (res.ok) setBusinessFunctions(await res.json()) } catch { /* silent */ }
  }, [])

  const fetchPositions = useCallback(async () => {
    try { const res = await fetch('/api/positions'); if (res.ok) setPositions(await res.json()) } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPrompts() }, [fetchPrompts])
  useEffect(() => { fetchDepartments(); fetchBusinessFunctions(); fetchPositions() }, [fetchDepartments, fetchBusinessFunctions, fetchPositions])

  const groupedPrompts = useMemo(() => {
    const groups: Record<string, MasterPrompt[]> = {}
    for (const p of prompts) { if (!groups[p.name]) groups[p.name] = []; groups[p.name].push(p) }
    return Object.entries(groups).map(([name, list]) => ({
      name,
      prompts: list.sort((a, b) => b.version - a.version),
      activeVersion: list.find(p => p.isActive),
      latestVersion: list.sort((a, b) => b.version - a.version)[0],
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [prompts])

  const openCreateDialog = () => {
    setEditingPrompt(null)
    setFormName(''); setFormContent(''); setFormDescription(''); setFormDepartmentId('')
    setFormBusinessFunctionId(''); setFormGrade(''); setFormFunctionType('')
    setEditDialogOpen(true)
  }

  const openEditDialog = (p: MasterPrompt) => {
    setEditingPrompt(p)
    setFormName(p.name); setFormContent(p.content); setFormDescription(p.description || '')
    setFormDepartmentId(p.departmentId || ''); setFormBusinessFunctionId(p.businessFunctionId || '')
    setFormGrade(p.grade || ''); setFormFunctionType(p.functionType || '')
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) {
      toast({ title: 'Ошибка', description: 'Название и содержимое обязательны', variant: 'destructive' }); return
    }
    try {
      const body = { name: formName, content: formContent, description: formDescription, departmentId: formDepartmentId || null, businessFunctionId: formBusinessFunctionId || null, grade: formGrade || null, functionType: formFunctionType || null }
      if (editingPrompt) {
        const res = await fetch('/api/master-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPrompt.id, ...body }) })
        if (!res.ok) throw new Error()
        toast({ title: 'Успешно', description: 'Мастер-промпт обновлён' })
      } else {
        const res = await fetch('/api/master-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error()
        toast({ title: 'Успешно', description: 'Мастер-промпт создан' })
      }
      setEditDialogOpen(false); fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingPrompt) return
    try {
      const res = await fetch('/api/master-prompts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deletingPrompt.id }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Мастер-промпт удалён' })
      setDeleteDialogOpen(false); fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (p: MasterPrompt) => {
    try {
      const res = await fetch('/api/master-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, isActive: !p.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: p.isActive ? 'Версия деактивирована' : 'Версия активирована' })
      fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось изменить статус', variant: 'destructive' })
    }
  }

  const openVersionDialog = async (name: string) => {
    setVersionPromptName(name)
    try {
      const res = await fetch(`/api/master-prompts/versions?name=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error()
      setVersionHistory(await res.json()); setVersionDialogOpen(true)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить версии', variant: 'destructive' })
    }
  }

  const handleDuplicate = (p: MasterPrompt) => {
    setEditingPrompt(null)
    setFormName(p.name); setFormContent(p.content); setFormDescription(`Копия версии ${p.version}`)
    setFormDepartmentId(p.departmentId || ''); setFormBusinessFunctionId(p.businessFunctionId || '')
    setFormGrade(p.grade || ''); setFormFunctionType(p.functionType || '')
    setEditDialogOpen(true)
  }

  const handleResolve = async () => {
    if (!resolverPositionId) { toast({ title: 'Ошибка', description: 'Выберите должность', variant: 'destructive' }); return }
    setResolverLoading(true)
    try {
      const res = await fetch('/api/master-prompts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: resolverPositionId }) })
      if (!res.ok) throw new Error()
      setResolverResult(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось разрешить промпт', variant: 'destructive' })
    } finally {
      setResolverLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> Мастер-промпты</h1>
          <p className="text-sm text-muted-foreground">Управление промптами для генерации ДИ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setResolverDialogOpen(true)}><Sparkles className="h-4 w-4 mr-1" /> Тест резолвера</Button>
          <Button onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1" /> Создать</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Поиск по названию..." value={filterName} onChange={e => setFilterName(e.target.value)} className="max-w-xs" />
            <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Подразделение" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterIsActive} onValueChange={setFilterIsActive}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Статус" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="true">Активные</SelectItem>
                <SelectItem value="false">Неактивные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : groupedPrompts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Нет мастер-промптов</p>
          <Button className="mt-2" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1" /> Создать</Button>
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {groupedPrompts.map(group => (
            <AccordionItem key={group.name} value={group.name} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-2 hover:no-underline">
                <div className="flex items-center gap-2 flex-1 text-left">
                  <Brain className="h-4 w-4" />
                  <span className="font-semibold">{group.name}</span>
                  <Badge variant="secondary" className="text-xs">v{group.latestVersion.version}</Badge>
                  {group.activeVersion ? <Badge className="text-xs bg-green-600">Активна v{group.activeVersion.version}</Badge> : <Badge variant="destructive" className="text-xs">Нет активной</Badge>}
                  <Badge variant="outline" className="text-xs">{group.prompts.length} версий</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Версия</TableHead><TableHead>Подразделение</TableHead><TableHead>Бизнес-функция</TableHead><TableHead>Статус</TableHead><TableHead>Дата</TableHead><TableHead className="text-right">Действия</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {group.prompts.map(p => (
                      <TableRow key={p.id} className={!p.isActive ? 'opacity-60' : ''}>
                        <TableCell><Badge variant="secondary">v{p.version}</Badge></TableCell>
                        <TableCell className="text-sm">{p.department?.name || 'Все'}</TableCell>
                        <TableCell className="text-sm">{p.businessFunction?.name || 'Все'}</TableCell>
                        <TableCell>{p.isActive ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Активна</Badge> : <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Неактивна</Badge>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setViewingPrompt(p); setViewDialogOpen(true) }}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(p)}>{p.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(p)}><Copy className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeletingPrompt(p); setDeleteDialogOpen(true) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => openVersionDialog(group.name)}><GitBranch className="h-4 w-4 mr-1" /> История</Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPrompt ? 'Редактировать промпт' : 'Создать промпт'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Название промпта" /></div>
            <div><Label>Содержимое *</Label><Textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Текст промпта..." className="min-h-[200px] font-mono text-sm" /></div>
            <div><Label>Описание</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Описание версии" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Подразделение</Label><Select value={formDepartmentId} onValueChange={setFormDepartmentId}><SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger><SelectContent><SelectItem value="_none">Все</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Бизнес-функция</Label><Select value={formBusinessFunctionId} onValueChange={setFormBusinessFunctionId}><SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger><SelectContent><SelectItem value="_none">Все</SelectItem>{businessFunctions.map(bf => <SelectItem key={bf.id} value={bf.id}>{bf.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Грейд</Label><Input value={formGrade} onChange={e => setFormGrade(e.target.value)} placeholder="G1, G2..." /></div>
              <div><Label className="text-xs">Тип функции</Label><Input value={formFunctionType} onChange={e => setFormFunctionType(e.target.value)} placeholder="Разработка, Аналитика..." /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button><Button onClick={handleSave}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingPrompt?.name} — v{viewingPrompt?.version}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              {viewingPrompt?.isActive ? <Badge className="bg-green-600">Активна</Badge> : <Badge variant="secondary">Неактивна</Badge>}
              {viewingPrompt?.businessFunction && <Badge variant="outline">{viewingPrompt.businessFunction.name}</Badge>}
              {gradeLabel(viewingPrompt?.grade ?? null) && <Badge variant="outline">{gradeLabel(viewingPrompt?.grade ?? null)}</Badge>}
            </div>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">{viewingPrompt?.content}</pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>История версий: {versionPromptName}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {versionHistory.map(v => (
              <div key={v.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2"><Badge variant="secondary">v{v.version}</Badge>{v.isActive ? <Badge className="bg-green-600 text-xs">Активна</Badge> : null}{v.description && <span className="text-sm text-muted-foreground">{v.description}</span>}</div>
                <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить промпт?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Версия v{deletingPrompt?.version} промпта &quot;{deletingPrompt?.name}&quot;</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolver Dialog */}
      <Dialog open={resolverDialogOpen} onOpenChange={setResolverDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Тест резолвера промптов</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Должность</Label><Select value={resolverPositionId} onValueChange={setResolverPositionId}><SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={handleResolve} disabled={resolverLoading}>{resolverLoading ? 'Резолвинг...' : 'Разрешить'}</Button>
            {resolverResult?.prompt && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium">Резолвлен: {resolverResult.prompt.name} (v{resolverResult.prompt.version})</p>
                {resolverResult.prompt.businessFunction && <p className="text-sm text-muted-foreground">Бизнес-функция: {resolverResult.prompt.businessFunction.name}</p>}
                {resolverResult.resolution && <p className="text-sm text-muted-foreground">Score: {resolverResult.resolution.score} | Совпадения: {resolverResult.resolution.matchDetails.join(', ')}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
