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
  GitBranch,
  GitCompareArrows,
  Menu,
  ChevronLeft,
  Loader2,
  MessageCircle,
  ArrowLeft,
} from 'lucide-react'
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
const ComparisonModule = lazy(() => import('@/components/modules/comparison').then(m => ({ default: m.ComparisonModule })))

const navItems: { id: ActiveSection; label: string; icon: React.ReactNode; group: string }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Обзор' },
  { id: 'staff-schedule', label: 'Штатное расписание', icon: <Users className="h-4 w-4" />, group: 'Данные' },
  { id: 'archive', label: 'Архив ДИ', icon: <Archive className="h-4 w-4" />, group: 'Данные' },
  { id: 'templates', label: 'Шаблоны ДИ', icon: <FileText className="h-4 w-4" />, group: 'Настройка' },
  { id: 'master-prompts', label: 'Мастер-промпты', icon: <Brain className="h-4 w-4" />, group: 'Настройка' },
  { id: 'generation', label: 'Генерация ДИ', icon: <Sparkles className="h-4 w-4" />, group: 'Генерация' },
  { id: 'tracking', label: 'Отслеживание', icon: <GitBranch className="h-4 w-4" />, group: 'Жизненный цикл' },
  { id: 'comparison', label: 'Сравнение версий', icon: <GitCompareArrows className="h-4 w-4" />, group: 'Жизненный цикл' },
]

const moduleComponents: Record<ActiveSection, React.ComponentType> = {
  dashboard: DashboardModule,
  'staff-schedule': StaffScheduleModule,
  archive: ArchiveModule,
  templates: TemplatesModule,
  'master-prompts': MasterPromptsModule,
  generation: GenerationModule,
  tracking: TrackingModule,
  comparison: ComparisonModule,
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
                <div className={cn('flip-card-inner', logoFlipped && 'flipped')}>
                  {/* FRONT SIDE */}
                  <div className="flip-card-front flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-primary-foreground font-bold text-sm">A</span>
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-semibold text-sm truncate">Группа Астра</h1>
                      <p className="text-xs text-muted-foreground truncate">Генератор ДИ</p>
                    </div>
                  </div>
                  {/* BACK SIDE */}
                  <div className="flip-card-back rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-2.5 flex flex-col items-center justify-center text-center">
                    <MessageCircle className="h-4 w-4 text-primary mb-1.5" />
                    <p className="text-xs leading-relaxed text-foreground">
                      Если возникли вопросы или предложения по работе сервиса, напишите в
                    </p>
                    <p className="text-sm font-semibold text-primary mt-0.5">
                      тг @vadshv
                    </p>
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
                  <div className="flip-card-back h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
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
        <ScrollArea className="flex-1 py-2">
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
      <main className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'ml-64' : 'ml-16')}>
        <div className="p-6 max-w-[1600px] mx-auto">
          <Suspense fallback={<ModuleLoader />}>
            <ActiveModule key={activeSection} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
