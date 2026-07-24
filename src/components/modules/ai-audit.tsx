'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Shield, Loader2, AlertTriangle, Clock, FileWarning, Scale, CheckCircle2, History, ChevronDown, ChevronRight } from 'lucide-react'

interface GeneratedDI {
  id: string
  title: string
  positionId: string
  status: string
  currentVersion: number
  position: { id: string; title: string; department: { id: string; name: string } }
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
}

interface AuditItem {
  quote: string
  explanation: string
  recommendation: string
  conflictsWith?: string
  riskLevel?: string
  legalReference?: string
}

interface AuditResult {
  id: string
  generatedDIId: string
  auditType: string
  overallScore: number
  outdatedItems: AuditItem[]
  contradictoryItems: AuditItem[]
  riskyItems: AuditItem[]
  recommendations: { area: string; current: string; suggested: string }[]
  summary: string | null
  auditedBy: string | null
  createdAt: string
}

const auditTypeLabels: Record<string, string> = {
  full: 'Полный аудит',
  legal: 'Юридический аудит',
  consistency: 'Аудит согласованности',
}

const auditTypeDescriptions: Record<string, string> = {
  full: 'Проверка устаревших, противоречивых и рискованных пунктов',
  legal: 'Проверка соблюдения трудового законодательства РФ',
  consistency: 'Проверка внутренней логики и согласованности документа',
}

