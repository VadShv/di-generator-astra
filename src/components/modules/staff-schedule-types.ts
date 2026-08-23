// Общие типы для модуля «Штатное расписание» (основной модуль + детальные карточки).
// Единый источник типов устраняет конфликты структурной типизации.

export interface Company {
  id: string
  name: string
  shortName: string | null
  code: string
  type: string | null
  director: string | null
  description: string | null
  inn: string | null
  ogrn: string | null
  kpp: string | null
  legalAddress: string | null
  actualAddress: string | null
  _count?: { departments: number }
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: string
  name: string
  code: string
  parentId: string | null
  parent?: Department | null
  children?: Department[]
  companyId: string | null
  company?: Pick<Company, 'id' | 'name' | 'shortName'> | null
  _count?: { positions: number }
  createdAt: string
  updatedAt: string
}

export interface BusinessFunction {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  _count?: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  _count?: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface GDI {
  id: string
  status: string
  signedByEmployee: boolean | null
}

export interface Position {
  id: string
  title: string
  code: string
  departmentId: string
  department: Department
  grade: string | null
  businessFunctionId: string | null
  businessFunction: { id: string; name: string } | null
  projectId: string | null
  project: { id: string; name: string } | null
  headcount: number
  functions: string | null
  generatedDIs: GDI[]
  archiveDIs: { id: string }[]
  attributes?: { id: string; name: string; code: string }[]
  createdAt: string
  updatedAt: string
}
