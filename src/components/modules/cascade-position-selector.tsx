'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle2, Building2, Users, Landmark } from 'lucide-react'

// Минимальные типы данных, получаемых из API
interface Company { id: string; name: string }
interface DepartmentItem { id: string; name: string; companyId: string | null; company?: { id: string; name: string } | null }
interface PositionItem {
  id: string
  title: string
  code: string
  departmentId: string
  department?: { id: string; name: string; companyId?: string | null } | null
}

interface CascadePositionSelectorProps {
  // Выбранная должность (контролируемый компонент)
  positionId: string
  onPositionChange: (positionId: string) => void
  // Опционально: предзагруженные данные, иначе компонент грузит сам
  companies?: Company[]
  departments?: DepartmentItem[]
  positions?: PositionItem[]
  // Подписи/компактность
  compact?: boolean
}

/**
 * Каскадный селектор должности: Организация → Подразделение → Должность.
 *
 * Логика:
 *  1. Сначала выбирается организация (одна).
 *  2. После выбора организации активируется выбор подразделения (из этой организации).
 *  3. После выбора подразделения активируется выбор должности (из этого подразделения).
 *  4. Изменение на верхнем уровне сбрасывает выбор на нижних уровнях.
 *
 * Используется в обычной генерации ДИ (AI и ручное создание),
 * чтобы пользователь шёл по тому же сценарию, что и в массовой генерации.
 */
export function CascadePositionSelector({
  positionId,
  onPositionChange,
  companies: companiesProp,
  departments: departmentsProp,
  positions: positionsProp,
  compact = false,
}: CascadePositionSelectorProps) {
  const [companies, setCompanies] = useState<Company[]>(companiesProp ?? [])
  const [departments, setDepartments] = useState<DepartmentItem[]>(departmentsProp ?? [])
  const [positions, setPositions] = useState<PositionItem[]>(positionsProp ?? [])
  const [loading, setLoading] = useState(!companiesProp || !departmentsProp || !positionsProp)

  // Внутренний выбор организации и подразделения (должность контролируется снаружи)
  const [selCompanyId, setSelCompanyId] = useState('')
  const [selDepartmentId, setSelDepartmentId] = useState('')

  // Подгрузка данных, если они не переданы снаружи
  const fetchData = useCallback(async () => {
    if (companiesProp && departmentsProp && positionsProp) {
      setCompanies(companiesProp)
      setDepartments(departmentsProp)
      setPositions(positionsProp)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const [cRes, dRes, pRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/departments'),
        fetch('/api/positions'),
      ])
      setCompanies(await cRes.json())
      setDepartments(await dRes.json())
      setPositions(await pRes.json())
    } catch {
      // silent — родитель покажет свою ошибку при необходимости
    } finally {
      setLoading(false)
    }
  }, [companiesProp, departmentsProp, positionsProp])

  useEffect(() => { fetchData() }, [fetchData])

  // При смене выбранной должности снаружи — восстановим компанию/подразделение
  useEffect(() => {
    if (!positionId) {
      setSelCompanyId('')
      setSelDepartmentId('')
      return
    }
    const pos = positions.find(p => p.id === positionId)
    if (pos) {
      const dept = pos.department
      if (dept) {
        if (dept.companyId && selCompanyId !== dept.companyId) {
          setSelCompanyId(dept.companyId)
        }
        if (selDepartmentId !== dept.id) {
          setSelDepartmentId(dept.id)
        }
      }
    }
  }, [positionId, positions, selCompanyId, selDepartmentId])

  // Каскадная фильтрация
  const filteredDepartments = useMemo(
    () => selCompanyId ? departments.filter(d => d.companyId === selCompanyId) : [],
    [departments, selCompanyId]
  )
  const filteredPositions = useMemo(
    () => selDepartmentId ? positions.filter(p => p.departmentId === selDepartmentId) : [],
    [positions, selDepartmentId]
  )

  // Обработчики с каскадным сбросом
  const handleCompanyChange = (id: string) => {
    setSelCompanyId(id)
    setSelDepartmentId('')
    onPositionChange('')
  }
  const handleDepartmentChange = (id: string) => {
    setSelDepartmentId(id)
    onPositionChange('')
  }
  const handlePositionChange = (id: string) => {
    onPositionChange(id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const sizeClass = compact ? 'max-h-44' : 'max-h-56'

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Блок 1: Организация */}
      <Card className={selCompanyId ? '' : 'ring-2 ring-primary/30'}>
        <CardHeader className={compact ? 'p-3 pb-1' : 'pb-3'}>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${selCompanyId ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'}`}>1</span>
            <Landmark className="h-4 w-4" /> Организация
          </CardTitle>
          {!compact && <CardDescription className="text-xs">Выберите компанию</CardDescription>}
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          <Select value={selCompanyId} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Выберите организацию" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Блок 2: Подразделение — активен после выбора организации */}
      <Card className={selCompanyId ? (selDepartmentId ? '' : 'ring-2 ring-primary/30') : 'opacity-50'}>
        <CardHeader className={compact ? 'p-3 pb-1' : 'pb-3'}>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${selDepartmentId ? 'bg-emerald-500 text-white' : selCompanyId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
            <Building2 className="h-4 w-4" /> Подразделение
          </CardTitle>
          {!compact && <CardDescription className="text-xs">
            {selCompanyId ? 'Выберите подразделение' : 'Сначала выберите организацию'}
          </CardDescription>}
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          {selCompanyId ? (
            <Select value={selDepartmentId} onValueChange={handleDepartmentChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Выберите подразделение" /></SelectTrigger>
              <SelectContent>
                {filteredDepartments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className={`flex items-center justify-center py-3 text-xs text-muted-foreground ${sizeClass}`}>
              Выберите организацию
            </div>
          )}
        </CardContent>
      </Card>

      {/* Блок 3: Должность — активна после выбора подразделения */}
      <Card className={selDepartmentId ? '' : 'opacity-50'}>
        <CardHeader className={compact ? 'p-3 pb-1' : 'pb-3'}>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${positionId ? 'bg-emerald-500 text-white' : selDepartmentId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
            <Users className="h-4 w-4" /> Должность
          </CardTitle>
          {!compact && <CardDescription className="text-xs">
            {selDepartmentId ? 'Выберите должность' : 'Сначала выберите подразделение'}
          </CardDescription>}
        </CardHeader>
        <CardContent className={compact ? 'p-3 pt-0' : ''}>
          {selDepartmentId ? (
            <Select value={positionId} onValueChange={handlePositionChange}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Выберите должность" /></SelectTrigger>
              <SelectContent>
                {filteredPositions.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className={`flex items-center justify-center py-3 text-xs text-muted-foreground ${sizeClass}`}>
              Выберите подразделение
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
