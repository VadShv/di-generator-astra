'use client'

// Рабочая область по должностным инструкциям для карточки должности.
// Объединяет работу с архивными ДИ, сгенерированными ДИ, сравнением версий
// и утверждением финальной ДИ. Все данные подгружаются через существующие API.

import { useCallback, useEffect, useState } from 'react'
import { useDIByPosition, useInvalidateDIData } from '@/hooks/use-generated-dis'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  Archive, FileText, Sparkles, GitCompareArrows, FileCheck2, Upload, Loader2,
  Trash2, RefreshCw, CheckCircle2, AlertCircle, ChevronRight, FileSignature,
} from 'lucide-react'
import type { Position } from './staff-schedule-types'

// ===== Локальные типы (полные данные из API) =====
interface ArchiveDIRow {
  id: string
  title: string
  content: string
  fileName: string | null
  uploadedAt: string
}

interface SectionData {
  title: string
  content: string
}

interface GeneratedDIRow {
  id: string
  title: string
  status: string
  currentVersion: number
  signedByEmployee: boolean
  createdAt: string
  positionId: string
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
}

interface VersionRow {
  id: string
  version: number
  isOriginal: boolean
  uploadedBy: string | null
  fileName: string | null
  changeDescription: string | null
  content: string
  createdAt: string
}

interface TemplateRow {
  id: string
  name: string
  isPrimary: boolean
}

interface MasterPromptRow {
  id: string
  name: string
  category: string
  version: number
  isAiCulture: boolean
  departmentId: string | null
  businessFunctionId: string | null
  grade: string | null
  companyId: string | null
  positionId: string | null
}

// Промежуточный результат парсинга файла — показывается пользователю перед сохранением.
interface ParsedPreview {
  fileName: string
  fileType: string
  rawText: string
  sections: { title: string; content: string }[]
}

interface PositionDIWorkspaceProps {
  position: Position
  // Колбэк для оповещения родителя об изменениях (чтобы обновить счетчики в дереве)
  onChanged?: () => void
}

// Парсинг контента версии/ДИ в текст для предпросмотра
function contentToText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { title?: string; sections?: SectionData[] }
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return parsed.sections
        .map(s => `## ${s.title}\n\n${s.content}`)
        .join('\n\n')
    }
    return content
  } catch {
    return content
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  review: 'На проверке',
  approved: 'Утверждена',
  exported: 'Экспортирована',
  imported: 'Импортирована',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  review: 'bg-amber-50 text-amber-700 border-amber-300',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  exported: 'bg-sky-50 text-sky-700 border-sky-300',
 imported: 'bg-violet-50 text-violet-700 border-violet-300',
}

// Sentinel для опции «авто-подбор мастер-промпта». Radix Select запрещает
// value="" у SelectItem, поэтому используем непустое значение-маркер.
const AUTO_PROMPT = '__auto__'

