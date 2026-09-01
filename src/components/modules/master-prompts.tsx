'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Brain, Plus, Eye, Pencil, Trash2, GitBranch, Copy, CheckCircle2, XCircle, Sparkles, FlaskConical, Play, Link2, History, Download, Upload, Tag } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { extractVariables, estimateTokens, PROMPT_CATEGORIES } from '@/lib/master-prompt-shared'
import {
  type Department, type BusinessFunctionItem, type CompanyItem, type AIProviderItem,
  type MasterPrompt, type Position, type PromptChain, type PromptTestResultItem,
  type PromptGroup,
  gradeLabel, parseTags, providerTypeLabel, STANDARD_VARIABLES,
} from './master-prompts-types'


const categoryLabel = (cat: string | null | undefined): string => {
  if (!cat) return PROMPT_CATEGORIES.generation
  return PROMPT_CATEGORIES[cat as keyof typeof PROMPT_CATEGORIES] || cat
}

export function MasterPromptsModule() {
  const { toast } = useToast()
  const [prompts, setPrompts] = useState<MasterPrompt[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [businessFunctions, setBusinessFunctions] = useState<BusinessFunctionItem[]>([])
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [providers, setProviders] = useState<AIProviderItem[]>([])
  const [chains, setChains] = useState<PromptChain[]>([])
  const [testResults, setTestResults] = useState<PromptTestResultItem[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [filterName, setFilterName] = useState('')
  const [filterDepartmentId, setFilterDepartmentId] = useState('all')
  const [filterIsActive, setFilterIsActive] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTag, setFilterTag] = useState('')
  const [filterCompanyId, setFilterCompanyId] = useState('all')
  const [activeTab, setActiveTab] = useState('prompts')

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [resolverDialogOpen, setResolverDialogOpen] = useState(false)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [chainDialogOpen, setChainDialogOpen] = useState(false)
  const [chainRunDialogOpen, setChainRunDialogOpen] = useState(false)

  const [editingPrompt, setEditingPrompt] = useState<MasterPrompt | null>(null)
  const [viewingPrompt, setViewingPrompt] = useState<MasterPrompt | null>(null)
  const [versionPromptName, setVersionPromptName] = useState('')
  const [versionHistory, setVersionHistory] = useState<MasterPrompt[]>([])
  const [deletingPrompt, setDeletingPrompt] = useState<MasterPrompt | null>(null)
  const [testingPrompt, setTestingPrompt] = useState<MasterPrompt | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState<string>('generation')
  const [formIsAiCulture, setFormIsAiCulture] = useState(false)
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [formBusinessFunctionId, setFormBusinessFunctionId] = useState('')
  const [formGrade, setFormGrade] = useState('')
  const [formFunctionType, setFormFunctionType] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formPositionId, setFormPositionId] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formChangeDescription, setFormChangeDescription] = useState('')
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit')
  const [previewData, setPreviewData] = useState<{ renderedContent: string; detectedVariables: string[]; unfilledVariables: string[]; estimatedTokens: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPositionId, setPreviewPositionId] = useState('')
  const [testProviderId, setTestProviderId] = useState('')
  const [testPositionId, setTestPositionId] = useState('')
  const [testResult, setTestResult] = useState<{ content: string; durationMs: number; providerName: string; modelName: string; testResultId: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [chainForm, setChainForm] = useState<{ id: string | null; name: string; description: string; steps: Array<{ category: string; order: number; stopOnError: boolean }>; isActive: boolean }>({ id: null, name: '', description: '', steps: [], isActive: false })
  const [chainRunId, setChainRunId] = useState('')
  const [chainRunPositionId, setChainRunPositionId] = useState('')
  const [chainRunResult, setChainRunResult] = useState<{ results: Array<{ step: number; category: string; content: string; error: string | null }>; finalOutput: string } | null>(null)
  const [deletingChain, setDeletingChain] = useState<PromptChain | null>(null)
  const [chainRunLoading, setChainRunLoading] = useState(false)
  const [chainsLoading, setChainsLoading] = useState(true)
  const [resolverPositionId, setResolverPositionId] = useState('')
  const [resolverResult, setResolverResult] = useState<{ prompt: MasterPrompt | null; resolution: { score: number; matchDetails: string[] } | null } | null>(null)
 const [resolverLoading, setResolverLoading] = useState(false)
  const [conflicts, setConflicts] = useState<Array<{ category: string; criteria: Record<string, unknown>; prompts: Array<{ id: string; name: string; version: number }> }>>([])

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterName) params.set('search', filterName)
      if (filterDepartmentId && filterDepartmentId !== 'all') params.set('departmentId', filterDepartmentId)
      if (filterIsActive !== 'all') params.set('isActive', filterIsActive)
      if (filterCategory !== 'all') params.set('category', filterCategory)
      if (filterTag) params.set('tag', filterTag)
      if (filterCompanyId && filterCompanyId !== 'all') params.set('companyId', filterCompanyId)
     const res = await fetch(`/api/master-prompts?${params.toString()}`)
     if (!res.ok) throw new Error()
      const data = await res.json()
      setPrompts(Array.isArray(data) ? data : [])
   } catch {
     toast({ title: 'Ошибка', description: 'Не удалось загрузить мастер-промпты', variant: 'destructive' })
   } finally {
     setLoading(false)
    }
  }, [filterName, filterDepartmentId, filterIsActive, filterCategory, filterTag, filterCompanyId, toast])

  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch('/api/departments'); if (res.ok) setDepartments(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchBusinessFunctions = useCallback(async () => {
    try { const res = await fetch('/api/business-functions'); if (res.ok) setBusinessFunctions(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch('/api/companies'); if (res.ok) setCompanies(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchProviders = useCallback(async () => {
    try { const res = await fetch('/api/ai-providers'); if (res.ok) setProviders(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchChains = useCallback(async () => {
    try { setChainsLoading(true); const res = await fetch('/api/prompt-chains'); if (res.ok) setChains(await res.json()) } catch { /* silent */ } finally { setChainsLoading(false) }
  }, [])
  const fetchTestResults = useCallback(async (promptId: string) => {
    try { const res = await fetch(`/api/master-prompts/test-results?masterPromptId=${promptId}`); if (res.ok) { const data = await res.json(); setTestResults(Array.isArray(data) ? data : data.results || []) } } catch { /* silent */ }
  }, [])
  const fetchPositions = useCallback(async () => {
    try { const res = await fetch('/api/positions'); if (res.ok) setPositions(await res.json()) } catch { /* silent */ }
  }, [])

 useEffect(() => { fetchPrompts() }, [fetchPrompts])
 useEffect(() => { fetchDepartments(); fetchBusinessFunctions(); fetchPositions(); fetchCompanies(); fetchProviders(); fetchChains() }, [fetchDepartments, fetchBusinessFunctions, fetchPositions, fetchCompanies, fetchProviders, fetchChains])
 useEffect(() => {
    fetch('/api/master-prompts/conflicts').then(r => r.ok ? r.json() : null).then(d => { if (d?.conflicts) setConflicts(d.conflicts) }).catch((err) => { console.warn('Failed to load prompt conflicts:', err) })
 }, [prompts])

 const groupedPrompts = useMemo(() => {
    const groups: Record<string, MasterPrompt[]> = {}
    for (const p of prompts) { if (!groups[p.name]) groups[p.name] = []; groups[p.name].push(p) }
    return Object.entries(groups).map(([name, list]) => ({
      name, prompts: list.sort((a, b) => b.version - a.version),
      activeVersion: list.find(p => p.isActive),
      latestVersion: list.sort((a, b) => b.version - a.version)[0],
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [prompts])

  const resetForm = () => {
    setFormName(''); setFormContent(''); setFormDescription(''); setFormDepartmentId('')
    setFormBusinessFunctionId(''); setFormGrade(''); setFormFunctionType('')
    setFormCategory('generation'); setFormIsAiCulture(false)
    setFormCompanyId(''); setFormPositionId(''); setFormTags(''); setFormChangeDescription('')
    setEditorTab('edit'); setPreviewData(null); setPreviewPositionId('')
  }

  const openCreateDialog = () => { setEditingPrompt(null); resetForm(); setEditDialogOpen(true) }
  const openEditDialog = (p: MasterPrompt) => {
    setEditingPrompt(p)
    setFormName(p.name); setFormContent(p.content); setFormDescription(p.description || '')
    setFormDepartmentId(p.departmentId || ''); setFormBusinessFunctionId(p.businessFunctionId || '')
    setFormGrade(p.grade || ''); setFormFunctionType(p.functionType || '')
    setFormCategory(p.category || 'generation'); setFormIsAiCulture(!!p.isAiCulture)
    setFormCompanyId(p.companyId || ''); setFormPositionId(p.positionId || '')
    setFormTags(parseTags(p.tags).join(', ')); setFormChangeDescription('')
    setEditorTab('edit'); setPreviewData(null); setPreviewPositionId('')
    setEditDialogOpen(true)
  }

  const detectedVariables = useMemo(() => extractVariables(formContent), [formContent])
  const currentTokens = useMemo(() => estimateTokens(formContent), [formContent])

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/master-prompts/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: formContent, positionId: previewPositionId || undefined }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPreviewData(data); setEditorTab('preview')
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось построить предпросмотр', variant: 'destructive' })
    } finally {
      setPreviewLoading(false)
    }
  }

  const insertVariable = (varName: string) => {
    setFormContent(prev => `${prev}{{${varName}}}`)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formContent.trim()) {
      toast({ title: 'Ошибка', description: 'Название и содержимое обязательны', variant: 'destructive' }); return
    }
    try {
      const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean)
      const body = {
        name: formName, content: formContent, description: formDescription,
        departmentId: formDepartmentId || null, businessFunctionId: formBusinessFunctionId || null,
        grade: formGrade || null, functionType: formFunctionType || null,
        category: formIsAiCulture ? 'ai_culture' : formCategory, isAiCulture: formIsAiCulture,
        variables: detectedVariables, companyId: formCompanyId || null,
        positionId: formPositionId || null, tags: tagsArray,
        changeDescription: formChangeDescription || undefined,
      }
      if (editingPrompt) {
        const res = await fetch('/api/master-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingPrompt.id, ...body }) })
        if (!res.ok) throw new Error()
        toast({ title: 'Успешно', description: 'Мастер-промпт обновлён' })
      } else {
        const res = await fetch('/api/master-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error()
        toast({ title: 'Успешно', description: 'Мастер-промпт создан' })
      }
      setEditDialogOpen(false); fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingPrompt) return
    try {
      const res = await fetch('/api/master-prompts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deletingPrompt.id }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Мастер-промпт удалён' })
      setDeleteDialogOpen(false); fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (p: MasterPrompt) => {
    try {
      const res = await fetch('/api/master-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, isActive: !p.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: p.isActive ? 'Версия деактивирована' : 'Версия активирована' })
      fetchPrompts()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось изменить статус', variant: 'destructive' })
    }
  }

  const openVersionDialog = async (name: string) => {
    setVersionPromptName(name)
    try {
      const res = await fetch(`/api/master-prompts/versions?name=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error()
      setVersionHistory(await res.json()); setVersionDialogOpen(true)
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить версии', variant: 'destructive' })
    }
  }

  const handleDuplicate = (p: MasterPrompt) => {
    setEditingPrompt(null)
    setFormName(p.name); setFormContent(p.content); setFormDescription(`Копия версии ${p.version}`)
    setFormDepartmentId(p.departmentId || ''); setFormBusinessFunctionId(p.businessFunctionId || '')
    setFormGrade(p.grade || ''); setFormFunctionType(p.functionType || '')
    setFormCategory(p.category || 'generation'); setFormIsAiCulture(!!p.isAiCulture)
    setFormCompanyId(p.companyId || ''); setFormPositionId(p.positionId || '')
    setFormTags(parseTags(p.tags).join(', ')); setFormChangeDescription('')
    setEditorTab('edit'); setPreviewData(null); setPreviewPositionId('')
    setEditDialogOpen(true)
  }

  const handleResolve = async () => {
    if (!resolverPositionId) { toast({ title: 'Ошибка', description: 'Выберите должность', variant: 'destructive' }); return }
    setResolverLoading(true)
    try {
      const res = await fetch('/api/master-prompts/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: resolverPositionId }) })
      if (!res.ok) throw new Error()
      setResolverResult(await res.json())
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось разрешить промпт', variant: 'destructive' })
    } finally {
      setResolverLoading(false)
    }
  }

  const openTestDialog = (p: MasterPrompt) => {
    setTestingPrompt(p); setTestResult(null); setTestProviderId(''); setTestPositionId('')
    fetchTestResults(p.id); setTestDialogOpen(true)
  }

  const handleTest = async () => {
    if (!testingPrompt) return
    setTestLoading(true)
    try {
      const res = await fetch('/api/master-prompts/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPromptId: testingPrompt.id, positionId: testPositionId || undefined, providerId: testProviderId || undefined }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Ошибка теста') }
      const data = await res.json()
      setTestResult(data)
      toast({ title: 'Успешно', description: `Тест выполнен за ${data.durationMs} мс` })
      fetchTestResults(testingPrompt.id)
    } catch (e) {
      toast({ title: 'Ошибка теста', description: e instanceof Error ? e.message : 'Неизвестная ошибка', variant: 'destructive' })
    } finally {
      setTestLoading(false)
    }
  }

  const handleRate = async (resultId: string, rating: number) => {
    try {
      const res = await fetch('/api/master-prompts/test-results', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: resultId, rating }) })
      if (!res.ok) throw new Error()
      if (testingPrompt) fetchTestResults(testingPrompt.id)
      toast({ title: 'Успешно', description: 'Оценка сохранена' })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить оценку', variant: 'destructive' })
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'master-prompts.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const items = JSON.parse(await file.text())
      if (!Array.isArray(items)) throw new Error('Неверный формат')
      let imported = 0
      let failed = 0
      const validCategories = Object.keys(PROMPT_CATEGORIES)
      for (const item of items) {
        if (!item.name || !item.content) { failed++; continue }
        const category = item.isAiCulture ? 'ai_culture' : (validCategories.includes(item.category) ? item.category : 'generation')
        const tagsArray = Array.isArray(item.tags) ? item.tags.map(String) : []
        try {
          const res = await fetch('/api/master-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(item.name), content: String(item.content), description: item.description ? String(item.description) : undefined, category, isAiCulture: !!item.isAiCulture, tags: tagsArray }) })
          if (!res.ok) { failed++; continue }
          imported++
        } catch { failed++ }
      }
      toast({ title: imported > 0 ? 'Успешно' : 'Импорт не выполнен', description: `Импортировано: ${imported}${failed > 0 ? `, пропущено: ${failed}` : ''}` })
      fetchPrompts()
    } catch (err) {
      toast({ title: 'Ошибка импорта', description: err instanceof Error ? err.message : 'Неверный формат файла', variant: 'destructive' })
    }
    e.target.value = ''
  }

  const addChainStep = () => setChainForm(prev => ({ ...prev, steps: [...prev.steps, { category: 'generation', order: prev.steps.length + 1, stopOnError: true }] }))
  const updateChainStep = (idx: number, field: 'category' | 'stopOnError', value: string | boolean) => setChainForm(prev => ({ ...prev, steps: prev.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s) }))
  const removeChainStep = (idx: number) => setChainForm(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }))

  const handleSaveChain = async () => {
    if (!chainForm.name.trim()) { toast({ title: 'Ошибка', description: 'Название обязательно', variant: 'destructive' }); return }
    try {
      const method = chainForm.id ? 'PUT' : 'POST'
      const res = await fetch('/api/prompt-chains', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: chainForm.id, name: chainForm.name, description: chainForm.description, steps: chainForm.steps, isActive: chainForm.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: chainForm.id ? 'Цепочка обновлена' : 'Цепочка создана' })
      setChainDialogOpen(false); fetchChains()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить цепочку', variant: 'destructive' })
    }
  }

  const handleToggleChain = async (c: PromptChain) => {
    try {
      const res = await fetch('/api/prompt-chains', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, isActive: !c.isActive }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: c.isActive ? 'Цепочка деактивирована' : 'Цепочка активирована' })
      fetchChains()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось изменить статус', variant: 'destructive' })
    }
  }

  const handleDeleteChain = async () => {
    if (!deletingChain) return
    const id = deletingChain.id
    try {
      const res = await fetch('/api/prompt-chains', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error()
      toast({ title: 'Успешно', description: 'Цепочка удалена' })
      setDeletingChain(null)
      fetchChains()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    }
  }

  const handleRunChain = async () => {
    if (!chainRunId) { toast({ title: 'Ошибка', description: 'Выберите цепочку', variant: 'destructive' }); return }
    setChainRunLoading(true); setChainRunResult(null)
    try {
      const res = await fetch('/api/prompt-chains/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chainId: chainRunId, positionId: chainRunPositionId || undefined }) })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Ошибка запуска') }
      const data = await res.json()
      setChainRunResult(data)
      toast({ title: 'Успешно', description: `Цепочка выполнена: ${data.completedSteps}/${data.totalSteps} шагов` })
    } catch (e) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Не удалось запустить', variant: 'destructive' })
    } finally {
      setChainRunLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> Мастер-промпты</h1>
          <p className="text-sm text-muted-foreground">Библиотека шаблонов запросов к ИИ для генерации, аудита и улучшения ДИ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Экспорт</Button>
          <label>
            <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" /> Импорт</span></Button>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <Button variant="outline" size="sm" onClick={() => setResolverDialogOpen(true)}><Sparkles className="h-4 w-4 mr-1" /> Ресолвер</Button>
          <Button variant="outline" size="sm" onClick={() => setChainRunDialogOpen(true)}><Link2 className="h-4 w-4 mr-1" /> Цепочки</Button>
          <Button size="sm" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1" /> Создать</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="prompts"><Brain className="h-4 w-4 mr-1" /> Промпты</TabsTrigger>
          <TabsTrigger value="chains"><Link2 className="h-4 w-4 mr-1" /> Цепочки</TabsTrigger>
        </TabsList>

       <TabsContent value="prompts" className="space-y-4">
          {conflicts.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Обнаружены конфликты активных промптов ({conflicts.length})
                </p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                  Несколько активных промптов с одинаковыми критериями применимости могут приводить к непредсказуемому выбору при генерации.
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                  {conflicts.slice(0, 5).map((c, i) => (
                    <li key={i}>
                      {c.category}: {c.prompts.map(p => `${p.name} v${p.version}`).join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Card><CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Поиск по названию..." value={filterName} onChange={e => setFilterName(e.target.value)} className="max-w-xs" />
              <Input placeholder="Тег..." value={filterTag} onChange={e => setFilterTag(e.target.value)} className="max-w-[140px]" />
              <Select value={filterCompanyId} onValueChange={setFilterCompanyId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Юр. лицо" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Все юр. лица</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Подразделение" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Все</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterIsActive} onValueChange={setFilterIsActive}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Статус" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Все статусы</SelectItem><SelectItem value="true">Активные</SelectItem><SelectItem value="false">Неактивные</SelectItem></SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Категория" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Все категории</SelectItem>{Object.entries(PROMPT_CATEGORIES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent></Card>

          {loading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : groupedPrompts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Нет мастер-промптов</p>
              <Button className="mt-2" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1" /> Создать</Button>
            </CardContent></Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {groupedPrompts.map(group => (
                <AccordionItem key={group.name} value={group.name} className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-2 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1 text-left flex-wrap">
                      <Brain className="h-4 w-4" /><span className="font-semibold">{group.name}</span>
                      <Badge variant="secondary" className="text-xs">v{group.latestVersion.version}</Badge>
                      {group.latestVersion.isAiCulture && <Badge className="text-xs bg-violet-600">Культура ИИ</Badge>}
                      <Badge variant="outline" className="text-xs">{categoryLabel(group.latestVersion.category)}</Badge>
                      {group.activeVersion ? <Badge className="text-xs bg-green-600">Активна v{group.activeVersion.version}</Badge> : <Badge variant="destructive" className="text-xs">Нет активной</Badge>}
                      <Badge variant="outline" className="text-xs">{group.prompts.length} версий</Badge>
                      {group.latestVersion.useCount > 0 && <Badge variant="outline" className="text-xs">Использован {group.latestVersion.useCount} раз</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Версия</TableHead><TableHead>Юр. лицо</TableHead><TableHead>Подразделение</TableHead><TableHead>Бизнес-функция</TableHead><TableHead>Теги</TableHead><TableHead>Статус</TableHead><TableHead>Дата</TableHead><TableHead className="text-right">Действия</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {group.prompts.map(p => {
                          const tags = parseTags(p.tags)
                          return (
                            <TableRow key={p.id} className={!p.isActive ? 'opacity-60' : ''}>
                              <TableCell><Badge variant="secondary">v{p.version}</Badge></TableCell>
                              <TableCell className="text-sm">{p.company?.name || 'Все'}</TableCell>
                              <TableCell className="text-sm">{p.department?.name || 'Все'}</TableCell>
                              <TableCell className="text-sm">{p.businessFunction?.name || 'Все'}</TableCell>
                              <TableCell className="text-sm">{tags.length > 0 ? tags.map(t => <Badge key={t} variant="outline" className="text-xs mr-1"><Tag className="h-2.5 w-2.5 mr-0.5" />{t}</Badge>) : '—'}</TableCell>
                              <TableCell>{p.isActive ? <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Активна</Badge> : <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Неактивна</Badge>}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Просмотр" onClick={() => { setViewingPrompt(p); setViewDialogOpen(true) }}><Eye className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Тестировать" onClick={() => openTestDialog(p)}><FlaskConical className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Редактировать" onClick={() => openEditDialog(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Активация" onClick={() => handleToggleActive(p)}>{p.isActive ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Копия" onClick={() => handleDuplicate(p)}><Copy className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Удалить" onClick={() => { setDeletingPrompt(p); setDeleteDialogOpen(true) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => openVersionDialog(group.name)}><GitBranch className="h-4 w-4 mr-1" /> История версий</Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="chains" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setChainForm({ id: null, name: '', description: '', steps: [], isActive: false }); setChainDialogOpen(true) }}><Plus className="h-4 w-4 mr-1" /> Создать цепочку</Button>
          </div>
          {chainsLoading ? <p className="text-center py-8 text-muted-foreground">Загрузка...</p> : chains.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Нет цепочек промптов</p>
              <p className="text-xs mt-1">Цепочка — последовательность шагов: генерация → улучшение → аудит</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {chains.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{c.name}</span>
                        {c.isActive ? <Badge className="bg-green-600">Активна</Badge> : <Badge variant="secondary">Неактивна</Badge>}
                        <Badge variant="outline">{c.steps.length} шагов</Badge>
                      </div>
                      {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {c.steps.slice().sort((a, b) => a.order - b.order).map((s, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">{i + 1}. {categoryLabel(s.category)}</Badge>
                            {i < c.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Активация" onClick={() => handleToggleChain(c)}>{c.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Запустить" onClick={() => { setChainRunId(c.id); setChainRunResult(null); setChainRunDialogOpen(true) }}><Play className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Редактировать" onClick={() => { setChainForm({ id: c.id, name: c.name, description: c.description || '', steps: c.steps.map(s => ({ ...s, stopOnError: s.stopOnError ?? true })), isActive: c.isActive }); setChainDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Удалить" onClick={() => setDeletingChain(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog — умный редактор с предпросмотром */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPrompt ? `Редактировать промпт (v${editingPrompt.version})` : 'Создать промпт'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Название промпта" /></div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as 'edit' | 'preview')}>
                  <TabsList><TabsTrigger value="edit">Редактирование</TabsTrigger><TabsTrigger value="preview" onClick={handlePreview}>Предпросмотр</TabsTrigger></TabsList>
                </Tabs>
                <Badge variant="outline" className="text-xs">~{currentTokens} токенов</Badge>
              </div>
              {editorTab === 'edit' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2">
                    <Label className="text-xs">Содержимое промпта *</Label>
                    <Textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Текст промпта. Используйте {{должность}}, {{подразделение}}, {{юр_лицо}}..." className="min-h-[360px] font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Переменные</Label>
                    <div className="border rounded-lg p-2 space-y-1 max-h-[200px] overflow-y-auto bg-muted/30">
                      {STANDARD_VARIABLES.map(v => (
                        <button key={v.name} type="button" onClick={() => insertVariable(v.name)} className="w-full text-left p-1.5 rounded hover:bg-accent flex items-center justify-between">
                          <code className="text-xs text-violet-600">{`{{${v.name}}}`}</code>
                          <span className="text-xs text-muted-foreground">{v.desc}</span>
                        </button>
                      ))}
                    </div>
                    {detectedVariables.length > 0 && (
                      <div className="border rounded-lg p-2 space-y-1 bg-muted/30">
                        <p className="text-xs font-medium">Найдено в тексте:</p>
                        {detectedVariables.map(v => <Badge key={v} variant="secondary" className="text-xs mr-1">{`{{${v}}}`}</Badge>)}
                      </div>
                    )}
                    <div>
                      <Label className="text-xs">Должность для предпросмотра</Label>
                      <Select value={previewPositionId} onValueChange={setPreviewPositionId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Не выбрана" /></SelectTrigger>
                        <SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" onClick={handlePreview} disabled={previewLoading}>{previewLoading ? 'Загрузка...' : 'Показать предпросмотр'}</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {previewData ? (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">~{previewData.estimatedTokens} токенов</Badge>
                        {previewData.detectedVariables.length > 0 && <Badge variant="secondary" className="text-xs">Переменных: {previewData.detectedVariables.length}</Badge>}
                        {previewData.unfilledVariables.length > 0 ? <Badge variant="destructive" className="text-xs">Не заполнено: {previewData.unfilledVariables.join(', ')}</Badge> : (previewData.detectedVariables.length > 0 && <Badge className="bg-green-600 text-xs">Все переменные заполнены</Badge>)}
                      </div>
                      <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[400px] overflow-y-auto font-mono">{previewData.renderedContent}</pre>
                    </>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">Нажмите «Показать предпросмотр» для рендера с переменными</p>}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Теги (через запятую)</Label>
              <Input value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="базовый, для-руководителей..." />
            </div>
            {editingPrompt && (<div><Label className="text-xs">Описание изменений (для новой версии)</Label><Input value={formChangeDescription} onChange={e => setFormChangeDescription(e.target.value)} placeholder="Что изменилось в этой версии..." /></div>)}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isAiCulture" checked={formIsAiCulture} onChange={e => setFormIsAiCulture(e.target.checked)} className="rounded" />
                <Label htmlFor="isAiCulture" className="text-sm cursor-pointer">Промпт «Культура ИИ»</Label>
              </div>
              {!formIsAiCulture && (
                <div><Label className="text-xs">Категория</Label>
                  <Select value={formCategory} onValueChange={setFormCategory} disabled={formIsAiCulture}>
                    <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PROMPT_CATEGORIES).filter(([k]) => k !== 'ai_culture').map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div><Label className="text-xs">Описание</Label><Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Краткое описание промпта" /></div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-medium">Условия применимости (пусто = для всех)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><Label className="text-xs">Юр. лицо</Label><Select value={formCompanyId} onValueChange={setFormCompanyId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все" /></SelectTrigger><SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Подразделение</Label><Select value={formDepartmentId} onValueChange={setFormDepartmentId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все" /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Бизнес-функция</Label><Select value={formBusinessFunctionId} onValueChange={setFormBusinessFunctionId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все" /></SelectTrigger><SelectContent>{businessFunctions.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Должность</Label><Select value={formPositionId} onValueChange={setFormPositionId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">Грейд</Label><Select value={formGrade} onValueChange={setFormGrade}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Все" /></SelectTrigger><SelectContent><SelectItem value="линейная">Линейная</SelectItem><SelectItem value="руководитель">Руководитель</SelectItem></SelectContent></Select></div>
                <div><Label className="text-xs">Тип функции</Label><Input value={formFunctionType} onChange={e => setFormFunctionType(e.target.value)} placeholder="Разработка, Аналитика..." className="h-8 text-xs" /></div>
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Отмена</Button><Button onClick={handleSave}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewingPrompt?.name} — v{viewingPrompt?.version}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {viewingPrompt?.isActive ? <Badge className="bg-green-600">Активна</Badge> : <Badge variant="secondary">Неактивна</Badge>}
              {viewingPrompt?.isAiCulture && <Badge className="bg-violet-600">Культура ИИ</Badge>}
              <Badge variant="outline">{categoryLabel(viewingPrompt?.category)}</Badge>
              {viewingPrompt?.company && <Badge variant="outline">{viewingPrompt.company.name}</Badge>}
              {viewingPrompt?.department && <Badge variant="outline">{viewingPrompt.department.name}</Badge>}
              {viewingPrompt?.businessFunction && <Badge variant="outline">{viewingPrompt.businessFunction.name}</Badge>}
              {gradeLabel(viewingPrompt?.grade ?? null) && <Badge variant="outline">{gradeLabel(viewingPrompt?.grade ?? null)}</Badge>}
              {viewingPrompt?.useCount ? <Badge variant="outline">Использован {viewingPrompt.useCount} раз</Badge> : null}
              {viewingPrompt?.estimatedTokens ? <Badge variant="outline">~{viewingPrompt.estimatedTokens} токенов</Badge> : null}
            </div>
            {viewingPrompt?.description && <p className="text-sm text-muted-foreground">{viewingPrompt.description}</p>}
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-[500px] overflow-y-auto">{viewingPrompt?.content}</pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle><History className="h-4 w-4 inline mr-1" />История версий: {versionPromptName}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {versionHistory.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Нет версий</p> : versionHistory.map(v => (
              <div key={v.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2"><Badge variant="secondary">v{v.version}</Badge>{v.isActive ? <Badge className="bg-green-600 text-xs">Активна</Badge> : null}{v.description && <span className="text-sm text-muted-foreground">{v.description}</span>}</div>
                <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить промпт?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Версия v{deletingPrompt?.version} промпта &quot;{deletingPrompt?.name}&quot;</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolver Dialog */}
      <Dialog open={resolverDialogOpen} onOpenChange={setResolverDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Ресолвер промптов</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Выберите должность — система подберёт наиболее подходящий промпт по категории и критериям применимости.</p>
            <div><Label>Должность</Label><Select value={resolverPositionId} onValueChange={setResolverPositionId}><SelectTrigger><SelectValue placeholder="Выберите должность" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={handleResolve} disabled={resolverLoading}>{resolverLoading ? 'Резолвинг...' : 'Подобрать промпт'}</Button>
            {resolverResult?.prompt && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-medium">Найден: {resolverResult.prompt.name} (v{resolverResult.prompt.version})</p>
                {resolverResult.prompt.businessFunction && <p className="text-sm text-muted-foreground">Бизнес-функция: {resolverResult.prompt.businessFunction.name}</p>}
                {resolverResult.resolution && <p className="text-sm text-muted-foreground">Score: {resolverResult.resolution.score} | Совпадения: {resolverResult.resolution.matchDetails.join(', ')}</p>}
              </div>
            )}
            {resolverResult && !resolverResult.prompt && <p className="text-sm text-muted-foreground">Подходящий промпт не найден</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle><FlaskConical className="h-4 w-4 inline mr-1" />Тестирование: {testingPrompt?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">ИИ-провайдер (пусто = по умолчанию)</Label><Select value={testProviderId} onValueChange={setTestProviderId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="По умолчанию" /></SelectTrigger><SelectContent>{providers.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({providerTypeLabel(p.type)})</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Должность (для контекста переменных)</Label><Select value={testPositionId} onValueChange={setTestPositionId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Без должности" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleTest} disabled={testLoading}><Play className="h-4 w-4 mr-1" />{testLoading ? 'Выполняется...' : 'Запустить тест'}</Button>
            {testResult && (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{testResult.providerName}</Badge><Badge variant="outline">{testResult.modelName}</Badge><Badge variant="secondary">{testResult.durationMs} мс</Badge>
                </div>
                <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg max-h-[300px] overflow-y-auto">{testResult.content}</pre>
              </div>
            )}
            {testResults.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2"><History className="h-4 w-4 inline mr-1" />История тестов</p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {testResults.map(r => (
                    <div key={r.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div className="flex items-center gap-2"><span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString('ru-RU')}</span><Badge variant="outline">{r.durationMs} мс</Badge></div>
                      <div className="flex items-center gap-1">{[1, 2, 3, 4, 5].map(n => (<button key={n} onClick={() => handleRate(r.id, n)} className={`text-sm ${r.rating === n ? 'text-yellow-500' : 'text-muted-foreground'}`}>★</button>))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chain Create/Edit Dialog */}
      <Dialog open={chainDialogOpen} onOpenChange={setChainDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{chainForm.id ? 'Редактировать цепочку' : 'Создать цепочку промптов'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Название *</Label><Input value={chainForm.name} onChange={e => setChainForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Напр.: Генерация → Улучшение → Аудит" /></div>
            <div><Label>Описание</Label><Input value={chainForm.description} onChange={e => setChainForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Краткое описание цепочки" /></div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>Шаги цепочки</Label><Button variant="outline" size="sm" onClick={addChainStep}><Plus className="h-3 w-3 mr-1" /> Добавить шаг</Button></div>
              {chainForm.steps.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4 border rounded">Нет шагов. Цепочка выполняется последовательно.</p> : (
                <div className="space-y-2">
                  {chainForm.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 border rounded">
                      <Badge variant="secondary">{i + 1}</Badge>
                      <Select value={s.category} onValueChange={v => updateChainStep(i, 'category', v)}><SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PROMPT_CATEGORIES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
                      <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={s.stopOnError} onChange={e => updateChainStep(i, 'stopOnError', e.target.checked)} className="rounded" />Стоп при ошибке</label>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeChainStep(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="chainActive" checked={chainForm.isActive} onChange={e => setChainForm(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded" />
            <Label htmlFor="chainActive" className="text-sm cursor-pointer">Сделать активной (снимет активность с остальных)</Label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setChainDialogOpen(false)}>Отмена</Button><Button onClick={handleSaveChain}>Сохранить</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chain Run Dialog */}
      <Dialog open={chainRunDialogOpen} onOpenChange={setChainRunDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Play className="h-4 w-4 inline mr-1" />Запуск цепочки промптов</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Цепочка</Label><Select value={chainRunId} onValueChange={setChainRunId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Выберите цепочку" /></SelectTrigger><SelectContent>{chains.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Должность (опционально)</Label><Select value={chainRunPositionId} onValueChange={setChainRunPositionId}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Без должности" /></SelectTrigger><SelectContent>{positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Button onClick={handleRunChain} disabled={chainRunLoading}><Play className="h-4 w-4 mr-1" />{chainRunLoading ? 'Выполняется...' : 'Запустить'}</Button>
            {chainRunResult && (
              <div className="space-y-2">
                {chainRunResult.results.map((r, i) => (
                  <div key={i} className={`border rounded-lg p-3 space-y-1 ${r.error ? 'border-destructive' : ''}`}>
                    <div className="flex items-center gap-2"><Badge variant="secondary">Шаг {r.step}</Badge><Badge variant="outline">{categoryLabel(r.category)}</Badge>{r.error ? <Badge variant="destructive">Ошибка</Badge> : <Badge className="bg-green-600">OK</Badge>}</div>
                    {r.error ? <p className="text-sm text-destructive">{r.error}</p> : <pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded max-h-[200px] overflow-y-auto">{r.content}</pre>}
                  </div>
                ))}
                {chainRunResult.finalOutput && (<div className="border-t pt-2"><p className="text-sm font-medium mb-1">Итоговый результат:</p><pre className="whitespace-pre-wrap text-xs bg-muted p-2 rounded max-h-[250px] overflow-y-auto">{chainRunResult.finalOutput}</pre></div>)}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Chain Delete Confirmation */}
      <AlertDialog open={!!deletingChain} onOpenChange={(open) => { if (!open) setDeletingChain(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить цепочку?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Цепочка «{deletingChain?.name}» будет удалена безвозвратно.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
