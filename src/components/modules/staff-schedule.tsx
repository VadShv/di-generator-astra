'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, Building2, Users, Search,
  Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2, XCircle, AlertCircle,
  FileCheck, FileClock, FileX2, Landmark, FolderTree, Percent, Eye,
  ChevronUp, ChevronDown as ChevronDownIcon, MapPin, GraduationCap, Briefcase, Shield,
  Clock, UserCheck, Scale, TrendingUp, CheckSquare2
} from 'lucide-react'

// ============ Interfaces ============
interface Company {
  id: string; name: string; shortName: string | null; code: string; type: string | null;
  director: string | null; description: string | null;
  _count?: { departments: number };
  createdAt: string; updatedAt: string;
}

interface Department {
  id: string; name: string; code: string; parentId: string | null;
  parent?: Department | null; children?: Department[];
  companyId: string | null; company?: Company | null;
  _count?: { positions: number };
  createdAt: string; updatedAt: string;
}

interface BusinessFunction {
  id: string; name: string; code: string; description: string | null;
  isActive: boolean; _count?: Record<string, number>;
  createdAt: string; updatedAt: string;
}

interface Project {
  id: string; name: string; code: string; description: string | null;
  isActive: boolean; _count?: Record<string, number>;
  createdAt: string; updatedAt: string;
}

interface GDI { id: string; status: string; signedByEmployee: boolean | null }
interface Position {
  id: string; title: string; code: string; departmentId: string;
  department: Department; grade: string | null;
  businessFunctionId: string | null; businessFunction: { id: string; name: string } | null;
  projectId: string | null; project: { id: string; name: string } | null;
  headcount: number; functions: string | null;
  generatedDIs: GDI[]; archiveDIs: { id: string }[];
  createdAt: string; updatedAt: string;
}

// ============ Helper: DI Status for a position ============
function getDIStatus(pos: Position) {
  const approved = pos.generatedDIs.some(d => d.status === 'approved')
  const hasGenerated = pos.generatedDIs.length > 0
  const hasArchive = pos.archiveDIs.length > 0

  if (approved) return { label: 'Утверждена', color: 'bg-emerald-500', icon: FileCheck, textColor: 'text-emerald-700' }
  if (hasGenerated) return { label: 'Сгенерирована', color: 'bg-amber-500', icon: FileClock, textColor: 'text-amber-700' }
  if (hasArchive) return { label: 'Архивная', color: 'bg-slate-400', icon: FileText, textColor: 'text-slate-600' }
  return { label: 'Нет ДИ', color: 'bg-red-400', icon: FileX2, textColor: 'text-red-600' }
}

// ============ Helper: Grade label ============
function getGradeLabel(grade: string | null) {
  if (!grade) return null
  if (grade === 'руководитель') return 'Руководитель'
  if (grade === 'линейная') return 'Линейная'
  return grade
}

// ============ Helper: DI coverage for a department ============
function getDICoverage(deptId: string, positions: Position[], departments: Department[]) {
  // Get all positions directly in this department + recursively in children
  const allDeptIds = getAllDescendantDeptIds(deptId, departments)
  const deptPositions = positions.filter(p => allDeptIds.includes(p.departmentId))
  if (deptPositions.length === 0) return { total: 0, covered: 0, percent: 0 }
  const covered = deptPositions.filter(p => p.generatedDIs.some(d => d.status === 'approved')).length
  const total = deptPositions.length
  const percent = Math.round((covered / total) * 100)
  return { total, covered, percent }
}

function getAllDescendantDeptIds(deptId: string, departments: Department[]): string[] {
  const result = [deptId]
  const children = departments.filter(d => d.parentId === deptId)
  for (const child of children) {
    result.push(...getAllDescendantDeptIds(child.id, departments))
  }
  return result
}

