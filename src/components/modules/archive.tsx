'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { Archive, Plus, Eye, Pencil, Trash2, Upload } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department; grade: string | null; domain: string | null }
interface ArchiveDI { id: string; title: string; content: string; positionId: string; fileName: string | null; uploadedAt: string; createdAt: string; updatedAt: string; position: Position }

export function ArchiveModule() {
  const { toast } = useToast()
  const [archiveDIs, setArchiveDIs] = useState<ArchiveDI[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [filterPositionId, setFilterPositionId] = useState<string>('all')
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all')

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const [uploadPositionId, setUploadPositionId] = useState('')
  const [uploadFileName, setUploadFileName] = useState('')

  // Edit form
  const [editId, setEditId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editPositionId, setEditPositionId] = useState('')

  // View/delete
  const [viewDI, setViewDI] = useState<ArchiveDI | null>(null)
  const [deleteId, setDeleteId] = useState('')
  const [deleteTitle, setDeleteTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)

  const fetchArchive = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterPositionId && filterPositionId !== 'all') params.set('positionId', filterPositionId)
      if (searchText) params.set('search', searchText)
      const res = await fetch(`/api/archive-di?${params.toString()}`)
      if (res.ok) setArchiveDIs(await res.json())
    } catch { /* silent */ }
  }, [filterPositionId, searchText])

  const fetchPositions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterDepartmentId && filterDepartmentId !== 'all') params.set('departmentId', filterDepartmentId)
      const res = await fetch(`/api/positions?${params.toString()}`)
      if (res.ok) setPositions(await res.json())
    } catch { /* silent */ }
  }, [filterDepartmentId])

  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch('/api/departments'); if (res.ok) setDepartments(await res.json()) } catch { /* silent */ }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await Promise.all([fetchDepartments(), fetchPositions()]); setLoading(false) })() }, [fetchDepartments, fetchPositions])
  useEffect(() => { fetchArchive() }, [fetchArchive])
  useEffect(() => { fetchPositions() }, [fetchPositions])

  const filteredDIs = archiveDIs.filter(di => !filterDepartmentId || filterDepartmentId === 'all' || di.position.departmentId === filterDepartmentId)

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim() || !uploadPositionId) { toast({ title: 'Ошибка', description: 'Заполните обязательные поля', variant: 'destructive' }); return }
    setUploading(true)
    try {
      const res = await fetch('/api/archive-di', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: uploadTitle.trim(), content: uploadContent.trim(), positionId: uploadPositionId, fileName: uploadFileName.trim() || null }) })
      if (res.ok) { toast({ title: 'Успешно', description: 'ДИ добавлена' }); setUploadDialogOpen(false); resetUpload(); fetchArchive() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  const handleEdit = async () => {
    if (!editTitle.trim() || !editContent.trim() || !editPositionId) { toast({ title: 'Ошибка', description: 'Заполните обязательные поля', variant: 'destructive' }); return }
    setEditing(true)
    try {
      const res = await fetch('/api/archive-di', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, title: editTitle.trim(), content: editContent.trim(), positionId: editPositionId }) })
      if (res.ok) { toast({ title: 'Успешно', description: 'ДИ обновлена' }); setEditDialogOpen(false); fetchArchive() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
    finally { setEditing(false) }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch('/api/archive-di', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteId }) })
      if (res.ok) { toast({ title: 'Успешно', description: 'ДИ удалена' }); setDeleteDialogOpen(false); fetchArchive() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
  }

  const handleView = async (di: ArchiveDI) => {
    try { const res = await fetch(`/api/archive-di/${di.id}`); if (res.ok) { setViewDI(await res.json()); setViewDialogOpen(true) } else { setViewDI(di); setViewDialogOpen(true) } } catch { setViewDI(di); setViewDialogOpen(true) }
  }

  const openEditDialog = (di: ArchiveDI) => { setEditId(di.id); setEditTitle(di.title); setEditContent(di.content); setEditPositionId(di.positionId); setEditDialogOpen(true) }
  const openDeleteDialog = (di: ArchiveDI) => { setDeleteId(di.id); setDeleteTitle(di.title); setDeleteDialogOpen(true) }
  const resetUpload = () => { setUploadTitle(''); setUploadContent(''); setUploadPositionId(''); setUploadFileName('') }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Archive className="h-6 w-6 text-amber-600" /> Архив ДИ</h1><p className="text-sm text-muted-foreground">Управление архивом должностных инструкций</p></div>
        <Button onClick={() => setUploadDialogOpen(true)}><Upload className="h-4 w-4 mr-1" /> Добавить ДИ</Button>
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Поиск..." value={searchText} onChange={e => setSearchText(e.target.value)} className="max-w-xs" />
          <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Подразделение" /></SelectTrigger><SelectContent><SelectItem value="all">Все</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
          <Select value={filterPositionId} onValueChange={setFilterPositionId}><SelectTrigger className="w-[200px]"><SelectValue placeholder="Должность" /></SelectTrigger><SelectContent><SelectItem value="all">Все</SelectItem>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>
        </div>
      </CardContent></Card>

      {/* Table */}
      {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : filteredDIs.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Archive className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Нет архивных ДИ</p><Button className="mt-2" onClick={() => setUploadDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Добавить</Button></CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Должность</TableHead><TableHead>Подразделение</TableHead><TableHead>Файл</TableHead><TableHead>Дата</TableHead><TableHead className="text-right">Действия</TableHead></TableRow></TableHeader>
          <TableBody>{filteredDIs.map(di => (
            <TableRow key={di.id}>
              <TableCell className="font-medium">{di.title}</TableCell>
              <TableCell className="text-sm">{di.position?.title}</TableCell>
              <TableCell className="text-sm">{di.position?.department?.name}</TableCell>
              <TableCell className="text-sm">{di.fileName || '—'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{new Date(di.createdAt).toLocaleDateString('ru-RU')}</TableCell>
              <TableCell><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleView(di)}><Eye className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(di)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog(di)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div></TableCell>
            </TableRow>
          ))}</TableBody></Table>
        </CardContent></Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Добавить архивную ДИ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} /></div>
            <div><Label>Должность *</Label><Select value={uploadPositionId} onValueChange={setUploadPositionId}><SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Содержимое *</Label><Textarea value={uploadContent} onChange={e => setUploadContent(e.target.value)} className="min-h-[200px] font-mono text-sm" /></div>
            <div><Label>Имя файла</Label><Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Отмена</Button><Button onClick={handleUpload} disabled={uploading}>{uploading ? 'Сохранение...' : 'Добавить'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Редактировать ДИ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div><Label>Должность *</Label><Select value={editPositionId} onValueChange={setEditPositionId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Содержимое *</Label><Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[200px] font-mono text-sm" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button><Button onClick={handleEdit} disabled={editing}>{editing ? 'Сохранение...' : 'Сохранить'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewDI?.title}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2"><Badge variant="outline">{viewDI?.position?.title}</Badge><Badge variant="outline">{viewDI?.position?.department?.name}</Badge></div>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">{viewDI?.content}</pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить ДИ?</AlertDialogTitle></AlertDialogHeader><p className="text-sm text-muted-foreground">{deleteTitle}</p><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
