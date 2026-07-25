'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command'
import { Users, Building2, FileText, Search } from 'lucide-react'
import { useAppStore, type ActiveSection } from '@/lib/store'

type PositionResult = {
  id: string
  title: string
  grade: string | null
  departmentName: string | null
  companyName: string | null
}
type DepartmentResult = {
  id: string
  name: string
  code: string
  companyName: string | null
}
type InstructionResult = {
  id: string
  title: string
  status: string
  updatedAt: string
  positionTitle: string | null
}
type SearchResponse = {
  positions: PositionResult[]
  departments: DepartmentResult[]
  instructions: InstructionResult[]
}

// Глобальный поиск с дебаунсом: должности / подразделения / должностные инструкции.
// Открывается по клику на триггер или хоткею Cmd/Ctrl+K.
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const setActiveSection = useAppStore(s => s.setActiveSection)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse>({ positions: [], departments: [], instructions: [] })
  const [loading, setLoading] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ positions: [], departments: [], instructions: [] })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      if (res.ok) setResults(data)
    } catch {
      // Тихо игнорируем сетевые ошибки — поиск вспомогательный
    } finally {
      setLoading(false)
    }
  }, [])

  // Дебаунс 300 мс
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const hasResults =
    results.positions.length > 0 ||
    results.departments.length > 0 ||
    results.instructions.length > 0

  const goTo = (section: ActiveSection) => {
    setActiveSection(section)
    onOpenChange(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Поиск должностей, подразделений, инструкций..." value={query} onValueChange={setQuery} />
      <CommandList>
        {loading && <div className="py-6 text-center text-sm text-muted-foreground">Поиск...</div>}
        {!loading && !hasResults && query.trim().length >= 2 && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}
        {!loading && query.trim().length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Введите минимум 2 символа для поиска
          </div>
        )}

        {results.positions.length > 0 && (
          <CommandGroup heading="Должности">
            {results.positions.map(p => (
              <CommandItem key={p.id} onSelect={() => goTo('staff-schedule')} className="gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.title}</div>
                  {(p.departmentName || p.companyName) && (
                    <div className="truncate text-xs text-muted-foreground">
                      {[p.departmentName, p.companyName].filter(Boolean).join(' • ')}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.departments.length > 0 && (
          <CommandGroup heading="Подразделения">
            {results.departments.map(d => (
              <CommandItem key={d.id} onSelect={() => goTo('dictionaries')} className="gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{d.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.code}{d.companyName ? ` • ${d.companyName}` : ''}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.instructions.length > 0 && (
          <CommandGroup heading="Должностные инструкции">
            {results.instructions.map(i => (
              <CommandItem key={i.id} onSelect={() => goTo('archive')} className="gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{i.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {i.positionTitle ?? 'Без должности'} • {i.status}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}

// Триггер-кнопка поиска для шапки
export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground w-full max-w-xs"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left truncate">Поиск...</span>
      <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  )
}
