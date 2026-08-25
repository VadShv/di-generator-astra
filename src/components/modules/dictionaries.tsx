'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Briefcase, FolderOpen, Plus, Pencil, Trash2, Search, Loader2, ShieldCheck } from 'lucide-react'
import { CardGridSkeleton } from '@/components/skeletons'

// ==========================================
// Types
// ==========================================

interface DictionaryItem {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { positions: number }
  promptAddition?: string
  category?: string | null
}

interface FormData {
  name: string
  code: string
  description: string
  isActive: boolean
  promptAddition: string
  category: string
}

type DictionaryType = 'business-functions' | 'projects' | 'position-attributes'

const EMPTY_FORM: FormData = {
  name: '',
  code: '',
  description: '',
  isActive: true,
  promptAddition: '',
  category: '',
}

// ==========================================
// Component
// ==========================================

export function DictionariesModule() {
  const { toast } = useToast()

  // --- Data state ---
  const [businessFunctions, setBusinessFunctions] = useState<DictionaryItem[]>([])
  const [projects, setProjects] = useState<DictionaryItem[]>([])
  const [positionAttributes, setPositionAttributes] = useState<DictionaryItem[]>([])
  const [loadingBf, setLoadingBf] = useState(true)
  const [loadingPr, setLoadingPr] = useState(true)
  const [loadingPa, setLoadingPa] = useState(true)

  // --- Search ---
  const [searchBf, setSearchBf] = useState('')
  const [searchPr, setSearchPr] = useState('')
  const [searchPa, setSearchPa] = useState('')

  // --- Dialog state ---
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activeDictionary, setActiveDictionary] = useState<DictionaryType>('business-functions')
  const [editingItem, setEditingItem] = useState<DictionaryItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<DictionaryItem | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // ==========================================
  // Fetch functions
  // ==========================================

  const fetchBusinessFunctions = useCallback(async () => {
    try {
      setLoadingBf(true)
      const res = await fetch('/api/business-functions')
      if (res.ok) setBusinessFunctions(await res.json())
      else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Не удалось загрузить бизнес-функции', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети при загрузке бизнес-функций', variant: 'destructive' })
    } finally {
      setLoadingBf(false)
    }
  }, [toast])

  const fetchProjects = useCallback(async () => {
    try {
      setLoadingPr(true)
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
      else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Не удалось загрузить проекты', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети при загрузке проектов', variant: 'destructive' })
    } finally {
      setLoadingPr(false)
    }
  }, [toast])

  const fetchPositionAttributes = useCallback(async () => {
    try {
      setLoadingPa(true)
      const res = await fetch('/api/position-attributes')
      if (res.ok) setPositionAttributes(await res.json())
      else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Не удалось загрузить признаки должности', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети при загрузке признаков', variant: 'destructive' })
    } finally {
      setLoadingPa(false)
    }
  }, [toast])

  useEffect(() => { fetchBusinessFunctions() }, [fetchBusinessFunctions])
  useEffect(() => { fetchProjects() }, [fetchProjects])
  useEffect(() => { fetchPositionAttributes() }, [fetchPositionAttributes])

  // ==========================================
  // CRUD handlers
  // ==========================================

  const openAddDialog = (dictType: DictionaryType) => {
    setActiveDictionary(dictType)
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setFormDialogOpen(true)
  }

  const openEditDialog = (dictType: DictionaryType, item: DictionaryItem) => {
    setActiveDictionary(dictType)
    setEditingItem(item)
    setForm({
      name: item.name,
      code: item.code || '',
      description: item.description || '',
      isActive: item.isActive,
      promptAddition: (item as DictionaryItem).promptAddition || '',
      category: (item as DictionaryItem).category || '',
    })
    setFormDialogOpen(true)
  }

  const openDeleteDialog = (dictType: DictionaryType, item: DictionaryItem) => {
    setActiveDictionary(dictType)
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Ошибка', description: 'Название обязательно', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const isAttr = activeDictionary === 'position-attributes'
      const basePayload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        isActive: form.isActive,
      }
      if (isAttr) {
        basePayload.promptAddition = form.promptAddition.trim()
        basePayload.category = form.category.trim() || null
      }
      const payload = editingItem
        ? { id: editingItem.id, ...basePayload }
        : basePayload

      const method = editingItem ? 'PUT' : 'POST'
      const url = activeDictionary === 'business-functions'
        ? '/api/business-functions'
        : activeDictionary === 'projects'
        ? '/api/projects'
        : editingItem
        ? `/api/position-attributes/${editingItem.id}`
        : '/api/position-attributes'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const labels: Record<DictionaryType, string> = {
          'business-functions': 'Бизнес-функция сохранена',
          'projects': 'Проект сохранён',
          'position-attributes': 'Признак сохранён',
        }
        toast({ title: editingItem ? 'Обновлено' : 'Создано', description: labels[activeDictionary] })
        setFormDialogOpen(false)
        if (activeDictionary === 'business-functions') fetchBusinessFunctions()
        else if (activeDictionary === 'projects') fetchProjects()
        else fetchPositionAttributes()
      } else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Ошибка сохранения', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    try {
      const url = activeDictionary === 'business-functions'
        ? '/api/business-functions'
        : activeDictionary === 'projects'
        ? '/api/projects'
        : `/api/position-attributes/${itemToDelete.id}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: activeDictionary === 'position-attributes' ? undefined : JSON.stringify({ id: itemToDelete.id }),
      })

      if (res.ok) {
        const labels: Record<DictionaryType, string> = {
          'business-functions': 'Бизнес-функция удалена',
          'projects': 'Проект удалён',
          'position-attributes': 'Признак удалён',
        }
        toast({ title: 'Удалено', description: labels[activeDictionary] })
        setDeleteDialogOpen(false)
        setItemToDelete(null)
        if (activeDictionary === 'business-functions') fetchBusinessFunctions()
        else if (activeDictionary === 'projects') fetchProjects()
        else fetchPositionAttributes()
      } else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Ошибка удаления', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' })
    } finally {
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  // ==========================================
  // Toggle isActive (quick toggle)
  // ==========================================

  const handleToggleActive = async (dictType: DictionaryType, item: DictionaryItem) => {
    try {
      const url = dictType === 'business-functions'
        ? '/api/business-functions'
        : dictType === 'projects'
        ? '/api/projects'
        : `/api/position-attributes/${item.id}`
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dictType === 'position-attributes' ? { isActive: !item.isActive } : { id: item.id, isActive: !item.isActive }),
      })

      if (res.ok) {
        toast({ title: item.isActive ? 'Отключено' : 'Включено', description: `${item.name} — ${item.isActive ? 'неактивна' : 'активна'}` })
        if (dictType === 'business-functions') fetchBusinessFunctions()
        else if (dictType === 'projects') fetchProjects()
        else fetchPositionAttributes()
      } else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Ошибка', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' })
    }
  }

  // ==========================================
  // Filtered data
  // ==========================================

  const filteredBf = businessFunctions.filter(bf =>
    bf.name.toLowerCase().includes(searchBf.toLowerCase()) ||
    (bf.code && bf.code.toLowerCase().includes(searchBf.toLowerCase())) ||
    (bf.description && bf.description.toLowerCase().includes(searchBf.toLowerCase()))
  )

  const filteredPr = projects.filter(pr =>
    pr.name.toLowerCase().includes(searchPr.toLowerCase()) ||
    (pr.code && pr.code.toLowerCase().includes(searchPr.toLowerCase())) ||
    (pr.description && pr.description.toLowerCase().includes(searchPr.toLowerCase()))
  )

  const filteredPa = positionAttributes.filter(pa =>
    pa.name.toLowerCase().includes(searchPa.toLowerCase()) ||
    (pa.code && pa.code.toLowerCase().includes(searchPa.toLowerCase())) ||
    (pa.description && pa.description.toLowerCase().includes(searchPa.toLowerCase()))
  )

  // ==========================================
  // Stats
  // ==========================================

  const bfStats = {
    total: businessFunctions.length,
    active: businessFunctions.filter(bf => bf.isActive).length,
  }

  const prStats = {
    total: projects.length,
    active: projects.filter(pr => pr.isActive).length,
  }

  const paStats = {
    total: positionAttributes.length,
    active: positionAttributes.filter(pa => pa.isActive).length,
  }

  // ==========================================
  // Dictionary label helpers
  // ==========================================

  const dictLabel = (dictType: DictionaryType) =>
    dictType === 'business-functions' ? 'Бизнес-функция' : dictType === 'projects' ? 'Проект' : 'Признак должности'

  const dictNewLabel = (dictType: DictionaryType) =>
    dictType === 'business-functions' ? 'Новая бизнес-функция' : dictType === 'projects' ? 'Новый проект' : 'Новый признак должности'

  const dictEditLabel = (dictType: DictionaryType) =>
    dictType === 'business-functions' ? 'Редактировать бизнес-функцию' : dictType === 'projects' ? 'Редактировать проект' : 'Редактировать признак'

  const dictIcon = (dictType: DictionaryType) =>
    dictType === 'business-functions' ? Briefcase : dictType === 'projects' ? FolderOpen : ShieldCheck

  // ==========================================
  // Render card for a dictionary item
  // ==========================================

  const renderItemCard = (dictType: DictionaryType, item: DictionaryItem) => {
    const Icon = dictIcon(dictType)
    return (
      <Card key={item.id} className={`hover:shadow-sm transition-shadow ${!item.isActive ? 'opacity-70' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {item.name}
            </CardTitle>
            <Badge className={item.isActive ? 'bg-green-600' : 'bg-gray-400'}>
              {item.isActive ? 'Активна' : 'Неактивна'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {item.code && (
            <p className="text-sm text-muted-foreground">
              Код: <span className="font-medium text-foreground">{item.code}</span>
            </p>
          )}
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
          )}
          {item.promptAddition && (
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-md p-2">
              <p className="text-xs font-medium text-amber-700 mb-0.5">Инструкция для ИИ:</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{item.promptAddition}</p>
            </div>
          )}
          {item._count && item._count.positions > 0 && (
            <p className="text-xs text-muted-foreground">
              Привязана к {item._count.positions} должности(-ям)
            </p>
          )}
          <Separator className="my-2" />
          <div className="flex gap-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleActive(dictType, item)}
              title={item.isActive ? 'Отключить' : 'Включить'}
            >
              {item.isActive ? (
                <span className="flex items-center gap-1"><span className="text-xs text-green-600">●</span> Откл.</span>
              ) : (
                <span className="flex items-center gap-1"><span className="text-xs text-gray-400">●</span> Вкл.</span>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditDialog(dictType, item)}>
              <Pencil className="h-3 w-3 mr-1" /> Ред.
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => openDeleteDialog(dictType, item)}>
              <Trash2 className="h-3 w-3 mr-1" /> Удалить
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ==========================================
  // Render stats bar
  // ==========================================

  const renderStats = (dictType: DictionaryType) => {
    const stats = dictType === 'business-functions' ? bfStats : dictType === 'projects' ? prStats : paStats
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Всего: <span className="font-medium text-foreground">{stats.total}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span>Активных: <span className="font-medium text-green-600">{stats.active}</span></span>
        <Separator orientation="vertical" className="h-4" />
        <span>Неактивных: <span className="font-medium text-gray-500">{stats.total - stats.active}</span></span>
      </div>
    )
  }

  // ==========================================
  // Render empty state
  // ==========================================

  const renderEmpty = (dictType: DictionaryType) => {
    const Icon = dictIcon(dictType)
    const label = dictLabel(dictType)
    const addLabel = dictType === 'business-functions' ? 'бизнес-функцию' : dictType === 'projects' ? 'проект' : 'признак'
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Icon className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Нет записей в справочнике</p>
          <p className="text-sm mt-1">Добавьте первую запись, нажав кнопку «Добавить»</p>
          <Button className="mt-3" onClick={() => openAddDialog(dictType)}>
            <Plus className="h-4 w-4 mr-1.5" /> Добавить {addLabel}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6" /> Справочники
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление справочниками бизнес-функций, проектов и признаков должности
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="business-functions" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="business-functions" className="gap-1.5">
            <Briefcase className="h-4 w-4" /> Бизнес-функции
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderOpen className="h-4 w-4" /> Проекты
          </TabsTrigger>
          <TabsTrigger value="position-attributes" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Признаки должности
          </TabsTrigger>
        </TabsList>

        {/* Business Functions Tab */}
        <TabsContent value="business-functions" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {renderStats('business-functions')}
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={searchBf}
                  onChange={e => setSearchBf(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button onClick={() => openAddDialog('business-functions')}>
                <Plus className="h-4 w-4 mr-1.5" /> Добавить
              </Button>
            </div>
          </div>

          {loadingBf ? (
            <CardGridSkeleton count={6} />
          ) : filteredBf.length === 0 ? (
            searchBf ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ничего не найдено по запросу «{searchBf}»</p>
                  <Button variant="outline" className="mt-2" onClick={() => setSearchBf('')}>
                    Сбросить поиск
                  </Button>
                </CardContent>
              </Card>
            ) : renderEmpty('business-functions')
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBf.map(bf => renderItemCard('business-functions', bf))}
            </div>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {renderStats('projects')}
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={searchPr}
                  onChange={e => setSearchPr(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button onClick={() => openAddDialog('projects')}>
                <Plus className="h-4 w-4 mr-1.5" /> Добавить
              </Button>
            </div>
          </div>

          {loadingPr ? (
            <CardGridSkeleton count={6} />
          ) : filteredPr.length === 0 ? (
            searchPr ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ничего не найдено по запросу «{searchPr}»</p>
                  <Button variant="outline" className="mt-2" onClick={() => setSearchPr('')}>
                    Сбросить поиск
                  </Button>
                </CardContent>
              </Card>
            ) : renderEmpty('projects')
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPr.map(pr => renderItemCard('projects', pr))}
            </div>
          )}
        </TabsContent>

        {/* Position Attributes Tab */}
        <TabsContent value="position-attributes" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {renderStats('position-attributes')}
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={searchPa}
                  onChange={e => setSearchPa(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button onClick={() => openAddDialog('position-attributes')}>
                <Plus className="h-4 w-4 mr-1.5" /> Добавить
              </Button>
            </div>
          </div>

          {loadingPa ? (
            <CardGridSkeleton count={6} />
          ) : filteredPa.length === 0 ? (
            searchPa ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Ничего не найдено по запросу «{searchPa}»</p>
                  <Button variant="outline" className="mt-2" onClick={() => setSearchPa('')}>
                    Сбросить поиск
                  </Button>
                </CardContent>
              </Card>
            ) : renderEmpty('position-attributes')
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPa.map(pa => renderItemCard('position-attributes', pa))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ==========================================
          Add/Edit Dialog
          ========================================== */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dictIcon(activeDictionary) && (
                (() => {
                  const Icon = dictIcon(activeDictionary)
                  return <Icon className="h-5 w-5" />
                })()
              )}
              {editingItem
                ? dictEditLabel(activeDictionary)
                : dictNewLabel(activeDictionary)
              }
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dict-name">Название *</Label>
              <Input
                id="dict-name"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={activeDictionary === 'business-functions' ? 'Название бизнес-функции' : 'Название проекта'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dict-code">Код</Label>
              <Input
                id="dict-code"
                value={form.code}
                onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Код (необязательно)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dict-description">Описание</Label>
              <Textarea
                id="dict-description"
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Описание (необязательно)"
                className="min-h-[80px]"
              />
            </div>

            {activeDictionary === 'position-attributes' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dict-promptAddition">Инструкция для ИИ *</Label>
                  <Textarea
                    id="dict-promptAddition"
                    value={form.promptAddition}
                    onChange={e => setForm(prev => ({ ...prev, promptAddition: e.target.value }))}
                    placeholder="Текст, который будет добавлен в промпт при генерации ДИ. Например: «Включи раздел о материальной ответственности: договор о полной индивидуальной материальной ответственности...»"
                    className="min-h-[120px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Этот текст автоматически инъектируется в системный промпт при генерации ДИ для должностей с этим признаком.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dict-category">Категория</Label>
                  <Input
                    id="dict-category"
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="responsibility | compliance | access (необязательно)"
                  />
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center gap-3">
              <Switch
                id="dict-isActive"
                checked={form.isActive}
                onCheckedChange={checked => setForm(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="dict-isActive">
                {form.isActive ? 'Активна' : 'Неактивна'}
              </Label>
              <Badge className={form.isActive ? 'bg-green-600' : 'bg-gray-400'}>
                {form.isActive ? 'Активна' : 'Неактивна'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || (activeDictionary === 'position-attributes' && !form.promptAddition.trim())}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Сохранение...</>
              ) : editingItem ? (
                'Сохранить'
              ) : (
                <><Plus className="h-4 w-4 mr-1.5" /> Создать</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          Delete Confirmation Dialog
          ========================================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Удалить {dictLabel(activeDictionary).toLowerCase()}?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Вы уверены, что хотите удалить «{itemToDelete?.name}»?
            </p>
            {itemToDelete?._count && itemToDelete._count.positions > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                <span className="font-medium">⚠ Внимание:</span>
                Эта запись привязана к {itemToDelete._count.positions} должности(-ям). Удаление невозможно.
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