export function PositionDIWorkspace({ position, onChanged }: PositionDIWorkspaceProps) {
  const { toast } = useToast()
  const invalidateDIData = useInvalidateDIData()
  const [tab, setTab] = useState('archive')

  // Данные
  const [archiveDIs, setArchiveDIs] = useState<ArchiveDIRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  // Сгенерированные ДИ должности — из общего кэша React Query.
  // Запрос идёт с positionId на сервер (не клиентский фильтр по первой странице),
  // поэтому после массовой генерации все ДИ должности гарантированно видны.
  const { data: generatedDIsData } = useDIByPosition(position.id)
  const generatedDIs: GeneratedDIRow[] = (generatedDIsData ?? []) as unknown as GeneratedDIRow[]

  // Состояния операций
  const [generating, setGenerating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  // Фаза 23: архивная ДИ как база генерации (ТЗ §4).
  const [selArchiveBaseId, setSelArchiveBaseId] = useState<string>('')
  const [useArchiveAsReference, setUseArchiveAsReference] = useState(true)
  const [uploadingArchive, setUploadingArchive] = useState(false)
  const [uploadingApproved, setUploadingApproved] = useState(false)

  // Сравнение
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [versionsForDI, setVersionsForDI] = useState<string>('')
  const [compareV1, setCompareV1] = useState<string>('')
  const [compareV2, setCompareV2] = useState<string>('')
  const [diffResult, setDiffResult] = useState<string>('')
  const [comparing, setComparing] = useState(false)

  // Предпросмотр
  const [previewArchiveId, setPreviewArchiveId] = useState<string | null>(null)
  const [previewGenId, setPreviewGenId] = useState<string | null>(null)

 // Мастер-промпты (выбор при генерации)
 const [masterPrompts, setMasterPrompts] = useState<MasterPromptRow[]>([])
 // '' = авто-подбор по критериям должности; иначе — выбранный промпт.
 // AUTO_PROMPT = авто-подбор по критериям должности; иначе — выбранный промпт.
 const [selMasterPromptId, setSelMasterPromptId] = useState<string>(AUTO_PROMPT)
 const [resolvedPromptName, setResolvedPromptName] = useState<string | null>(null)

  // Предпросмотр загружаемой архивной ДИ (после parse, до save)
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview | null>(null)
  const [parsingArchive, setParsingArchive] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // ===== Загрузка данных =====
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
     // Сгенерированные ДИ грузит React Query (useDIByPosition) — здесь только
     // архив, шаблоны и мастер-промпты.
     const [archRes, tmplRes] = await Promise.all([
       fetch(`/api/archive-di?positionId=${position.id}`),
       fetch('/api/templates'),
     ])
      if (archRes.ok) setArchiveDIs((await archRes.json()).items as ArchiveDIRow[])
     if (tmplRes.ok) setTemplates((await tmplRes.json()) as TemplateRow[])
      // Мастер-промпты для выбора при генерации (только активные, категория generation)
      const mpRes = await fetch('/api/master-prompts?active=true')
      if (mpRes.ok) {
        const allMp = (await mpRes.json()) as MasterPromptRow[]
        setMasterPrompts(allMp.filter(p => p.category === 'generation'))
      }
      // Резолв «дефолтного» промпта для текущей должности (для подписи в UI).
      try {
        const rsvRes = await fetch('/api/master-prompts/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positionId: position.id, category: 'generation' }),
        })
        if (rsvRes.ok) {
          const rsv = await rsvRes.json()
          setResolvedPromptName(rsv.prompt?.name ?? null)
        }
      } catch {
        // Резолв не критичен — генерация всё равно сработает с авто-подбором на сервере.
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить данные по ДИ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [position.id, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Предвыбор основного шаблона
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      const primary = templates.find(t => t.isPrimary)
      setSelectedTemplate(primary?.id || templates[0].id)
    }
  }, [templates, selectedTemplate])

  // ===== Генерация ДИ =====
  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast({ title: 'Выберите шаблон', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-di/ai-generate', {
        method: 'POST',
       headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
         positionId: position.id,
         templateId: selectedTemplate,
          masterPromptId: selMasterPromptId === AUTO_PROMPT ? undefined : selMasterPromptId,
         archiveDIId: selArchiveBaseId || undefined,
         useArchiveAsReference,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации')
      toast({ title: '✓ ДИ сгенерирована', description: 'Новый черновик создан' })
      invalidateDIData()
      await loadAll()
      onChanged?.()
      setTab('generated')
    } catch (e) {
      toast({ title: 'Ошибка генерации', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  // ===== Загрузка архивной ДИ (PDF/DOCX) =====
  // ===== Загрузка архивной ДИ: шаг 1 — парсинг файла в предпросмотр =====
  const handleArchiveParse = async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      toast({ title: 'Неподдерживаемый формат', description: 'Допускаются только .pdf и .docx', variant: 'destructive' })
      return
    }
    setParsingArchive(true)
    setParsedPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/di-upload?mode=parse', { method: 'POST', body: fd })
      const parsed = await parseRes.json()
      if (!parseRes.ok) throw new Error(parsed.error || 'Ошибка разбора файла')
      setParsedPreview({
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        rawText: parsed.rawText,
        sections: parsed.sections || [],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // Типичная причина пустого текста — PDF-скан без текстового слоя.
      const hint = /извлечь текст|скан/i.test(msg)
        ? 'Возможно, это скан. Распознайте текст (OCR) и загрузите текстовый PDF/DOCX.'
        : msg
      toast({ title: 'Ошибка разбора файла', description: hint, variant: 'destructive' })
    } finally {
      setParsingArchive(false)
    }
  }

  // Обработчик выбора файла (input) — запускает парсинг.
  const handleArchiveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleArchiveParse(file)
    e.target.value = ''
  }

  // ===== Загрузка архивной ДИ: шаг 2 — подтверждение и сохранение =====
  const handleConfirmSaveArchive = async () => {
    if (!parsedPreview) return
    setUploadingArchive(true)
    try {
      const saveRes = await fetch('/api/di-upload?mode=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: parsedPreview.fileName,
          fileType: parsedPreview.fileType,
          rawText: parsedPreview.rawText,
          sections: parsedPreview.sections,
          positionId: position.id,
          companyId: position.department?.companyId || null,
        }),
      })
      const saved = await saveRes.json()
      if (!saveRes.ok) throw new Error(saved.error || 'Ошибка сохранения')
      toast({ title: '✓ Архивная ДИ загружена', description: `${parsedPreview.sections.length} секций` })
      setParsedPreview(null)
      await loadAll()
      onChanged?.()
    } catch (e) {
      toast({ title: 'Ошибка сохранения', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setUploadingArchive(false)
    }
  }

  // ===== Удаление архивной ДИ =====
  const handleDeleteArchive = async (id: string) => {
    if (!confirm('Удалить архивную ДИ?')) return
    try {
      const res = await fetch(`/api/archive-di/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Ошибка удаления')
      toast({ title: '✓ Удалено' })
      await loadAll()
      onChanged?.()
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  // ===== Загрузка версий для сравнения =====
  const loadVersions = useCallback(async (diId: string) => {
    if (!diId) {
      setVersions([])
      return
    }
    try {
      const res = await fetch(`/api/compare?generatedDIId=${diId}`)
      if (res.ok) {
        setVersions((await res.json()).items as VersionRow[])
      }
    } catch {
      setVersions([])
    }
  }, [])

  useEffect(() => {
    if (versionsForDI) loadVersions(versionsForDI)
    setCompareV1('')
    setCompareV2('')
    setDiffResult('')
  }, [versionsForDI, loadVersions])

  // ===== Сравнение версий через ИИ =====
  const handleCompare = async () => {
    if (!compareV1 || !compareV2) {
      toast({ title: 'Выберите две версии', variant: 'destructive' })
      return
    }
    setComparing(true)
    setDiffResult('')
    try {
      const res = await fetch('/api/compare/ai-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version1Id: compareV1, version2Id: compareV2 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка сравнения')
      setDiffResult(data.diff || data.summary || JSON.stringify(data, null, 2))
    } catch (e) {
      toast({ title: 'Ошибка сравнения', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setComparing(false)
    }
  }

  // ===== Загрузка утверждённой ДИ (версия + статус approved) =====
  const handleUploadApproved = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (generatedDIs.length === 0) {
      toast({ title: 'Сначала сгенерируйте ДИ', description: 'Утверждаемая ДИ привязывается к сгенерированной', variant: 'destructive' })
      e.target.value = ''
      return
    }
    setUploadingApproved(true)
    try {
      // 1. Парсинг файла руководителя
      const fd = new FormData()
      fd.append('file', file)
      const parseRes = await fetch('/api/di-upload?mode=parse', { method: 'POST', body: fd })
      const parsed = await parseRes.json()
      if (!parseRes.ok) throw new Error(parsed.error || 'Ошибка разбора файла')

      const targetDI = generatedDIs[0]
      // 2. Создание новой версии с пометкой
      const versionRes = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedDIId: targetDI.id,
          content: parsed.rawText,
          uploadedBy: 'manager',
          fileName: parsed.fileName,
          isOriginal: false,
        }),
      })
      if (!versionRes.ok) {
        const err = await versionRes.json()
        throw new Error(err.error || 'Ошибка создания версии')
      }

      // 3. Смена статуса ДИ на approved
     const statusRes = await fetch(`/api/tracking/update-di-status`, {
        method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ generatedDIId: targetDI.id, status: 'approved' }),
     })
      if (!statusRes.ok) {
        // Не критично — версия создана
        console.warn('Статус не обновлён')
      }

      toast({ title: '✓ Утверждённая ДИ загружена', description: 'Создана новая версия, статус обновлён' })
      invalidateDIData()
      await loadAll()
      onChanged?.()
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setUploadingApproved(false)
      e.target.value = ''
    }
  }

  // ===== Изменение статуса ДИ =====
  const handleStatusChange = async (diId: string, status: string) => {
    try {
      const res = await fetch('/api/tracking/update-di-status', {
        method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ generatedDIId: diId, status }),
     })
      if (!res.ok) throw new Error('Ошибка обновления статуса')
      toast({ title: '✓ Статус обновлён' })
      invalidateDIData()
      await loadAll()
      onChanged?.()
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка данных по ДИ…
      </div>
    )
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="archive" className="text-xs"><Archive className="h-3.5 w-3.5 mr-1.5" /> Архив ({archiveDIs.length})</TabsTrigger>
        <TabsTrigger value="generated" className="text-xs"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Генерация ({generatedDIs.length})</TabsTrigger>
        <TabsTrigger value="compare" className="text-xs"><GitCompareArrows className="h-3.5 w-3.5 mr-1.5" /> Сравнение</TabsTrigger>
        <TabsTrigger value="approve" className="text-xs"><FileCheck2 className="h-3.5 w-3.5 mr-1.5" /> Утверждение</TabsTrigger>
      </TabsList>

      {/* ===== Архивные ДИ ===== */}
     <TabsContent value="archive" className="mt-3 space-y-3">
       <div className="flex items-center justify-between gap-2">
         <p className="text-xs text-muted-foreground">Старые ДИ (PDF/DOCX) — используются как референс при генерации</p>
         <label className="cursor-pointer">
           <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleArchiveUpload} disabled={uploadingArchive} />
           <span className="inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium h-8 px-3 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
             {uploadingArchive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
             Загрузить ДИ
           </span>
         </label>
       </div>

        {/* Зона загрузки (drag&drop + клик) */}
        <label
          className={`block cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400 hover:bg-muted/40'
          } ${(parsingArchive || uploadingArchive) ? 'opacity-60 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) await handleArchiveParse(file)
          }}
        >
          <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleArchiveUpload} disabled={parsingArchive || uploadingArchive} />
          {parsingArchive ? (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Разбор файла…
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Upload className="h-6 w-6 text-emerald-600" />
              <p className="text-sm font-medium">Перетащите ДИ сюда или нажмите для выбора</p>
              <p className="text-xs text-muted-foreground">PDF или DOCX — текстовый слой (сканы нужно прогнать через OCR)</p>
            </div>
          )}
        </label>

        {/* Предпросмотр распарсенного файла перед сохранением */}
        {parsedPreview && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{parsedPreview.fileName}</span>
                <Badge variant="outline" className="text-xs h-5 uppercase">{parsedPreview.fileType}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setParsedPreview(null)} disabled={uploadingArchive}>Отмена</Button>
                <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmSaveArchive} disabled={uploadingArchive}>
                  {uploadingArchive ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                  {uploadingArchive ? 'Сохранение…' : 'Сохранить в архив'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{parsedPreview.sections.length} секций распознано</span>
              <span>· {parsedPreview.rawText.length} символов</span>
            </div>
            {parsedPreview.sections.length > 0 ? (
              <ScrollArea className="h-40 rounded border bg-background">
                <div className="p-2 space-y-2">
                  {parsedPreview.sections.map((s, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-muted-foreground">{s.title}</p>
                      <p className="text-xs whitespace-pre-wrap line-clamp-3">{s.content}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Секции не распознаны — текст будет сохранён целиком как одна секция.
              </div>
            )}
          </div>
        )}

        {archiveDIs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
            <Archive className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Нет архивных ДИ</p>
            <p className="text-xs">Загрузите старую ДИ в формате PDF или DOCX</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] rounded-lg border">
            <div className="p-2 space-y-1">
              {archiveDIs.map(a => (
                <div key={a.id} className="group flex items-start gap-2 p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center justify-center h-8 w-8 rounded bg-slate-100 text-slate-600 flex-shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <button className="text-sm font-medium text-left hover:text-emerald-700 hover:underline truncate w-full" onClick={() => setPreviewArchiveId(previewArchiveId === a.id ? null : a.id)}>
                      {a.title}
                    </button>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      {a.fileName && <span className="truncate">{a.fileName}</span>}
                      <span>· {formatDate(a.uploadedAt)}</span>
                    </p>
                    {previewArchiveId === a.id && (
                      <Textarea readOnly value={a.content} className="mt-2 h-48 text-xs font-mono" />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteArchive(a.id)} title="Удалить">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </TabsContent>

     {/* ===== Сгенерированные ДИ ===== */}
   <TabsContent value="generated" className="mt-3 space-y-3">
     {/* Воркфлоу генерации: пошаговая настройка перед запуском */}
      <div className="rounded-lg border bg-violet-50/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600 flex-shrink-0" />
            <p className="text-sm font-medium text-violet-700">Генерация новой ДИ через ИИ</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Шаг 1. Шаблон (по умолчанию — основной) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-violet-600 text-white text-[10px]">1</span>
                Шаблон структуры
              </label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Выберите шаблон" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}{t.isPrimary ? ' ★ Основной' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Шаг 2. Мастер-промпт (по умолчанию — авто-подбор) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-violet-600 text-white text-[10px]">2</span>
                Мастер-промпт
              </label>
             <Select value={selMasterPromptId} onValueChange={setSelMasterPromptId}>
               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Авто-подбор по должности" /></SelectTrigger>
               <SelectContent>
                  <SelectItem value={AUTO_PROMPT} className="text-xs">⚡ Авто-подбор по критериям должности</SelectItem>
                 {masterPrompts.map(p => (
                   <SelectItem key={p.id} value={p.id} className="text-xs">
                     {p.name}{p.isAiCulture ? ' 🤖' : ''}{p.departmentId || p.businessFunctionId || p.grade ? ' · привязан' : ' · общий'} (v{p.version})
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
              {selMasterPromptId === AUTO_PROMPT && (
               <p className="text-[11px] text-muted-foreground">
                 {resolvedPromptName
                   ? <>Будет использован: <span className="font-medium">{resolvedPromptName}</span></>
                   : 'Не найден — применится стандартный стиль ДИ.'}
               </p>
             )}
            </div>

            {/* Шаг 3. Архивная ДИ как база (опционально) */}
            {archiveDIs.length > 0 && (
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span className="flex items-center justify-center h-4 w-4 rounded-full bg-violet-600 text-white text-[10px]">3</span>
                  Архивная ДИ как база (опционально)
                </label>
                <div className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50/60">
                  <Archive className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <Select value={selArchiveBaseId} onValueChange={setSelArchiveBaseId}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Не использовать архивную ДИ" /></SelectTrigger>
                    <SelectContent>
                      {archiveDIs.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selArchiveBaseId && (
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={useArchiveAsReference} onChange={(e) => setUseArchiveAsReference(e.target.checked)} className="rounded h-3 w-3" />
                      <span>как референс</span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t">
            <p className="text-[11px] text-muted-foreground">
              {selectedTemplate ? 'Готово к генерации' : 'Выберите шаблон, чтобы продолжить'}
            </p>
            <Button size="sm" className="h-9 px-4 bg-violet-600 hover:bg-violet-700" onClick={handleGenerate} disabled={generating || !selectedTemplate}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {generating ? 'Генерация…' : 'Сгенерировать ДИ'}
            </Button>
          </div>
        </div>

        {generatedDIs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Нет сгенерированных ДИ</p>
            <p className="text-xs">Запустите генерацию кнопкой выше</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] rounded-lg border">
            <div className="p-2 space-y-1">
              {generatedDIs.map(d => (
                <div key={d.id} className="group p-2 rounded hover:bg-muted/50">
                  <div className="flex items-start gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded bg-violet-100 text-violet-600 flex-shrink-0">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <button className="text-sm font-medium text-left hover:text-violet-700 hover:underline truncate w-full" onClick={() => setPreviewGenId(previewGenId === d.id ? null : d.id)}>
                        {d.title}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className={`text-xs h-5 ${STATUS_COLORS[d.status] || 'bg-slate-100'}`}>
                          {STATUS_LABELS[d.status] || d.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">v{d.currentVersion}</span>
                        <span className="text-xs text-muted-foreground">· {formatDate(d.createdAt)}</span>
                        {d.signedByEmployee && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      </div>
                      {previewGenId === d.id && d.sections.length > 0 && (
                        <ScrollArea className="h-48 mt-2 rounded border bg-muted/30">
                          <div className="p-2 space-y-2 text-xs">
                            {d.sections.map(s => (
                              <div key={s.id}>
                                <p className="font-semibold text-muted-foreground">{s.sectionTitle}</p>
                                <p className="whitespace-pre-wrap">{s.sectionContent}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.status !== 'approved' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleStatusChange(d.id, 'approved')} title="Утвердить">
                          <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Утвердить
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setVersionsForDI(d.id); setTab('compare') }} title="Сравнить версии">
                        <GitCompareArrows className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </TabsContent>

      {/* ===== Сравнение версий ===== */}
      <TabsContent value="compare" className="mt-3 space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Сравнение версий ДИ через ИИ — выявление различий между версиями</p>
          <Select value={versionsForDI} onValueChange={setVersionsForDI}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="Выберите ДИ для сравнения версий" /></SelectTrigger>
            <SelectContent>
              {generatedDIs.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs">{d.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {versionsForDI && (
          <>
            {versions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs border rounded-lg border-dashed">
                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-40" />
                Нет версий для сравнения
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Версия 1</p>
                  <Select value={compareV1} onValueChange={setCompareV1}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>
                      {versions.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          v{v.version}{v.isOriginal ? ' (оригинал)' : ''}{v.fileName ? ` · ${v.fileName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Версия 2</p>
                  <Select value={compareV2} onValueChange={setCompareV2}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>
                      {versions.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          v{v.version}{v.isOriginal ? ' (оригинал)' : ''}{v.fileName ? ` · ${v.fileName}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {compareV1 && compareV2 && (
              <Button size="sm" className="w-full" onClick={handleCompare} disabled={comparing}>
                {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />}
                {comparing ? 'Сравнение…' : 'Сравнить через ИИ'}
              </Button>
            )}

            {diffResult && (
              <ScrollArea className="h-[240px] rounded-lg border bg-muted/30">
                <pre className="p-3 text-xs whitespace-pre-wrap">{diffResult}</pre>
              </ScrollArea>
            )}
          </>
        )}
      </TabsContent>

      {/* ===== Утверждение ===== */}
      <TabsContent value="approve" className="mt-3 space-y-3">
        <div className="p-3 rounded-lg border bg-emerald-50/50 space-y-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700">Утверждение должностной инструкции</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Загрузите ДИ с корректировками руководителя (PDF/DOCX). Будет создана новая версия,
            а статус ДИ изменится на «Утверждена».
          </p>
          {generatedDIs.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Сначала сгенерируйте ДИ во вкладке «Генерация»
            </div>
          )}
          <label className="cursor-pointer block">
            <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleUploadApproved} disabled={uploadingApproved || generatedDIs.length === 0} />
            <span className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium h-9 px-4 w-full ${generatedDIs.length === 0 ? 'bg-muted text-muted-foreground' : 'bg-emerald-600 text-white hover:bg-emerald-700'} disabled:opacity-50`}>
              {uploadingApproved ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingApproved ? 'Загрузка…' : 'Загрузить утверждённую ДИ'}
            </span>
          </label>
        </div>

        {generatedDIs.filter(d => d.status === 'approved').length > 0 && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Утверждённые ДИ</p>
            {generatedDIs.filter(d => d.status === 'approved').map(d => (
              <div key={d.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="flex-1 truncate">{d.title}</span>
                <Badge variant="outline" className="text-xs h-5 bg-emerald-50 text-emerald-700 border-emerald-300">v{d.currentVersion}</Badge>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
