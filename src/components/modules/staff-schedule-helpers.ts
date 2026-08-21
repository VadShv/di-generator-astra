// Вспомогательные функции для модуля «Штатное расписание» (Фаза 6: Frontend refactoring).
// Извлечены из staff-schedule.tsx для уменьшения размера главного компонента.

import { FileCheck, FileClock, FileText, FileX2 } from 'lucide-react'
import type { Company, Department, Position } from './staff-schedule-types'

/** Статус ДИ для должности (метка + цвет + иконка). */
export function getDIStatus(pos: Position) {
  const approved = pos.generatedDIs.some((d) => d.status === 'approved')
  const hasGenerated = pos.generatedDIs.length > 0
  const hasArchive = pos.archiveDIs.length > 0

  if (approved) return { label: 'Утверждена', color: 'bg-emerald-500', icon: FileCheck, textColor: 'text-emerald-700' }
  if (hasGenerated) return { label: 'Сгенерирована', color: 'bg-amber-500', icon: FileClock, textColor: 'text-amber-700' }
  if (hasArchive) return { label: 'Архивная', color: 'bg-slate-400', icon: FileText, textColor: 'text-slate-600' }
  return { label: 'Нет ДИ', color: 'bg-red-400', icon: FileX2, textColor: 'text-red-600' }
}

/** Человекочитаемая метка грейда. */
export function getGradeLabel(grade: string | null) {
  if (!grade) return null
  if (grade === 'руководитель') return 'Руководитель'
  if (grade === 'линейная') return 'Линейная'
  return grade
}

/** Все ID подразделений-потомков (включая само). */
export function getAllDescendantDeptIds(deptId: string, departments: Department[]): string[] {
  const result = [deptId]
  const children = departments.filter((d) => d.parentId === deptId)
  for (const child of children) {
    result.push(...getAllDescendantDeptIds(child.id, departments))
  }
  return result
}

/** Покрытие ДИ для подразделения (с учётом дочерних). */
export function getDICoverage(deptId: string, positions: Position[], departments: Department[]) {
  const allDeptIds = getAllDescendantDeptIds(deptId, departments)
  const deptPositions = positions.filter((p) => allDeptIds.includes(p.departmentId))
  if (deptPositions.length === 0) return { total: 0, covered: 0, percent: 0 }
  const covered = deptPositions.filter((p) => p.generatedDIs.some((d) => d.status === 'approved')).length
  const total = deptPositions.length
  const percent = Math.round((covered / total) * 100)
  return { total, covered, percent }
}
