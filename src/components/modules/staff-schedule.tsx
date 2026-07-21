'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Building2, Users, Search, Upload } from 'lucide-react'

interface Department { id: string; name: string; code: string; parentId: string | null; parent?: Department | null; children?: Department[]; _count?: { positions: number }; createdAt: string; updatedAt: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department; grade: string | null; domain: string | null; headcount: number; functions: string | null; createdAt: string; updatedAt: string }

export function StaffScheduleModule() {
  const { toast } = useToast()
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)

  // Dept dialog
  const [deptDialogOpen, setDeptDialogOpen] = useState(false)
  const [deptDialogMode, setDeptDialogMode] = useState<'create' | 'edit'>('create')
  const [deptForm, setDeptForm] = useState({ id: '', name: '', code: '', parentId: '' })
  const [deptSubmitting, setDeptSubmitting] = useState(false)
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null)

  // Pos dialog
  const [posDialogOpen, setPosDialogOpen] = useState(false)
  const [posDialogMode, setPosDialogMode] = useState<'create' | 'edit'>('create')
  const [posForm, setPosForm] = useState({ id: '', title: '', code: '', departmentId: '', grade: '', domain: '', headcount: 1, functions: '' })
  const [posSubmitting, setPosSubmitting] = useState(false)
  const [posDeleteOpen, setPosDeleteOpen] = useState(false)
  const [posToDelete, setPosToDelete] = useState<Position | null>(null)

  // Bulk
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch('/api/departments'); if (res.ok) setDepartments(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchPositions = useCallback(async () => {
    try { const res = await fetch('/api/positions'); if (res.ok) setPositions(await res.json()) } catch { /* silent */ }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await Promise.all([fetchDepartments(), fetchPositions()]); setLoading(false) })() }, [fetchDepartments, fetchPositions])

  const rootDepts = departments.filter(d => !d.parentId)
  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id) } else { n.add(id) }; return n })
  const getChildren = (id: string) => departments.filter(d => d.parentId === id)
  const getPosCount = (id: string) => departments.find(d => d.id === id)?._count?.positions ?? 0

  const filteredPositions = positions.filter(p => {
    if (selectedDeptId && p.departmentId !== selectedDeptId) return false
    if (searchQuery) { const q = searchQuery.toLowerCase(); return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.department?.name?.toLowerCase().includes(q) }
    return true
  })

  // Dept handlers
  const openCreateDept = (parentId?: string) => { setDeptDialogMode('create'); setDeptForm({ id: '', name: '', code: '', parentId: parentId || '' }); setDeptDialogOpen(true) }
  const openEditDept = (d: Department) => { setDeptDialogMode('edit'); setDeptForm({ id: d.id, name: d.name, code: d.code, parentId: d.parentId || '' }); setDeptDialogOpen(true) }

  const handleDeptSubmit = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim()) { toast({ title: 'Ошибка', description: 'Название и код обязательны', variant: 'destructive' }); return }
    setDeptSubmitting(true)
    try {
      const body: Record<string, string> = { name: deptForm.name.trim(), code: deptForm.code.trim() }
      if (deptForm.parentId) body.parentId = deptForm.parentId
      if (deptDialogMode === 'edit') body.id = deptForm.id
      const res = await fetch('/api/departments', { method: deptDialogMode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: deptDialogMode === 'create' ? 'Создано' : 'Обновлено', description: deptForm.name })
      setDeptDialogOpen(false); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setDeptSubmitting(false) }
  }

  const handleDeptDelete = async () => {
    if (!deptToDelete) return
    try {
      const res = await fetch('/api/departments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deptToDelete.id }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: 'Удалено', description: deptToDelete.name })
      if (selectedDeptId === deptToDelete.id) setSelectedDeptId(null)
      setDeptDeleteOpen(false); setDeptToDelete(null); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
  }

  // Position handlers
  const openCreatePos = (departmentId?: string) => { setPosDialogMode('create'); setPosForm({ id: '', title: '', code: '', departmentId: departmentId || selectedDeptId || '', grade: '', domain: '', headcount: 1, functions: '' }); setPosDialogOpen(true) }
  const openEditPos = (p: Position) => { setPosDialogMode('edit'); setPosForm({ id: p.id, title: p.title, code: p.code, departmentId: p.departmentId, grade: p.grade || '', domain: p.domain || '', headcount: p.headcount, functions: p.functions || '' }); setPosDialogOpen(true) }

  const handlePosSubmit = async () => {
    if (!posForm.title.trim() || !posForm.code.trim() || !posForm.departmentId) { toast({ title: 'Ошибка', description: 'Название, код и подразделение обязательны', variant: 'destructive' }); return }
    setPosSubmitting(true)
    try {
      const body: Record<string, unknown> = { title: posForm.title.trim(), code: posForm.code.trim(), departmentId: posForm.departmentId, grade: posForm.grade || null, domain: posForm.domain || null, headcount: posForm.headcount || 1, functions: posForm.functions || null }
      if (posDialogMode === 'edit') body.id = posForm.id
      const res = await fetch('/api/positions', { method: posDialogMode === 'create' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: posDialogMode === 'create' ? 'Создано' : 'Обновлено', description: posForm.title })
      setPosDialogOpen(false); await fetchPositions(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setPosSubmitting(false) }
  }

  const handlePosDelete = async () => {
    if (!posToDelete) return
    try {
      const res = await fetch('/api/positions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: posToDelete.id }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: 'Удалено', description: posToDelete.title })
      setPosDeleteOpen(false); setPosToDelete(null); await fetchPositions(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
  }

  const handleBulkUpload = async () => {
    if (!bulkText.trim()) { toast({ title: 'Ошибка', description: 'Введите данные', variant: 'destructive' }); return }
    setBulkSubmitting(true)
    try {
      const lines = bulkText.trim().split('\n').filter(l => l.trim()); let created = 0; let errors = 0
      for (const line of lines) {
        const [code, title, deptCode, grade, domain, headcountStr, functions] = line.split(';').map(s => s.trim())
        if (!code || !title || !deptCode) { errors++; continue }
        const dept = departments.find(d => d.code === deptCode)
        if (!dept || positions.find(p => p.code === code)) { errors++; continue }
        try {
          const res = await fetch('/api/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, title, departmentId: dept.id, grade: grade || null, domain: domain || null, headcount: headcountStr ? parseInt(headcountStr, 10) || 1 : 1, functions: functions || null }) })
          if (res.ok) { created++ } else { errors++ }
        } catch { errors++ }
      }
      toast({ title: 'Загрузка завершена', description: `Создано: ${created}, Ошибок: ${errors}` })
      setBulkDialogOpen(false); setBulkText(''); await fetchPositions(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: 'Ошибка загрузки', variant: 'destructive' }) }
    finally { setBulkSubmitting(false) }
  }

  const renderDept = (dept: Department, depth = 0) => {
    const children = getChildren(dept.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dept.id)
    const isSelected = selectedDeptId === dept.id
    return (
      <div key={dept.id}>
        <div className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'}`} style={{ paddingLeft: `${depth * 20 + 8}px` }} onClick={() => setSelectedDeptId(isSelected ? null : dept.id)}>
          <button className="h-5 w-5 flex items-center justify-center flex-shrink-0" onClick={e => { e.stopPropagation(); toggleExpand(dept.id) }}>
            {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-3.5 w-3.5" />}
          </button>
          <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="text-sm truncate flex-1">{dept.name}</span>
          {getPosCount(dept.id) > 0 && <Badge variant="secondary" className="text-xs h-5 px-1.5">{getPosCount(dept.id)}</Badge>}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 hover:!opacity-100" style={{ opacity: undefined }}>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openCreateDept(dept.id) }} title="Добавить дочернее"><Plus className="h-3 w-3" /></button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openEditDept(dept) }}><Pencil className="h-3 w-3" /></button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); setDeptToDelete(dept); setDeptDeleteOpen(true) }}><Trash2 className="h-3 w-3" /></button>
          </div>
        </div>
        {hasChildren && isExpanded && children.map(c => renderDept(c, depth + 1))}
      </div>
    )
  }

  if (loading) return <p className="text-center py-8 text-muted-foreground">Загрузка...</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Штатное расписание</h1><p className="text-sm text-muted-foreground">Подразделения и должности</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}><Upload className="h-4 w-4 mr-1" /> Загрузить</Button>
          <Button onClick={() => openCreateDept()}><Plus className="h-4 w-4 mr-1" /> Подразделение</Button>
          <Button onClick={() => openCreatePos()}><Plus className="h-4 w-4 mr-1" /> Должность</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Department tree */}
        <Card className="lg:col-span-1"><CardHeader className="pb-2"><CardTitle className="text-base">Подразделения</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">{rootDepts.map(d => renderDept(d))}</CardContent>
        </Card>

        {/* Positions table */}
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">Должности {selectedDeptId && <Badge variant="outline" className="ml-2">{departments.find(d => d.id === selectedDeptId)?.name}</Badge>}</CardTitle></div></CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-2"><Input placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
            <Table><TableHeader><TableRow><TableHead>Код</TableHead><TableHead>Название</TableHead><TableHead>Подразделение</TableHead><TableHead>Грейд</TableHead><TableHead>Штат</TableHead><TableHead className="text-right">Действия</TableHead></TableRow></TableHeader>
              <TableBody>{filteredPositions.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-mono">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-sm">{p.department?.name}</TableCell>
                  <TableCell className="text-sm">{p.grade || '—'}</TableCell>
                  <TableCell className="text-sm">{p.headcount}</TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPos(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setPosToDelete(p); setPosDeleteOpen(true) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dept Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{deptDialogMode === 'create' ? 'Новое подразделение' : 'Редактировать'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Код *</Label><Input value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} /></div>
            <div><Label>Родительское подразделение</Label><Select value={deptForm.parentId || '_none'} onValueChange={v => setDeptForm(p => ({ ...p, parentId: v === '_none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger><SelectContent><SelectItem value="_none">Нет (корень)</SelectItem>{departments.filter(d => d.id !== deptForm.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Отмена</Button><Button onClick={handleDeptSubmit} disabled={deptSubmitting}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{posDialogMode === 'create' ? 'Новая должность' : 'Редактировать'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Название *</Label><Input value={posForm.title} onChange={e => setPosForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label>Код *</Label><Input value={posForm.code} onChange={e => setPosForm(p => ({ ...p, code: e.target.value }))} /></div>
            </div>
            <div><Label>Подразделение *</Label><Select value={posForm.departmentId} onValueChange={v => setPosForm(p => ({ ...p, departmentId: v }))}><SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Грейд</Label><Input value={posForm.grade} onChange={e => setPosForm(p => ({ ...p, grade: e.target.value }))} /></div>
              <div><Label>Домен</Label><Input value={posForm.domain} onChange={e => setPosForm(p => ({ ...p, domain: e.target.value }))} /></div>
              <div><Label>Штатных единиц</Label><Input type="number" min={1} value={posForm.headcount} onChange={e => setPosForm(p => ({ ...p, headcount: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Функции</Label><Textarea value={posForm.functions} onChange={e => setPosForm(p => ({ ...p, functions: e.target.value }))} className="min-h-[60px]" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPosDialogOpen(false)}>Отмена</Button><Button onClick={handlePosSubmit} disabled={posSubmitting}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Массовая загрузка должностей</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Формат: Код;Название;Код_подразделения;Грейд;Домен;Штат;Функции</p>
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="DEV001;Разработчик;IT;G3;IT;5;Разработка ПО" className="min-h-[150px] font-mono text-sm" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Отмена</Button><Button onClick={handleBulkUpload} disabled={bulkSubmitting}>Загрузить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dept Dialog */}
      <AlertDialog open={deptDeleteOpen} onOpenChange={setDeptDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить подразделение?</AlertDialogTitle></AlertDialogHeader><p className="text-sm text-muted-foreground">{deptToDelete?.name}</p><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDeptDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {/* Delete Position Dialog */}
      <AlertDialog open={posDeleteOpen} onOpenChange={setPosDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить должность?</AlertDialogTitle></AlertDialogHeader><p className="text-sm text-muted-foreground">{posToDelete?.title}</p><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handlePosDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
