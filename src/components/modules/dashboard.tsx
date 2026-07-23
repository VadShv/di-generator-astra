'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Archive, FileText, Brain, Sparkles, GitBranch, GitCompareArrows, TrendingUp, ArrowRight } from 'lucide-react'

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
  { label: 'Сгенерировать новую ДИ', icon: Sparkles, color: 'text-cyan-600', bgColor: 'bg-cyan-100', section: 'generation' as const, badge: 'AI' },
  { label: 'Загрузить архивную ДИ', icon: Archive, color: 'text-amber-600', bgColor: 'bg-amber-100', section: 'archive' as const, badge: null },
  { label: 'Сравнить версии ДИ', icon: GitCompareArrows, color: 'text-pink-600', bgColor: 'bg-pink-100', section: 'comparison' as const, badge: 'New' },
  { label: 'Настроить мастер-промпт', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-100', section: 'master-prompts' as const, badge: null },
  { label: 'Загрузить штатное расписание', icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-100', section: 'staff-schedule' as const, badge: null },
  { label: 'Создать шаблон ДИ', icon: FileText, color: 'text-rose-600', bgColor: 'bg-rose-100', section: 'templates' as const, badge: null },
]

export function DashboardModule() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

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

  const statCards = stats ? [
    { label: 'Подразделения', value: stats.departments, icon: <Users className="h-5 w-5" />, gradient: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-100 text-emerald-600' },
    { label: 'Должности в ШР', value: stats.positions, icon: <Users className="h-5 w-5" />, gradient: 'from-teal-500 to-teal-600', iconBg: 'bg-teal-100 text-teal-600' },
    { label: 'Архивных ДИ', value: stats.archiveDIs, icon: <Archive className="h-5 w-5" />, gradient: 'from-amber-500 to-amber-600', iconBg: 'bg-amber-100 text-amber-600' },
    { label: 'Шаблонов ДИ', value: stats.templates, icon: <FileText className="h-5 w-5" />, gradient: 'from-rose-500 to-rose-600', iconBg: 'bg-rose-100 text-rose-600' },
    { label: 'Мастер-промптов', value: stats.masterPrompts, icon: <Brain className="h-5 w-5" />, gradient: 'from-purple-500 to-purple-600', iconBg: 'bg-purple-100 text-purple-600' },
    { label: 'Сгенерированных ДИ', value: stats.generatedDIs, icon: <Sparkles className="h-5 w-5" />, gradient: 'from-cyan-500 to-cyan-600', iconBg: 'bg-cyan-100 text-cyan-600' },
    { label: 'На согласовании', value: stats.pendingTracking, icon: <GitBranch className="h-5 w-5" />, gradient: 'from-orange-500 to-orange-600', iconBg: 'bg-orange-100 text-orange-600' },
    { label: 'Ожидают сравнения', value: stats.pendingComparison, icon: <GitCompareArrows className="h-5 w-5" />, gradient: 'from-pink-500 to-pink-600', iconBg: 'bg-pink-100 text-pink-600' },
  ] : []

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
          statCards.map((card) => (
            <Card key={card.label} className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                    <p className="text-2xl font-bold mt-0.5">{card.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                    {card.icon}
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
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Быстрые действия
            </CardTitle>
            <CardDescription>Основные операции системы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {quickActions.map((action) => (
              <div key={action.label} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group">
                <div className={`p-1.5 rounded-lg ${action.bgColor}`}>
                  <action.icon className={`h-4 w-4 ${action.color}`} />
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
              <GitBranch className="h-5 w-5 text-orange-600" />
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
