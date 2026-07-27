'use client'

import { useAppStore, type ActiveSection } from '@/lib/store'
import { useState, useEffect, lazy, Suspense } from 'react'
import {
  LayoutDashboard,
  Users,
  Archive,
  FileText,
  Brain,
  Sparkles,
  ClipboardList,
  Menu,
  ChevronLeft,
  Loader2,
  MessageCircle,
  ArrowLeft,
} from 'lucide-react'
import { BookOpen, Cpu, Zap, History, ShieldCheck, HelpCircle } from 'lucide-react'
import { Boxes } from 'lucide-react'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { GlobalSearch, SearchTrigger } from '@/components/global-search'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const DashboardModule = lazy(() => import('@/components/modules/dashboard').then(m => ({ default: m.DashboardModule })))
const StaffScheduleModule = lazy(() => import('@/components/modules/staff-schedule').then(m => ({ default: m.StaffScheduleModule })))
const ArchiveModule = lazy(() => import('@/components/modules/archive').then(m => ({ default: m.ArchiveModule })))
const TemplatesModule = lazy(() => import('@/components/modules/templates').then(m => ({ default: m.TemplatesModule })))
const MasterPromptsModule = lazy(() => import('@/components/modules/master-prompts').then(m => ({ default: m.MasterPromptsModule })))
const GenerationModule = lazy(() => import('@/components/modules/generation').then(m => ({ default: m.GenerationModule })))
const TrackingModule = lazy(() => import('@/components/modules/tracking').then(m => ({ default: m.TrackingModule })))
const DictionariesModule = lazy(() => import('@/components/modules/dictionaries').then(m => ({ default: m.DictionariesModule })))
const AiProvidersModule = lazy(() => import('@/components/modules/ai-providers').then(m => ({ default: m.AiProvidersModule })))
const MassGenerationModule = lazy(() => import('@/components/modules/mass-generation').then(m => ({ default: m.MassGenerationModule })))
const AiAuditModule = lazy(() => import('@/components/modules/ai-audit').then(m => ({ default: m.AiAuditModule })))
const DIVersionsModule = lazy(() => import('@/components/modules/di-versions').then(m => ({ default: m.DIVersionsModule })))
const InstructionsModule = lazy(() => import('@/components/modules/instructions').then(m => ({ default: m.InstructionsModule })))
const TechStackModule = lazy(() => import('@/components/modules/tech-stack').then(m => ({ default: m.TechStackModule })))

const navItems: { id: ActiveSection; label: string; icon: React.ReactNode; group: string }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Обзор' },
  { id: 'staff-schedule', label: 'Штатное расписание', icon: <Users className="h-4 w-4" />, group: 'Данные' },
  { id: 'dictionaries', label: 'Справочники', icon: <BookOpen className="h-4 w-4" />, group: 'Данные' },
  { id: 'archive', label: 'Архив ДИ', icon: <Archive className="h-4 w-4" />, group: 'Данные' },
  { id: 'templates', label: 'Шаблоны ДИ', icon: <FileText className="h-4 w-4" />, group: 'Настройка' },
  { id: 'master-prompts', label: 'Мастер-промпты', icon: <Brain className="h-4 w-4" />, group: 'Настройка' },
  { id: 'ai-providers', label: 'ИИ-провайдеры', icon: <Cpu className="h-4 w-4" />, group: 'Настройка' },
  { id: 'generation', label: 'Генерация ДИ', icon: <Sparkles className="h-4 w-4" />, group: 'Генерация' },
  { id: 'mass-generation', label: 'Массовая генерация', icon: <Zap className="h-4 w-4" />, group: 'Генерация' },
  { id: 'tracking', label: 'Журнал действий', icon: <ClipboardList className="h-4 w-4" />, group: 'Жизненный цикл' },
  { id: 'version-history', label: 'Версии и сравнение', icon: <History className="h-4 w-4" />, group: 'Жизненный цикл' },
  { id: 'ai-audit', label: 'Аудит ДИ', icon: <ShieldCheck className="h-4 w-4" />, group: 'Жизненный цикл' },
  { id: 'instructions', label: 'Инструкции', icon: <HelpCircle className="h-4 w-4" />, group: 'Обзор' },
  { id: 'tech-stack', label: 'Стек технологий', icon: <Boxes className="h-4 w-4" />, group: 'Обзор' },
]

