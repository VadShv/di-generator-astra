'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Archive, FileText, Brain, Sparkles, GitBranch, GitCompareArrows, TrendingUp, ArrowRight, Zap, Shield, History } from 'lucide-react'

import { useAppStore, type ActiveSection } from '@/lib/store'

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
  { label: 'Сравнить версии ДИ', icon: GitCompareArrows, color: 'text-pink-600', bgColor: 'bg-pink-100', section: 'comparison' as ActiveSection, badge: null },
  { label: 'Настроить мастер-промпт', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-100', section: 'master-prompts' as ActiveSection, badge: null },
  { label: 'Загрузить штатное расписание', icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-100', section: 'staff-schedule' as ActiveSection, badge: null },
  { label: 'Создать шаблон ДИ', icon: FileText, color: 'text-rose-600', bgColor: 'bg-rose-100', section: 'templates' as ActiveSection, badge: null },
]

const statCardsConfig = [
  { label: 'Подразделения', key: 'departments' as const, icon: Users, iconBg: 'bg-emerald-100 text-emerald-600' },
  { label: 'Должности в ШР', key: 'positions' as const, icon: Users, iconBg: 'bg-teal-100 text-teal-600' },
  { label: 'Архивных ДИ', key: 'archiveDIs' as const, icon: Archive, iconBg: 'bg-amber-100 text-amber-600' },
  { label: 'Шаблонов ДИ', key: 'templates' as const, icon: FileText, iconBg: 'bg-rose-100 text-rose-600' },
  { label: 'Мастер-промптов', key: 'masterPrompts' as const, icon: Brain, iconBg: 'bg-purple-100 text-purple-600' },
  { label: 'Сгенерированных ДИ', key: 'generatedDIs' as const, icon: Sparkles, iconBg: 'bg-cyan-100 text-cyan-600' },
  { label: 'На согласовании', key: 'pendingTracking' as const, icon: GitBranch, iconBg: 'bg-orange-100 text-orange-600' },
  { label: 'Ожидают сравнения', key: 'pendingComparison' as const, icon: GitCompareArrows, iconBg: 'bg-pink-100 text-pink-600' },
]

export function DashboardModule() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const { setActiveSection } = useAppStore()

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.ok) {
          setStats(await res.json())
        }
      } catch (e) {
        console.error(e)
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
            <Card key={card.label} className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{stats ? stats[card.key] : 0}</p>
                  </div>
                  <div className={`p-2.5 rounded-full ${card.iconBg}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
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
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm">Система инициализирована</span>
                  <p className="text-xs text-muted-foreground">Генератор ДИ Группы Астра готов к работе</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-cyan-50">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm">ИИ-генерация доступна</span>
                  <p className="text-xs text-muted-foreground">Создание ДИ вручную или с помощью ИИ</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-50">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm">Загрузка файлов</span>
                  <p className="text-xs text-muted-foreground">Поддержка DOCX, PDF, XLSX, CSV</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 rounded-lg">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Начните с добавления подразделений и должностей</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
