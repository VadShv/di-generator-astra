'use client'

import { useMemo } from 'react'
import { Treemap, ResponsiveContainer } from 'recharts'
import type { Company, Department, Position } from './staff-schedule-types'
import { getAllDescendantDeptIds } from './staff-schedule-helpers'

interface TreemapNode {
  name: string
  size: number
  coverage?: number
  deptId?: string
  companyId?: string
  positionCount?: number
  children?: TreemapNode[]
}

interface StaffScheduleTreemapProps {
  companies: Company[]
  departments: Department[]
  positions: Position[]
  selectedDeptId: string | null
  selectedCompanyId: string | null
  onSelectDept: (deptId: string) => void
  onSelectCompany: (companyId: string) => void
  onDetailDept: (deptId: string) => void
}

function coverageColor(percent: number): string {
  if (percent >= 80) return '#10b981'
  if (percent >= 50) return '#f59e0b'
  if (percent >= 25) return '#f97316'
  return '#ef4444'
}

function buildTreemapData(
  companies: Company[],
  departments: Department[],
  positions: Position[]
): TreemapNode[] {
  return companies.map((company) => {
    const companyDepts = departments.filter((d) => d.companyId === company.id && !d.parentId)
    const allCompanyDeptIds = departments
      .filter((d) => d.companyId === company.id)
      .map((d) => getAllDescendantDeptIds(d.id, departments))
      .flat()
    const companyPositions = positions.filter((p) => allCompanyDeptIds.includes(p.departmentId))
    const companyHeadcount = companyPositions.reduce((sum, p) => sum + (p.headcount || 1), 0)
    const approvedCount = companyPositions.filter((p) => p.generatedDIs.some((d) => d.status === 'approved')).length
    const companyCoverage = companyPositions.length > 0 ? Math.round((approvedCount / companyPositions.length) * 100) : 0

    const children = companyDepts.map((dept) => buildDeptNode(dept, departments, positions))

    return {
      name: company.name,
      size: Math.max(companyHeadcount, 1),
      coverage: companyCoverage,
      companyId: company.id,
      positionCount: companyPositions.length,
      children: children.length > 0 ? children : undefined,
    }
  })
}

function buildDeptNode(dept: Department, departments: Department[], positions: Position[]): TreemapNode {
  const allDeptIds = getAllDescendantDeptIds(dept.id, departments)
  const deptPositions = positions.filter((p) => allDeptIds.includes(p.departmentId))
  const headcount = deptPositions.reduce((sum, p) => sum + (p.headcount || 1), 0)
  const approvedCount = deptPositions.filter((p) => p.generatedDIs.some((d) => d.status === 'approved')).length
  const coverage = deptPositions.length > 0 ? Math.round((approvedCount / deptPositions.length) * 100) : 0

  const childDepts = departments.filter((d) => d.parentId === dept.id)
  const children = childDepts.map((d) => buildDeptNode(d, departments, positions))

  return {
    name: dept.name,
    size: Math.max(headcount, 1),
    coverage,
    deptId: dept.id,
    positionCount: deptPositions.length,
    children: children.length > 0 ? children : undefined,
  }
}

interface CustomContentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  coverage?: number
  deptId?: string
  companyId?: string
  positionCount?: number
  depth?: number
  index?: number
  root?: unknown
}

function CustomContent(props: CustomContentProps & {
  selectedDeptId: string | null
  selectedCompanyId: string | null
  onSelectDept: (id: string) => void
  onSelectCompany: (id: string) => void
  onDetailDept: (id: string) => void
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, coverage = 0, deptId, companyId, positionCount = 0, depth = 0 } = props

  if (width <= 0 || height <= 0 || depth === 0) return <g />

  const isCompany = depth === 1
  const isSelected = deptId ? props.selectedDeptId === deptId : companyId ? props.selectedCompanyId === companyId : false
  const color = coverageColor(coverage)
  const bgOpacity = isCompany ? 0.15 : 0.25
  const minSizeForLabel = 48

  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        if (deptId) props.onSelectDept(deptId)
        else if (companyId) props.onSelectCompany(companyId)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (deptId) props.onDetailDept(deptId)
      }}
    >
      <rect
        width={width}
        height={height}
        fill={color}
        fillOpacity={isSelected ? 0.45 : bgOpacity}
        stroke={isSelected ? color : 'rgba(255,255,255,0.5)'}
        strokeWidth={isSelected ? 2.5 : 1}
        rx={4}
        ry={4}
        className="transition-all"
      />
      {height > minSizeForLabel && width > 60 && (
        <>
          <text
            x={6}
            y={16}
            fill="currentColor"
            className="font-semibold fill-foreground"
            style={{ fontSize: isCompany ? '12px' : '10px', fontWeight: isCompany ? 700 : 600 }}
          >
            {name && name.length > 22 ? name.slice(0, 20) + '…' : name}
          </text>
          {height > 64 && positionCount > 0 && (
            <text
              x={6}
              y={30}
              className="fill-muted-foreground"
              style={{ fontSize: '9px' }}
            >
              {positionCount} должн. · {coverage}%
            </text>
          )}
          {height > 80 && width > 80 && (
            <rect
              x={6}
              y={height - 12}
              width={Math.min(width - 12, (width - 12) * (coverage / 100))}
              height={4}
              fill={color}
              rx={2}
            />
          )}
        </>
      )}
    </g>
  )
}

export function StaffScheduleTreemap({
  companies,
  departments,
  positions,
  selectedDeptId,
  selectedCompanyId,
  onSelectDept,
  onSelectCompany,
  onDetailDept,
}: StaffScheduleTreemapProps) {
  const data = useMemo(
    () => buildTreemapData(companies, departments, positions),
    [companies, departments, positions]
  )

  if (data.length === 0 || positions.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Treemap
        data={data}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="rgba(255,255,255,0.6)"
        content={((contentProps: any) => (
          <CustomContent
            {...contentProps}
            selectedDeptId={selectedDeptId}
            selectedCompanyId={selectedCompanyId}
            onSelectDept={onSelectDept}
            onSelectCompany={onSelectCompany}
            onDetailDept={onDetailDept}
          />
        )) as any}
      />
    </ResponsiveContainer>
  )
}
