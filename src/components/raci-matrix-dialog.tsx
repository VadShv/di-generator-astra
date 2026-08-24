'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Table as TableIcon } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface RACIItem {
  positionId: string
  role: string // R | A | C | I
}

interface RACIZone {
  zone: string
  items: RACIItem[]
}

interface RACIMatrixData {
  id: string
  departmentId: string
  zones: RACIZone[]
  generatedBy: string | null
  updatedAt: string
}

interface Position {
  id: string
  title: string
}

const ROLE_COLORS: Record<string, string> = {
  R: 'bg-blue-100 text-blue-700 border-blue-300',
  A: 'bg-red-100 text-red-700 border-red-300',
  C: 'bg-amber-100 text-amber-700 border-amber-300',
  I: 'bg-gray-100 text-gray-600 border-gray-300',
}

const ROLE_LABELS: Record<string, string> = {
  R: 'R — Responsible',
  A: 'A — Accountable',
  C: 'C — Consulted',
  I: 'I — Informed',
}

const ROLE_CYCLE = ['R', 'A', 'C', 'I', '']

export function RaciMatrixDialog({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  positions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  departmentId: string
  departmentName: string
  positions: Position[]
}) {
  const { toast } = useToast()
  const [matrix, setMatrix] = useState<RACIMatrixData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchMatrix = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/raci/${departmentId}`)
      if (res.ok) {
        const data = await res.json()
        setMatrix(data)
      } else {
        setMatrix(null)
      }
    } catch {
      setMatrix(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    if (open) fetchMatrix()
  }, [open, fetchMatrix])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/raci/${departmentId}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setMatrix(data)
        toast({ title: 'RACI матрица сгенерирована', description: `${data.zones?.length || 0} зон ответственности` })
      } else {
        const d = await res.json()
        toast({ title: 'Ошибка', description: d.error || 'Не удалось сгенерировать', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleCellClick = (zoneIdx: number, positionId: string) => {
    if (!matrix) return
    const zones = [...matrix.zones]
    const zone = { ...zones[zoneIdx] }
    const items = [...zone.items]
    const itemIdx = items.findIndex((i) => i.positionId === positionId)
    const currentRole = itemIdx >= 0 ? items[itemIdx].role : ''
    const nextRole = ROLE_CYCLE[(ROLE_CYCLE.indexOf(currentRole) + 1) % ROLE_CYCLE.length]

    if (nextRole === '') {
      if (itemIdx >= 0) items.splice(itemIdx, 1)
    } else {
      if (itemIdx >= 0) {
        items[itemIdx] = { positionId, role: nextRole }
      } else {
        items.push({ positionId, role: nextRole })
      }
    }
    zone.items = items
    zones[zoneIdx] = zone
    setMatrix({ ...matrix, zones })
  }

  const handleSave = async () => {
    if (!matrix) return
    setSaving(true)
    try {
      const res = await fetch(`/api/raci/${departmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones: matrix.zones }),
      })
      if (res.ok) {
        toast({ title: 'Сохранено', description: 'RACI матрица обновлена' })
      } else {
        toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка сети', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const getRole = (zone: RACIZone, positionId: string): string => {
    return zone.items.find((i) => i.positionId === positionId)?.role || ''
  }

  // Coverage check: each zone should have at least one R and one A
  const coverageIssues = matrix?.zones.filter(
    (z) => !z.items.some((i) => i.role === 'R') || !z.items.some((i) => i.role === 'A')
  ) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            RACI матрица — {departmentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <Button onClick={handleGenerate} disabled={generating || loading} size="sm">
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            {matrix ? 'Перегенерировать' : 'Сгенерировать RACI'}
          </Button>
          {matrix && (
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Сохранить
            </Button>
          )}
          {matrix && coverageIssues.length === 0 && (
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Все зоны покрыты
            </Badge>
          )}
          {matrix && coverageIssues.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300">
              <AlertTriangle className="h-3 w-3 mr-1" /> {coverageIssues.length} зон без R или A
            </Badge>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !matrix && (
          <div className="py-12 text-center text-muted-foreground">
            <TableIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>RACI матрица ещё не создана</p>
            <p className="text-sm mt-1">Нажмите «Сгенерировать RACI» для AI-генерации из ДИ подразделения</p>
          </div>
        )}

        {!loading && matrix && matrix.zones.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background min-w-[200px]">Зона ответственности</TableHead>
                  {positions.map((p) => (
                    <TableHead key={p.id} className="text-center min-w-[80px] text-xs">
                      {p.title.length > 20 ? p.title.slice(0, 18) + '…' : p.title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.zones.map((zone, zoneIdx) => {
                  const hasIssue = !zone.items.some((i) => i.role === 'R') || !zone.items.some((i) => i.role === 'A')
                  return (
                    <TableRow key={zoneIdx}>
                      <TableCell className="sticky left-0 bg-background font-medium text-sm">
                        {hasIssue && <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />}
                        {zone.zone}
                      </TableCell>
                      {positions.map((p) => {
                        const role = getRole(zone, p.id)
                        return (
                          <TableCell key={p.id} className="text-center p-1">
                            <button
                              onClick={() => handleCellClick(zoneIdx, p.id)}
                              className={`w-8 h-8 rounded-md border text-xs font-bold transition-all hover:scale-110 ${
                                role ? ROLE_COLORS[role] : 'border-transparent hover:border-muted'
                              }`}
                            >
                              {role || '·'}
                            </button>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && matrix && matrix.zones.length === 0 && (
          <p className="text-center text-muted-foreground py-8">AI не смог извлечь зоны ответственности. Попробуйте перегенерировать.</p>
        )}

        {matrix && (
          <div className="flex gap-3 flex-wrap text-xs text-muted-foreground mt-2">
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <span className={`w-5 h-5 rounded border text-xs font-bold flex items-center justify-center ${ROLE_COLORS[key]}`}>{key}</span>
                {label}
              </span>
            ))}
            <span className="text-muted-foreground">· Клик по ячейке — циклический переход R→A→C→I→пусто</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