const moduleComponents: Record<ActiveSection, React.ComponentType> = {
  dashboard: DashboardModule,
  'staff-schedule': StaffScheduleModule,
  archive: ArchiveModule,
  templates: TemplatesModule,
  'master-prompts': MasterPromptsModule,
  generation: GenerationModule,
  tracking: TrackingModule,
  dictionaries: DictionariesModule,
  'ai-providers': AiProvidersModule,
  'mass-generation': MassGenerationModule,
  'ai-audit': AiAuditModule,
  'version-history': DIVersionsModule,
  instructions: InstructionsModule,
  'tech-stack': TechStackModule,
}

function ModuleLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function AppShell() {
  const { activeSection, setActiveSection, sidebarOpen, setSidebarOpen } = useAppStore()
  const [logoFlipped, setLogoFlipped] = useState(false)
  const groups = ['Обзор', 'Данные', 'Настройка', 'Генерация', 'Жизненный цикл']
  const ActiveModule = moduleComponents[activeSection]
  const [searchOpen, setSearchOpen] = useState(false)

  // Хоткей глобального поиска: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Подпись активного раздела для хлебных крошек
  const activeLabel = navItems.find(n => n.id === activeSection)?.label ?? activeSection

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300', sidebarOpen ? 'w-64' : 'w-16')}>
        <div className="p-4 border-b">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              {/* Flip card plaque */}
              <div
                className="flip-card flex-1 min-w-0 cursor-pointer"
                onClick={() => setLogoFlipped(!logoFlipped)}
              >
                <div className={cn('flip-card-inner min-h-[3.25rem]', logoFlipped && 'flipped')}>
                  {/* FRONT SIDE */}
                  <div className="flip-card-front rounded-lg bg-card p-2 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-bold text-sm">A</span>
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-semibold text-sm truncate">Группа Астра</h1>
                      <p className="text-xs text-muted-foreground truncate">Генератор ДИ</p>
                    </div>
                  </div>
                  {/* BACK SIDE */}
                  <div className="flip-card-back rounded-lg bg-card p-2 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-bold tracking-wide">@VADSHV</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flip-card cursor-pointer"
                onClick={() => setLogoFlipped(!logoFlipped)}
              >
                <div className={cn('flip-card-inner h-8 w-8', logoFlipped && 'flipped')}>
                  {/* FRONT */}
                  <div className="flip-card-front h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">A</span>
                  </div>
                  {/* BACK */}
                  <div className="flip-card-back h-8 w-8 rounded-lg bg-card flex items-center justify-center">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0 py-2">
          {groups.map((group) => {
            const items = navItems.filter((item) => item.group === group)
            if (items.length === 0) return null
            return (
              <div key={group} className="mb-2">
                {sidebarOpen && <p className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">{group}</p>}
                {!sidebarOpen && <Separator className="mx-2 my-1" />}
                {items.map((item) => (
                  <Button key={item.id} variant={activeSection === item.id ? 'secondary' : 'ghost'} className={cn('w-full justify-start gap-3 h-9 px-3 mx-1', !sidebarOpen && 'justify-center px-0 w-12', activeSection === item.id && 'font-medium')} onClick={() => setActiveSection(item.id)} title={!sidebarOpen ? item.label : undefined}>
                    {item.icon}
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </Button>
                ))}
              </div>
            )
          })}
        </ScrollArea>
        <div className="p-3 border-t">
          {sidebarOpen && <p className="text-xs text-muted-foreground text-center">v1.0 • Группа Астра</p>}
        </div>
      </aside>
      <main className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'sm:ml-64' : 'sm:ml-16')}>
        {/* Затемнение-оверлей для мобильных при открытом сайдбаре */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-6 py-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button type="button" onClick={() => setActiveSection('dashboard')} className="text-muted-foreground hover:text-foreground">
                    Генератор ДИ
                  </button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{activeLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
        </header>
        <div className="p-6 max-w-[1600px] mx-auto">
          <Suspense fallback={<ModuleLoader />}>
            <ActiveModule key={activeSection} />
          </Suspense>
        </div>
      </main>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
