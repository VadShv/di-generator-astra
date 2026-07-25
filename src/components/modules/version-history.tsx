'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { History, Loader2, GitCommit, RotateCcw, Eye, Calendar, User, FileText, ArrowLeft, ArrowRight } from 'lucide-react'
import { CascadePositionSelector } from './cascade-position-selector'

interface GeneratedDI {
  id: string
  title: string
  positionId: string
  status: string
  currentVersion: number
  position: { id: string; title: string; department: { id: string; name: string } }
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
  _count: { sections: number; versions: number }
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
  const [versions, setVersions] = useState<DIVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [versionsLoading, setVersionsLoading] = useState(false)

  const [selectedDI, setSelectedDI] = useState<GeneratedDI | null>(null)
  // Единый каскадный фильтр «компания → подразделение → должность» для выбора ДИ.
  const [filterPositionId, setFilterPositionId] = useState('')
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

  const fetchDIs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/generate-di')
      if (!res.ok) throw new Error()
      setGeneratedDIs(await res.json())
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
   setShowDiff(false)
   setCompareV1(null)
   setCompareV2(null)
   setSelectedVersion(null)
   await fetchVersions(di.id)
 }

  // Отфильтрованный список ДИ: если выбрана должность — показываем только её ДИ.
  const filteredDIs = filterPositionId
    ? generatedDIs.filter(d => d.positionId === filterPositionId)
    : generatedDIs

 const handleCompare = () => {
    if (!compareV1 || !compareV2) {
      toast({ title: 'Ошибка', description: 'Выберите две версии для сравнения', variant: 'destructive' })
      return
    }
    setDiffLines(computeDiff(parseContent(compareV1.content), parseContent(compareV2.content)))
    setShowDiff(true)
  }

  const handleRestore = async () => {
    if (!restoringVersion || !selectedDI) return

    try {
      // Parse the version content to get sections
      const versionData = JSON.parse(restoringVersion.content)
      const sections = versionData.sections || []

      const res = await fetch('/api/generate-di', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDI.id,
          title: versionData.title || selectedDI.title,
          sections: sections.map((s: { title: string; content: string }, i: number) => ({
            sectionTitle: s.title,
            sectionContent: s.content,
            order: i,
            aiGenerated: true,
            editedBy: `restore-v${restoringVersion.version}`,
          })),
          changeDescription: `Восстановление версии v${restoringVersion.version}`,
        }),
      })

      if (!res.ok) throw new Error()
      const updated = await res.json()

      toast({ title: 'Успешно', description: `Восстановлена версия v${restoringVersion.version}` })
      setRestoreDialogOpen(false)
      setRestoringVersion(null)

      // Refresh data
      await fetchDIs()
      if (selectedDI) {
        const refreshedDI = generatedDIs.find(d => d.id === selectedDI.id)
        if (refreshedDI) setSelectedDI(refreshedDI)
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
              <CardDescription>Выберите ДИ для просмотра истории</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-1">
              <div className="mb-2 pb-2 border-b">
                <CascadePositionSelector positionId={filterPositionId} onPositionChange={setFilterPositionId} />
              </div>
              {filteredDIs.map(di => (
               <div
                 key={di.id}
                 className={`p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                   selectedDI?.id === di.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                 }`}
                 onClick={() => handleSelectDI(di)}
               >
                 <p className="font-medium">{di.title}</p>
                 <p className="text-xs text-muted-foreground">
                   {di.position?.title} · v{di.currentVersion} · {di._count?.versions || 0} версий
                 </p>
               </div>
             ))}
              {filteredDIs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {filterPositionId ? 'Нет ДИ для выбранной должности' : 'Нет сгенерированных ДИ'}
                </p>
              )}
           </CardContent>
          </Card>

          {/* Version History */}
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
                    <Badge variant="secondary">v{selectedDI.currentVersion}</Badge>
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
