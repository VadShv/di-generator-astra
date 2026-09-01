'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface LegalReference {
  id: string
  type: string
  article: string
  title: string
  text: string
  category: string | null
  isActive: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: LegalReference | null
  onSaved: () => void
}

export function LegalReferenceDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    type: 'tk_rf',
    article: '',
    title: '',
    text: '',
    category: '',
  })
  const [saving, setSaving] = useState(false)

  // Sync form when dialog opens or editing changes
  const lastEditingId = editing?.id ?? null
  const formKey = `${open}-${lastEditingId}`
  const [syncedKey, setSyncedKey] = useState('')
  if (open && formKey !== syncedKey) {
    setSyncedKey(formKey)
    if (editing) {
      setForm({
        type: editing.type,
        article: editing.article,
        title: editing.title,
        text: editing.text,
        category: editing.category || '',
      })
    } else {
      setForm({ type: 'tk_rf', article: '', title: '', text: '', category: '' })
    }
  }

  const handleSave = async () => {
    if (!form.article.trim() || !form.title.trim() || !form.text.trim()) {
      toast({ title: 'Ошибка', description: 'Статья, заголовок и текст обязательны', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        article: form.article.trim(),
        title: form.title.trim(),
        text: form.text,
        category: form.category || null,
      }
      const url = editing ? `/api/legal-references/${editing.id}` : '/api/legal-references'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast({ title: editing ? 'Норма обновлена' : 'Норма добавлена' })
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить норму', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Редактировать норму' : 'Новая правовая норма'}</DialogTitle>
          <DialogDescription>Заполните поля правовой нормы</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tk_rf">ТК РФ</SelectItem>
                  <SelectItem value="mintrud">Минтруд</SelectItem>
                  <SelectItem value="profstandard">Профстандарты</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Статья *</Label>
              <Input value={form.article} onChange={e => setForm({ ...form, article: e.target.value })} placeholder="Напр. ст. 21 ТК РФ" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Заголовок *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Текст *</Label>
            <Textarea value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} className="min-h-[120px]" />
          </div>
          <div className="space-y-2">
            <Label>Категория</Label>
            <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Напр. обязанности" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2" />}
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteProps {
  deleteId: string | null
  onClose: () => void
  onDeleted: () => void
}

export function LegalReferenceDeleteDialog({ deleteId, onClose, onDeleted }: DeleteProps) {
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/legal-references/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Норма удалена' })
      onClose()
      onDeleted()
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить норму', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить правовую норму?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>Норма будет удалена безвозвратно.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => { e.preventDefault(); handleDelete() }}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-2" />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
