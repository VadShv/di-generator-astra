'use client'

// Чтение списка должностей через React Query (дерево штатного расписания).
// Список включает generatedDIs (статус-бейджи ДИ) и archiveDIs, поэтому после
// генерации ДИ из любого пути инвалидация positionKeys обновляет бейджи в дереве.

import { useQuery } from '@tanstack/react-query'
import { positionKeys } from '@/lib/query-keys'
import type { Position } from '@/components/modules/staff-schedule-types'

async function fetchPositions(): Promise<Position[]> {
  const res = await fetch('/api/positions')
  if (!res.ok) throw new Error('Не удалось загрузить должности')
  return res.json()
}

/** Список должностей с включёнными ДИ (для дерева штатного расписания). */
export function usePositions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: positionKeys.list(),
    queryFn: fetchPositions,
    enabled: options?.enabled ?? true,
  })
}
