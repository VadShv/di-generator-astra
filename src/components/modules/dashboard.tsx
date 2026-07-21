'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Archive, FileText, Brain, Sparkles, GitBranch, GitCompareArrows, TrendingUp } from 'lucide-react'

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

export function DashboardModule() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
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
    { label: 'Подразделения', value: stats.departments, icon: <Users className="h-5 w-5" />, color: 'text-emerald-600' },
    { label: 'Должности в ШР', value: stats.positions, icon: <Users className="h-5 w-5" />, color: 'text-teal-600' },
    { label: 'Архивных ДИ', value: stats.archiveDIs, icon: <Archive className="h-5 w-5" />, color: 'text-amber-600' },
    { label: 'Шаблонов ДИ', value: stats.templates, icon: <FileText className="h-5 w-5" />, color: 'text-rose-600' },
    { label: 'Мастер-промптов', value: stats.masterPrompts, icon: <Brain className="h-5 w-5" />, color: 'text-purple-600' },
    { label: 'Сгенерированных ДИ', value: stats.generatedDIs, icon: <Sparkles className="h-5 w-5" />, color: 'text-cyan-600' },
    { label: 'На согласовании', value: stats.pendingTracking, icon: <GitBranch className="h-5 w-5" />, color: 'text-orange-600' },
    { label: 'Ожидают сравнения', value: stats.pendingComparison, icon: <GitCompareArrows className="h-5 w-5" />, color: 'text-pink-600' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-muted-foreground mt-1">
          Обзор системы генерации должностных инструкций Группы Астра
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((card) => (
            <Card key={card.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-1">{card.value}</p>
                  </div>
                  <div className={cn('p-3 rounded-xl bg-muted/50', card.color)}>
                    {card.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Быстрые действия
            </CardTitle>
            <CardDescription>Основные операции системы</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              <span className="text-sm">Сгенерировать новую ДИ</span>
              <Badge variant="secondary" className="ml-auto">AI</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <Archive className="h-4 w-4 text-amber-600" />
              <span className="text-sm">Загрузить архивную ДИ</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <GitCompareArrows className="h-4 w-4 text-pink-600" />
              <span className="text-sm">Сравнить версии ДИ</span>
              <Badge variant="outline" className="ml-auto">New</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-sm">Настроить мастер-промпт</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-orange-600" />
              Последние действия
            </CardTitle>
            <CardDescription>Хронология событий</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Система инициализирована</span>
                <span className="ml-auto text-xs">сейчас</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                <span>Начните с добавления подразделений и должностей</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}
