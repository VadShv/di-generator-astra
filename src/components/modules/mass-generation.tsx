'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Zap, Loader2, CheckCircle2, XCircle, Building2, Users, FileText, Layers, Landmark, ChevronRight } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ShieldAlert, Trash2 } from 'lucide-react'

interface Company { id: string; name: string; shortName: string | null; code: string; _count: { departments: number } }
interface Department { id: string; name: string; code: string; companyId: string | null; company: Company | null; _count: { positions: number } }
interface Template { id: string; name: string; description: string | null; isPrimary: boolean }
interface Position {
  id: string; title: string; code: string; departmentId: string; grade: string | null; headcount: number
  department: { id: string; name: string; company: { id: string; name: string } | null } | null
  generatedDIs: { id: string; status: string }[]
  archiveDIs: { id: string }[]
}

interface MassGenerateResult {
  positionId: string
  positionTitle: string
  diId: string
  title: string
  success: boolean
  error?: string
}

// Статус ДИ по должности (для индикации в блоке выбора должностей)
function getPositionDiStatus(p: Position) {
  const approved = p.generatedDIs.some(d => d.status === 'approved')
  const hasGenerated = p.generatedDIs.length > 0
  const hasArchive = p.archiveDIs.length > 0
  if (approved) return { label: 'Утверждена', color: 'bg-emerald-500', textColor: 'text-emerald-700' }
  if (hasGenerated) return { label: 'Сгенерирована', color: 'bg-amber-500', textColor: 'text-amber-700' }
  if (hasArchive) return { label: 'Архивная', color: 'bg-slate-400', textColor: 'text-slate-600' }
  return { label: 'Нет ДИ', color: 'bg-red-400', textColor: 'text-red-600' }
}

