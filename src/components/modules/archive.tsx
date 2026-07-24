'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Archive, Plus, Eye, Pencil, Trash2, Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle, FileUp } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position {
  id: string; title: string; code: string; departmentId: string; department: Department
  grade: string | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  projectId: string | null; project: { id: string; name: string } | null
}
interface ArchiveDI { id: string; title: string; content: string; positionId: string; fileName: string | null; uploadedAt: string; createdAt: string; updatedAt: string; position: Position }

const gradeLabel = (grade: string | null): string | null => {
  if (!grade) return null
  if (grade === 'линейная') return 'Линейная позиция'
  if (grade === 'руководитель') return 'Руководитель'
  return grade
}

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
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Manual upload form
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

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePositionId, setFilePositionId] = useState('')
  const [useAiParsing, setUseAiParsing] = useState(true)
  const [fileUploading, setFileUploading] = useState(false)
  const [fileUploadProgress, setFileUploadProgress] = useState(0)
  const [fileUploadResult, setFileUploadResult] = useState<{
    summary: { total: number; success: number; failed: number }
    results: Array<{ fileName: string; success: boolean; title?: string; positionTitle?: string; error?: string }>
  } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // File upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) { toast({ title: 'Ошибка', description: 'Выберите файлы', variant: 'destructive' }); return }
    setFileUploading(true); setFileUploadProgress(10); setFileUploadResult(null)
    try {
      const formData = new FormData()
      selectedFiles.forEach(file => formData.append('files', file))
      if (filePositionId) formData.append('positionId', filePositionId)
      formData.append('useAiParsing', String(useAiParsing))
      
      setFileUploadProgress(30)
      const res = await fetch('/api/upload/archive-di', { method: 'POST', body: formData })
      setFileUploadProgress(80)
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка загрузки')
      }
      
      const data = await res.json()
      setFileUploadProgress(100)
      setFileUploadResult(data)
      
      toast({
        title: 'Загрузка завершена',
        description: `Успешно: ${data.summary.success}, Ошибки: ${data.summary.failed}`,
      })
      fetchArchive()
    } catch (e) {
      toast({ title: 'Ошибка загрузки файлов', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally {
      setFileUploading(false)
    }
  }

  const openFileUploadDialog = () => {
    setSelectedFiles([]); setFileUploadResult(null); setFileUploadProgress(0); setFilePositionId(''); setFileUploadDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6 text-amber-600" /> Архив ДИ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Управление архивом должностных инструкций</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openFileUploadDialog}>
            <FileUp className="h-4 w-4 mr-1.5" /> Загрузить файлы
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-1.5" /> Добавить вручную
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Input placeholder="Поиск по тексту..." value={searchText} onChange={e => setSearchText(e.target.value)} />
            </div>
            <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Подразделение" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Все</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterPositionId} onValueChange={setFilterPositionId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Должность" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Все</SelectItem>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredDIs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Нет архивных ДИ</p>
            <div className="flex gap-2 justify-center mt-3">
              <Button variant="outline" onClick={openFileUploadDialog}><FileUp className="h-4 w-4 mr-1.5" /> Загрузить файлы</Button>
              <Button onClick={() => setUploadDialogOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Добавить вручную</Button>
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
                  <TableHead className="hidden md:table-cell">Подразделение</TableHead>
                  <TableHead className="hidden sm:table-cell">Файл</TableHead>
                  <TableHead className="hidden sm:table-cell">Дата</TableHead>
                  <TableHead className="w-24 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDIs.map(di => (
                  <TableRow key={di.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-sm">{di.title}</TableCell>
                    <TableCell className="text-sm">{di.position?.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{di.position?.department?.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {di.fileName ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <FileText className="h-3 w-3" /> {di.fileName.length > 20 ? di.fileName.substring(0, 17) + '...' : di.fileName}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{new Date(di.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleView(di)}><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(di)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog(di)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Manual Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Добавить архивную ДИ вручную</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="ДИ — Руководитель отдела продаж" /></div>
            <div>
              <Label>Должность *</Label>
              <Select value={uploadPositionId} onValueChange={setUploadPositionId}>
                <SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger>
                <SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.department?.name})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Содержимое *</Label><Textarea value={uploadContent} onChange={e => setUploadContent(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="Вставьте текст должностной инструкции..." /></div>
            <div><Label>Имя файла</Label><Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} placeholder="di_sales_head.docx" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUpload} disabled={uploading}>{uploading ? 'Сохранение...' : 'Добавить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={fileUploadDialogOpen} onOpenChange={setFileUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-amber-600" />
              Загрузка архивных ДИ из файлов
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Supported formats */}
            <div className="flex flex-wrap gap-1.5">
              {['DOCX', 'PDF', 'XLSX', 'CSV', 'TXT', 'MD'].map(fmt => (
                <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
              ))}
            </div>

            {/* Position selector (optional) */}
            <div className="space-y-2">
              <Label>Привязать к должности (необязательно)</Label>
              <Select value={filePositionId} onValueChange={setFilePositionId}>
                <SelectTrigger><SelectValue placeholder="Авто-определение ИИ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_auto">Авто-определение ИИ</SelectItem>
                  {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.department?.name})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={useAiParsing} onCheckedChange={setUseAiParsing} id="ai-parsing" />
                <Label htmlFor="ai-parsing" className="text-sm text-muted-foreground">ИИ-определение должности из содержимого</Label>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-amber-500 bg-amber-50/50' : 'border-muted-foreground/25 hover:border-amber-400 hover:bg-muted/30'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.doc,.xlsx,.xls,.csv,.pdf,.txt,.md" multiple onChange={handleFileSelect} />
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-medium">Перетащите файлы сюда</p>
                <p className="text-xs text-muted-foreground">или нажмите для выбора (можно несколько файлов)</p>
              </div>
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Выбранные файлы ({selectedFiles.length}):</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 bg-muted/40 rounded text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">({(file.size / 1024).toFixed(0)} КБ)</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => removeFile(i)}>
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload progress */}
            {fileUploading && <Progress value={fileUploadProgress} className="h-2" />}

            {/* Upload result */}
            {fileUploadResult && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Обработка завершена: {fileUploadResult.summary.success} успешно, {fileUploadResult.summary.failed} ошибок
                </div>
                <div className="space-y-1">
                  {fileUploadResult.results.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      {r.success ? (
                        <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />
                      )}
                      <span className={r.success ? '' : 'text-destructive'}>
                        {r.fileName} {r.success ? `→ ${r.positionTitle || 'привязана'}` : `: ${r.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFileUploadDialogOpen(false)}>Закрыть</Button>
            <Button onClick={handleFileUpload} disabled={fileUploading || selectedFiles.length === 0} className="bg-amber-600 hover:bg-amber-700">
              {fileUploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Обработка...</> : <><Upload className="h-4 w-4 mr-1.5" /> Загрузить ({selectedFiles.length})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Редактировать ДИ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div>
              <Label>Должность *</Label>
              <Select value={editPositionId} onValueChange={setEditPositionId}>
                <SelectTrigger /><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Содержимое *</Label><Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[200px] font-mono text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleEdit} disabled={editing}>{editing ? 'Сохранение...' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDI?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" /> {viewDI?.position?.title}</Badge>
              <Badge variant="outline">{viewDI?.position?.department?.name}</Badge>
              {viewDI?.position?.businessFunction && <Badge variant="outline">{viewDI.position.businessFunction.name}</Badge>}
              {viewDI?.position?.project && <Badge variant="outline">{viewDI.position.project.name}</Badge>}
              {gradeLabel(viewDI?.position?.grade ?? null) && <Badge variant="secondary">{gradeLabel(viewDI?.position?.grade ?? null)}</Badge>}
              {viewDI?.fileName && <Badge variant="secondary" className="text-xs">{viewDI.fileName}</Badge>}
            </div>
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg max-h-[500px] overflow-y-auto border">{viewDI?.content}</pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить ДИ?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{deleteTitle}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
