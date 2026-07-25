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
import { CascadePositionSelector } from './cascade-position-selector'
import {
  Shield, Loader2, AlertTriangle, Clock, FileWarning, Scale, CheckCircle2, History,
  Copy, MessageSquareWarning, Gavel, Target, ListChecks,
} from 'lucide-react'

// ─── Data types ────────────────────────────────────────────

interface GeneratedDI {
  id: string
  title: string
  positionId: string
  status: string
  currentVersion: number
  position: { id: string; title: string; department: { id: string; name: string } }
  sections: { id: string; sectionTitle: string; sectionContent: string; order: number }[]
}

interface DuplicatedTkItem {
  quote: string
  tkArticle: string
  tkText: string
  explanation: string
  recommendation: string
}

interface VagueFormulationItem {
  quote: string
  problemType: string
  riskExplanation: string
  specificAlternative: string
}

interface LegislativeConflictItem {
  quote: string
  violatedLaw: string
  violationType: string
  riskLevel: string
  explanation: string
  correctFormulation: string
}

interface UnrealisticRequirementItem {
  quote: string
  requirementType: string
  currentValue: string
  realisticAlternative: string
  explanation: string
}

interface IncompleteSectionItem {
  missingSection: string
  requiredContent: string
  currentState: string
  impactExplanation: string
  suggestedContent: string
}

interface AuditResult {
  id: string
  generatedDIId: string
  auditType: string
  overallScore: number
  categoryScores: {
    duplicatedTk: number
    vagueFormulations: number
    legislativeConflicts: number
    unrealisticRequirements: number
    incompleteSections: number
  }
  duplicatedTkItems: DuplicatedTkItem[]
  vagueFormulationItems: VagueFormulationItem[]
  legislativeConflictItems: LegislativeConflictItem[]
  unrealisticRequirementItems: UnrealisticRequirementItem[]
  incompleteSectionItems: IncompleteSectionItem[]
  // Legacy
  outdatedItems: unknown[]
  contradictoryItems: unknown[]
  riskyItems: unknown[]
  recommendations: { area: string; priority: string; current: string; suggested: string }[]
  summary: string | null
  auditedBy: string | null
  createdAt: string
}

// ─── Constants ─────────────────────────────────────────────

const auditTypeLabels: Record<string, string> = {
  full: 'Полный аудит',
  legal: 'Юридический аудит',
  consistency: 'Аудит согласованности',
}

const auditTypeDescriptions: Record<string, string> = {
  full: 'Проверка всех 5 классов ошибок: дублирование ТК, расплывчатые формулировки, противоречия закону, завышенные требования, неполнота разделов',
  legal: 'Фокус на дублировании норм ТК РФ, противоречиях законодательству и неполноте обязательных разделов',
  consistency: 'Фокус на расплывчатых формулировках и завышенных/нереалистичных требованиях',
}

