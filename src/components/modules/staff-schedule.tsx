'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Building2, Users, Search, Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

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

  // Bulk text
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // File upload
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    summary?: { departmentsFound: number; departmentsCreated: number; departmentsExisting: number; positionsFound: number; positionsCreated: number; positionsSkipped: number }
    errors?: string[]
  } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (searchQuery) { const q = searchQuery.toLowerCase(); return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.department?.name?.toLowerCase().includes(q) || (p.grade || '').toLowerCase().includes(q) || (p.domain || '').toLowerCase().includes(q) }
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
    } catch { toast({ title: 'Ошибка', description: 'Ошибка загрузки', variant: 'destructive' }) }
    finally { setBulkSubmitting(false) }
  }

  // File upload handler
  const handleFileUpload = async () => {
    if (!selectedFile) { toast({ title: 'Ошибка', description: 'Выберите файл', variant: 'destructive' }); return }
    setUploading(true); setUploadProgress(10); setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      setUploadProgress(30)
      
      const res = await fetch('/api/upload/staff-schedule', { method: 'POST', body: formData })
      setUploadProgress(80)
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка загрузки')
      }
      
      const data = await res.json()
      setUploadProgress(100)
      setUploadResult(data)
      
      if (data.success) {
        toast({ 
          title: 'Файл обработан', 
          description: `Подразделений: ${data.summary.departmentsCreated} создано, Должностей: ${data.summary.positionsCreated} создано` 
        })
        await fetchPositions(); await fetchDepartments()
      }
    } catch (e) {
      toast({ title: 'Ошибка загрузки файла', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const openUploadDialog = () => {
    setSelectedFile(null); setUploadResult(null); setUploadProgress(0); setUploadDialogOpen(true)
  }

  const renderDept = (dept: Department, depth = 0) => {
    const children = getChildren(dept.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dept.id)
    const isSelected = selectedDeptId === dept.id
    return (
      <div key={dept.id}>
        <div className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/60'}`} style={{ paddingLeft: `${depth * 20 + 8}px` }} onClick={() => setSelectedDeptId(isSelected ? null : dept.id)}>
          <button className="h-5 w-5 flex items-center justify-center flex-shrink-0 rounded hover:bg-muted" onClick={e => { e.stopPropagation(); toggleExpand(dept.id) }}>
            {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-3.5 w-3.5" />}
          </button>
          <Building2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
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

  // Stats
  const totalHeadcount = positions.reduce((sum, p) => sum + p.headcount, 0)
  const uniqueDomains = [...new Set(positions.map(p => p.domain).filter(Boolean))]
  const uniqueGrades = [...new Set(positions.map(p => p.grade).filter(Boolean))]

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" /> 
            Штатное расписание
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Подразделения и должности организации</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openUploadDialog}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Загрузить файл
          </Button>
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Вставить текст
          </Button>
          <Button onClick={() => openCreateDept()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-1.5" /> Подразделение
          </Button>
          <Button variant="outline" onClick={() => openCreatePos()}>
            <Plus className="h-4 w-4 mr-1.5" /> Должность
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50">
          <CardContent className="p-3">
            <p className="text-xs text-emerald-700 font-medium">Подразделения</p>
            <p className="text-2xl font-bold text-emerald-800">{departments.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100/50 border-teal-200/50">
          <CardContent className="p-3">
            <p className="text-xs text-teal-700 font-medium">Должности</p>
            <p className="text-2xl font-bold text-teal-800">{positions.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200/50">
          <CardContent className="p-3">
            <p className="text-xs text-cyan-700 font-medium">Штатных единиц</p>
            <p className="text-2xl font-bold text-cyan-800">{totalHeadcount}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-sky-100/50 border-sky-200/50">
          <CardContent className="p-3">
            <p className="text-xs text-sky-700 font-medium">Доменов</p>
            <p className="text-2xl font-bold text-sky-800">{uniqueDomains.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Department tree */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" /> Подразделения
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {rootDepts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Нет подразделений</p>
                <Button size="sm" className="mt-2" onClick={() => openCreateDept()}>Создать</Button>
              </div>
            ) : rootDepts.map(d => renderDept(d))}
          </CardContent>
        </Card>

        {/* Positions table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" /> Должности
                {selectedDeptId && <Badge variant="outline" className="ml-1 text-emerald-700 border-emerald-300">{departments.find(d => d.id === selectedDeptId)?.name}</Badge>}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск по названию, коду, грейду..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
            </div>
            {filteredPositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Нет должностей</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Код</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead className="hidden md:table-cell">Подразделение</TableHead>
                    <TableHead className="w-20 hidden sm:table-cell">Грейд</TableHead>
                    <TableHead className="w-20 hidden sm:table-cell">Домен</TableHead>
                    <TableHead className="w-16">Штат</TableHead>
                    <TableHead className="w-20 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map(p => (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs font-mono text-muted-foreground">{p.code}</TableCell>
                      <TableCell className="font-medium text-sm">{p.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{p.department?.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.grade ? <Badge variant="secondary" className="text-xs">{p.grade}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="hidden sm:table-cell">{p.domain ? <Badge variant="outline" className="text-xs">{p.domain}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{p.headcount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPos(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setPosToDelete(p); setPosDeleteOpen(true) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dept Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deptDialogMode === 'create' ? 'Новое подразделение' : 'Редактировать подразделение'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="Например: Отдел продаж" /></div>
            <div><Label>Код *</Label><Input value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} placeholder="Например: SALES" /></div>
            <div>
              <Label>Родительское подразделение</Label>
              <Select value={deptForm.parentId || '_none'} onValueChange={v => setDeptForm(p => ({ ...p, parentId: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Нет (корень)</SelectItem>
                  {departments.filter(d => d.id !== deptForm.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleDeptSubmit} disabled={deptSubmitting}>{deptSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{posDialogMode === 'create' ? 'Новая должность' : 'Редактировать должность'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Название *</Label><Input value={posForm.title} onChange={e => setPosForm(p => ({ ...p, title: e.target.value }))} placeholder="Руководитель отдела продаж" /></div>
              <div><Label>Код *</Label><Input value={posForm.code} onChange={e => setPosForm(p => ({ ...p, code: e.target.value }))} placeholder="ROP-001" /></div>
            </div>
            <div>
              <Label>Подразделение *</Label>
              <Select value={posForm.departmentId} onValueChange={v => setPosForm(p => ({ ...p, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Грейд</Label><Input value={posForm.grade} onChange={e => setPosForm(p => ({ ...p, grade: e.target.value }))} placeholder="G3" /></div>
              <div><Label>Домен</Label><Input value={posForm.domain} onChange={e => setPosForm(p => ({ ...p, domain: e.target.value }))} placeholder="Продажи" /></div>
              <div><Label>Штатных единиц</Label><Input type="number" min={1} value={posForm.headcount} onChange={e => setPosForm(p => ({ ...p, headcount: parseInt(e.target.value) || 1 }))} /></div>
            </div>
            <div><Label>Функции</Label><Textarea value={posForm.functions} onChange={e => setPosForm(p => ({ ...p, functions: e.target.value }))} className="min-h-[60px]" placeholder="Управление отделом, планирование..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosDialogOpen(false)}>Отмена</Button>
            <Button onClick={handlePosSubmit} disabled={posSubmitting}>{posSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Text Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Массовая загрузка должностей</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Формат: Код;Название;Код_подразделения;Грейд;Домен;Штат;Функции</p>
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="DEV001;Разработчик;IT;G3;IT;5;Разработка ПО" className="min-h-[150px] font-mono text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkUpload} disabled={bulkSubmitting}>{bulkSubmitting ? 'Загрузка...' : 'Загрузить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Загрузка штатного расписания
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Supported formats */}
            <div className="flex flex-wrap gap-1.5">
              {['DOCX', 'XLSX', 'CSV', 'PDF', 'TXT'].map(fmt => (
                <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
              ))}
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-muted/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.doc,.xlsx,.xls,.csv,.pdf,.txt,.md" onChange={handleFileSelect} />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-emerald-600" />
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} КБ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">Перетащите файл сюда</p>
                  <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
                </div>
              )}
            </div>

            {/* Upload progress */}
            {uploading && <Progress value={uploadProgress} className="h-2" />}

            {/* Upload result */}
            {uploadResult && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {uploadResult.success && uploadResult.summary && (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Файл обработан успешно
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Подразделений: {uploadResult.summary.departmentsCreated} создано / {uploadResult.summary.departmentsExisting} найдено</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-teal-600" />
                        <span>Должностей: {uploadResult.summary.positionsCreated} создано / {uploadResult.summary.positionsSkipped} пропущено</span>
                      </div>
                    </div>
                  </>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Закрыть</Button>
            <Button onClick={handleFileUpload} disabled={uploading || !selectedFile} className="bg-emerald-600 hover:bg-emerald-700">
              {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Обработка...</> : <><Upload className="h-4 w-4 mr-1.5" /> Загрузить</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dept Dialog */}
      <AlertDialog open={deptDeleteOpen} onOpenChange={setDeptDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить подразделение?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{deptToDelete?.name}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDeptDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Position Dialog */}
      <AlertDialog open={posDeleteOpen} onOpenChange={setPosDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить должность?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{posToDelete?.title}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handlePosDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
