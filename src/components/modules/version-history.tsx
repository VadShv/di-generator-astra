'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { History, Loader2, GitCommit, RotateCcw, Eye, Calendar, User, Archive } from 'lucide-react'
import { CascadePositionSelector } from './cascade-position-selector'

interface GeneratedDI {
  id: string
  title: string
  positionId: string
  status: string
  currentVersion: number
  position: { id: string; title: string; department: { id: string; name: string; companyId?: string | null; company?: { id: string; name: string } | null } }
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
  _count: { sections: number; versions: number }
}

// Архивная ДИ (старая/загруженная). У неё нет версий, но есть текст.
interface ArchiveDI {
  id: string
  title: string
  content: string
  positionId: string | null
  position: { id: string; title: string; department: { id: string; name: string; companyId?: string | null } | null } | null
  uploadedAt: string
  fileName: string | null
}

interface DIVersion {
  id: string
  generatedDIId: string
  content: string
  version: number
  isOriginal: boolean
  uploadedBy: string | null
  fileName: string | null
  diffSummary: string | null
  changeDescription: string | null
  createdAt: string
}

interface DiffLine {
  type: 'same' | 'added' | 'removed' | 'modified'
  line1?: string
  line2?: string
}

// Метаданные типа ДИ для единообразного отображения (цвет + подпись).
const DI_TYPE_META: Record<string, { label: string; className: string }> = {
  archive: { label: 'Архивная', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  draft: { label: 'Сгенерированная', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  review: { label: 'На согласовании', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  approved: { label: 'Согласованная', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
}

// Определение типа ДИ по статусу (для сгенерированных ДИ).
function diTypeLabel(status: string): string {
  if (status === 'review') return 'review'
  if (status === 'approved') return 'approved'
  return 'draft'
}

function computeDiff(text1: string, text2: string): DiffLine[] {
  const l1 = text1.split('\n'), l2 = text2.split('\n'), result: DiffLine[] = [], maxLen = Math.max(l1.length, l2.length)
  for (let i = 0; i < maxLen; i++) {
    const a = i < l1.length ? l1[i] : undefined, b = i < l2.length ? l2[i] : undefined
    if (a !== undefined && b !== undefined) result.push(a === b ? { type: 'same', line1: a, line2: b } : { type: 'modified', line1: a, line2: b })
    else if (a !== undefined) result.push({ type: 'removed', line1: a })
    else if (b !== undefined) result.push({ type: 'added', line2: b })
  }
  return result
}

function parseContent(content: string): string {
  try {
    const p = JSON.parse(content)
    const parts: string[] = []
    if (p.title) parts.push(`# ${p.title}`)
    if (p.sections) for (const s of p.sections) { parts.push(`\n## ${s.title}`); parts.push(s.content) }
    return parts.join('\n')
  } catch { return content }
}

export function VersionHistoryModule() {
  const { toast } = useToast()
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [archiveDIs, setArchiveDIs] = useState<ArchiveDI[]>([])
  const [versions, setVersions] = useState<DIVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)

  const [selectedDI, setSelectedDI] = useState<GeneratedDI | null>(null)
  // Выбранная архивная ДИ (просмотр текста; у архивных нет версий).
  const [selectedArchiveDI, setSelectedArchiveDI] = useState<ArchiveDI | null>(null)
  // Единый каскадный фильтр «компания → подразделение → должность» для выбора ДИ.
  const [filterPositionId, setFilterPositionId] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('')
  const [selectedVersion, setSelectedVersion] = useState<DIVersion | null>(null)

  // Compare
  const [compareV1, setCompareV1] = useState<DIVersion | null>(null)
  const [compareV2, setCompareV2] = useState<DIVersion | null>(null)
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])
  const [showDiff, setShowDiff] = useState(false)

  // View version dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<DIVersion | null>(null)

  // Restore dialog
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoringVersion, setRestoringVersion] = useState<DIVersion | null>(null)

  // Загрузка сгенерированных и архивных ДИ одним запросом.
  const fetchDIs = useCallback(async () => {
    try {
      setLoading(true)
      const [genRes, archRes] = await Promise.all([
        fetch('/api/generate-di'),
        fetch('/api/archive-di?linkStatus=all'),
      ])
      if (!genRes.ok || !archRes.ok) throw new Error()
      setGeneratedDIs(await genRes.json())
      setArchiveDIs(await archRes.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchVersions = useCallback(async (diId: string) => {
    try {
      setVersionsLoading(true)
      const res = await fetch(`/api/compare?generatedDIId=${diId}`)
      if (!res.ok) throw new Error()
      setVersions(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить версии', variant: 'destructive' })
    } finally {
      setVersionsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchDIs() }, [fetchDIs])

  const handleSelectDI = async (di: GeneratedDI) => {
    setSelectedDI(di)
    setSelectedArchiveDI(null)
    setShowDiff(false)
    setCompareV1(null)
    setCompareV2(null)
    setSelectedVersion(null)
    await fetchVersions(di.id)
  }

  // Выбор архивной ДИ: версии отсутствуют, показываем только текст.
  const handleSelectArchiveDI = (di: ArchiveDI) => {
    setSelectedArchiveDI(di)
    setSelectedDI(null)
    setVersions([])
    setShowDiff(false)
    setCompareV1(null)
    setCompareV2(null)
    setSelectedVersion(null)
  }

  // Каскадный фильтр сгенерированных ДИ: компания → подразделение → должность.
  // Каждый уровень сужает выборку; если ничего не выбрано — показываем все ДИ.
  const filteredDIs = useMemo(() => {
    return generatedDIs.filter(d => {
      if (filterPositionId && d.positionId !== filterPositionId) return false
      if (filterDepartmentId && d.position?.department?.id !== filterDepartmentId) return false
      if (filterCompanyId && d.position?.department?.companyId !== filterCompanyId && d.position?.department?.company?.id !== filterCompanyId) return false
      return true
    })
  }, [generatedDIs, filterPositionId, filterDepartmentId, filterCompanyId])

  // Каскадный фильтр архивных ДИ по тем же уровням.
  const filteredArchiveDIs = useMemo(() => {
    return archiveDIs.filter(d => {
      if (filterPositionId && d.positionId !== filterPositionId) return false
      if (filterDepartmentId && d.position?.department?.id !== filterDepartmentId) return false
      if (filterCompanyId && d.position?.department?.companyId !== filterCompanyId) return false
      return true
    })
  }, [archiveDIs, filterPositionId, filterDepartmentId, filterCompanyId])

  const handleCompare = () => {
    if (!compareV1 || !compareV2) {
      toast({ title: 'Ошибка', description: 'Выберите две версии для сравнения', variant: 'destructive' })
      return
    }
    const text1 = parseContent(compareV1.content)
    const text2 = parseContent(compareV2.content)
    setDiffLines(computeDiff(text1, text2))
    setShowDiff(true)
  }

  const handleRestore = async () => {
    if (!restoringVersion || !selectedDI) return
    try {
      const versionData = JSON.parse(restoringVersion.content)
      const res = await fetch('/api/generate-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDI.id,
          title: versionData.title || selectedDI.title,
          sections: versionData.sections || [],
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Версия восстановлена', description: `Восстановлена версия v${restoringVersion.version}` })
      setRestoreDialogOpen(false)
      setRestoringVersion(null)
      await fetchDIs()
      if (selectedDI) {
        await fetchVersions(selectedDI.id)
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось восстановить версию', variant: 'destructive' })
    }
  }

  const uploadByLabel = (u: string | null) => {
    if (!u) return '—'
    const map: Record<string, string> = {
      'manual': 'Ручное создание',
      'manual-edit': 'Ручное редактирование',
      'ai-generate': 'AI-генерация',
      'ai-mass-generate': 'AI массовая генерация',
      'system': 'Авто-сохранение',
    }
    return map[u] || u
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" /> Версионирование ДИ
          </h1>
          <p className="text-sm text-muted-foreground">
            История изменений и восстановление версий должностных инструкций
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* DI List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Должностные инструкции</CardTitle>
              <CardDescription>Выберите организацию, подразделение и должность</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-1">
              <div className="mb-2 pb-2 border-b">
                <CascadePositionSelector
                  positionId={filterPositionId}
                  onPositionChange={setFilterPositionId}
                  companyId={filterCompanyId}
                  departmentId={filterDepartmentId}
                  onCompanyChange={setFilterCompanyId}
                  onDepartmentChange={setFilterDepartmentId}
                />
              </div>
              {/* Сгенерированные ДИ (с версиями) */}
              {filteredDIs.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">
                  Сгенерированные ({filteredDIs.length})
                </p>
              )}
              {filteredDIs.map(di => {
                const t = diTypeLabel(di.status)
                const meta = DI_TYPE_META[t]
                return (
                  <div
                    key={di.id}
                    className={`p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                      selectedDI?.id === di.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleSelectDI(di)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{di.title}</p>
                      <Badge variant="outline" className={`text-xs shrink-0 ${meta.className}`}>{meta.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {di.position?.title} · v{di.currentVersion} · {di._count?.versions || 0} версий
                    </p>
                  </div>
                )
              })}
              {/* Архивные ДИ (без версий — только текст) */}
              {filteredArchiveDIs.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3 pb-1 border-t mt-2">
                  Архивные ({filteredArchiveDIs.length})
                </p>
              )}
              {filteredArchiveDIs.map(di => (
                <div
                  key={di.id}
                  className={`p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                    selectedArchiveDI?.id === di.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                  onClick={() => handleSelectArchiveDI(di)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{di.title}</p>
                    <Badge variant="outline" className="text-xs shrink-0 bg-slate-100 text-slate-700 border-slate-300">
                      <Archive className="h-3 w-3 mr-1" />Архивная
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {di.position ? di.position.title : 'Без должности'}
                    {di.fileName ? ` · ${di.fileName}` : ''}
                  </p>
                </div>
              ))}
              {filteredDIs.length === 0 && filteredArchiveDIs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {filterCompanyId || filterDepartmentId || filterPositionId ? 'Нет ДИ по выбранным критериям' : 'Нет должностных инструкций'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Version History / Details */}
          <Card className="lg:col-span-2">
            {selectedDI ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedDI.title}</CardTitle>
                      <CardDescription>
                        Текущая версия: v{selectedDI.currentVersion} · {selectedDI.position?.title}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`text-xs ${DI_TYPE_META[diTypeLabel(selectedDI.status)].className}`}>
                      {DI_TYPE_META[diTypeLabel(selectedDI.status)].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {versionsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Compare selectors */}
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Версия 1</p>
                          <Select value={compareV1?.id || ''} onValueChange={v => setCompareV1(versions.find(ver => ver.id === v) || null)}>
                            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                            <SelectContent>
                              {versions.map(ver => (
                                <SelectItem key={ver.id} value={ver.id}>
                                  v{ver.version} {ver.isOriginal ? '(оригинал)' : ''} — {uploadByLabel(ver.uploadedBy)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Версия 2</p>
                          <Select value={compareV2?.id || ''} onValueChange={v => setCompareV2(versions.find(ver => ver.id === v) || null)}>
                            <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                            <SelectContent>
                              {versions.map(ver => (
                                <SelectItem key={ver.id} value={ver.id}>
                                  v{ver.version} {ver.isOriginal ? '(оригинал)' : ''} — {uploadByLabel(ver.uploadedBy)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCompare} disabled={!compareV1 || !compareV2}>Сравнить</Button>
                      </div>

                      {/* Version timeline */}
                      <div className="space-y-1.5">
                        {versions.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Нет сохранённых версий. Версия создаётся автоматически при редактировании ДИ.
                          </p>
                        )}
                        {versions.sort((a, b) => b.version - a.version).map(v => (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between p-2.5 border rounded-lg text-sm transition-colors ${
                              selectedVersion?.id === v.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GitCommit className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <Badge variant="secondary" className="text-xs">v{v.version}</Badge>
                              {v.isOriginal && <Badge variant="outline" className="text-xs">Оригинал</Badge>}
                              {v.changeDescription && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {v.changeDescription}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {uploadByLabel(v.uploadedBy)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {new Date(v.createdAt).toLocaleDateString('ru-RU')}
                              </div>
                              <Button variant="ghost" size="sm" className="h-7"
                                onClick={() => { setViewingVersion(v); setViewDialogOpen(true) }}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {v.version !== selectedDI.currentVersion && (
                                <Button variant="ghost" size="sm" className="h-7"
                                  onClick={() => { setRestoringVersion(v); setRestoreDialogOpen(true) }}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Diff result */}
                      {showDiff && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Результат сравнения</h4>
                          <div className="border rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                            {diffLines.map((line, i) => (
                              <div key={i} className={`px-2 py-0.5 ${
                                line.type === 'removed' ? 'bg-red-100 text-red-800' :
                                line.type === 'added' ? 'bg-green-100 text-green-800' :
                                line.type === 'modified' ? 'bg-yellow-100' : ''
                              }`}>
                                {line.type === 'removed' && <span>- {line.line1}</span>}
                                {line.type === 'added' && <span>+ {line.line2}</span>}
                                {line.type === 'same' && <span className="text-muted-foreground">  {line.line1}</span>}
                                {line.type === 'modified' && (
                                  <>
                                    <div className="text-red-800">- {line.line1}</div>
                                    <div className="text-green-800">+ {line.line2}</div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </>
            ) : selectedArchiveDI ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedArchiveDI.title}</CardTitle>
                      <CardDescription>
                        {selectedArchiveDI.position ? selectedArchiveDI.position.title : 'Без должности'}
                        {selectedArchiveDI.fileName ? ` · ${selectedArchiveDI.fileName}` : ''}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                      <Archive className="h-3 w-3 mr-1" />Архивная
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Архивные ДИ не имеют истории версий. Текст инструкции сохранён как есть
                    при загрузке и может служить базой для генерации новых ДИ.
                  </p>
                  <div className="rounded-md border bg-muted/30 p-3 max-h-[500px] overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">{selectedArchiveDI.content}</pre>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-12 text-center">
                <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground">Выберите ДИ для просмотра истории версий</p>
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* View Version Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Версия {viewingVersion ? `v${viewingVersion.version}` : ''}
            </DialogTitle>
            <DialogDescription>Содержание выбранной версии ДИ</DialogDescription>
          </DialogHeader>
          {viewingVersion && (
            <>
              <div className="flex items-center gap-2 mb-3">
                {viewingVersion.isOriginal && <Badge variant="outline">Оригинал</Badge>}
                {viewingVersion.changeDescription && (
                  <Badge variant="secondary">{viewingVersion.changeDescription}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {uploadByLabel(viewingVersion.uploadedBy)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(viewingVersion.createdAt).toLocaleString('ru-RU')}
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">
                {parseContent(viewingVersion.content)}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Version Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Восстановление версии
            </DialogTitle>
            <DialogDescription>Восстановление предыдущей версии с сохранением текущей в истории</DialogDescription>
          </DialogHeader>
          {restoringVersion && (
            <div className="space-y-3">
              <p className="text-sm">
                Вы собираетесь восстановить <strong>версию v{restoringVersion.version}</strong> должностной инструкции.
              </p>
              {restoringVersion.changeDescription && (
                <p className="text-xs text-muted-foreground">
                  Описание: {restoringVersion.changeDescription}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Текущая версия (v{selectedDI?.currentVersion}) будет сохранена в истории, а содержимое заменится на версию v{restoringVersion.version}.
              </p>
              <Separator />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleRestore}>Восстановить</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