// ============ Main Component ============
export function StaffScheduleModule() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Company[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [businessFunctions, setBusinessFunctions] = useState<BusinessFunction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set())
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tree' | 'positions'>('tree')

  // Company dialog
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [companyDialogMode, setCompanyDialogMode] = useState<'create' | 'edit'>('create')
  const [companyForm, setCompanyForm] = useState({ id: '', name: '', shortName: '', code: '', type: '', director: '', description: '' })
  const [companySubmitting, setCompanySubmitting] = useState(false)
  const [companyDeleteOpen, setCompanyDeleteOpen] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)

  // Dept dialog
  const [deptDialogOpen, setDeptDialogOpen] = useState(false)
  const [deptDialogMode, setDeptDialogMode] = useState<'create' | 'edit'>('create')
  const [deptForm, setDeptForm] = useState({ id: '', name: '', code: '', parentId: '', companyId: '' })
  const [deptSubmitting, setDeptSubmitting] = useState(false)
  const [deptDeleteOpen, setDeptDeleteOpen] = useState(false)
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null)

  // Pos dialog
  const [posDialogOpen, setPosDialogOpen] = useState(false)
  const [posDialogMode, setPosDialogMode] = useState<'create' | 'edit'>('create')
  const [posForm, setPosForm] = useState({ id: '', title: '', code: '', departmentId: '', grade: '', businessFunctionId: '', projectId: '', headcount: 1, functions: '' })
  const [posSubmitting, setPosSubmitting] = useState(false)
  const [posDeleteOpen, setPosDeleteOpen] = useState(false)
  const [posToDelete, setPosToDelete] = useState<Position | null>(null)

  // Bulk / file upload
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    summary?: { departmentsFound: number; departmentsCreated: number; departmentsExisting: number; positionsFound: number; positionsCreated: number; positionsSkipped: number }
    errors?: string[]
  } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDIStatus, setFilterDIStatus] = useState<string>('all')

  // ============ Data fetching ============
  const fetchCompanies = useCallback(async () => {
    try { const res = await fetch('/api/companies'); if (res.ok) setCompanies(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchDepartments = useCallback(async () => {
    try { const res = await fetch('/api/departments'); if (res.ok) setDepartments(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchPositions = useCallback(async () => {
    try { const res = await fetch('/api/positions'); if (res.ok) setPositions(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchBusinessFunctions = useCallback(async () => {
    try { const res = await fetch('/api/business-functions'); if (res.ok) setBusinessFunctions(await res.json()) } catch { /* silent */ }
  }, [])
  const fetchProjects = useCallback(async () => {
    try { const res = await fetch('/api/projects'); if (res.ok) setProjects(await res.json()) } catch { /* silent */ }
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([fetchCompanies(), fetchDepartments(), fetchPositions(), fetchBusinessFunctions(), fetchProjects()])
      setLoading(false)
    })()
  }, [fetchCompanies, fetchDepartments, fetchPositions, fetchBusinessFunctions, fetchProjects])

  // ============ Tree helpers ============
  const toggleExpand = (id: string) => setExpandedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleCompanyExpand = (id: string) => setExpandedCompanyIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const getChildren = (id: string) => departments.filter(d => d.parentId === id)

  // ============ Filtered positions ============
  const filteredPositions = positions.filter(p => {
    if (selectedDeptId) {
      const allIds = getAllDescendantDeptIds(selectedDeptId, departments)
      if (!allIds.includes(p.departmentId)) return false
    }
    if (selectedCompanyId) {
      // Show positions from departments belonging to this company
      const companyDepts = departments.filter(d => d.companyId === selectedCompanyId)
      const allCompanyDeptIds = companyDepts.map(d => getAllDescendantDeptIds(d.id, departments)).flat()
      if (!allCompanyDeptIds.includes(p.departmentId)) return false
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) ||
        (p.department?.name || '').toLowerCase().includes(q) ||
        (p.grade || '').toLowerCase().includes(q) ||
        (p.businessFunction?.name || '').toLowerCase().includes(q) ||
        (p.project?.name || '').toLowerCase().includes(q)
    }
    if (filterDIStatus !== 'all') {
      const diSt = getDIStatus(p)
      if (filterDIStatus === 'approved' && !p.generatedDIs.some(d => d.status === 'approved')) return false
      if (filterDIStatus === 'generated' && (!p.generatedDIs.length || p.generatedDIs.some(d => d.status === 'approved'))) return false
      if (filterDIStatus === 'none' && (p.generatedDIs.length > 0 || p.archiveDIs.length > 0)) return false
    }
    return true
  })

  // ============ Stats ============
  const totalHeadcount = positions.reduce((sum, p) => sum + p.headcount, 0)
  const uniqueBusinessFunctions = [...new Set(positions.map(p => p.businessFunction?.name).filter(Boolean))]
  const totalApproved = positions.filter(p => p.generatedDIs.some(d => d.status === 'approved')).length
  const totalGenerated = positions.filter(p => p.generatedDIs.length > 0).length
  const coveragePercent = positions.length > 0 ? Math.round((totalApproved / positions.length) * 100) : 0

  // ============ Company handlers ============
  const openCreateCompany = () => {
    setCompanyDialogMode('create')
    setCompanyForm({ id: '', name: '', shortName: '', code: '', type: '', director: '', description: '' })
    setCompanyDialogOpen(true)
  }
  const openEditCompany = (c: Company) => {
    setCompanyDialogMode('edit')
    setCompanyForm({ id: c.id, name: c.name, shortName: c.shortName || '', code: c.code, type: c.type || '', director: c.director || '', description: c.description || '' })
    setCompanyDialogOpen(true)
  }

  const handleCompanySubmit = async () => {
    if (!companyForm.name.trim() || !companyForm.code.trim()) {
      toast({ title: 'Ошибка', description: 'Название и код обязательны', variant: 'destructive' }); return
    }
    setCompanySubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: companyForm.name.trim(), code: companyForm.code.trim(),
        shortName: companyForm.shortName.trim() || null,
        type: companyForm.type.trim() || null,
        director: companyForm.director.trim() || null,
        description: companyForm.description.trim() || null,
      }
      if (companyDialogMode === 'edit') body.id = companyForm.id
      const res = await fetch('/api/companies', {
        method: companyDialogMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: companyDialogMode === 'create' ? 'Создано' : 'Обновлено', description: companyForm.name })
      setCompanyDialogOpen(false); await fetchCompanies()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setCompanySubmitting(false) }
  }

  const handleCompanyDelete = async () => {
    if (!companyToDelete) return
    try {
      const res = await fetch('/api/companies', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: companyToDelete.id }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: 'Удалено', description: companyToDelete.name })
      if (selectedCompanyId === companyToDelete.id) setSelectedCompanyId(null)
      setCompanyDeleteOpen(false); setCompanyToDelete(null); await fetchCompanies(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
  }

  // ============ Dept handlers ============
  const openCreateDept = (parentId?: string, companyId?: string) => {
    setDeptDialogMode('create')
    setDeptForm({ id: '', name: '', code: '', parentId: parentId || '', companyId: companyId || selectedCompanyId || '' })
    setDeptDialogOpen(true)
  }
  const openEditDept = (d: Department) => {
    setDeptDialogMode('edit')
    setDeptForm({ id: d.id, name: d.name, code: d.code, parentId: d.parentId || '', companyId: d.companyId || '' })
    setDeptDialogOpen(true)
  }

  const handleDeptSubmit = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim()) {
      toast({ title: 'Ошибка', description: 'Название и код обязательны', variant: 'destructive' }); return
    }
    setDeptSubmitting(true)
    try {
      const body: Record<string, string> = { name: deptForm.name.trim(), code: deptForm.code.trim() }
      if (deptForm.parentId) body.parentId = deptForm.parentId
      if (deptForm.companyId) body.companyId = deptForm.companyId
      if (deptDialogMode === 'edit') body.id = deptForm.id
      const res = await fetch('/api/departments', {
        method: deptDialogMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: deptDialogMode === 'create' ? 'Создано' : 'Обновлено', description: deptForm.name })
      setDeptDialogOpen(false); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setDeptSubmitting(false) }
  }

  const handleDeptDelete = async () => {
    if (!deptToDelete) return
    try {
      const res = await fetch('/api/departments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deptToDelete.id }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: 'Удалено', description: deptToDelete.name })
      if (selectedDeptId === deptToDelete.id) setSelectedDeptId(null)
      setDeptDeleteOpen(false); setDeptToDelete(null); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
  }

  // ============ Position handlers ============
  const openCreatePos = (departmentId?: string) => {
    setPosDialogMode('create')
    setPosForm({ id: '', title: '', code: '', departmentId: departmentId || selectedDeptId || '', grade: '', businessFunctionId: '', projectId: '', headcount: 1, functions: '' })
    setPosDialogOpen(true)
  }
  const openEditPos = (p: Position) => {
    setPosDialogMode('edit')
    setPosForm({
      id: p.id, title: p.title, code: p.code, departmentId: p.departmentId,
      grade: p.grade || '', businessFunctionId: p.businessFunctionId || '', projectId: p.projectId || '',
      headcount: p.headcount, functions: p.functions || ''
    })
    setPosDialogOpen(true)
  }

  const handlePosSubmit = async () => {
    if (!posForm.title.trim() || !posForm.code.trim() || !posForm.departmentId) {
      toast({ title: 'Ошибка', description: 'Название, код и подразделение обязательны', variant: 'destructive' }); return
    }
    setPosSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        title: posForm.title.trim(), code: posForm.code.trim(), departmentId: posForm.departmentId,
        grade: posForm.grade || null,
        businessFunctionId: posForm.businessFunctionId || null,
        projectId: posForm.projectId || null,
        headcount: posForm.headcount || 1, functions: posForm.functions || null
      }
      if (posDialogMode === 'edit') body.id = posForm.id
      const res = await fetch('/api/positions', {
        method: posDialogMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: posDialogMode === 'create' ? 'Создано' : 'Обновлено', description: posForm.title })
      setPosDialogOpen(false); await fetchPositions(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
    finally { setPosSubmitting(false) }
  }

  const handlePosDelete = async () => {
    if (!posToDelete) return
    try {
      const res = await fetch('/api/positions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: posToDelete.id }) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Ошибка') }
      toast({ title: 'Удалено', description: posToDelete.title })
      setPosDeleteOpen(false); setPosToDelete(null); await fetchPositions(); await fetchDepartments()
    } catch (e) { toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' }) }
  }

  // Bulk upload
  const handleBulkUpload = async () => {
    if (!bulkText.trim()) { toast({ title: 'Ошибка', description: 'Введите данные', variant: 'destructive' }); return }
    setBulkSubmitting(true)
    try {
      const lines = bulkText.trim().split('\n').filter(l => l.trim()); let created = 0; let errors = 0
      for (const line of lines) {
        const [code, title, deptCode, grade, businessFunctionCode, projectCode, headcountStr, functions] = line.split(';').map(s => s.trim())
        if (!code || !title || !deptCode) { errors++; continue }
        const dept = departments.find(d => d.code === deptCode)
        if (!dept || positions.find(p => p.code === code)) { errors++; continue }
        // Lookup business function and project by code
        const bf = businessFunctions.find(b => b.code === businessFunctionCode)
        const proj = projects.find(pr => pr.code === projectCode)
        try {
          const res = await fetch('/api/positions', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code, title, departmentId: dept.id,
              grade: grade || null,
              businessFunctionId: bf?.id || null,
              projectId: proj?.id || null,
              headcount: headcountStr ? parseInt(headcountStr, 10) || 1 : 1,
              functions: functions || null
            })
          })
          if (res.ok) created++; else errors++
        } catch { errors++ }
      }
      toast({ title: 'Загрузка завершена', description: `Создано: ${created}, Ошибок: ${errors}` })
      setBulkDialogOpen(false); setBulkText(''); await fetchPositions(); await fetchDepartments()
    } catch { toast({ title: 'Ошибка', description: 'Ошибка загрузки', variant: 'destructive' }) }
    finally { setBulkSubmitting(false) }
  }

  // File upload handler
  const handleFileUpload = async () => {
    if (!selectedFile) { toast({ title: 'Ошибка', description: 'Выберите файл', variant: 'destructive' }); return }
    setUploading(true); setUploadProgress(10); setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      setUploadProgress(30)
      const res = await fetch('/api/upload/staff-schedule', { method: 'POST', body: formData })
      setUploadProgress(80)
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Ошибка загрузки') }
      const data = await res.json()
      setUploadProgress(100); setUploadResult(data)
      if (data.success) {
        toast({ title: 'Файл обработан', description: `Подразделений: ${data.summary.departmentsCreated} создано, Должностей: ${data.summary.positionsCreated} создано` })
        await fetchPositions(); await fetchDepartments(); await fetchCompanies()
      }
    } catch (e) {
      toast({ title: 'Ошибка загрузки файла', description: e instanceof Error ? e.message : 'Ошибка', variant: 'destructive' })
    } finally { setUploading(false) }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0])
  }

  const openUploadDialog = () => {
    setSelectedFile(null); setUploadResult(null); setUploadProgress(0); setUploadDialogOpen(true)
  }

  // ============ Render: Department tree item ============
  const renderDeptTreeItem = (dept: Department, depth: number) => {
    const children = getChildren(dept.id)
    const hasChildren = children.length > 0
    const isExpanded = expandedIds.has(dept.id)
    const isSelected = selectedDeptId === dept.id
    const coverage = getDICoverage(dept.id, positions, departments)
    const directPositions = positions.filter(p => p.departmentId === dept.id)

    return (
      <div key={dept.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all group ${
            isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/50'
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          onClick={() => { setSelectedDeptId(isSelected ? null : dept.id); setActiveTab('positions') }}
        >
          {/* Expand toggle */}
          <button
            className="h-5 w-5 flex items-center justify-center flex-shrink-0 rounded hover:bg-muted"
            onClick={e => { e.stopPropagation(); toggleExpand(dept.id) }}
          >
            {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />) : <span className="h-3.5 w-3.5 block" />}
          </button>

          {/* Dept icon */}
          <FolderTree className="h-4 w-4 flex-shrink-0 text-emerald-600" />

          {/* Dept name */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{dept.name}</span>
            <span className="text-xs text-muted-foreground ml-1.5">{dept.code}</span>
          </div>

          {/* Position count */}
          {directPositions.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-teal-50 text-teal-700 border-teal-200">
                    {directPositions.length} должн.
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Должностей в этом подразделении: {directPositions.length}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* DI coverage mini bar */}
          {coverage.total > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          coverage.percent >= 80 ? 'bg-emerald-500' :
                          coverage.percent >= 50 ? 'bg-amber-500' :
                          coverage.percent >= 25 ? 'bg-orange-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${coverage.percent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${
                      coverage.percent >= 80 ? 'text-emerald-700' :
                      coverage.percent >= 50 ? 'text-amber-700' : 'text-red-600'
                    }`}>{coverage.percent}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium">Покрытие ДИ: {coverage.percent}%</p>
                  <p className="text-xs text-muted-foreground">
                    {coverage.covered} из {coverage.total} должностей имеют утверждённые ДИ
                    (включая дочерние подразделения)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openCreateDept(dept.id, dept.companyId || selectedCompanyId || undefined) }} title="Добавить дочернее">
              <Plus className="h-3 w-3" />
            </button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openEditDept(dept) }}>
              <Pencil className="h-3 w-3" />
            </button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); setDeptToDelete(dept); setDeptDeleteOpen(true) }}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {children.map(c => renderDeptTreeItem(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // ============ Render: Company section in tree ============
  const renderCompanySection = (company: Company) => {
    const companyDepts = departments.filter(d => d.companyId === company.id && !d.parentId)
    const isExpanded = expandedCompanyIds.has(company.id)
    const isSelected = selectedCompanyId === company.id

    // Get all positions for this company
    const allCompanyDeptIds = departments
      .filter(d => d.companyId === company.id)
      .map(d => getAllDescendantDeptIds(d.id, departments))
      .flat()
    const companyPositions = positions.filter(p => allCompanyDeptIds.includes(p.departmentId))
    const approvedCount = companyPositions.filter(p => p.generatedDIs.some(d => d.status === 'approved')).length
    const companyCoverage = companyPositions.length > 0 ? Math.round((approvedCount / companyPositions.length) * 100) : 0

    return (
      <div key={company.id} className="mb-2">
        <div
          className={`flex items-center gap-2 py-2.5 px-3 rounded-xl cursor-pointer transition-all group ${
            isSelected && !selectedDeptId ? 'bg-emerald-50 ring-1 ring-emerald-300/50' : 'hover:bg-emerald-5'
          }`}
          onClick={() => {
            const newId = isSelected && !selectedDeptId ? null : company.id
            setSelectedCompanyId(newId)
            setSelectedDeptId(null)
            setActiveTab('positions')
            if (!isExpanded) toggleCompanyExpand(company.id)
          }}
        >
          <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); toggleCompanyExpand(company.id) }}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Landmark className="h-5 w-5 text-emerald-700 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold truncate">{company.name}</span>
            {company.shortName && <span className="text-xs text-muted-foreground ml-1">({company.shortName})</span>}
            {company.type && <Badge variant="outline" className="ml-1.5 text-xs h-5 border-emerald-300 text-emerald-700">{company.type}</Badge>}
          </div>

          {/* Company position count */}
          <Badge variant="secondary" className="text-xs h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
            {companyPositions.length} должн.
          </Badge>

          {/* Company coverage */}
          {companyPositions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-20 h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    companyCoverage >= 80 ? 'bg-emerald-500' :
                    companyCoverage >= 50 ? 'bg-amber-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${companyCoverage}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${
                companyCoverage >= 80 ? 'text-emerald-700' :
                companyCoverage >= 50 ? 'text-amber-700' : 'text-red-600'
              }`}>{companyCoverage}%</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openCreateDept(undefined, company.id) }} title="Добавить подразделение">
              <Plus className="h-3 w-3" />
            </button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted" onClick={e => { e.stopPropagation(); openEditCompany(company) }}>
              <Pencil className="h-3 w-3" />
            </button>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); setCompanyToDelete(company); setCompanyDeleteOpen(true) }}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {isExpanded && companyDepts.length > 0 && (
          <div className="ml-3 mt-1 space-y-0.5">
            {companyDepts.map(d => renderDeptTreeItem(d, 0))}
          </div>
        )}
        {isExpanded && companyDepts.length === 0 && (
          <div className="ml-6 py-3 text-center text-muted-foreground">
            <p className="text-xs">Нет подразделений</p>
            <Button size="sm" variant="ghost" className="mt-1 h-6 text-xs" onClick={() => openCreateDept(undefined, company.id)}>
              <Plus className="h-3 w-3 mr-1" /> Добавить
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ============ Render: Orphan departments (without company) ============
  const orphanDepts = departments.filter(d => !d.companyId && !d.parentId)

  // ============ Loading ============
  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  // ============ Main Render ============
  return (
    <div className="space-y-6">
      {/* ====== Header ====== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            Штатное расписание
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Юридические лица, подразделения, должности и покрытие ДИ</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={openUploadDialog}>
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Загрузить файл
          </Button>
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Вставить текст
          </Button>
          <Button onClick={openCreateCompany} className="bg-emerald-600 hover:bg-emerald-700">
            <Landmark className="h-4 w-4 mr-1.5" /> Юр. лицо
          </Button>
          <Button variant="outline" onClick={() => openCreateDept()}>
            <Building2 className="h-4 w-4 mr-1.5" /> Подразделение
          </Button>
          <Button variant="outline" onClick={() => openCreatePos()}>
            <Plus className="h-4 w-4 mr-1.5" /> Должность
          </Button>
        </div>
      </div>

      {/* ====== Stats Cards ====== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Landmark className="h-3.5 w-3.5 text-emerald-700" />
              <p className="text-xs text-emerald-700 font-medium">Юр. лица</p>
            </div>
            <p className="text-2xl font-bold text-emerald-800">{companies.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-teal-100/50 border-teal-200/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <FolderTree className="h-3.5 w-3.5 text-teal-700" />
              <p className="text-xs text-teal-700 font-medium">Подразделения</p>
            </div>
            <p className="text-2xl font-bold text-teal-800">{departments.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border-cyan-200/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-cyan-700" />
              <p className="text-xs text-cyan-700 font-medium">Должности</p>
            </div>
            <p className="text-2xl font-bold text-cyan-800">{positions.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-sky-100/50 border-sky-200/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Briefcase className="h-3.5 w-3.5 text-sky-700" />
              <p className="text-xs text-sky-700 font-medium">Штат. единиц</p>
            </div>
            <p className="text-2xl font-bold text-sky-800">{totalHeadcount}</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br border ${
          coveragePercent >= 80 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200/50' :
          coveragePercent >= 50 ? 'from-amber-50 to-amber-100/50 border-amber-200/50' :
          'from-red-50 to-red-100/50 border-red-200/50'
        }`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Percent className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Покрытие ДИ</p>
            </div>
            <p className={`text-2xl font-bold ${
              coveragePercent >= 80 ? 'text-emerald-800' :
              coveragePercent >= 50 ? 'text-amber-800' : 'text-red-800'
            }`}>{coveragePercent}%</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Briefcase className="h-3.5 w-3.5 text-violet-700" />
              <p className="text-xs text-violet-700 font-medium">Бизнес-функций</p>
            </div>
            <p className="text-2xl font-bold text-violet-800">{uniqueBusinessFunctions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ====== Coverage Summary Bar ====== */}
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">Общее покрытие утверждёнными ДИ</span>
            </div>
            <span className={`text-lg font-bold ${
              coveragePercent >= 80 ? 'text-emerald-700' :
              coveragePercent >= 50 ? 'text-amber-700' : 'text-red-600'
            }`}>{coveragePercent}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coveragePercent >= 80 ? 'bg-emerald-500' :
                coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-400'
              }`}
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{totalApproved} утверждённых</span>
            <span>{totalGenerated - totalApproved} в работе</span>
            <span>{positions.length - totalGenerated} без ДИ</span>
          </div>
        </CardContent>
      </Card>

      {/* ====== Main Content: Tree + Positions ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ====== Left: Organization Tree ====== */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-emerald-600" /> Структура организации
            </CardTitle>
            <CardDescription className="text-xs">
              Компании и подразделения с покрытием ДИ
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[700px] overflow-y-auto">
            {companies.length === 0 && orphanDepts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Landmark className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Нет юридических лиц</p>
                <p className="text-xs mb-3">Начните с создания компании</p>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreateCompany}>
                  <Landmark className="h-4 w-4 mr-1.5" /> Создать юр. лицо
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Company sections */}
                {companies.map(c => renderCompanySection(c))}

                {/* Orphan departments */}
                {orphanDepts.length > 0 && (
                  <div className="mt-3">
                    <Separator className="mb-2" />
                    <p className="text-xs text-muted-foreground font-medium mb-1 px-2">Без юр. лица</p>
                    {orphanDepts.map(d => renderDeptTreeItem(d, 0))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ====== Right: Positions ====== */}
        <Card className="lg:col-span-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" /> Должности
                {selectedDeptId && (
                  <Badge variant="outline" className="ml-1 text-emerald-700 border-emerald-300">
                    {departments.find(d => d.id === selectedDeptId)?.name}
                  </Badge>
                )}
                {selectedCompanyId && !selectedDeptId && (
                  <Badge variant="outline" className="ml-1 text-emerald-700 border-emerald-300">
                    {companies.find(c => c.id === selectedCompanyId)?.name}
                  </Badge>
                )}
              </CardTitle>
              {(selectedDeptId || selectedCompanyId) && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedDeptId(null); setSelectedCompanyId(null) }}>
                  Сбросить фильтр
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Search and filter bar */}
            <div className="px-4 pb-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск по названию, коду, подразделению, бизнес-функции, проекту..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
              <Select value={filterDIStatus} onValueChange={setFilterDIStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Статус ДИ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все должности</SelectItem>
                  <SelectItem value="approved">✅ Утверждена</SelectItem>
                  <SelectItem value="generated">📝 Сгенерирована</SelectItem>
                  <SelectItem value="none">❌ Нет ДИ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredPositions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Нет должностей</p>
                <p className="text-xs mb-3">Создайте должность или загрузите штатное расписание</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => openCreatePos()}>
                    <Plus className="h-4 w-4 mr-1.5" /> Создать
                  </Button>
                  <Button size="sm" variant="outline" onClick={openUploadDialog}>
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" /> Загрузить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4 grid gap-2 max-h-[600px] overflow-y-auto">
                {filteredPositions.map(p => {
                  const diStatus = getDIStatus(p)
                  const DiIcon = diStatus.icon
                  const signedByEmployee = p.generatedDIs.some(d => d.signedByEmployee)
                  return (
                    <div key={p.id} className="group border rounded-xl p-3 hover:bg-muted/30 transition-all hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* DI Status indicator */}
                        <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${diStatus.color} text-white flex-shrink-0`}>
                          <DiIcon className="h-5 w-5" />
                        </div>

                        {/* Position info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm truncate">{p.title}</span>
                            <Badge variant="secondary" className="text-xs h-5 font-mono">{p.code}</Badge>
                            <Badge className={`text-xs h-5 ${diStatus.textColor} border-current/20`} variant="outline">
                              {diStatus.label}
                              {signedByEmployee && (
                                <CheckSquare2 className="h-3 w-3 ml-1 text-emerald-600" />
                              )}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {/* Department */}
                            <span className="flex items-center gap-1">
                              <FolderTree className="h-3 w-3 text-emerald-500" />
                              {p.department?.name || '—'}
                            </span>

                            {/* Company */}
                            {p.department?.company && (
                              <span className="flex items-center gap-1">
                                <Landmark className="h-3 w-3 text-emerald-700" />
                                {p.department.company.shortName || p.department.company.name}
                              </span>
                            )}

                            {/* Grade */}
                            {p.grade && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3 w-3 text-violet-500" />
                                {getGradeLabel(p.grade)}
                              </span>
                            )}

                            {/* Business Function */}
                            {p.businessFunction && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3 text-cyan-500" />
                                {p.businessFunction.name}
                              </span>
                            )}

                            {/* Project */}
                            {p.project && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-amber-500" />
                                {p.project.name}
                              </span>
                            )}

                            {/* Headcount */}
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3 text-teal-500" />
                              {p.headcount} штат. ед.
                            </span>

                            {/* Archive DI count */}
                            {p.archiveDIs.length > 0 && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3 text-slate-500" />
                                {p.archiveDIs.length} архивных ДИ
                              </span>
                            )}
                          </div>

                          {/* Functions preview */}
                          {p.functions && (
                            <div className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
                              <Briefcase className="h-3 w-3 inline mr-0.5" />
                              {p.functions}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPos(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setPosToDelete(p); setPosDeleteOpen(true) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ====== Dialogs ====== */}

      {/* Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-600" />
              {companyDialogMode === 'create' ? 'Новое юридическое лицо' : 'Редактировать юр. лицо'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Название *</Label><Input value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} placeholder="ООО «Астра Групп»" /></div>
              <div><Label>Краткое название</Label><Input value={companyForm.shortName} onChange={e => setCompanyForm(p => ({ ...p, shortName: e.target.value }))} placeholder="Астра Групп" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Код/ИНН *</Label><Input value={companyForm.code} onChange={e => setCompanyForm(p => ({ ...p, code: e.target.value }))} placeholder="7710824510" /></div>
              <div>
                <Label>Тип</Label>
                <Select value={companyForm.type || '_none'} onValueChange={v => setCompanyForm(p => ({ ...p, type: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Не указан</SelectItem>
                    <SelectItem value="ООО">ООО</SelectItem>
                    <SelectItem value="АО">АО</SelectItem>
                    <SelectItem value="ПАО">ПАО</SelectItem>
                    <SelectItem value="ИП">ИП</SelectItem>
                    <SelectItem value="ГКУ">ГКУ</SelectItem>
                    <SelectItem value="ФГУП">ФГУП</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Руководитель</Label><Input value={companyForm.director} onChange={e => setCompanyForm(p => ({ ...p, director: e.target.value }))} placeholder="Иванов И.И." /></div>
            <div><Label>Описание</Label><Textarea value={companyForm.description} onChange={e => setCompanyForm(p => ({ ...p, description: e.target.value }))} className="min-h-[60px]" placeholder="Краткое описание деятельности компании" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleCompanySubmit} disabled={companySubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {companySubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dept Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {deptDialogMode === 'create' ? 'Новое подразделение' : 'Редактировать подразделение'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Название *</Label><Input value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="Отдел продаж" /></div>
              <div><Label>Код *</Label><Input value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value }))} placeholder="SALES" /></div>
            </div>
            <div>
              <Label>Юридическое лицо</Label>
              <Select value={deptForm.companyId || '_none'} onValueChange={v => setDeptForm(p => ({ ...p, companyId: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Не указано</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.shortName || c.name} ({c.type || c.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Родительское подразделение</Label>
              <Select value={deptForm.parentId || '_none'} onValueChange={v => setDeptForm(p => ({ ...p, parentId: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Нет (корень)</SelectItem>
                  {departments.filter(d => d.id !== deptForm.id).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleDeptSubmit} disabled={deptSubmitting}>{deptSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{posDialogMode === 'create' ? 'Новая должность' : 'Редактировать должность'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Название *</Label><Input value={posForm.title} onChange={e => setPosForm(p => ({ ...p, title: e.target.value }))} placeholder="Руководитель отдела продаж" /></div>
              <div><Label>Код *</Label><Input value={posForm.code} onChange={e => setPosForm(p => ({ ...p, code: e.target.value }))} placeholder="ROP-001" /></div>
            </div>
            <div>
              <Label>Подразделение *</Label>
              <Select value={posForm.departmentId} onValueChange={v => setPosForm(p => ({ ...p, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} {d.company ? `(${d.company.shortName || d.company.name})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Грейд</Label>
                <Select value={posForm.grade || '_none'} onValueChange={v => setPosForm(p => ({ ...p, grade: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Не указан</SelectItem>
                    <SelectItem value="линейная">Линейная позиция</SelectItem>
                    <SelectItem value="руководитель">Руководитель</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Бизнес-функция</Label>
                <Select value={posForm.businessFunctionId || '_none'} onValueChange={v => setPosForm(p => ({ ...p, businessFunctionId: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Не указана" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Не указана</SelectItem>
                    {businessFunctions.filter(bf => bf.isActive).map(bf => <SelectItem key={bf.id} value={bf.id}>{bf.name} ({bf.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Проект</Label>
                <Select value={posForm.projectId || '_none'} onValueChange={v => setPosForm(p => ({ ...p, projectId: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Не указан" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Не указан</SelectItem>
                    {projects.filter(pr => pr.isActive).map(pr => <SelectItem key={pr.id} value={pr.id}>{pr.name} ({pr.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Штатных единиц</Label><Input type="number" min={1} value={posForm.headcount} onChange={e => setPosForm(p => ({ ...p, headcount: parseInt(e.target.value) || 1 }))} /></div>
            <div><Label>Функции</Label><Textarea value={posForm.functions} onChange={e => setPosForm(p => ({ ...p, functions: e.target.value }))} className="min-h-[60px]" placeholder="Управление отделом, планирование..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPosDialogOpen(false)}>Отмена</Button>
            <Button onClick={handlePosSubmit} disabled={posSubmitting}>{posSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Text Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Массовая загрузка должностей</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Формат: Код;Название;Код_подразделения;Грейд;Код_БФ;Код_проекта;Штат;Функции</p>
            <p className="text-xs text-muted-foreground">Грейд: «линейная» или «руководитель». Код БФ и проекта — из справочников.</p>
            <Textarea value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder="DEV001;Разработчик;IT;линейная;BF_IT;PROJ_MAIN;5;Разработка ПО" className="min-h-[150px] font-mono text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleBulkUpload} disabled={bulkSubmitting}>{bulkSubmitting ? 'Загрузка...' : 'Загрузить'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Загрузка штатного расписания
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {['DOCX', 'XLSX', 'CSV', 'PDF', 'TXT'].map(fmt => (
                <Badge key={fmt} variant="secondary" className="text-xs">{fmt}</Badge>
              ))}
            </div>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-emerald-500 bg-emerald-50/50' : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-muted/30'
              }`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden" accept=".docx,.doc,.xlsx,.xls,.csv,.pdf,.txt,.md" onChange={handleFileSelect} />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-10 w-10 mx-auto text-emerald-600" />
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} КБ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-medium">Перетащите файл сюда</p>
                  <p className="text-xs text-muted-foreground">или нажмите для выбора</p>
                </div>
              )}
            </div>
            {uploading && <Progress value={uploadProgress} className="h-2" />}
            {uploadResult && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                {uploadResult.success && uploadResult.summary && (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Файл обработан успешно
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Подразделений: {uploadResult.summary.departmentsCreated} создано / {uploadResult.summary.departmentsExisting} найдено</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-teal-600" />
                        <span>Должностей: {uploadResult.summary.positionsCreated} создано / {uploadResult.summary.positionsSkipped} пропущено</span>
                      </div>
                    </div>
                  </>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Закрыть</Button>
            <Button onClick={handleFileUpload} disabled={uploading || !selectedFile} className="bg-emerald-600 hover:bg-emerald-700">
              {uploading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Обработка...</> : <><Upload className="h-4 w-4 mr-1.5" /> Загрузить</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Dialog */}
      <AlertDialog open={companyDeleteOpen} onOpenChange={setCompanyDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить юридическое лицо?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{companyToDelete?.name}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleCompanyDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dept Dialog */}
      <AlertDialog open={deptDeleteOpen} onOpenChange={setDeptDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить подразделение?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{deptToDelete?.name}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDeptDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Position Dialog */}
      <AlertDialog open={posDeleteOpen} onOpenChange={setPosDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить должность?</AlertDialogTitle></AlertDialogHeader>
          <p className="text-sm text-muted-foreground">{posToDelete?.title}</p>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handlePosDelete}>Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
