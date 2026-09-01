'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Archive, FileText, Brain, Sparkles, GitBranch, GitCompareArrows, TrendingUp, ArrowRight, Zap, Shield, History, BookOpen, Loader2 } from 'lucide-react'

import { useAppStore, type ActiveSection } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
interface Stats {
  departments: number
  positions: number
  archiveDIs: number
  templates: number
  masterPrompts: number
  generatedDIs: number
  pendingTracking: number
  pendingComparison: number
}

const quickActions = [
  { label: 'Сгенерировать новую ДИ', icon: Sparkles, color: 'text-cyan-600', bgColor: 'bg-cyan-100', section: 'generation' as ActiveSection, badge: 'AI' },
  { label: 'Массовая генерация ДИ', icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100', section: 'mass-generation' as ActiveSection, badge: 'New' },
  { label: 'AI-аудит ДИ', icon: Shield, color: 'text-red-600', bgColor: 'bg-red-100', section: 'ai-audit' as ActiveSection, badge: 'New' },
  { label: 'Версионирование ДИ', icon: History, color: 'text-indigo-600', bgColor: 'bg-indigo-100', section: 'version-history' as ActiveSection, badge: 'New' },
  { label: 'Загрузить архивную ДИ', icon: Archive, color: 'text-amber-600', bgColor: 'bg-amber-100', section: 'archive' as ActiveSection, badge: null },
  { label: 'Сравнить версии ДИ', icon: GitCompareArrows, color: 'text-pink-600', bgColor: 'bg-pink-100', section: 'version-history' as ActiveSection, badge: null },
  { label: 'Настроить мастер-промпт', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-100', section: 'master-prompts' as ActiveSection, badge: null },
  { label: 'Загрузить штатное расписание', icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-100', section: 'staff-schedule' as ActiveSection, badge: null },
  { label: 'Создать шаблон ДИ', icon: FileText, color: 'text-rose-600', bgColor: 'bg-rose-100', section: 'templates' as ActiveSection, badge: null },
  { label: 'Инструкция сервиса', icon: BookOpen, color: 'text-gray-600', bgColor: 'bg-gray-100', section: 'instructions' as ActiveSection, badge: null },
]

const statCardsConfig = [
  { label: 'Подразделения', key: 'departments' as const, icon: Users, cardBg: 'bg-emerald-50', iconColor: 'text-emerald-500', iconBg: 'bg-emerald-100', borderAccent: 'border-emerald-200', section: 'staff-schedule' as ActiveSection },
  { label: 'Должности в ШР', key: 'positions' as const, icon: Users, cardBg: 'bg-teal-50', iconColor: 'text-teal-500', iconBg: 'bg-teal-100', borderAccent: 'border-teal-200', section: 'staff-schedule' as ActiveSection },
  { label: 'Архивных ДИ', key: 'archiveDIs' as const, icon: Archive, cardBg: 'bg-amber-50', iconColor: 'text-amber-500', iconBg: 'bg-amber-100', borderAccent: 'border-amber-200', section: 'archive' as ActiveSection },
  { label: 'Шаблонов ДИ', key: 'templates' as const, icon: FileText, cardBg: 'bg-rose-50', iconColor: 'text-rose-500', iconBg: 'bg-rose-100', borderAccent: 'border-rose-200', section: 'templates' as ActiveSection },
  { label: 'Мастер-промптов', key: 'masterPrompts' as const, icon: Brain, cardBg: 'bg-purple-50', iconColor: 'text-purple-500', iconBg: 'bg-purple-100', borderAccent: 'border-purple-200', section: 'master-prompts' as ActiveSection },
  { label: 'Сгенерированных ДИ', key: 'generatedDIs' as const, icon: Sparkles, cardBg: 'bg-cyan-50', iconColor: 'text-cyan-500', iconBg: 'bg-cyan-100', borderAccent: 'border-cyan-200', section: 'generation' as ActiveSection },
  { label: 'На согласовании', key: 'pendingTracking' as const, icon: GitBranch, cardBg: 'bg-orange-50', iconColor: 'text-orange-500', iconBg: 'bg-orange-100', borderAccent: 'border-orange-200', section: 'tracking' as ActiveSection },
  { label: 'Ожидают сравнения', key: 'pendingComparison' as const, icon: GitCompareArrows, cardBg: 'bg-pink-50', iconColor: 'text-pink-500', iconBg: 'bg-pink-100', borderAccent: 'border-pink-200', section: 'version-history' as ActiveSection },
]

interface FeedEvent { id: string; type: string; title: string; description: string | null; author: string | null; createdAt: string }

const EVENT_COLORS: Record<string, string> = {
  di_created: 'bg-emerald-500',
  di_updated: 'bg-cyan-500',
  version_created: 'bg-indigo-500',
  audit: 'bg-red-500',
  archive_uploaded: 'bg-amber-500',
  status_change: 'bg-orange-500',
  tag_created: 'bg-rose-500',
  tag_resolved: 'bg-violet-500',
}

export function DashboardModule() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
const { setActiveSection } = useAppStore()
 const { toast } = useToast()

useEffect(() => {
  async function loadStats() {
     try {
       const res = await fetch('/api/dashboard/stats')
       if (res.ok) {
         setStats(await res.json())
       }
       const feedRes = await fetch('/api/activity-feed?limit=8')
       if (feedRes.ok) { const feedData = await feedRes.json(); setEvents(feedData.events || []) }
    } catch (e) {
      console.error(e)
       toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' })
    } finally {
       setLoading(false)
     }
   }
   loadStats()
 }, [])

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCardsConfig.map((card) => (
            <Card key={card.label} className={`hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${card.cardBg} ${card.borderAccent}`} onClick={() => setActiveSection(card.section)}>
              <CardContent className="p-4 relative overflow-hidden">
                {/* Large background icon */}
                <card.icon className={`absolute -right-2 -bottom-2 h-16 w-16 opacity-15 ${card.iconColor}`} />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`flex items-center justify-center rounded-lg p-1.5 ${card.iconBg}`}>
                      <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                  </div>
                  <p className="text-2xl font-bold">{stats ? stats[card.key] : 0}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions and Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-full bg-emerald-100">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              Быстрые действия
            </CardTitle>
            <CardDescription>Основные операции системы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {quickActions.map((action) => (
              <div key={action.label} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group" onClick={() => setActiveSection(action.section)}>
                <div className={`flex items-center justify-center rounded-lg p-2.5 ${action.bgColor}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <span className="text-sm flex-1">{action.label}</span>
                {action.badge && <Badge variant="secondary" className="text-xs">{action.badge}</Badge>}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-full bg-orange-100">
                <GitBranch className="h-4 w-4 text-orange-600" />
              </div>
              Последние действия
            </CardTitle>
            <CardDescription>Хронология событий</CardDescription>
          </CardHeader>
         <CardContent>
            <div className="space-y-3 min-h-[200px]">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : events.length === 0 ? (
                <div className="flex items-center gap-3 p-2 rounded-lg">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Пока нет событий. Начните с создания должностей и генерации ДИ.</span>
                </div>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setActiveSection('tracking')}>
                    <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${EVENT_COLORS[ev.type] || 'bg-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{ev.title}</span>
                      <p className="text-xs text-muted-foreground truncate">
                        {ev.description || '—'} {ev.author ? `· ${ev.author}` : ''} · {new Date(ev.createdAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
