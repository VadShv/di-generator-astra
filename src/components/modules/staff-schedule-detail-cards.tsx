'use client'

// Детальные карточки для модуля «Штатное расписание» (Фаза: Полиш ШР).
// Подробный просмотр компании, подразделения и должности с реквизитами и статистикой.

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Landmark, FolderTree, Users, Briefcase, Percent, Hash, FileText, User, MapPin,
  Building2, Network, ChevronRight, Pencil, GraduationCap,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { Company, Department, Position } from './staff-schedule-types'
export type { Company, Department, Position }
import { PositionDIWorkspace } from './position-di-workspace'

// Статус ДИ по должности (дублирует логику основного модуля)
function getDIStatus(pos: Position) {
  const approved = pos.generatedDIs.some(d => d.status === 'approved')
  const hasGenerated = pos.generatedDIs.length > 0
  const hasArchive = pos.archiveDIs.length > 0
  if (approved) return { label: 'Утверждена', color: 'bg-emerald-500', textColor: 'text-emerald-700' }
  if (hasGenerated) return { label: 'Сгенерирована', color: 'bg-amber-500', textColor: 'text-amber-700' }
  if (hasArchive) return { label: 'Архивная', color: 'bg-slate-400', textColor: 'text-slate-600' }
  return { label: 'Нет ДИ', color: 'bg-red-400', textColor: 'text-red-600' }
}

function getGradeLabel(grade: string | null) {
  if (!grade) return null
  if (grade === 'руководитель') return 'Руководитель'
  if (grade === 'линейная') return 'Линейная'
  return grade
}

// Строка с иконкой, подписью и значением
function InfoRow({ icon: Icon, label, value, onClick }: {
  icon: ComponentType<{ className?: string }>; label: string; value?: string | null; onClick?: () => void
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
     {value ? (
        <p className={`text-sm font-medium break-words ${onClick ? 'cursor-pointer hover:text-emerald-700 underline-offset-2 hover:underline' : ''}`} onClick={onClick}>{value}</p>
     ) : (
         <p className="text-sm text-muted-foreground/60">—</p>
       )}
      </div>
    </div>
  )
}

// Общие поля для подстановки иерархии подразделений
interface DeptLookup {
  departments: Department[]
  positions: Position[]
  getAllDescendantDeptIds: (deptId: string, departments: Department[]) => string[]
  getChildren: (id: string) => Department[]
}

export interface CompanyDetailProps extends DeptLookup {
  company: Company | null
  onCloseCompany: () => void
  onSelectDept: (d: Department) => void
  onEditCompany: (c: Company) => void
}

export interface DepartmentDetailProps extends DeptLookup {
  dept: Department | null
  onCloseDept: () => void
  onSelectDept: (d: Department) => void
  onSelectPos: (p: Position) => void
  onEditDept: (d: Department) => void
}

export interface PositionDetailProps {
  pos: Position | null
  onClosePos: () => void
  onSelectDept: (d: Department) => void
  onEditPos: (p: Position) => void
  onChanged?: () => void
}

