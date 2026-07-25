'use client'

// Модуль управления ИИ-провайдерами (Фаза 2)
// Функционал: список провайдеров с индикатором статуса, форма добавления/редактирования,
// тест соединения, выбор активного провайдера по умолчанию.

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Cpu, Plus, Pencil, Trash2, Zap, CheckCircle2, XCircle, Star, Loader2 } from 'lucide-react'

// Тип провайдера — соответствует AIProviderType из коннектора
type ProviderType = 'openai_compatible' | 'yandex_cloud' | 'cloud' | 'ollama' | 'zai'

interface AIProviderRow {
  id: string
  name: string
  type: ProviderType
  baseUrl: string | null
  apiKeyMask: string
  hasApiKey: boolean
  modelName: string
  folderId: string | null
  isActive: boolean
  isDefault: boolean
  config: string
  lastTestedAt: string | null
  lastTestStatus: string | null
  lastTestMessage: string | null
  createdAt: string
  updatedAt: string
}

// Метки типов провайдеров для UI
const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai_compatible: 'OpenAI-совместимый',
  yandex_cloud: 'Yandex Cloud',
  cloud: 'Cloud.ru',
  ollama: 'Ollama (локальная LLM)',
  zai: 'z-ai-web-dev-sdk (встроенный)',
}

// Подсказки по baseUrl для каждого типа
const BASE_URL_HINTS: Record<ProviderType, string> = {
  openai_compatible: 'https://api.openai.com',
  yandex_cloud: 'https://llm.api.cloud.yandex.net',
  cloud: 'https://api.cloud.ru',
  ollama: 'http://localhost:11434',
  zai: 'Не требуется (встроенный SDK)',
}

// Нормализация типа провайдера из БД: устаревший 'klad' отображается как 'cloud' (Cloud.ru).
// Для новых записей доступен только 'cloud'; старые записи 'klad' продолжают работать на бэке.
function normalizeProviderType(type: string): ProviderType {
  if (type === 'klad') return 'cloud'
  return (type as ProviderType) || 'openai_compatible'
}

// Состояние формы (добавление/редактирование)
interface FormState {
  id?: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
  modelName: string
  folderId: string
  temperature: string
  maxTokens: string
  isActive: boolean
  isDefault: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'openai_compatible',
  baseUrl: '',
  apiKey: '',
  modelName: '',
  folderId: '',
  temperature: '0.7',
  maxTokens: '2048',
  isActive: false,
  isDefault: false,
}

