'use client'

// Модуль «Архив ДИ» — работа с архивными должностными инструкциями.
// Архивные ДИ можно загружать без привязки к должности и привязывать позже.
// См. ТЗ раздел 18 (AGENT_LOG.md).

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import {
 Archive, Plus, Eye, Pencil, Trash2, Upload, FileText, Loader2, CheckCircle2,
  XCircle, Link2, Unlink, Search, Building2, FolderTree, FileUp, Briefcase, Sparkles,
} from 'lucide-react'
import { CascadePositionSelector } from './cascade-position-selector'
import { useAppStore } from '@/lib/store'

interface Company { id: string; name: string; shortName: string | null }
interface Department { id: string; name: string; code: string; company?: Company | null }
interface Position {
  id: string; title: string; code: string; departmentId: string; department: Department
  grade: string | null
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null
  projectId: string | null; project: { id: string; name: string } | null
}
interface ArchiveDI {
  id: string; title: string; content: string
  positionId: string | null
  position: Position | null
  fileName: string | null; uploadedAt: string; createdAt: string; updatedAt: string
  // Фаза 23: кол-во сгенерированных ДИ, созданных на базе этой архивной ДИ.
  derivedCount?: number
}

const gradeLabel = (grade: string | null): string | null => {
  if (!grade) return null
  if (grade === 'линейная') return 'Линейная позиция'
  if (grade === 'руководитель') return 'Руководитель'
  return grade
}

// Описание должности для селектора: «Должность · Подразделение · Компания»
const positionLabel = (p: Position | null): string => {
  if (!p) return '—'
  const parts = [p.title]
  if (p.department?.name) parts.push(p.department.name)
  if (p.department?.company) parts.push(p.department.company.shortName || p.department.company.name)
  return parts.join(' · ')
}

