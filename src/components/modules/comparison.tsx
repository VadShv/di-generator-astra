'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { GitCompareArrows, Plus, Sparkles, Loader2, History } from 'lucide-react'

interface Department { id: string; name: string; code: string }
interface Position { id: string; title: string; code: string; departmentId: string; department: Department }
interface GeneratedDI { id: string; positionId: string; title: string; status: string; position: Position; versions: DIVersionItem[]; createdAt: string }
interface DIVersionItem { id: string; generatedDIId: string; content: string; version: number; isOriginal: boolean; uploadedBy: string | null; fileName: string | null; diffSummary: string | null; createdAt: string }

interface DiffLine { type: 'same' | 'added' | 'removed' | 'modified'; line1?: string; line2?: string }

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
  try { const p = JSON.parse(content); const parts: string[] = []; if (p.title) parts.push(`# ${p.title}`); if (p.sections) for (const s of p.sections) { parts.push(`\n## ${s.title}`); parts.push(s.content) } return parts.join('\n') } catch { return content }
}

export function ComparisonModule() {
  const { toast } = useToast()
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDI, setSelectedDI] = useState<GeneratedDI | null>(null)

  // Upload
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({ generatedDIId: '', content: '', uploadedBy: '', fileName: '' })
  const [uploading, setUploading] = useState(false)

  // Compare
  const [compareV1, setCompareV1] = useState<DIVersionItem | null>(null)
  const [compareV2, setCompareV2] = useState<DIVersionItem | null>(null)
  const [diffLines, setDiffLines] = useState<DiffLine[]>([])
  const [showDiff, setShowDiff] = useState(false)

  // AI diff
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // View version
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<DIVersionItem | null>(null)

  const fetchDIs = useCallback(async () => {
    try { setLoading(true); const res = await fetch('/api/generated-di'); if (!res.ok) throw new Error(); setGeneratedDIs(await res.json()) }
    catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchDIs() }, [fetchDIs])

  const handleSelectDI = (di: GeneratedDI) => { setSelectedDI(di); setShowDiff(false); setAiSummary(null); setCompareV1(null); setCompareV2(null) }

  const handleUpload = async () => {
    if (!uploadForm.generatedDIId || !uploadForm.content.trim()) { toast({ title: 'Ошибка', description: 'Заполните обязательные поля', variant: 'destructive' }); return }
    setUploading(true)
    try {
      const di = generatedDIs.find(d => d.id === uploadForm.generatedDIId)
      if (di && di.versions.filter(v => v.isOriginal).length === 0) {
        await fetch('/api/compare/auto-save-original', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: uploadForm.generatedDIId }) })
      }
      const res = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: uploadForm.generatedDIId, content: uploadForm.content, uploadedBy: uploadForm.uploadedBy || null, fileName: uploadForm.fileName || null, isOriginal: false }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Версия загружена' })
      setUploadDialogOpen(false); setUploadForm({ generatedDIId: '', content: '', uploadedBy: '', fileName: '' })
      await fetchDIs()
      if (selectedDI?.id === uploadForm.generatedDIId) { const fresh = await fetch('/api/generated-di'); const data = await fresh.json(); const updated = data.find((d: GeneratedDI) => d.id === uploadForm.generatedDIId); if (updated) setSelectedDI(updated) }
    } catch { toast({ title: 'Ошибка', description: 'Не удалось загрузить', variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  const handleCompare = () => {
    if (!compareV1 || !compareV2) { toast({ title: 'Ошибка', description: 'Выберите две версии', variant: 'destructive' }); return }
    setDiffLines(computeDiff(parseContent(compareV1.content), parseContent(compareV2.content)))
    setShowDiff(true); setAiSummary(null)
  }

  const handleAIDiff = async () => {
    if (!compareV1 || !compareV2) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/compare/ai-diff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version1Id: compareV1.id, version2Id: compareV2.id }) })
      if (!res.ok) throw new Error()
      const data = await res.json(); setAiSummary(data.aiSummary); toast({ title: 'Готово', description: 'ИИ-сравнение завершено' })
    } catch { toast({ title: 'Ошибка', description: 'Не удалось выполнить ИИ-сравнение', variant: 'destructive' }) }
    finally { setAiLoading(false) }
  }

  const handleAutoSaveOriginal = async () => {
    if (!selectedDI) return
    try {
      await fetch('/api/compare/auto-save-original', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generatedDIId: selectedDI.id }) })
      toast({ title: 'Успешно', description: 'Оригинал сохранён' }); fetchDIs()
    } catch { toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><GitCompareArrows className="h-6 w-6" /> Сравнение версий</h1><p className="text-sm text-muted-foreground">Сравнение версий должностных инструкций</p></div>
        <Button onClick={() => setUploadDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Загрузить версию</Button>
      </div>

      {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* DI List */}
          <Card className="lg:col-span-1"><CardHeader className="pb-2"><CardTitle className="text-base">Должностные инструкции</CardTitle></CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto space-y-1">
              {generatedDIs.map(di => (
                <div key={di.id} className={`p-2 rounded cursor-pointer text-sm ${selectedDI?.id === di.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`} onClick={() => handleSelectDI(di)}>
                  <p className="font-medium">{di.title}</p>
                  <p className="text-xs text-muted-foreground">{di.position?.title} · {di.versions.length} версий</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Version Details */}
          <Card className="lg:col-span-2">
            {selectedDI ? <>
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">{selectedDI.title}</CardTitle><Button variant="outline" size="sm" onClick={handleAutoSaveOriginal}>Сохранить оригинал</Button></div></CardHeader>
              <CardContent className="space-y-3">
                {/* Version selector */}
                <div className="flex items-end gap-2">
                  <div className="flex-1"><Label className="text-xs">Версия 1</Label><Select value={compareV1?.id || ''} onValueChange={v => setCompareV1(selectedDI.versions.find(ver => ver.id === v) || null)}><SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger><SelectContent>{selectedDI.versions.map(ver => <SelectItem key={ver.id} value={ver.id}>v{ver.version} {ver.isOriginal ? '(оригинал)' : ''} {ver.uploadedBy ? `- ${ver.uploadedBy}` : ''}</SelectItem>)}</SelectContent></Select></div>
                  <div className="flex-1"><Label className="text-xs">Версия 2</Label><Select value={compareV2?.id || ''} onValueChange={v => setCompareV2(selectedDI.versions.find(ver => ver.id === v) || null)}><SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger><SelectContent>{selectedDI.versions.map(ver => <SelectItem key={ver.id} value={ver.id}>v{ver.version} {ver.isOriginal ? '(оригинал)' : ''} {ver.uploadedBy ? `- ${ver.uploadedBy}` : ''}</SelectItem>)}</SelectContent></Select></div>
                  <Button onClick={handleCompare} disabled={!compareV1 || !compareV2}>Сравнить</Button>
                </div>

                {/* Versions list */}
                <div className="space-y-1">
                  {selectedDI.versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-2"><Badge variant="secondary">v{v.version}</Badge>{v.isOriginal && <Badge variant="outline">Оригинал</Badge>}{v.uploadedBy && <span className="text-muted-foreground">{v.uploadedBy}</span>}</div>
                      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString('ru-RU')}</span><Button variant="ghost" size="sm" onClick={() => { setViewingVersion(v); setViewDialogOpen(true) }}>Просмотр</Button></div>
                    </div>
                  ))}
                </div>

                {/* Diff result */}
                {showDiff && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><h4 className="font-medium">Результат сравнения</h4><Button variant="outline" size="sm" onClick={handleAIDiff} disabled={aiLoading}>{aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />} ИИ-анализ</Button></div>
                    {aiSummary && <Card><CardContent className="p-3"><p className="text-sm whitespace-pre-wrap">{aiSummary}</p></CardContent></Card>}
                    <div className="border rounded-lg max-h-[400px] overflow-y-auto text-sm font-mono">
                      {diffLines.map((line, i) => (
                        <div key={i} className={`px-2 py-0.5 ${line.type === 'removed' ? 'bg-red-100 text-red-800' : line.type === 'added' ? 'bg-green-100 text-green-800' : line.type === 'modified' ? 'bg-yellow-100' : ''}`}>
                          {line.type === 'removed' && <span>- {line.line1}</span>}
                          {line.type === 'added' && <span>+ {line.line2}</span>}
                          {line.type === 'same' && <span className="text-muted-foreground">  {line.line1}</span>}
                          {line.type === 'modified' && <><div className="text-red-800">- {line.line1}</div><div className="text-green-800">+ {line.line2}</div></>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </> : <CardContent className="p-8 text-center text-muted-foreground"><GitCompareArrows className="h-10 w-10 mx-auto mb-2 opacity-50" /><p>Выберите ДИ для сравнения</p></CardContent>}
          </Card>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Загрузить новую версию</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ДИ *</Label><Select value={uploadForm.generatedDIId} onValueChange={v => setUploadForm(p => ({ ...p, generatedDIId: v }))}><SelectTrigger><SelectValue placeholder="Выберите ДИ" /></SelectTrigger><SelectContent>{generatedDIs.map(di => <SelectItem key={di.id} value={di.id}>{di.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Содержимое *</Label><Textarea value={uploadForm.content} onChange={e => setUploadForm(p => ({ ...p, content: e.target.value }))} className="min-h-[200px] font-mono text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Загрузил</Label><Input value={uploadForm.uploadedBy} onChange={e => setUploadForm(p => ({ ...p, uploadedBy: e.target.value }))} /></div>
              <div><Label>Имя файла</Label><Input value={uploadForm.fileName} onChange={e => setUploadForm(p => ({ ...p, fileName: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Отмена</Button><Button onClick={handleUpload} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Загрузить'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Version Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Версия {viewingVersion ? `v${viewingVersion.version}` : ''}</DialogTitle></DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">{viewingVersion ? parseContent(viewingVersion.content) : ''}</pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}
