'use client'

// Общий слой чтения/инвалидации данных ДИ через React Query.
//
// Назначение: связать три пути генерации ДИ (вкладка «Генерация ДИ», карточка
// должности в штатном расписании, массовая генерация) через единый кэш. Все
// экраны читают ДИ по общим ключам (см. query-keys.ts), а любая мутация
// (генерация/сохранение/удаление/смена статуса) вызывает invalidateDIData(),
// после чего все подписанные экраны автоматически подтягивают свежие данные.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { diKeys, positionKeys } from '@/lib/query-keys'

// ===== Типы ответов API =====

/** Секция сгенерированной ДИ. */
export interface DISection {
  id: string
  sectionTitle: string
  sectionContent: string
  order: number
  aiGenerated?: boolean
  editedBy?: string | null
}

/** Строка сгенерированной ДИ (полная — из /api/generate-di и /api/generated-di). */
export interface GeneratedDI {
  id: string
  title: string
  status: string
  currentVersion: number
  signedByEmployee: boolean
  signedAt?: string | null
  createdAt: string
  updatedAt?: string
  positionId?: string
  templateId?: string | null
  sections: DISection[]
  position?: unknown
  template?: unknown
  sourceArchive?: { id: string; title: string } | null
  _count?: { sections?: number; versions?: number; auditResults?: number }
  type?: string
}

interface PaginatedDIResponse {
  items: GeneratedDI[]
  total: number
  page: number
  pageSize: number
}

// ===== Fetch-функции =====

async function fetchDIList(): Promise<GeneratedDI[]> {
  const res = await fetch('/api/generate-di')
  if (!res.ok) throw new Error('Не удалось загрузить список ДИ')
  return res.json()
}

/**
 * Список ДИ конкретной должности.
 * Важно: передаём positionId на сервер и берём большой pageSize, чтобы получить
 * ВСЕ ДИ должности. Ранее запрос шёл без positionId (первая страница из 50 по
 * всей БД) с фильтром на клиенте — из-за чего после массовой генерации ДИ
 * должности могли «пропадать» из карточки, не попав в первую страницу.
 */
async function fetchDIByPosition(positionId: string): Promise<GeneratedDI[]> {
  const res = await fetch(`/api/generated-di?positionId=${encodeURIComponent(positionId)}&pageSize=200`)
  if (!res.ok) throw new Error('Не удалось загрузить ДИ должности')
  const data = (await res.json()) as PaginatedDIResponse
  return data.items
}

// ===== Хуки чтения =====

/** Полный список ДИ (вкладка «Генерация ДИ»). */
export function useDIList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diKeys.list(),
    queryFn: fetchDIList,
    enabled: options?.enabled ?? true,
  })
}

/** Список ДИ конкретной должности (карточка должности в штатном расписании). */
export function useDIByPosition(positionId: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: diKeys.byPosition(positionId ?? ''),
    queryFn: () => fetchDIByPosition(positionId as string),
    enabled: (options?.enabled ?? true) && Boolean(positionId),
  })
}

// ===== Инвалидация =====

/**
 * Возвращает функцию, инвалидирующую все ДИ- и position-запросы разом.
 * Вызывать после ЛЮБОЙ мутации ДИ (генерация одиночная/массовая, сохранение,
 * смена статуса, удаление), из любого экрана — все подписанные экраны
 * (вкладка «Генерация ДИ», карточка должности, дерево штатки) обновятся.
 */
export function useInvalidateDIData() {
  const queryClient = useQueryClient()
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: diKeys.all })
    void queryClient.invalidateQueries({ queryKey: positionKeys.all })
  }, [queryClient])
}
