'use client'

// Модуль личного кабинета (Профиль).
// Для всех: карточка профиля, смена пароля, обзор прав доступа.
// Для администратора дополнительно: управление пользователями и системные настройки.

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserCircle, KeyRound, Users, Settings, Plus, Pencil, Trash2, Loader2, Shield, ShieldCheck } from 'lucide-react'
import { ALL_TABS, KDP_PRESET, type Permissions, type AccessLevel } from '@/lib/auth/permissions'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', kdp: 'Специалист по КДП', user: 'Пользователь',
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Дашборд', 'staff-schedule': 'Штатное расписание', dictionaries: 'Справочники',
  archive: 'Архив ДИ', templates: 'Шаблоны ДИ', 'master-prompts': 'Мастер-промпты',
  'ai-providers': 'ИИ-провайдеры', generation: 'Генерация ДИ', 'mass-generation': 'Массовая генерация',
  tracking: 'Журнал действий', 'version-history': 'Версии и сравнение', 'ai-audit': 'Аудит ДИ',
  instructions: 'Инструкции', 'tech-stack': 'Стек технологий', profile: 'Профиль',
}

const ACCESS_LABELS: Record<AccessLevel, string> = { read: 'Чтение', write: 'Запись', none: 'Нет доступа' }

interface SessionUser {
  id?: string
  email?: string | null
  name?: string | null
  role?: string
  permissions?: Permissions | null
}

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  permissions: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function parsePermissionsJson(raw: string | null): Permissions {
  if (!raw) return {}
  try { return JSON.parse(raw) as Permissions } catch { return {} }
}

function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABELS[role] || role
  if (role === 'admin') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{label}</Badge>
  if (role === 'kdp') return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{label}</Badge>
  return <Badge variant="secondary">{label}</Badge>
}

function AccessBadge({ level }: { level: AccessLevel }) {
  if (level === 'write') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{ACCESS_LABELS.write}</Badge>
  if (level === 'read') return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{ACCESS_LABELS.read}</Badge>
  return <Badge variant="outline" className="text-muted-foreground">{ACCESS_LABELS.none}</Badge>
}