const riskLevelColors: Record<string, string> = {
  высокий: 'bg-red-100 text-red-800 border-red-200',
  средний: 'bg-amber-100 text-amber-800 border-amber-200',
  низкий: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

const priorityColors: Record<string, string> = {
  высокий: 'bg-red-100 text-red-800',
  средний: 'bg-amber-100 text-amber-800',
  низкий: 'bg-emerald-100 text-emerald-800',
}

const currentStateColors: Record<string, string> = {
  'отсутствует полностью': 'bg-red-100 text-red-800 border-red-200',
  'заголовок без содержания': 'bg-amber-100 text-amber-800 border-amber-200',
  'содержание недостаточно': 'bg-orange-100 text-orange-800 border-orange-200',
}

const problemTypeLabels: Record<string, string> = {
  'абстрактная обязанность': 'Абстрактная обязанность',
  'открытый перечень': 'Открытый перечень',
  'неопределённый результат': 'Неопределённый результат',
  'неясный критерий': 'Неясный критерий',
}

const violationTypeLabels: Record<string, string> = {
  'незаконный штраф': 'Незаконный штраф',
  'ограничение прав': 'Ограничение прав',
  'незаконное условие': 'Незаконное условие',
  'неправомерное требование': 'Неправомерное требование',
}

const requirementTypeLabels: Record<string, string> = {
  'недостижимый KPI': 'Недостижимый KPI',
  'квалификация вне грейда': 'Квалификация вне грейда',
  'невыполнимый срок': 'Невыполнимый срок',
  'несоразмерное требование': 'Несоразмерное требование',
}

// Category config for the 5 tabs
const categoryConfig = [
  { key: 'duplicatedTk', label: 'Дублирование ТК', icon: Copy, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Нормы ТК, которые дублируются в ДИ и действуют автоматически' },
  { key: 'vagueFormulations', label: 'Расплывчатые формулировки', icon: MessageSquareWarning, color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'Обязанности без конкретных результатов — риск трудовых споров' },
  { key: 'legislativeConflicts', label: 'Противоречия закону', icon: Gavel, color: 'text-red-600', bgColor: 'bg-red-100', description: 'Пункты, нарушающие ТК РФ и иные нормативные акты' },
  { key: 'unrealisticRequirements', label: 'Завышенные требования', icon: Target, color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'Нереалистичные KPI, квалификация вне грейда, невыполнимые сроки' },
  { key: 'incompleteSections', label: 'Неполнота разделов', icon: ListChecks, color: 'text-teal-600', bgColor: 'bg-teal-100', description: 'Отсутствие обязательных разделов ДИ' },
] as const

// ─── Score helpers ─────────────────────────────────────────

function scoreColor(score: number) {
  return score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
}
function scoreBgColor(score: number) {
  return score >= 80 ? 'bg-emerald-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50'
}
function scoreBorderColor(score: number) {
  return score >= 80 ? 'border-emerald-200' : score >= 50 ? 'border-amber-200' : 'border-red-200'
}

function MiniScore({ label, score, icon, color, bgColor }: { label: string; score: number; icon: React.ElementType; color: string; bgColor: string }) {
  const Icon = icon
  const sColor = scoreColor(score)
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${scoreBgColor(score)} ${scoreBorderColor(score)} border`}>
      <div className={`flex items-center justify-center rounded-md p-1.5 ${bgColor}`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
      </div>
      <span className={`text-sm font-bold ${sColor}`}>{score}</span>
    </div>
  )
}

function ScoreCircle({ score }: { score: number }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 ${scoreBorderColor(score)} ${scoreBgColor(score)}`}>
      <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
      <span className="text-xs text-muted-foreground mt-1">из 100</span>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────

export function AiAuditModule() {
  const { toast } = useToast()
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDI[]>([])
  // Единый каскадный фильтр «компания → подразделение → должность» для выбора ДИ.
  const [filterPositionId, setFilterPositionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedDIId, setSelectedDIId] = useState<string>('')

  // Audit state
  const [auditType, setAuditType] = useState<string>('full')
  // Отфильтрованный список ДИ: если выбрана должность — показываем только её ДИ.
  const filteredDIs = filterPositionId
    ? generatedDIs.filter(d => d.positionId === filterPositionId)
    : generatedDIs
  const [auditing, setAuditing] = useState(false)
  const [auditProgress, setAuditProgress] = useState(0)
  const [currentAudit, setCurrentAudit] = useState<AuditResult | null>(null)

  // History
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)

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

  // Helper to get category items count
  const getCategoryCount = (key: string) => {
    if (!currentAudit) return 0
    const map: Record<string, number> = {
      duplicatedTk: currentAudit.duplicatedTkItems?.length || 0,
      vagueFormulations: currentAudit.vagueFormulationItems?.length || 0,
      legislativeConflicts: currentAudit.legislativeConflictItems?.length || 0,
      unrealisticRequirements: currentAudit.unrealisticRequirementItems?.length || 0,
      incompleteSections: currentAudit.incompleteSectionItems?.length || 0,
    }
    return map[key] || 0
  }

  const totalFindings = currentAudit
    ? (currentAudit.duplicatedTkItems?.length || 0) +
      (currentAudit.vagueFormulationItems?.length || 0) +
      (currentAudit.legislativeConflictItems?.length || 0) +
      (currentAudit.unrealisticRequirementItems?.length || 0) +
      (currentAudit.incompleteSectionItems?.length || 0)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> AI-аудит ДИ
          </h1>
          <p className="text-sm text-muted-foreground">
            Правовое ядро: 5 классов ошибок в 80% инструкций
          </p>
        </div>
      </div>

      {/* ─── 5 classes overview banner ─── */}
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">Что проверяет модуль (правовое ядро)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {categoryConfig.map((cat) => (
              <div key={cat.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className={`flex items-center justify-center rounded-md p-1.5 ${cat.bgColor}`}>
                  <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                </div>
                <span className="text-xs font-medium">{cat.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Selection panel ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Выбор ДИ и тип аудита</CardTitle>
          <CardDescription>Выберите должностную инструкцию для анализа</CardDescription>
        </CardHeader>
       <CardContent className="space-y-4">
          <div className="pb-3 border-b">
            <CascadePositionSelector positionId={filterPositionId} onPositionChange={(id) => { setFilterPositionId(id); setSelectedDIId('') }} />
          </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
           <div>
             <p className="text-xs font-medium text-muted-foreground mb-1.5">Должностная инструкция</p>
             <Select value={selectedDIId} onValueChange={setSelectedDIId}>
               <SelectTrigger>
                 <SelectValue placeholder="Выберите ДИ" />
               </SelectTrigger>
               <SelectContent>
                  {filteredDIs.map(di => (
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
                  <SelectItem value="full">Полный аудит (все 5 классов)</SelectItem>
                  <SelectItem value="legal">Юридический аудит (ТК + закон + разделы)</SelectItem>
                  <SelectItem value="consistency">Аудит согласованности (формулировки + требования)</SelectItem>
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
              <p className="text-xs text-muted-foreground">
                AI анализирует 5 классов ошибок: дублирование ТК, расплывчатые формулировки, противоречия закону, завышенные требования, неполнота разделов...
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {auditTypeDescriptions[auditType]}
          </p>
        </CardContent>
      </Card>

      {/* ─── Audit Results ─── */}
      {currentAudit && (
        <div className="space-y-4">
          {/* Overall Score + Category Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Результаты аудита
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{auditTypeLabels[currentAudit.auditType]}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {totalFindings} найденных проблем
                  </Badge>
                </div>
              </div>
              <CardDescription>{new Date(currentAudit.createdAt).toLocaleString('ru-RU')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Overall score + summary */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <ScoreCircle score={currentAudit.overallScore} />
                  <div className="flex-1">
                    {currentAudit.summary && (
                      <p className="text-sm leading-relaxed">{currentAudit.summary}</p>
                    )}
                  </div>
                </div>

                {/* Category mini-scores */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {categoryConfig.map((cat) => {
                    const score = currentAudit.categoryScores?.[cat.key] ?? 50
                    const count = getCategoryCount(cat.key)
                    return (
                      <MiniScore
                        key={cat.key}
                        label={cat.label}
                        score={score}
                        icon={cat.icon}
                        color={cat.color}
                        bgColor={cat.bgColor}
                      />
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ─── Findings Tabs (5 categories) ─── */}
          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="legislativeConflicts">
                <TabsList className="w-full justify-start px-4 pt-4 overflow-x-auto flex-wrap h-auto gap-1">
                  {categoryConfig.map((cat) => (
                    <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 text-xs">
                      <cat.icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      {cat.label} ({getCategoryCount(cat.key)})
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="recommendations" className="gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Рекомендации ({currentAudit.recommendations?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {/* ─── Tab: Дублирование ТК ─── */}
                <TabsContent value="duplicatedTk" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.duplicatedTkItems || currentAudit.duplicatedTkItems.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <Copy className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Дублирование норм ТК РФ не обнаружено ✓</p>
                      <p className="text-xs">Все обязанности — специфичные для должности, не копируют базовые нормы</p>
                    </div>
                  ) : (
                    currentAudit.duplicatedTkItems.map((item, i) => (
                      <Alert key={i}>
                        <Copy className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          Дублирование #{i + 1}
                          <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                            {item.tkArticle}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          <div className="p-2 bg-blue-50 rounded text-xs border border-blue-100">
                            <p className="font-medium text-blue-800 mb-1">Норма ТК РФ, которая дублируется:</p>
                            <p>{item.tkText}</p>
                          </div>
                          <p className="text-sm">{item.explanation}</p>
                          <div className="p-2 bg-emerald-50 rounded text-sm border border-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-emerald-600" />
                            <span className="text-emerald-700">{item.recommendation}</span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* ─── Tab: Расплывчатые формулировки ─── */}
                <TabsContent value="vagueFormulations" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.vagueFormulationItems || currentAudit.vagueFormulationItems.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <MessageSquareWarning className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Расплывчатых формулировок не обнаружено ✓</p>
                      <p className="text-xs">Все обязанности конкретны и измеримы</p>
                    </div>
                  ) : (
                    currentAudit.vagueFormulationItems.map((item, i) => (
                      <Alert key={i} variant="destructive">
                        <MessageSquareWarning className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          Расплывчатая формулировка #{i + 1}
                          <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                            {problemTypeLabels[item.problemType] || item.problemType}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          <div className="p-2 bg-orange-50 rounded text-xs border border-orange-100">
                            <p className="font-medium text-orange-800 mb-1">Риск трудового спора:</p>
                            <p>{item.riskExplanation}</p>
                          </div>
                          <div className="p-2 bg-emerald-50 rounded text-sm border border-emerald-100">
                            <p className="text-xs font-medium text-emerald-800 mb-1">Конкретная альтернатива:</p>
                            <p className="text-emerald-700">{item.specificAlternative}</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* ─── Tab: Противоречия законодательству ─── */}
                <TabsContent value="legislativeConflicts" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.legislativeConflictItems || currentAudit.legislativeConflictItems.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <Gavel className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Противоречий законодательству не обнаружено ✓</p>
                      <p className="text-xs">Все пункты соответствуют ТК РФ и нормативным актам</p>
                    </div>
                  ) : (
                    currentAudit.legislativeConflictItems.map((item, i) => (
                      <Alert key={i} variant="destructive">
                        <Gavel className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2 flex-wrap">
                          Нарушение #{i + 1}
                          <Badge className={`text-xs ${riskLevelColors[item.riskLevel] || 'bg-gray-100 text-gray-800'}`}>
                            {item.riskLevel} риск
                          </Badge>
                          <Badge className="text-xs bg-red-100 text-red-800 border-red-200">
                            {violationTypeLabels[item.violationType] || item.violationType}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          <div className="p-2 bg-red-50 rounded text-xs border border-red-100">
                            <p className="font-medium text-red-800 mb-1">Нарушенная норма:</p>
                            <p><Scale className="h-3 w-3 inline mr-1" />{item.violatedLaw}</p>
                          </div>
                          <p className="text-sm">{item.explanation}</p>
                          <div className="p-2 bg-emerald-50 rounded text-sm border border-emerald-100">
                            <p className="text-xs font-medium text-emerald-800 mb-1">Правильная формулировка по закону:</p>
                            <p className="text-emerald-700">{item.correctFormulation}</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* ─── Tab: Завышенные требования ─── */}
                <TabsContent value="unrealisticRequirements" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.unrealisticRequirementItems || currentAudit.unrealisticRequirementItems.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <Target className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Завышенных/нереалистичных требований не обнаружено ✓</p>
                      <p className="text-xs">Все требования соразмерны должности и грейду</p>
                    </div>
                  ) : (
                    currentAudit.unrealisticRequirementItems.map((item, i) => (
                      <Alert key={i}>
                        <Target className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          Завышенное требование #{i + 1}
                          <Badge className="text-xs bg-purple-100 text-purple-800 border-purple-200">
                            {requirementTypeLabels[item.requirementType] || item.requirementType}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-muted rounded text-sm font-mono">«{item.quote}»</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="p-2 bg-purple-50 rounded text-xs border border-purple-100">
                              <p className="font-medium text-purple-800 mb-1">Текущее значение:</p>
                              <p>{item.currentValue}</p>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded text-xs border border-emerald-100">
                              <p className="font-medium text-emerald-800 mb-1">Реалистичная альтернатива:</p>
                              <p>{item.realisticAlternative}</p>
                            </div>
                          </div>
                          <p className="text-sm">{item.explanation}</p>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* ─── Tab: Неполнота разделов ─── */}
                <TabsContent value="incompleteSections" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.incompleteSectionItems || currentAudit.incompleteSectionItems.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <ListChecks className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Все обязательные разделы присутствуют ✓</p>
                      <p className="text-xs">Общие положения, обязанности, права, ответственность, квалификация — заполнены</p>
                    </div>
                  ) : (
                    currentAudit.incompleteSectionItems.map((item, i) => (
                      <Alert key={i}>
                        <ListChecks className="h-4 w-4" />
                        <AlertTitle className="flex items-center gap-2">
                          {item.missingSection}
                          <Badge className={`text-xs ${currentStateColors[item.currentState] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                            {item.currentState}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="space-y-2 mt-2">
                          <div className="p-2 bg-teal-50 rounded text-xs border border-teal-100">
                            <p className="font-medium text-teal-800 mb-1">Что должно содержаться:</p>
                            <p>{item.requiredContent}</p>
                          </div>
                          <p className="text-sm">{item.impactExplanation}</p>
                          <div className="p-2 bg-emerald-50 rounded text-sm border border-emerald-100">
                            <p className="text-xs font-medium text-emerald-800 mb-1">Предлагаемое содержание:</p>
                            <p className="text-emerald-700">{item.suggestedContent}</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  )}
                </TabsContent>

                {/* ─── Tab: Рекомендации ─── */}
                <TabsContent value="recommendations" className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {(!currentAudit.recommendations || currentAudit.recommendations.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Дополнительных рекомендаций нет ✓</p>
                    </div>
                  ) : (
                    currentAudit.recommendations.map((rec, i) => (
                      <Card key={i} className="border-l-4 border-l-emerald-400">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{rec.area}</p>
                            {rec.priority && (
                              <Badge className={`text-xs ${priorityColors[rec.priority] || ''}`}>
                                {rec.priority}
                              </Badge>
                            )}
                          </div>
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

      {/* ─── Empty state ─── */}
      {!currentAudit && !auditing && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Выберите ДИ и нажмите «Запустить аудит»</p>
            <p className="text-xs text-muted-foreground mt-2">
              AI проверит 5 классов ошибок: дублирование ТК, расплывчатые формулировки, противоречия закону, завышенные требования, неполнота разделов
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── History Dialog ─── */}
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
                      <span>ТК дублирование: {audit.duplicatedTkItems?.length || 0}</span>
                      <span>Расплывчатые: {audit.vagueFormulationItems?.length || 0}</span>
                      <span>Противоречия: {audit.legislativeConflictItems?.length || 0}</span>
                      <span>Завышенные: {audit.unrealisticRequirementItems?.length || 0}</span>
                      <span>Неполнота: {audit.incompleteSectionItems?.length || 0}</span>
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
