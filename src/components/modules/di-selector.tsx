'use client'

import { useState, useMemo, useEffect } from 'react'
import { CascadePositionSelector } from './cascade-position-selector'
import { DICard, diTypeFromStatus, type DIType, type DICardData } from './di-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, FileText, Filter } from 'lucide-react'

// Минимальные типы данных из API.
interface Company { id: string; name: string }
interface DepartmentItem { id: string; name: string; companyId: string | null }
interface PositionItem { id: string; title: string; code: string; departmentId: string }

// Запись сгенерированной ДИ из /api/generated-di (с вычисленным полем type).
interface GeneratedDIRow {
  id: string
  title: string
  status: string
  type?: DIType
  currentVersion?: number
  createdAt: string
  updatedAt?: string
  sourceArchive?: { id: string; title: string } | null
  sourceArchiveTitle?: string | null
  position?: { id: string; title: string; code?: string | null; department?: { id: string; name: string; company?: { id: string; name: string } | null } | null } | null
}

export interface DISelectorProps {
  // Выбранная ДИ (контролируемый компонент).
  selectedDIId: string
  onDIChange: (diId: string) => void
  // Фильтр по типам ДИ (какие показывать). По умолчанию все 4.
  allowedTypes?: DIType[]
  // Заголовок.
  title?: string
  compact?: boolean
}

/**
 * Единый селектор ДИ (ТЗ §5.4): организация → подразделение → должность → ДИ.
 *
 * После выбора должности подгружает все её ДИ (сгенерированные + архивные)
 * и показывает их карточками с фильтром по типу. Применяется в AI-аудите,
 * сравнении, отслеживании.
 */
export function DISelector({
  selectedDIId,
  onDIChange,
  allowedTypes,
  title = 'Выбор должностной инструкции',
  compact = false,
}: DISelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [selPositionId, setSelPositionId] = useState('')
  const [generatedDIs, setGeneratedDIs] = useState<GeneratedDIRow[]>([])
  const [archiveDIs, setArchiveDIs] = useState<{ id: string; title: string; content: string; uploadedAt: string; fileName?: string | null; derivedCount?: number; position?: { title: string; code?: string | null; department?: { name: string; company?: { name: string } | null } | null } | null }[]>([])
  const [loading, setLoading] = useState(false)

  // Загрузка справочников (компании/подразделения/должности).
  useEffect(() => {
    (async () => {
      try {
        const [c, d, p] = await Promise.all([fetch('/api/companies'), fetch('/api/departments'), fetch('/api/positions')])
        setCompanies(await c.json())
        setDepartments(await d.json())
        setPositions(await p.json())
      } catch {
        // silent
      }
    })()
  }, [])

  // Загрузка ДИ по выбранной должности.
  useEffect(() => {
    if (!selPositionId) {
      setGeneratedDIs([])
      setArchiveDIs([])
      return
    }
    (async () => {
      setLoading(true)
      try {
        const [genRes, archRes] = await Promise.all([
          fetch('/api/generated-di'),
          fetch(`/api/archive-di?positionId=${selPositionId}`),
        ])
        const genAll: GeneratedDIRow[] = genRes.ok ? await genRes.json() : []
        // Фильтруем по выбранной должности.
        setGeneratedDIs(genAll.filter(g => g.position?.id === selPositionId))
        setArchiveDIs(archRes.ok ? await archRes.json() : [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()
  }, [selPositionId])

  // Сборка карточек ДИ из сгенерированных + архивных, с фильтром по типу.
  const cards: DICardData[] = useMemo(() => {
    const genCards: DICardData[] = generatedDIs.map(g => ({
      id: g.id,
      type: g.type ?? diTypeFromStatus(g.status),
      title: g.title,
      companyName: g.position?.department?.company?.name ?? null,
      departmentName: g.position?.department?.name ?? null,
      positionTitle: g.position?.title ?? null,
      positionCode: g.position?.code ?? null,
      date: g.createdAt,
      content: '',
      version: g.currentVersion ?? null,
      sourceArchiveTitle: g.sourceArchive?.title ?? null,
    }))
    const archCards: DICardData[] = archiveDIs.map(a => ({
      id: a.id,
      type: 'archive' as DIType,
      title: a.title,
      companyName: a.position?.department?.company?.name ?? null,
      departmentName: a.position?.department?.name ?? null,
      positionTitle: a.position?.title ?? null,
      positionCode: a.position?.code ?? null,
      date: a.uploadedAt,
      content: a.content,
      fileName: a.fileName ?? null,
      derivedCount: a.derivedCount ?? null,
    }))
    const all = [...genCards, ...archCards]
    return allowedTypes ? all.filter(c => allowedTypes.includes(c.type)) : all
  }, [generatedDIs, archiveDIs, allowedTypes])

  // Метка-фильтр для подсветки активных типов.
  const typeCounts = useMemo(() => {
    const counts: Record<DIType, number> = { archive: 0, draft: 0, review: 0, approved: 0 }
    cards.forEach(c => { counts[c.type]++ })
    return counts
  }, [cards])

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className={compact ? 'p-3 pb-2' : 'pb-3'}>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          <CascadePositionSelector
            positionId={selPositionId}
            onPositionChange={setSelPositionId}
            companies={companies}
            departments={departments}
            positions={positions}
            compact
          />
        </CardContent>
      </Card>

      {/* Список ДИ выбранной должности */}
      {selPositionId && (
        <Card>
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" /> Доступные ДИ
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {(['archive', 'draft', 'review', 'approved'] as DIType[]).map(t => (
                  typeCounts[t] > 0 && (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t === 'archive' ? 'Архив' : t === 'draft' ? 'Сгенер.' : t === 'review' ? 'Согл.' : 'Утв.'}: {typeCounts[t]}
                    </Badge>
                  )
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                Нет ДИ для выбранной должности
              </div>
            ) : (
              <ScrollArea className="h-[340px]">
                <div className="space-y-2 pr-2">
                  {cards.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onDIChange(c.id)}
                      className={`w-full text-left rounded-lg transition-all ${selectedDIId === c.id ? 'ring-2 ring-primary' : 'hover:bg-muted/40'}`}
                    >
                      <DICard di={c} actions={false} compact />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