function PermissionsEditor({ permissions, onChange }: { permissions: Permissions; onChange: (p: Permissions) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ALL_TABS.map((tab) => (
        <div key={tab} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <Label className="text-sm font-normal truncate">{TAB_LABELS[tab] || tab}</Label>
          <Select
            value={permissions[tab] || 'none'}
            onValueChange={(v) => onChange({ ...permissions, [tab]: v as AccessLevel })}
          >
            <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{ACCESS_LABELS.none}</SelectItem>
              <SelectItem value="read">{ACCESS_LABELS.read}</SelectItem>
              <SelectItem value="write">{ACCESS_LABELS.write}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

function SettingRow({ label, value, saving, onSave }: {
  label: string; value: string; saving: boolean; onSave: (v: string) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Label className="text-sm font-normal">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" value={local} onChange={(e) => setLocal(e.target.value)} className="w-32" />
        <Button size="sm" onClick={() => onSave(local)} disabled={saving || local === value}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </div>
  )
}

export function ProfileModule() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const user = session?.user as SessionUser | undefined
  const isAdmin = user?.role === 'admin'
  const myId = user?.id
  const errToast = (e: unknown, fallback: string) =>
    toast({ title: 'Ошибка', description: e instanceof Error ? e.message : fallback, variant: 'destructive' })

  // Смена пароля
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const handleChangePassword = async () => {
    if (pwd.next.length < 6) {
      toast({ title: 'Внимание', description: 'Новый пароль должен быть не менее 6 символов', variant: 'destructive' })
      return
    }
    if (pwd.next !== pwd.confirm) {
      toast({ title: 'Внимание', description: 'Пароли не совпадают', variant: 'destructive' })
      return
    }
    setPwdSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось сменить пароль')
      }
      toast({ title: 'Пароль изменён' })
      setPwd({ current: '', next: '', confirm: '' })
    } catch (e) {
      errToast(e, 'Не удалось сменить пароль')
    } finally {
      setPwdSaving(false)
    }
  }

  // Управление пользователями (admin)
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [userSaving, setUserSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<{
    email: string; name: string; password: string; role: string; isActive: boolean; permissions: Permissions
  }>({ email: '', name: '', password: '', role: 'user', isActive: true, permissions: {} })

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Не удалось загрузить пользователей')
      setUsers((await res.json()) as UserRow[])
    } catch (e) {
      errToast(e, 'Не удалось загрузить пользователей')
    } finally {
      setUsersLoading(false)
    }
  }, [toast])

  useEffect(() => { if (isAdmin) loadUsers() }, [isAdmin, loadUsers])

  const openCreateUser = () => {
    setEditingUser(null)
    setUserForm({ email: '', name: '', password: '', role: 'user', isActive: true, permissions: {} })
    setUserDialogOpen(true)
  }

  const openEditUser = (u: UserRow) => {
    setEditingUser(u)
    setUserForm({
      email: u.email, name: u.name || '', password: '', role: u.role, isActive: u.isActive,
      permissions: u.role === 'admin' ? {} : parsePermissionsJson(u.permissions),
    })
    setUserDialogOpen(true)
  }

  const handleRoleChange = (role: string) => {
    setUserForm((prev) => ({
      ...prev, role,
      permissions: role === 'kdp' ? { ...KDP_PRESET } : prev.permissions,
    }))
  }

  const handleSaveUser = async () => {
    const isEdit = !!editingUser
    if (!isEdit && (!userForm.email.trim() || !userForm.password.trim())) {
      toast({ title: 'Внимание', description: 'Email и пароль обязательны', variant: 'destructive' })
      return
    }
    setUserSaving(true)
    try {
      const payload: Record<string, unknown> = { name: userForm.name || null, role: userForm.role }
      if (isEdit) {
        payload.isActive = userForm.isActive
        payload.permissions = userForm.role === 'admin' ? null : userForm.permissions
      } else {
        payload.email = userForm.email
        payload.password = userForm.password
        if (userForm.role !== 'admin') payload.permissions = userForm.permissions
      }
      const url = isEdit ? `/api/users/${editingUser!.id}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ошибка сохранения')
      }
      toast({ title: isEdit ? 'Пользователь обновлён' : 'Пользователь создан' })
      setUserDialogOpen(false)
      loadUsers()
    } catch (e) {
      errToast(e, 'Не удалось сохранить')
    } finally {
      setUserSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Не удалось удалить')
      }
      toast({ title: 'Пользователь удалён' })
      setDeleteId(null)
      loadUsers()
    } catch (e) {
      errToast(e, 'Не удалось удалить')
    }
  }

  // Системные настройки (admin)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Не удалось загрузить настройки')
      setSettings((await res.json()) as Record<string, string>)
    } catch (e) {
      errToast(e, 'Не удалось загрузить настройки')
    } finally {
      setSettingsLoading(false)
    }
  }, [toast])

  useEffect(() => { if (isAdmin) loadSettings() }, [isAdmin, loadSettings])

  const handleSaveSetting = async (key: string, value: string) => {
    setSavingKey(key)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ошибка сохранения')
      }
      setSettings((prev) => ({ ...prev, [key]: value }))
      toast({ title: 'Настройка сохранена' })
    } catch (e) {
      errToast(e, 'Не удалось сохранить')
    } finally {
      setSavingKey(null)
    }
  }

  const perms = user?.permissions
  const hasFullAccess = !perms || isAdmin

  return (
    <div className="space-y-6">
      {/* Карточка профиля */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-blue-600" /> Профиль
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Имя</p>
              <p className="font-medium">{user?.name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Роль</p>
              <RoleBadge role={user?.role || 'user'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Смена пароля */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" /> Смена пароля
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cur-pwd">Текущий пароль</Label>
              <Input id="cur-pwd" type="password" value={pwd.current}
                onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pwd">Новый пароль</Label>
              <Input id="new-pwd" type="password" value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf-pwd">Подтверждение</Label>
              <Input id="conf-pwd" type="password" value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={pwdSaving}>
            {pwdSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Сменить пароль
          </Button>
        </CardContent>
      </Card>

      {/* Обзор прав доступа */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" /> Права доступа
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasFullAccess ? (
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="font-medium">Полный доступ</span>
              <span className="text-muted-foreground">— все вкладки доступны на запись</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ALL_TABS.map((tab) => (
                <div key={tab} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm truncate">{TAB_LABELS[tab] || tab}</span>
                  <AccessBadge level={(perms?.[tab] as AccessLevel) || 'none'} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Секции администратора --- */}
      {isAdmin && (
        <>
          {/* Управление пользователями */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" /> Пользователи
              </CardTitle>
              <Button onClick={openCreateUser}>
                <Plus className="h-4 w-4 mr-2" /> Создать пользователя
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Имя</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Последний вход</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.name || '—'}</TableCell>
                        <TableCell><RoleBadge role={u.role} /></TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Заблокирован</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(u.lastLoginAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEditUser(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDeleteId(u.id)} disabled={u.id === myId}>
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

          {/* Системные настройки */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-slate-600" /> Системные настройки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Загрузка…
                </div>
              ) : (
                <div className="space-y-4">
                  <SettingRow label="Лимит массовой генерации" value={settings.massGenLimit || ''}
                    saving={savingKey === 'massGenLimit'} onSave={(v) => handleSaveSetting('massGenLimit', v)} />
                  <Separator />
                  <SettingRow label="Лимит загрузки файлов" value={settings.fileUploadLimit || ''}
                    saving={savingKey === 'fileUploadLimit'} onSave={(v) => handleSaveSetting('fileUploadLimit', v)} />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Диалог создания/редактирования пользователя */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Редактирование пользователя' : 'Новый пользователь'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-email">Email</Label>
                <Input id="u-email" value={userForm.email} disabled={!!editingUser} placeholder="user@example.com"
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-name">Имя</Label>
                <Input id="u-name" value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="u-pwd">Пароль</Label>
                <Input id="u-pwd" type="password" value={userForm.password} placeholder="Минимум 6 символов"
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-role">Роль</Label>
                <Select value={userForm.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="u-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Администратор</SelectItem>
                    <SelectItem value="kdp">Специалист по КДП</SelectItem>
                    <SelectItem value="user">Пользователь</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingUser && (
                <div className="flex items-end gap-2 pb-2">
                  <Switch id="u-active" checked={userForm.isActive}
                    onCheckedChange={(v) => setUserForm({ ...userForm, isActive: v })} />
                  <Label htmlFor="u-active">Активен</Label>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Права доступа</Label>
              {userForm.role === 'admin' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-md border px-3 py-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Администратор имеет полный доступ ко всем вкладкам.
                </div>
              ) : (
                <PermissionsEditor permissions={userForm.permissions}
                  onChange={(p) => setUserForm({ ...userForm, permissions: p })} />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)} disabled={userSaving}>Отмена</Button>
            <Button onClick={handleSaveUser} disabled={userSaving}>
              {userSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Удалить пользователя?</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">
            Действие необратимо. Пользователь будет удалён из базы данных.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
