'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Building2, FolderTree, Briefcase, FileText, CornerDownLeft } from 'lucide-react'

interface SearchResult {
  positions: Array<{ id: string; title: string; grade: string | null; department: { name: string; company: { name: string } } }>
  departments: Array<{ id: string; name: string; code: string | null; company: { name: string } }>
  instructions: Array<{ id: string; title: string; status: string; position: { title: string; department: { name: string } } }>
  archiveDIs: Array<{ id: string; title: string; positionTitle: string | null; departmentName: string | null; companyName: string | null }>
}

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { setActiveSection } = useAppStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=10`)
      if (res.ok) {
        setResults(await res.json())
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const handleSelect = (type: 'position' | 'department' | 'instruction' | 'archive', id: string) => {
    onOpenChange(false)
    if (type === 'position' || type === 'department') {
      setActiveSection('staff-schedule')
    } else if (type === 'instruction') {
      setActiveSection('version-history')
    } else if (type === 'archive') {
      setActiveSection('archive')
    }
    toast({ title: 'Переход', description: `Выбран элемент: ${id.slice(-6)}` })
  }

  const hasResults = results && (
    (results.positions?.length ?? 0) > 0 ||
    (results.departments?.length ?? 0) > 0 ||
    (results.instructions?.length ?? 0) > 0 ||
    (results.archiveDIs?.length ?? 0) > 0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Поиск по компаниям, подразделениям, должностям, ДИ..."
            className="border-0 focus-visible:ring-0 text-base"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onOpenChange(false)
            }}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          <kbd className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {!hasResults && query.trim().length >= 2 && !loading && (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Ничего не найдено по запросу «{query}»</p>
            </div>
          )}
          {!hasResults && query.trim().length < 2 && (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Начните вводить для поиска</p>
              <p className="text-xs mt-1">Компании, подразделения, должности, ДИ</p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {results!.positions?.length > 0 && (
                <div className="px-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" /> Должности
                  </p>
                  {results!.positions.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelect('position', p.id)}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted flex items-center gap-2 group"
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.department?.name} · {p.department?.company?.name}
                        </p>
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}

              {results!.departments?.length > 0 && (
                <div className="px-2 mt-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                    <FolderTree className="h-3.5 w-3.5" /> Подразделения
                  </p>
                  {results!.departments.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelect('department', d.id)}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted flex items-center gap-2 group"
                    >
                      <FolderTree className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.company?.name}</p>
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}

              {results!.instructions?.length > 0 && (
                <div className="px-2 mt-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Сгенерированные ДИ
                  </p>
                  {results!.instructions.map((di) => (
                    <button
                      key={di.id}
                      onClick={() => handleSelect('instruction', di.id)}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted flex items-center gap-2 group"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{di.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {di.position?.title} · {di.position?.department?.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{di.status}</Badge>
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}

              {results!.archiveDIs?.length > 0 && (
                <div className="px-2 mt-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Архивные ДИ
                  </p>
                  {results!.archiveDIs.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelect('archive', a.id)}
                      className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted flex items-center gap-2 group"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[a.positionTitle, a.departmentName, a.companyName].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