export function ArchiveModule() {
  const { toast } = useToast()
  const navigateTo = useAppStore((s) => s.navigateTo)
  const [archiveDIs, setArchiveDIs] = useState<ArchiveDI[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [linkStatus, setLinkStatus] = useState<'unlinked' | 'linked' | 'all'>('unlinked')

  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [fileUploadDialogOpen, setFileUploadDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)

  // Manual upload form (positionId опционален)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const [uploadPositionId, setUploadPositionId] = useState('')
  const [uploadFileName, setUploadFileName] = useState('')

  // Edit form
  const [editId, setEditId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editPositionId, setEditPositionId] = useState<string | ''>('')

  // Link form (привязка непривязанной ДИ)
  const [linkDI, setLinkDI] = useState<ArchiveDI | null>(null)
  const [linkPositionId, setLinkPositionId] = useState<string>('')

  // View/delete
  const [viewDI, setViewDI] = useState<ArchiveDI | null>(null)
  const [deleteId, setDeleteId] = useState('')
  const [deleteTitle, setDeleteTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState(false)

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePositionId, setFilePositionId] = useState('')
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
      params.set('linkStatus', linkStatus)
      if (searchText) params.set('search', searchText)
      const res = await fetch(`/api/archive-di?${params.toString()}`)
      if (res.ok) setArchiveDIs((await res.json()).items)
    } catch { /* silent */ }
  }, [linkStatus, searchText])

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions')
      if (res.ok) setPositions(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await fetchPositions(); setLoading(false) })() }, [fetchPositions])
  useEffect(() => { fetchArchive() }, [fetchArchive])

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadContent.trim()) { toast({ title: 'Ошибка', description: 'Заполните название и содержание', variant: 'destructive' }); return }
    setUploading(true)
    try {
      const res = await fetch('/api/archive-di', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent.trim(),
          positionId: uploadPositionId || null, // опционально
          fileName: uploadFileName.trim() || null,
        }),
      })
      if (res.ok) {
        toast({ title: 'Успешно', description: uploadPositionId ? 'ДИ добавлена и привязана' : 'ДИ добавлена без привязки' })
        setUploadDialogOpen(false); resetUpload(); fetchArchive()
      } else {
        const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' })
      }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  const handleEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) { toast({ title: 'Ошибка', description: 'Заполните название и содержание', variant: 'destructive' }); return }
    setEditing(true)
    try {
      const res = await fetch('/api/archive-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId, title: editTitle.trim(), content: editContent.trim(),
          positionId: editPositionId || null, // может быть null (отвязка)
        }),
      })
      if (res.ok) { toast({ title: 'Успешно', description: 'ДИ обновлена' }); setEditDialogOpen(false); fetchArchive() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
    finally { setEditing(false) }
  }

  // Привязка непривязанной ДИ к должности
  const handleLink = async () => {
    if (!linkDI || !linkPositionId) { toast({ title: 'Ошибка', description: 'Выберите должность', variant: 'destructive' }); return }
    setLinking(true)
    try {
      const res = await fetch('/api/archive-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkDI.id, positionId: linkPositionId }),
      })
      if (res.ok) {
        toast({ title: 'Успешно', description: 'ДИ привязана к должности' })
        setLinkDialogOpen(false); setLinkDI(null); setLinkPositionId(''); fetchArchive()
      } else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
    finally { setLinking(false) }
  }

  // Отвязка ДИ от должности
  const handleUnlink = async (di: ArchiveDI) => {
    try {
      const res = await fetch('/api/archive-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: di.id, positionId: null }),
      })
      if (res.ok) { toast({ title: 'Успешно', description: 'ДИ отвязана от должности' }); fetchArchive() }
      else { const d = await res.json(); toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' }) }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' }) }
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

  const openEditDialog = (di: ArchiveDI) => {
    setEditId(di.id); setEditTitle(di.title); setEditContent(di.content)
    setEditPositionId(di.positionId || ''); setEditDialogOpen(true)
  }
  const openDeleteDialog = (di: ArchiveDI) => { setDeleteId(di.id); setDeleteTitle(di.title); setDeleteDialogOpen(true) }
  const openLinkDialog = (di: ArchiveDI) => { setLinkDI(di); setLinkPositionId(''); setLinkDialogOpen(true) }
  const resetUpload = () => { setUploadTitle(''); setUploadContent(''); setUploadPositionId(''); setUploadFileName('') }

  // File upload handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files) setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setSelectedFiles(prev => [...prev, ...Array.from(files)])
  }

  const removeFile = (index: number) => setSelectedFiles(prev => prev.filter((_, i) => i !== index))

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) { toast({ title: 'Ошибка', description: 'Выберите файлы', variant: 'destructive' }); return }
    // filePositionId опционален — можно загрузить без привязки
    setFileUploading(true); setFileUploadProgress(10); setFileUploadResult(null)
    try {
      const results: Array<{ fileName: string; success: boolean; title?: string; positionTitle?: string; error?: string }> = []
      let success = 0
      let failed = 0
      const total = selectedFiles.length

      for (let i = 0; i < total; i++) {
        const file = selectedFiles[i]
        const progressStep = Math.round(((i + 1) / total) * 100)
        setFileUploadProgress(Math.max(10, progressStep - 5))
        try {
          const formData = new FormData()
          formData.append('file', file)
          const parseRes = await fetch('/api/di-upload?mode=parse', { method: 'POST', body: formData })
          if (!parseRes.ok) {
            const err = await parseRes.json().catch(() => ({}))
            throw new Error(err.error || 'Ошибка извлечения текста')
          }
          const parsed = await parseRes.json()

          const saveRes = await fetch('/api/di-upload?mode=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: parsed.fileName,
              fileType: parsed.fileType,
              rawText: parsed.rawText,
              sections: parsed.sections,
              positionId: filePositionId || null, // опционально
            }),
          })
          if (!saveRes.ok) {
            const err = await saveRes.json().catch(() => ({}))
            throw new Error(err.error || 'Ошибка сохранения')
          }
          const saved = await saveRes.json()
          success++
          results.push({
            fileName: file.name,
            success: true,
            positionTitle: saved.positionTitle,
            title: `Секций: ${saved.sectionCount || 0}`,
          })
        } catch (e) {
          failed++
          results.push({ fileName: file.name, success: false, error: e instanceof Error ? e.message : 'Ошибка' })
        }
        setFileUploadProgress(Math.round(((i + 1) / total) * 100))
      }

      setFileUploadResult({ summary: { total, success, failed }, results })
      if (success > 0) { toast({ title: 'Успешно', description: `${success} из ${total} загружено` }); fetchArchive() }
    } catch { toast({ title: 'Ошибка', description: 'Ошибка загрузки', variant: 'destructive' }) }
    finally { setFileUploading(false); setFileUploadProgress(0) }
  }

  const unlinkedCount = archiveDIs.filter(d => !d.positionId).length

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Archive className="h-6 w-6 text-amber-600" /> Архив должностных инструкций
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Старые ДИ (PDF/DOCX/текст). Можно загружать без привязки и привязывать к должности позже.
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setFileUploadDialogOpen(true)}>
                <FileUp className="h-4 w-4 mr-1.5" /> Из файла
              </Button>
              <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Добавить
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск по названию, содержимому, имени файла…" value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-8" />
          </div>
          <Select value={linkStatus} onValueChange={(v) => setLinkStatus(v as typeof linkStatus)}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unlinked">📋 Непривязанные ({unlinkedCount})</SelectItem>
              <SelectItem value="linked">✅ Привязанные</SelectItem>
              <SelectItem value="all">🗂️ Все</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            {linkStatus === 'unlinked' ? 'Непривязанные ДИ' : linkStatus === 'linked' ? 'Привязанные ДИ' : 'Все архивные ДИ'}
            <Badge variant="secondary">{archiveDIs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
            </div>
          ) : archiveDIs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">{searchText ? 'Ничего не найдено' : 'Нет архивных ДИ'}</p>
              <p className="text-xs mb-3">{searchText ? 'Измените запрос или фильтр' : 'Загрузите старые ДИ из файла или вручную'}</p>
              {!searchText && (
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => setFileUploadDialogOpen(true)}><FileUp className="h-4 w-4 mr-1.5" /> Из файла</Button>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => setUploadDialogOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Добавить</Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Должность / Подразделение / Компания</TableHead>
                  <TableHead>Файл</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archiveDIs.map(di => (
                  <TableRow key={di.id}>
                   <TableCell className="font-medium">
                     <div className="flex items-center gap-2">
                       {!di.positionId && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">непривязана</Badge>}
                       {di.title}
                       {di.derivedCount && di.derivedCount > 0 && (
                         <Badge variant="outline" className="text-xs text-violet-700 border-violet-300 bg-violet-50">
                           база для {di.derivedCount} ДИ
                         </Badge>
                       )}
                     </div>
                   </TableCell>
                    <TableCell>
                      {di.position ? (
                        <div className="text-sm space-y-0.5">
                          <div className="flex items-center gap-1 font-medium"><Briefcase className="h-3 w-3 text-muted-foreground" />{di.position.title}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FolderTree className="h-3 w-3" />{di.position.department?.name}
                          </div>
                          {di.position.department?.company && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />{di.position.department.company.shortName || di.position.department.company.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">не привязана</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{di.fileName || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(di.uploadedAt).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {!di.positionId && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600" onClick={() => openLinkDialog(di)} title="Привязать к должности">
                            <Link2 className="h-4 w-4" />
                          </Button>
                        )}
                       {di.positionId && (
                         <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-600" onClick={() => handleUnlink(di)} title="Отвязать">
                           <Unlink className="h-4 w-4" />
                         </Button>
                       )}
                       {di.positionId && (
                         <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-violet-600" onClick={() => navigateTo('generation', { positionId: di.positionId!, archiveId: di.id })} title="Сгенерировать ДИ на базе">
                           <Sparkles className="h-4 w-4" />
                         </Button>
                       )}
                       <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleView(di)} title="Просмотр"><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEditDialog(di)} title="Редактировать"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => openDeleteDialog(di)} title="Удалить"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ====== Dialogs ====== */}

      {/* Manual upload Dialog (positionId опционален) */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Добавить архивную ДИ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="ДИ — Разработчик ИИ" /></div>
           <div>
             <Label>Должность <span className="text-muted-foreground font-normal">(необязательно — можно привязать позже)</span></Label>
              <CascadePositionSelector positionId={uploadPositionId} onPositionChange={setUploadPositionId} />
           </div>
            <div><Label>Имя файла <span className="text-muted-foreground font-normal">(необязательно)</span></Label><Input value={uploadFileName} onChange={e => setUploadFileName(e.target.value)} placeholder="di-razrabotchik.pdf" /></div>
            <div><Label>Содержимое *</Label><Textarea value={uploadContent} onChange={e => setUploadContent(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder="Полный текст должностной инструкции…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleUpload} disabled={uploading} className="bg-amber-600 hover:bg-amber-700">
              {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Сохранение…</> : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog — привязка непривязанной ДИ к должности */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-emerald-600" /> Привязать ДИ к должности</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">Должностная инструкция</p>
              <p className="text-sm font-medium truncate">{linkDI?.title}</p>
            </div>
           <div>
             <Label>Выберите должность *</Label>
              <p className="text-xs text-muted-foreground mb-2">Видно: должность · подразделение · компания</p>
              <CascadePositionSelector positionId={linkPositionId} onPositionChange={setLinkPositionId} />
           </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleLink} disabled={linking || !linkPositionId} className="bg-emerald-600 hover:bg-emerald-700">
              {linking ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Привязка…</> : <><Link2 className="h-4 w-4 mr-1.5" /> Привязать</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File upload Dialog */}
      <Dialog open={fileUploadDialogOpen} onOpenChange={setFileUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Загрузка ДИ из файлов</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
             <Label>Должность <span className="text-muted-foreground font-normal">(необязательно — можно привязать позже)</span></Label>
              <CascadePositionSelector positionId={filePositionId} onPositionChange={setFilePositionId} />
           </div>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? 'border-amber-500 bg-amber-50' : 'border-muted-foreground/30'}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <FileUp className="h-10 w-10 mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm font-medium">Перетащите файлы сюда</p>
              <p className="text-xs text-muted-foreground mb-3">PDF или DOCX</p>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1.5" /> Выбрать файлы
              </Button>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx" className="hidden" onChange={handleFileSelect} />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeFile(i)}><XCircle className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}

            {fileUploading && <Progress value={fileUploadProgress} className="h-2" />}

            {fileUploadResult && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Обработка завершена: {fileUploadResult.summary.success} успешно, {fileUploadResult.summary.failed} ошибок
                </div>
                <div className="space-y-1">
                  {fileUploadResult.results.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs">
                      {r.success ? <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-600 flex-shrink-0" /> : <XCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />}
                      <span className={r.success ? '' : 'text-destructive'}>
                        {r.fileName} {r.success ? `→ ${r.positionTitle || 'без привязки'}` : `: ${r.error}`}
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
              {fileUploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Обработка…</> : <><Upload className="h-4 w-4 mr-1.5" /> Загрузить ({selectedFiles.length})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog (positionId опционален) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Редактировать ДИ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
            <div>
             <Label>Должность <span className="text-muted-foreground font-normal">(необязательно)</span></Label>
              <CascadePositionSelector positionId={editPositionId} onPositionChange={setEditPositionId} />
             {editPositionId && (
                <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs text-amber-600" onClick={() => setEditPositionId('')}>
                  <Unlink className="h-3 w-3 mr-1" /> Отвязать от должности
                </Button>
              )}
            </div>
            <div><Label>Содержимое *</Label><Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[200px] font-mono text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleEdit} disabled={editing}>{editing ? 'Сохранение…' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewDI?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {viewDI?.position ? (
                <>
                  <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" /> {viewDI.position.title}</Badge>
                  <Badge variant="outline"><FolderTree className="h-3 w-3 mr-1" />{viewDI.position.department?.name}</Badge>
                  {viewDI.position.department?.company && <Badge variant="outline"><Building2 className="h-3 w-3 mr-1" />{viewDI.position.department.company.shortName || viewDI.position.department.company.name}</Badge>}
                  {viewDI.position.businessFunction && <Badge variant="outline">{viewDI.position.businessFunction.name}</Badge>}
                  {gradeLabel(viewDI.position.grade ?? null) && <Badge variant="secondary">{gradeLabel(viewDI.position.grade ?? null)}</Badge>}
                </>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">не привязана к должности</Badge>
              )}
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