export function CompanyDetailCard(props: CompanyDetailProps) {
  const { company: c, departments, positions, onCloseCompany, onSelectDept, onEditCompany, getAllDescendantDeptIds } = props
  if (!c) return null
  const companyDepts = departments.filter(d => d.companyId === c.id)
  const allDeptIds = companyDepts.map(d => getAllDescendantDeptIds(d.id, departments)).flat()
  const companyPositions = positions.filter(p => allDeptIds.includes(p.departmentId))
  const approved = companyPositions.filter(p => p.generatedDIs.some(d => d.status === 'approved')).length
  const headcount = companyPositions.reduce((s, p) => s + p.headcount, 0)
  const cov = companyPositions.length > 0 ? Math.round((approved / companyPositions.length) * 100) : 0

  return (
    <Dialog open={!!c} onOpenChange={v => !v && onCloseCompany()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-emerald-600" />
           {c.name}
           {c.type && <Badge variant="outline" className="border-emerald-300 text-emerald-700">{c.type}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {c.shortName && <span>Краткое: {c.shortName} · </span>}
            Карточка юридического лица
          </DialogDescription>
        </DialogHeader>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-teal-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium"><FolderTree className="h-3.5 w-3.5" /> Подразделений</div>
            <p className="text-xl font-bold text-teal-800 mt-1">{companyDepts.length}</p>
          </div>
          <div className="rounded-lg border bg-cyan-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-cyan-700 font-medium"><Users className="h-3.5 w-3.5" /> Должностей</div>
            <p className="text-xl font-bold text-cyan-800 mt-1">{companyPositions.length}</p>
          </div>
          <div className="rounded-lg border bg-sky-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-sky-700 font-medium"><Briefcase className="h-3.5 w-3.5" /> Штат. единиц</div>
            <p className="text-xl font-bold text-sky-800 mt-1">{headcount}</p>
          </div>
          <div className={`rounded-lg border p-3 ${cov >= 80 ? 'bg-emerald-50/50' : cov >= 50 ? 'bg-amber-50/50' : 'bg-red-50/50'}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium"><Percent className="h-3.5 w-3.5" /> Покрытие ДИ</div>
            <p className={`text-xl font-bold mt-1 ${cov >= 80 ? 'text-emerald-800' : cov >= 50 ? 'text-amber-800' : 'text-red-800'}`}>{cov}%</p>
          </div>
        </div>

        {/* Реквизиты */}
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Реквизиты</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <InfoRow icon={Hash} label="Код" value={c.code} />
            <InfoRow icon={FileText} label="ИНН" value={c.inn} />
            <InfoRow icon={FileText} label="ОГРН" value={c.ogrn} />
            <InfoRow icon={FileText} label="КПП" value={c.kpp} />
            <InfoRow icon={User} label="Руководитель" value={c.director} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={MapPin} label="Юр. адрес" value={c.legalAddress} />
            <InfoRow icon={MapPin} label="Факт. адрес" value={c.actualAddress} />
          </div>
        </div>

        {c.description && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Описание</p>
            <p className="text-sm whitespace-pre-wrap">{c.description}</p>
          </div>
        )}

        {/* Подразделения верхнего уровня */}
        {companyDepts.filter(d => !d.parentId).length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Подразделения</p>
            <div className="space-y-1">
              {companyDepts.filter(d => !d.parentId).map(d => (
                <button key={d.id} className="flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted/60"
                  onClick={() => onSelectDept(d)}>
                  <FolderTree className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{d.code}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onCloseCompany(); onEditCompany(c) }}>
            <Pencil className="h-4 w-4 mr-1.5" /> Редактировать
          </Button>
          <Button variant="outline" onClick={onCloseCompany}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DepartmentDetailCard(props: DepartmentDetailProps) {
  const { dept: d, departments, positions, onCloseDept, onSelectDept, onSelectPos, onEditDept, getAllDescendantDeptIds, getChildren } = props
  if (!d) return null
  const children = getChildren(d.id)
  const allDeptIds = getAllDescendantDeptIds(d.id, departments)
  const directPositions = positions.filter(p => p.departmentId === d.id)
  const allPositions = positions.filter(p => allDeptIds.includes(p.departmentId))
  const approved = allPositions.filter(p => p.generatedDIs.some(x => x.status === 'approved')).length
  const headcount = allPositions.reduce((s, p) => s + p.headcount, 0)
  const cov = allPositions.length > 0 ? Math.round((approved / allPositions.length) * 100) : 0
  const parent = departments.find(x => x.id === d.parentId)

  return (
    <Dialog open={!!d} onOpenChange={v => !v && onCloseDept()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" />
            {d.name}
            <Badge variant="outline" className="font-mono">{d.code}</Badge>
          </DialogTitle>
          <DialogDescription>
            {d.company ? <span>{d.company.name} · </span> : <span className="text-amber-600">Без юр. лица · </span>}
            Карточка подразделения
          </DialogDescription>
        </DialogHeader>

        {/* Иерархия */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Network className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Иерархия:</span>
          {parent && <Badge variant="secondary" className="cursor-pointer" onClick={() => onSelectDept(parent)}>{parent.name}</Badge>}
          {parent && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{d.name}</Badge>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-teal-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium"><Building2 className="h-3.5 w-3.5" /> Дочерних</div>
            <p className="text-xl font-bold text-teal-800 mt-1">{children.length}</p>
          </div>
          <div className="rounded-lg border bg-cyan-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-cyan-700 font-medium"><Users className="h-3.5 w-3.5" /> Должностей (всего)</div>
            <p className="text-xl font-bold text-cyan-800 mt-1">{allPositions.length}</p>
          </div>
          <div className="rounded-lg border bg-sky-50/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-sky-700 font-medium"><Briefcase className="h-3.5 w-3.5" /> Штат. единиц</div>
            <p className="text-xl font-bold text-sky-800 mt-1">{headcount}</p>
          </div>
          <div className={`rounded-lg border p-3 ${cov >= 80 ? 'bg-emerald-50/50' : cov >= 50 ? 'bg-amber-50/50' : 'bg-red-50/50'}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium"><Percent className="h-3.5 w-3.5" /> Покрытие ДИ</div>
            <p className={`text-xl font-bold mt-1 ${cov >= 80 ? 'text-emerald-800' : cov >= 50 ? 'text-amber-800' : 'text-red-800'}`}>{cov}%</p>
          </div>
        </div>

        {/* Дочерние подразделения */}
        {children.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Дочерние подразделения</p>
            <div className="space-y-1">
              {children.map(ch => (
                <button key={ch.id} className="flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted/60"
                  onClick={() => onSelectDept(ch)}>
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1 truncate">{ch.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{ch.code}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Должности в подразделении */}
        {directPositions.length > 0 && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Должности ({directPositions.length})</p>
            <div className="space-y-1">
              {directPositions.map(p => {
                const st = getDIStatus(p)
                return (
                  <button key={p.id} className="flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded hover:bg-muted/60"
                    onClick={() => onSelectPos(p)}>
                    <span className={`flex items-center justify-center h-6 w-6 rounded ${st.color} text-white`}><FileText className="h-3.5 w-3.5" /></span>
                    <span className="flex-1 truncate">{p.title}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.code}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onCloseDept(); onEditDept(d) }}>
            <Pencil className="h-4 w-4 mr-1.5" /> Редактировать
          </Button>
          <Button variant="outline" onClick={onCloseDept}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PositionDetailCard(props: PositionDetailProps) {
  const { pos: p, onClosePos, onSelectDept, onEditPos, onChanged } = props
  if (!p) return null
  const st = getDIStatus(p)
  const signedByEmployee = p.generatedDIs.some(d => d.signedByEmployee)
  const approvedDIs = p.generatedDIs.filter(d => d.status === 'approved')
  const inProgressDIs = p.generatedDIs.filter(d => d.status !== 'approved')

  return (
    <Dialog open={!!p} onOpenChange={v => !v && onClosePos()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`flex items-center justify-center h-8 w-8 rounded-lg ${st.color} text-white`}><FileText className="h-4 w-4" /></span>
            {p.title}
            <Badge variant="outline" className="font-mono">{p.code}</Badge>
          </DialogTitle>
          <DialogDescription>Карточка должности</DialogDescription>
        </DialogHeader>

        {/* Статус ДИ */}
        <div className={`rounded-lg border p-3 flex items-center gap-3 ${st.textColor} bg-muted/30`}>
          <FileText className="h-5 w-5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">ДИ: {st.label}</p>
            <p className="text-xs text-muted-foreground">
              {approvedDIs.length > 0 && `${approvedDIs.length} утвержд. · `}
              {inProgressDIs.length > 0 && `${inProgressDIs.length} в работе · `}
              {p.archiveDIs.length > 0 && `${p.archiveDIs.length} архивн.`}
              {signedByEmployee && <span className="text-emerald-600 font-medium"> · подписана сотрудником</span>}
            </p>
          </div>
        </div>

        {/* Атрибуты */}
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Атрибуты</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <InfoRow icon={Building2} label="Подразделение" value={p.department?.name} onClick={() => p.department && onSelectDept(p.department)} />
            <InfoRow icon={Landmark} label="Юр. лицо" value={p.department?.company?.name} />
            <InfoRow icon={GraduationCap} label="Грейд" value={getGradeLabel(p.grade)} />
            <InfoRow icon={Briefcase} label="Бизнес-функция" value={p.businessFunction?.name} />
            <InfoRow icon={MapPin} label="Проект" value={p.project?.name} />
            <InfoRow icon={Users} label="Штат. единиц" value={String(p.headcount)} />
          </div>
        </div>

        {p.functions && (
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Функции</p>
            <p className="text-sm whitespace-pre-wrap">{p.functions}</p>
          </div>
        )}

        {/* Рабочая область по ДИ: архив / генерация / сравнение / утверждение */}
        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Работа с должностными инструкциями</p>
          <PositionDIWorkspace position={p} onChanged={onChanged} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClosePos(); onEditPos(p) }}>
            <Pencil className="h-4 w-4 mr-1.5" /> Редактировать
          </Button>
          <Button variant="outline" onClick={onClosePos}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
