'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Zap, Loader2, CheckCircle2, XCircle, Building2, Users, FileText, Layers } from 'lucide-react'

interface Company { id: string; name: string; shortName: string | null; code: string; _count: { departments: number } }
interface Department { id: string; name: string; code: string; companyId: string | null; company: Company | null; _count: { positions: number } }
interface Template { id: string; name: string; description: string | null; isPrimary: boolean }

interface MassGenerateResult {
  positionId: string
  positionTitle: string
  diId: string
  title: string
  success: boolean
  error?: string
}

export function MassGenerationModule() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Selection state
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  // Generation state
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<MassGenerateResult[] | null>(null)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [companiesRes, departmentsRes, templatesRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/departments'),
        fetch('/api/templates'),
      ])
      setCompanies(await companiesRes.json())
      setDepartments(await departmentsRes.json())
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

  // Filter departments based on selected companies
  const filteredDepartments = selectedCompanyIds.length > 0
    ? departments.filter(d => selectedCompanyIds.includes(d.companyId || ''))
    : departments

  // Calculate affected positions count
  const affectedPositions = filteredDepartments
    .filter(d => selectedDepartmentIds.length > 0 ? selectedDepartmentIds.includes(d.id) : true)
    .reduce((sum, d) => sum + d._count.positions, 0)

  const toggleCompanyId = (id: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    // Clear department selections when company selection changes
    setSelectedDepartmentIds([])
  }

  const toggleDepartmentId = (id: string) => {
    setSelectedDepartmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllDepartments = () => {
    setSelectedDepartmentIds(filteredDepartments.map(d => d.id))
  }

  const clearDepartmentSelection = () => {
    setSelectedDepartmentIds([])
  }

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

    try {
      setProgress(30)
      const res = await fetch('/api/generate-di/mass-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentIds: selectedDepartmentIds.length > 0 ? selectedDepartmentIds : undefined,
          companyIds: selectedCompanyIds.length > 0 ? selectedCompanyIds : undefined,
          templateId: selectedTemplateId,
        }),
      })

      setProgress(80)

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка массовой генерации')
      }

      const data = await res.json()
      setResults(data.results)
      setProgress(100)

      toast({
        title: 'Генерация завершена',
        description: `Создано ${data.successCount} ДИ из ${data.total}. Ошибок: ${data.failCount}`,
      })
      setResultDialogOpen(true)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка'
      toast({ title: 'Ошибка', description: msg, variant: 'destructive' })
    } finally {
      setGenerating(false)
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
          {/* Step 1: Select scope */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 1. Выбор организаций
              </CardTitle>
              <CardDescription>Выберите компании и подразделения</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Companies */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Компании</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {companies.map(c => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedCompanyIds.includes(c.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleCompanyId(c.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
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
              </div>

              <Separator />

              {/* Departments */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Подразделения ({filteredDepartments.length})
                </p>
                <div className="flex gap-2 mb-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={selectAllDepartments}>Выбрать все</Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={clearDepartmentSelection}>Очистить</Button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {filteredDepartments.map(d => (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedDepartmentIds.includes(d.id) ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleDepartmentId(d.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedDepartmentIds.includes(d.id) ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        }`}>
                          {selectedDepartmentIds.includes(d.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm truncate">{d.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{d._count.positions} должн.</Badge>
                    </div>
                  ))}
                  {filteredDepartments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет подразделений</p>}
                </div>
              </div>

              <Separator />

              {/* Stats */}
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-bold">{affectedPositions}</span> должностей будет обработано
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Select template */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> 2. Шаблон ДИ
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
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Компаний: <span className="font-bold">{selectedCompanyIds.length}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  Подразделений: <span className="font-bold">{selectedDepartmentIds.length || filteredDepartments.length}</span>
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

          {/* Step 3: Generate */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" /> 3. Генерация
              </CardTitle>
              <CardDescription>Запуск массовой генерации</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generating && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-medium">Генерация в процессе...</span>
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
      )}

      {/* Results Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результаты массовой генерации</DialogTitle>
            <DialogDescription>Детали генерации ДИ для каждой должности</DialogDescription>
          </DialogHeader>
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
    </div>
  )
}