export function MassGenerationModule() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Selection state — 3 последовательных блока выбора
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<MassGenerateResult[] | null>(null)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Пакетные операции над результатами генерации
  const [batchAuditLoading, setBatchAuditLoading] = useState(false)
  const [batchAuditOpen, setBatchAuditOpen] = useState(false)
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [companiesRes, departmentsRes, positionsRes, templatesRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/departments'),
        fetch('/api/positions'),
        fetch('/api/templates'),
      ])
      setCompanies(await companiesRes.json())
      setDepartments(await departmentsRes.json())
      setPositions(await positionsRes.json())
      const templatesData = await templatesRes.json()
      setTemplates(templatesData)
      // Auto-select primary template
      const primary = templatesData.find((t: Template) => t.isPrimary)
      if (primary) setSelectedTemplateId(primary.id)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить данные', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Каскадная фильтрация: компания → подразделение → должность ──

  // Подразделения, относящиеся к выбранным компаниям
  const filteredDepartments = selectedCompanyIds.length > 0
    ? departments.filter(d => selectedCompanyIds.includes(d.companyId || ''))
    : []

  // Должности, относящиеся к выбранным подразделениям
  const filteredPositions = selectedDepartmentIds.length > 0
    ? positions.filter(p => selectedDepartmentIds.includes(p.departmentId))
    : []

  // Итоговый список должностей для генерации:
  // если выбраны конкретные должности — они, иначе все должности выбранных подразделений
  const affectedPositions = selectedPositionIds.length > 0
    ? selectedPositionIds.length
    : filteredPositions.length

  // ── Обработчики выбора ──

  const toggleCompanyId = (id: string) => {
    setSelectedCompanyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    // Сброс дочерних выборов при изменении компаний
    setSelectedDepartmentIds([])
    setSelectedPositionIds([])
  }

  const toggleDepartmentId = (id: string) => {
    setSelectedDepartmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    // Сброс выбора должностей при изменении подразделений
    setSelectedPositionIds([])
  }

  const togglePositionId = (id: string) => {
    setSelectedPositionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllCompanies = () => setSelectedCompanyIds(companies.map(c => c.id))
  const clearCompanySelection = () => { setSelectedCompanyIds([]); setSelectedDepartmentIds([]); setSelectedPositionIds([]) }

  const selectAllDepartments = () => setSelectedDepartmentIds(filteredDepartments.map(d => d.id))
  const clearDepartmentSelection = () => { setSelectedDepartmentIds([]); setSelectedPositionIds([]) }

  const selectAllPositions = () => setSelectedPositionIds(filteredPositions.map(p => p.id))
  const clearPositionSelection = () => setSelectedPositionIds([])

  const handleMassGenerate = async () => {
    if (!selectedTemplateId) {
      toast({ title: 'Ошибка', description: 'Выберите шаблон ДИ', variant: 'destructive' })
      return
    }
    if (affectedPositions === 0) {
      toast({ title: 'Ошибка', description: 'Нет должностей для генерации', variant: 'destructive' })
      return
    }

    setGenerating(true)
    setProgress(0)
    setResults(null)

    const stopPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }

    try {
      const res = await fetch('/api/generate-di/mass-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionIds: selectedPositionIds.length > 0 ? selectedPositionIds : undefined,
          departmentIds: selectedPositionIds.length === 0 && selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined,
          companyIds: selectedPositionIds.length === 0 && selectedDepartmentIds.length === 0 && selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
          templateId: selectedTemplateId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка массовой генерации')
      }

      const { jobId } = await res.json()
      if (!jobId) throw new Error('Сервер не вернул jobId')

      const pollDeadline = Date.now() + 10 * 60 * 1000
      let finalResults: MassGenerateResult[] = []

      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          if (Date.now() > pollDeadline) {
            stopPolling()
            reject(new Error('Превышен таймаут ожидания генерации (10 мин)'))
            return
          }
          try {
            const statusRes = await fetch(`/api/generate-di/mass-generate?jobId=${jobId}`)
            if (!statusRes.ok) {
              stopPolling()
              reject(new Error('Ошибка получения статуса задачи'))
              return
            }
            const job = await statusRes.json()
            if (job.total > 0) {
              setProgress(Math.round((job.completed / job.total) * 100))
            }
            if (job.status === 'completed' || job.status === 'failed') {
              stopPolling()
              const mapped: MassGenerateResult[] = (job.results || []).map((r: { positionId: string; positionTitle: string; diId: string; title: string; status: string; message?: string }) => ({
                positionId: r.positionId,
                positionTitle: r.positionTitle,
                diId: r.diId,
                title: r.title,
                success: r.status === 'success',
                error: r.message,
              }))
              finalResults = mapped
              setResults(mapped)
              setProgress(100)
              resolve()
            }
          } catch {
            // Сетевая ошибка опроса — продолжаем пытаться до таймаута
          }
        }
        poll()
        pollingRef.current = setInterval(poll, 2000)
      })

      const successCount = finalResults.filter(r => r.success).length
      const failCount = finalResults.filter(r => !r.success).length
      toast({
        title: 'Генерация завершена',
        description: `Создано ${successCount} ДИ. Ошибок: ${failCount}`,
      })
      setResultDialogOpen(true)
    } catch (error) {
      stopPolling()
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast({ title: 'Ошибка', description: msg, variant: 'destructive' })
    } finally {
      stopPolling()
      setGenerating(false)
    }
  }

  // Очистка опроса при размонтировании
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // Список ID успешно созданных ДИ для пакетных операций
  const successDiIds = results
    ? results.filter(r => r.success && r.diId).map(r => r.diId)
    : []

  const handleBatchAudit = async () => {
    if (successDiIds.length === 0) {
      toast({ title: 'Нет ДИ для аудита', variant: 'destructive' })
      return
    }
    setBatchAuditLoading(true)
    try {
      const res = await fetch('/api/generate-di/batch-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diIds: successDiIds }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка пакетного аудита')
      }
      toast({
        title: 'Аудит завершён',
        description: `Проверено ${data.successCount} из ${data.total}. Ошибок: ${data.failCount}`,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast({ title: 'Ошибка аудита', description: msg, variant: 'destructive' })
    } finally {
      setBatchAuditLoading(false)
      setBatchAuditOpen(false)
    }
  }

  const handleBatchDelete = async () => {
    if (successDiIds.length === 0) {
      toast({ title: 'Нет ДИ для удаления', variant: 'destructive' })
      return
    }
    setBatchDeleteLoading(true)
    try {
      const res = await fetch('/api/generate-di/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diIds: successDiIds, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка пакетного удаления')
      }
      toast({
        title: 'Удаление завершено',
        description: `Удалено ${data.successCount} из ${data.total}. Ошибок: ${data.failCount}`,
      })
      setResults(null)
      setResultDialogOpen(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast({ title: 'Ошибка удаления', description: msg, variant: 'destructive' })
    } finally {
      setBatchDeleteLoading(false)
      setBatchDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" /> Массовая генерация
          </h1>
          <p className="text-sm text-muted-foreground">
            Генерация ДИ для всего штата выбранных подразделений или компаний
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Колонка 1: каскадный выбор (3 последовательных блока) ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Блок 1: Организации */}
            <Card className={selectedCompanyIds.length === 0 ? 'ring-2 ring-primary/30' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${selectedCompanyIds.length > 0 ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'}`}>1</span>
                      <Landmark className="h-4 w-4" /> Организации
                    </CardTitle>
                    <CardDescription>Выберите компании — откроется выбор подразделений</CardDescription>
                  </div>
                  {selectedCompanyIds.length > 0 && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Выбрано: {selectedCompanyIds.length}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={selectAllCompanies}>Выбрать все</Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={clearCompanySelection} disabled={selectedCompanyIds.length === 0}>Очистить</Button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {companies.map(c => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedCompanyIds.includes(c.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleCompanyId(c.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          selectedCompanyIds.includes(c.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {selectedCompanyIds.includes(c.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm truncate">{c.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{c._count.departments} подр.</Badge>
                    </div>
                  ))}
                  {companies.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет компаний</p>}
                </div>
              </CardContent>
            </Card>

            {/* Блок 2: Подразделения — активен только после выбора компаний */}
            <Card className={selectedCompanyIds.length === 0 ? 'opacity-50' : (selectedDepartmentIds.length === 0 ? 'ring-2 ring-primary/30' : '')}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${selectedDepartmentIds.length > 0 ? 'bg-emerald-500 text-white' : selectedCompanyIds.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                      <Building2 className="h-4 w-4" /> Подразделения
                    </CardTitle>
                    <CardDescription>
                      {selectedCompanyIds.length === 0
                        ? 'Сначала выберите организации в блоке 1'
                        : 'Выберите подразделения — откроется выбор должностей'}
                    </CardDescription>
                  </div>
                  {selectedDepartmentIds.length > 0 && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Выбрано: {selectedDepartmentIds.length}</Badge>
                  )}
                </div>
              </CardHeader>
              {selectedCompanyIds.length > 0 && (
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={selectAllDepartments}>Выбрать все</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={clearDepartmentSelection} disabled={selectedDepartmentIds.length === 0}>Очистить</Button>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {filteredDepartments.map(d => (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedDepartmentIds.includes(d.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleDepartmentId(d.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            selectedDepartmentIds.includes(d.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selectedDepartmentIds.includes(d.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className="text-sm truncate">{d.name}</span>
                          {d.company && <span className="text-xs text-muted-foreground truncate">· {d.company.name}</span>}
                        </div>
                        <Badge variant="secondary" className="text-xs">{d._count.positions} должн.</Badge>
                      </div>
                    ))}
                    {filteredDepartments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет подразделений</p>}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Блок 3: Должности — активен только после выбора подразделений */}
            <Card className={selectedDepartmentIds.length === 0 ? 'opacity-50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${selectedPositionIds.length > 0 ? 'bg-emerald-500 text-white' : selectedDepartmentIds.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                      <Users className="h-4 w-4" /> Должности
                    </CardTitle>
                    <CardDescription>
                      {selectedDepartmentIds.length === 0
                        ? 'Сначала выберите подразделения в блоке 2'
                        : 'Выберите конкретные должности или оставьте пустым — обработаются все должности выбранных подразделений'}
                    </CardDescription>
                  </div>
                  {selectedDepartmentIds.length > 0 && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                      {selectedPositionIds.length > 0 ? `Выбрано: ${selectedPositionIds.length}` : `Все: ${filteredPositions.length}`}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {selectedDepartmentIds.length > 0 && (
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={selectAllPositions}>Выбрать все</Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={clearPositionSelection} disabled={selectedPositionIds.length === 0}>Очистить</Button>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {filteredPositions.map(p => {
                      const st = getPositionDiStatus(p)
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedPositionIds.includes(p.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          }`}
                          onClick={() => togglePositionId(p.id)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedPositionIds.includes(p.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                            }`}>
                              {selectedPositionIds.includes(p.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <span className={`flex items-center justify-center h-5 w-5 rounded ${st.color} text-white flex-shrink-0`}><FileText className="h-3 w-3" /></span>
                            <span className="text-sm truncate">{p.title}</span>
                            {p.department && <span className="text-xs text-muted-foreground truncate">· {p.department.name}</span>}
                          </div>
                          <Badge variant="outline" className={`text-xs ${st.textColor}`}>{st.label}</Badge>
                        </div>
                      )
                    })}
                    {filteredPositions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет должностей</p>}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ── Колонка 2: шаблон + генерация ── */}
          <div className="space-y-4">
            {/* Шаблон ДИ */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Шаблон ДИ
                </CardTitle>
                <CardDescription>Выберите шаблон для генерации</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите шаблон" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.isPrimary ? '(основной)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Template details */}
                {selectedTemplateId && templates.find(t => t.id === selectedTemplateId) && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{templates.find(t => t.id === selectedTemplateId)?.name}</p>
                    {templates.find(t => t.id === selectedTemplateId)?.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {templates.find(t => t.id === selectedTemplateId)?.description}
                      </p>
                    )}
                    {templates.find(t => t.id === selectedTemplateId)?.isPrimary && (
                      <Badge className="mt-2 text-xs" variant="secondary">Основной шаблон</Badge>
                    )}
                  </div>
                )}

                <Separator />

                {/* Preview of what will happen */}
                <div className="p-3 border rounded-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Предварительный обзор</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                    Компаний: <span className="font-bold">{selectedCompanyIds.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    Подразделений: <span className="font-bold">{selectedDepartmentIds.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    Должностей: <span className="font-bold">{affectedPositions}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Шаблон: <span className="font-bold">{selectedTemplateId ? templates.find(t => t.id === selectedTemplateId)?.name || '—' : '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Генерация */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" /> Генерация
                </CardTitle>
                <CardDescription>Запуск массовой генерации</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generating && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Генерация в процессе...</span>
                      {affectedPositions > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Обработка {affectedPositions} должностей...
                        </span>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      AI генерирует ДИ для каждой должности. Это может занять несколько минут.
                    </p>
                  </div>
                )}

                {!generating && results && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium">Генерация завершена!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-emerald-50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Успешно</p>
                        <p className="text-lg font-bold text-emerald-600">{results.filter(r => r.success).length}</p>
                      </div>
                      <div className="p-2 bg-red-50 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Ошибки</p>
                        <p className="text-lg font-bold text-red-600">{results.filter(r => !r.success).length}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setResultDialogOpen(true)}>
                      Показать детали
                    </Button>
                  </div>
                )}

                {!generating && !results && (
                  <div className="space-y-3 text-center py-4">
                    <Zap className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Выберите организации, подразделения и шаблон, затем нажмите «Генерировать»
                    </p>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={generating || !selectedTemplateId || affectedPositions === 0}
                  onClick={handleMassGenerate}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {generating ? 'Генерация...' : `Генерировать ${affectedPositions} ДИ`}
                </Button>

                {affectedPositions > 10 && !generating && (
                  <p className="text-xs text-muted-foreground text-center">
                    ⚠️ Генерация более 10 ДИ может занять значительное время
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Results Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результаты массовой генерации</DialogTitle>
            <DialogDescription>Детали генерации ДИ для каждой должности</DialogDescription>
          </DialogHeader>
          {results && successDiIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium">
                Успешно создано: {successDiIds.length}
              </span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={batchAuditLoading || batchDeleteLoading}
                  onClick={() => setBatchAuditOpen(true)}
                >
                  {batchAuditLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 mr-1" />
                  )}
                  Аудит всех
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={batchAuditLoading || batchDeleteLoading}
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  {batchDeleteLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Удалить все
                </Button>
              </div>
            </div>
          )}
          {results && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Должность</TableHead>
                  <TableHead>Название ДИ</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.positionId}>
                    <TableCell className="text-sm">{r.positionTitle}</TableCell>
                    <TableCell className="text-sm">{r.title || '—'}</TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Создана
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" /> Ошибка: {r.error}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Подтверждение пакетного аудита */}
      <AlertDialog open={batchAuditOpen} onOpenChange={setBatchAuditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Запустить аудит всех ДИ?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет проверено {successDiIds.length} должностных инструкций через активного ИИ-провайдера.
              Операция может занять некоторое время.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchAuditLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchAuditLoading}
              onClick={(e) => {
                e.preventDefault()
                handleBatchAudit()
              }}
            >
              {batchAuditLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Запустить аудит
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Подтверждение пакетного удаления */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все созданные ДИ?</AlertDialogTitle>
            <AlertDialogDescription>
              Будет безвозвратно удалено {successDiIds.length} должностных инструкций
              вместе со связанными разделами и результатами аудита. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleteLoading}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchDeleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                handleBatchDelete()
              }}
            >
              {batchDeleteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Удалить безвозвратно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