export function AiProvidersModule() {
  const { toast } = useToast()
  const [providers, setProviders] = useState<AIProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Загрузка списка провайдеров
  const loadProviders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-providers')
      if (!res.ok) throw new Error('Не удалось загрузить провайдеров')
      const data = (await res.json()) as AIProviderRow[]
      setProviders(
        data.map((p) => ({ ...p, type: normalizeProviderType(p.type) }))
      )
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось загрузить провайдеров',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadProviders()
  }, [loadProviders])

  // Открыть форму добавления
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  // Открыть форму редактирования
  const openEdit = (p: AIProviderRow) => {
    let extraConfig: { temperature?: number; maxTokens?: number } = {}
    try {
      extraConfig = JSON.parse(p.config)
    } catch {
      // пустой конфиг
    }
    setForm({
     id: p.id,
     name: p.name,
      type: normalizeProviderType(p.type),
     baseUrl: p.baseUrl || '',
      apiKey: '', // ключ не возвращаем в открытом виде; пусто = не менять
      modelName: p.modelName,
      folderId: p.folderId || '',
      temperature: String(extraConfig.temperature ?? 0.7),
      maxTokens: String(extraConfig.maxTokens ?? 2048),
      isActive: p.isActive,
      isDefault: p.isDefault,
    })
    setDialogOpen(true)
  }

  // Сохранение (создание/обновление)
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Внимание', description: 'Укажите название провайдера', variant: 'destructive' })
      return
    }
    if (!form.modelName.trim()) {
      toast({ title: 'Внимание', description: 'Укажите имя модели', variant: 'destructive' })
      return
    }
    if (form.type !== 'zai' && !form.baseUrl.trim()) {
      toast({ title: 'Внимание', description: 'Укажите baseUrl', variant: 'destructive' })
      return
    }
    if (form.type === 'yandex_cloud' && !form.folderId.trim()) {
      toast({ title: 'Внимание', description: 'Укажите folder_id для Yandex Cloud', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const config = JSON.stringify({
        temperature: Number(form.temperature) || 0.7,
        maxTokens: Number(form.maxTokens) || 2048,
      })
      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        baseUrl: form.baseUrl || null,
        modelName: form.modelName,
        folderId: form.folderId || null,
        isActive: form.isActive,
        isDefault: form.isDefault,
        config,
      }
      // Ключ отправляем только если заполнен (при редактировании пусто = не менять)
      if (form.apiKey) {
        payload.apiKey = form.apiKey
      }

      const isEdit = !!form.id
      const url = isEdit ? `/api/ai-providers/${form.id}` : '/api/ai-providers'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ошибка сохранения')
      }
      toast({
        title: isEdit ? 'Провайдер обновлён' : 'Провайдер создан',
        description: form.name,
      })
      setDialogOpen(false)
      loadProviders()
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось сохранить',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Тест соединения
  const handleTest = async (p: AIProviderRow) => {
    setTestingId(p.id)
    try {
      const res = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: p.id }),
      })
      const result = await res.json()
      if (result.ok) {
        toast({
          title: 'Соединение установлено',
          description: `${p.name}: ${result.sampleResponse || 'OK'} (${result.latencyMs} мс)`,
        })
      } else {
        toast({
          title: 'Ошибка соединения',
          description: `${p.name}: ${result.message}`,
          variant: 'destructive',
        })
      }
      loadProviders()
    } catch (e) {
      toast({
        title: 'Ошибка теста',
        description: e instanceof Error ? e.message : 'Не удалось проверить соединение',
        variant: 'destructive',
      })
    } finally {
      setTestingId(null)
    }
  }

  // Установка провайдера по умолчанию
  const handleSetDefault = async (p: AIProviderRow) => {
    try {
      const res = await fetch(`/api/ai-providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true, isActive: true }),
      })
      if (!res.ok) throw new Error('Не удалось установить по умолчанию')
      toast({ title: 'Провайдер по умолчанию', description: p.name })
      loadProviders()
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Ошибка',
        variant: 'destructive',
      })
    }
  }

  // Удаление
  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/ai-providers/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Не удалось удалить')
      toast({ title: 'Провайдер удалён' })
      setDeleteId(null)
      loadProviders()
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось удалить',
        variant: 'destructive',
      })
    }
  }

  const needsBaseUrl = form.type !== 'zai'
  const needsFolderId = form.type === 'yandex_cloud'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-600" />
              ИИ-провайдеры
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
             Универсальный коннектор ИИ-моделей. Поддержка OpenAI-совместимых API, Yandex Cloud,
              Cloud.ru, Ollama и встроенного z-ai-web-dev-sdk.
           </p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить провайдера
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Нет настроенных провайдеров.</p>
              <p className="text-sm">
                Без провайдеров генерация использует встроенный z-ai-web-dev-sdk.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Модель</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>По умолчанию</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PROVIDER_TYPE_LABELS[p.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.modelName}</TableCell>
                    <TableCell>
                      {p.lastTestStatus === 'ok' ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      ) : p.lastTestStatus === 'error' ? (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Ошибка
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Не проверен</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.isDefault ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          <Star className="h-3 w-3 mr-1" />
                          По умолчанию
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(p)}
                          className="text-xs"
                        >
                          Сделать активным
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(p)}
                          disabled={testingId === p.id}
                        >
                          {testingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Тест</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Диалог добавления/редактирования */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Редактирование провайдера' : 'Новый ИИ-провайдер'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="OpenAI Production"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Тип провайдера *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as ProviderType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                Base URL {needsBaseUrl ? '*' : '(не требуется)'}
              </Label>
              <Input
                id="baseUrl"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder={BASE_URL_HINTS[form.type]}
                disabled={!needsBaseUrl}
              />
              <p className="text-xs text-muted-foreground">
                Без суффикса /v1/chat/completions — он добавится автоматически.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">Имя модели *</Label>
                <Input
                  id="modelName"
                  value={form.modelName}
                  onChange={(e) => setForm({ ...form, modelName: e.target.value })}
                  placeholder="gpt-4o / yandexgpt / qwen2.5"
                />
              </div>
              {needsFolderId ? (
                <div className="space-y-2">
                  <Label htmlFor="folderId">Folder ID * (Yandex Cloud)</Label>
                  <Input
                    id="folderId"
                    value={form.folderId}
                    onChange={(e) => setForm({ ...form, folderId: e.target.value })}
                    placeholder="b1g..."
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API-ключ {form.id ? '(оставьте пустым, чтобы не менять)' : needsBaseUrl && form.type !== 'ollama' ? ' *' : ''}
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.id ? '••••••••' : 'sk-... или OAuth-токен для Yandex'}
              />
              <p className="text-xs text-muted-foreground">
                Для Yandex Cloud — это OAuth-токен (IAM получается автоматически).
                Для Ollama ключ не требуется. Ключ шифруется (AES-256-GCM) перед сохранением.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxTokens">Max tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min="1"
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  id="isActive"
                />
                <Label htmlFor="isActive">Активен</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isDefault}
                  onCheckedChange={(v) => setForm({ ...form, isDefault: v })}
                  id="isDefault"
                />
                <Label htmlFor="isDefault">По умолчанию</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить провайдера?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="text-sm text-muted-foreground">
            Действие необратимо. Провайдер будет удалён из базы данных.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