const riskLevelColors: Record<string, string> = {
  высокий: 'bg-red-100 text-red-800',
  средний: 'bg-amber-100 text-amber-800',
  низкий: 'bg-emerald-100 text-emerald-800',
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  const bgColor = score >= 80 ? 'bg-emerald-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50'
  const borderColor = score >= 80 ? 'border-emerald-200' : score >= 50 ? 'border-amber-200' : 'border-red-200'

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 ${borderColor} ${bgColor}`}>
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground mt-1">из 100</span>
    </div>
  )
}

export function AiAuditModule() {
  const { toast } = useToast()
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDIId, setSelectedDIId] = useState<string>('')

  // Audit state
  const [auditType, setAuditType] = useState<string>('full')
  const [auditing, setAuditing] = useState(false)
  const [auditProgress, setAuditProgress] = useState(0)
  const [currentAudit, setCurrentAudit] = useState<AuditResult | null>(null)

  // History
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

  // Expand/collapse sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const fetchDIs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/generated-di')
      if (!res.ok) throw new Error()
      setGeneratedDIs(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить ДИ', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchDIs() }, [fetchDIs])

  const handleAudit = async () => {
    if (!selectedDIId) {
      toast({ title: 'Ошибка', description: 'Выберите ДИ для аудита', variant: 'destructive' })
      return
    }

    setAuditing(true)
    setAuditProgress(0)
    setCurrentAudit(null)

    try {
      setAuditProgress(30)
      const res = await fetch('/api/generate-di/ai-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedDIId: selectedDIId, auditType }),
      })
      setAuditProgress(70)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка аудита')
      }

      const data = await res.json()
      setAuditProgress(100)
      setCurrentAudit(data)
      setExpandedSections({})

      toast({ title: 'Аудит завершён', description: `Оценка: ${data.overallScore}/100` })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast({ title: 'Ошибка', description: msg, variant: 'destructive' })
    } finally {
      setAuditing(false)
    }
  }

  const handleShowHistory = async () => {
    if (!selectedDIId) return
    setHistoryLoading(true)
    setHistoryDialogOpen(true)
    try {
      const res = await fetch(`/api/generate-di/ai-audit?generatedDIId=${selectedDIId}`)
      if (!res.ok) throw new Error()
      setAuditHistory(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить историю', variant: 'destructive' })
    } finally {
      setHistoryLoading(false)
    }
  }

  const selectedDI = generatedDIs.find(d => d.id === selectedDIId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> AI-аудит ДИ
          </h1>
          <p className="text-sm text-muted-foreground">
            Поиск устаревших, противоречивых и юридически рискованных пунктов
          </p>
        </div>
      </div>

      {/* Selection panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Выбор ДИ и тип аудита</CardTitle>
          <CardDescription>Выберите должностную инструкцию для анализа</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Должностная инструкция</p>
              <Select value={selectedDIId} onValueChange={setSelectedDIId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите ДИ" />
                </SelectTrigger>
                <SelectContent>
                  {generatedDIs.map(di => (
                    <SelectItem key={di.id} value={di.id}>
                      {di.title} — {di.position?.title || '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Тип аудита</p>
              <Select value={auditType} onValueChange={setAuditType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Полный аудит</SelectItem>
                  <SelectItem value="legal">Юридический аудит</SelectItem>
                  <SelectItem value="consistency">Аудит согласованности</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Button disabled={auditing || !selectedDIId} onClick={handleAudit}>
                {auditing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                {auditing ? 'Аудит...' : 'Запустить аудит'}
              </Button>
              {selectedDIId && (
                <Button variant="outline" size="sm" onClick={handleShowHistory} disabled={historyLoading}>
                  <History className="h-3.5 w-3.5 mr-1.5" /> История аудитов
                </Button>
              )}
            </div>
          </div>

          {selectedDI && (
            <div className="p-3 bg-muted rounded-lg flex items-center gap-3 text-sm">
              <FileWarning className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedDI.title}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground">{selectedDI.position?.title}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground">v{selectedDI.currentVersion}</span>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="secondary">{selectedDI.sections.length} секций</Badge>
            </div>
          )}

          {auditing && (
            <div className="space-y-2">
              <Progress value={auditProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">AI анализирует содержание должностной инструкции...</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {auditTypeDescriptions[auditType]}
          </p>
        </CardContent>
      </Card>

      {/* Audit Results */}
      {currentAudit && (
        <div className="space-y-4">
          {/* Score */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Результаты аудита
                </CardTitle>
                <Badge variant="secondary">{auditTypeLabels[currentAudit.auditType]}</Badge>
              </div>
              <CardDescription>{new Date(currentAudit.createdAt).toLocaleString('ru-RU')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <ScoreCircle score={currentAudit.overallScore} />
                {currentAudit.summary && (
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{currentAudit.summary}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Findings Tabs */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="risky">
                <TabsList className="w-full justify-start px-4 pt-4">
                  <TabsTrigger value="risky" className="gap-1.5">
                    <Scale className="h-3.5 w-3.5" /> Риски ({currentAudit.riskyItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="outdated" className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Устаревшие ({currentAudit.outdatedItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="contradictory" className="gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Противоречия ({currentAudit.contradictoryItems.length})
                  </TabsTrigger>
                  <TabsTrigger value="recommendations" className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Рекомендации ({currentAudit.recommendations.length})
                  </TabsTrigger>
                </TabsList>

                {/* Risky items */}
                <TabsContent value="risky" className="p-4 space-y-3">
                  {currentAudit.riskyItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Юридических рисков не обнаружено ✓</p>
                  ) : (
                    currentAudit.riskyItems.map((item, i) => (
                      <Alert key={i} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          Риск #{i + 1}
                          {item.riskLevel && (
                            <Badge className={`text-xs ${riskLevelColors[item.riskLevel] || ''}`}>
                              {item.riskLevel}
                            </Badge>
                          )}
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          {item.legalReference && (
                            <p className="text-xs text-muted-foreground">
                              <Scale className="h-3 w-3 inline mr-1" />
                              {item.legalReference}
                            </p>
                          )}
                          <p className="text-sm">{item.explanation}</p>
                          <p className="text-sm text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                            Рекомендация: {item.recommendation}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* Outdated items */}
                <TabsContent value="outdated" className="p-4 space-y-3">
                  {currentAudit.outdatedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Устаревших пунктов не обнаружено ✓</p>
                  ) : (
                    currentAudit.outdatedItems.map((item, i) => (
                      <Alert key={i}>
                        <Clock className="h-4 w-4" />
                        <AlertTitle>Устаревший пункт #{i + 1}</AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          <p className="text-sm">{item.explanation}</p>
                          <p className="text-sm text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                            Рекомендация: {item.recommendation}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* Contradictory items */}
                <TabsContent value="contradictory" className="p-4 space-y-3">
                  {currentAudit.contradictoryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Противоречий не обнаружено ✓</p>
                  ) : (
                    currentAudit.contradictoryItems.map((item, i) => (
                      <Alert key={i} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Проторечие #{i + 1}</AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          {item.conflictsWith && (
                            <p className="text-xs text-muted-foreground">
                              Противоречит: «{item.conflictsWith}»
                            </p>
                          )}
                          <p className="text-sm">{item.explanation}</p>
                          <p className="text-sm text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                            Рекомендация: {item.recommendation}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* Recommendations */}
                <TabsContent value="recommendations" className="p-4 space-y-3">
                  {currentAudit.recommendations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Дополнительных рекомендаций нет ✓</p>
                  ) : (
                    currentAudit.recommendations.map((rec, i) => (
                      <Card key={i} className="border-l-4 border-l-emerald-400">
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium">{rec.area}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="p-2 bg-red-50 rounded">
                              <p className="text-xs text-muted-foreground mb-0.5">Текущее:</p>
                              <p>{rec.current}</p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded">
                              <p className="text-xs text-muted-foreground mb-0.5">Предлагаемое:</p>
                              <p>{rec.suggested}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {!currentAudit && !auditing && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Выберите ДИ и нажмите «Запустить аудит»</p>
            <p className="text-xs text-muted-foreground mt-2">
              AI найдёт устаревшие, противоречивые и юридически рискованные пункты
            </p>
          </CardContent>
        </Card>
      )}

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История аудитов</DialogTitle>
            <DialogDescription>Ранее выполненные аудиты данной ДИ</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : auditHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Нет результатов аудита</p>
          ) : (
            <div className="space-y-3">
              {auditHistory.map(audit => (
                <Card key={audit.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setCurrentAudit(audit); setHistoryDialogOpen(false) }}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ScoreCircle score={audit.overallScore} />
                        <div>
                          <p className="text-sm font-medium">{auditTypeLabels[audit.auditType]}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(audit.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{audit.auditType}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Риски: {audit.riskyItems.length}</span>
                      <span>Устаревших: {audit.outdatedItems.length}</span>
                      <span>Противоречий: {audit.contradictoryItems.length}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
