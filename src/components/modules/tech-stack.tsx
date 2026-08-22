'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore, type ActiveSection } from '@/lib/store'
import {
  Cpu, Database, Brain, Server, Layers, Shield, Terminal, Package,
  ChevronRight, Info, Boxes, GitBranch, Zap, Lock, Wrench, Cloud,
  FileCode2, Workflow,
} from 'lucide-react'

// ─── Navigate helper ───────────────────────────────────────

function NavButton({ section, children }: { section: ActiveSection; children: React.ReactNode }) {
  const { setActiveSection } = useAppStore()
  return (
    <button
      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline underline-offset-2 cursor-pointer text-sm font-medium"
      onClick={() => setActiveSection(section)}
    >
      {children}
      <ChevronRight className="h-3 w-3" />
    </button>
  )
}

// ─── Структура данных стека ────────────────────────────────

interface TechItem {
  name: string
  version?: string
  purpose: string
  notes?: string
}

interface TechGroup {
  id: string
  title: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  description: string
  items: TechItem[]
}

const techGroups: TechGroup[] = [
  {
    id: 'runtime',
    title: 'Среда выполнения',
    icon: Terminal,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    description: 'Базовая платформа для запуска сервиса и управления зависимостями.',
    items: [
      { name: 'Bun', version: '>=1.3', purpose: 'JavaScript-рантайм и пакетный менеджер', notes: 'Используется для запуска dev-сервера, скриптов db:push и production-сервера. Быстрее npm/yarn.' },
      { name: 'Node.js совместимость', purpose: 'Базовое окружение', notes: 'Bun совместим с Node-API, поэтому работают все Node-пакеты (Prisma, Next.js).' },
    ],
  },
  {
    id: 'frontend',
    title: 'Фронтенд',
    icon: Layers,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    description: 'Клиентская часть: UI-фреймворк, компоненты, управление состоянием.',
    items: [
      { name: 'Next.js', version: '16.1.x', purpose: 'React-фреймворк (App Router, RSC, API routes)', notes: 'Единый фреймворк для фронтенда и бэкенда. output: "standalone" для production-сборки.' },
      { name: 'React', version: '19.x', purpose: 'UI-библиотека', notes: 'Конкурентный рендеринг, Server Components.' },
      { name: 'TypeScript', version: '5.x', purpose: 'Статическая типизация', notes: 'ignoreBuildErrors: true в конфиге, но tsc --noEmit проверяет чистоту кода.' },
      { name: 'Tailwind CSS', version: '4.x', purpose: 'Utility-first CSS', notes: 'Через @tailwindcss/postcss. tw-animate-css для анимаций.' },
      { name: 'shadcn/ui', purpose: 'Система компонентов на базе Radix UI', notes: 'Компоненты в src/components/ui/, кастомизируются под проект.' },
      { name: 'Radix UI', version: 'latest', purpose: 'Headless-примитивы (диалоги, селекты, меню)', notes: 'Доступность (a11y) и управление фокусом из коробки.' },
      { name: 'lucide-react', version: '0.525.x', purpose: 'Иконки', notes: 'Единый набор SVG-иконок во всём интерфейсе.' },
      { name: 'Zustand', version: '5.x', purpose: 'Глобальный стор (activeSection, sidebar)', notes: 'Минималистичный, без бойлерплейта Redux.' },
      { name: 'TanStack Query', version: '5.x', purpose: 'Серверный кэш и запросы', notes: 'Для данных с автоматическим рефитчем.' },
      { name: 'TanStack Table', version: '8.x', purpose: 'Табличные данные', notes: 'Сортировка, фильтрация, виртуализация.' },
      { name: 'react-hook-form', version: '7.x', purpose: 'Управление формами', notes: 'С zod-валидацией через @hookform/resolvers.' },
      { name: 'zod', version: '4.x', purpose: 'Схемы валидации', notes: 'Рантайм-валидация данных на клиенте и сервере.' },
      { name: 'framer-motion', version: '12.x', purpose: 'Анимации интерфейса', notes: 'Плавные переходы, flip-карточки.' },
      { name: 'recharts', version: '2.x', purpose: 'Графики и диаграммы', notes: 'Для визуализации метрик дашборда.' },
      { name: 'MDX Editor', version: '3.39.x', purpose: 'Редактирование промптов и текстов', notes: 'WYSIWYG-редактор Markdown.' },
    ],
  },
  {
    id: 'backend',
    title: 'Бэкенд',
    icon: Server,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    description: 'Серверная часть: API, ORM, бизнес-логика.',
    items: [
      { name: 'Next.js Route Handlers', purpose: 'REST API (/app/api/*)', notes: 'Все эндпоинты как route.ts. Без отдельного Express-сервера.' },
      { name: 'Prisma', version: '6.19.x', purpose: 'ORM для PostgreSQL', notes: 'Схема в prisma/schema.prisma. transpilePackages в next.config.ts для работы с Turbopack.' },
      { name: 'NextAuth', version: '4.24.x', purpose: 'Аутентификация (заложена)', notes: 'Готовая инфраструктура, активируется при необходимости.' },
      { name: 'next-intl', version: '4.3.x', purpose: 'Интернационализация', notes: 'Локализация интерфейса (русский по умолчанию).' },
      { name: 'Server Components', purpose: 'Серверный рендеринг', notes: 'БД-запросы и тяжёлая логика на сервере.' },
    ],
  },
  {
    id: 'database',
    title: 'База данных',
    icon: Database,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    description: 'Хранилище данных и схема.',
    items: [
      { name: 'PostgreSQL', version: '16.12', purpose: 'Реляционная БД', notes: 'Portable-сборка в /tmp/pgroot, кластер данных в ./.pgdata (переживает перезапуск сессии).' },
      { name: 'DATABASE_URL', purpose: 'Строка подключения', notes: 'postgresql://astra:astra@127.0.0.1:5432/di_generator' },
      { name: 'Prisma Migrate / db:push', purpose: 'Миграции схемы', notes: 'db:push для dev (принимает data-loss), migrate dev для версионированных миграций.' },
      { name: 'CUID-идентификаторы', purpose: 'Первичные ключи', notes: '@default(cuid()) — распределённые ID без коллизий.' },
    ],
  },
  {
    id: 'ai',
    title: 'ИИ-коннектор',
    icon: Brain,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    description: 'Универсальный слой для работы с LLM-моделями.',
    items: [
      { name: 'Универсальный коннектор', purpose: 'Единый интерфейс к разным LLM', notes: 'src/lib/ai-connector/. Фабрика провайдеров, шифрование ключей.' },
      { name: 'OpenAI-compatible', purpose: 'OpenAI, Cloud.ru, Ollama, vLLM, LiteLLM', notes: 'Тип openai_compatible. Базовый URL + API-ключ.' },
      { name: 'Yandex Cloud', purpose: 'YandexGPT', notes: 'Тип yandex_cloud. IAM-токен + folder_id.' },
      { name: 'Ollama', purpose: 'Локальные LLM', notes: 'Тип ollama. OpenAI-совместимый endpoint, без ключа.' },
      { name: 'z-ai-web-dev-sdk', version: '0.0.18', purpose: 'Встроенный fallback', notes: 'Тип zai. Не требует настроек, работает из коробки.' },
      { name: 'AES-шифрование ключей', purpose: 'Безопасное хранение API-ключей', notes: 'AI_PROVIDER_ENCRYPTION_KEY. Ключи в БД в зашифрованном виде.' },
      { name: 'Задачи генерации', purpose: 'Массовая и одиночная генерация ДИ', notes: 'Модель GenerationJob для отслеживания статусов.' },
    ],
  },
  {
    id: 'parsing',
    title: 'Парсинг документов',
    icon: FileCode2,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    description: 'Загрузка и обработка входных файлов.',
    items: [
      { name: 'xlsx (SheetJS)', version: '0.18.x', purpose: 'Парсинг штатного расписания из Excel', notes: 'src/lib/staffing-parser.ts.' },
      { name: 'pdf-parse', version: '2.4.x', purpose: 'Извлечение текста из PDF', notes: 'Для загрузки старых ДИ.' },
      { name: 'mammoth', version: '1.12.x', purpose: 'Конвертация DOCX → текст/HTML', notes: 'Для загрузки архивных ДИ из Word.' },
      { name: 'DI-парсер', purpose: 'Структурирование ДИ на секции', notes: 'src/lib/di-parser.ts. Разбивка на разделы для аудита и сравнения.' },
      { name: 'react-markdown', version: '10.x', purpose: 'Рендеринг Markdown', notes: 'Отображение сгенерированных ДИ.' },
    ],
  },
  {
    id: 'infra',
    title: 'Инфраструктура и сборка',
    icon: Cloud,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    description: 'Деплой, сборка, окружение.',
    items: [
      { name: 'Turbopack', purpose: 'Dev-сборщик (по умолчанию)', notes: 'Быстрее webpack в 30–40 раз. Работает благодаря transpilePackages: ["@prisma/client", ".prisma/client"] в next.config.ts.' },
      { name: 'Standalone output', purpose: 'Production-сборка', notes: 'output: "standalone" — автономный сервер без node_modules. bun .next/standalone/server.js.' },
      { name: 'Portable PostgreSQL', purpose: 'БД без системной установки', notes: 'Бинари распакованы из .deb в /tmp/pgroot. Не требует sudo/systemctl.' },
      { name: 'setsid-демон', purpose: 'Запуск БД как отсоединённый процесс', notes: 'Чтобы AstraCode не убивал Postgres при переключении PTY-сессии.' },
      { name: '.env', purpose: 'Переменные окружения', notes: 'DATABASE_URL, AI_PROVIDER_ENCRYPTION_KEY.' },
    ],
  },
  {
    id: 'quality',
    title: 'Качество кода',
    icon: Shield,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    description: 'Инструменты проверки и стиля.',
    items: [
      { name: 'ESLint', version: '9.x', purpose: 'Статический анализ', notes: 'eslint-config-next. Проверяет все .ts/.tsx.' },
      { name: 'TypeScript Compiler', purpose: 'Проверка типов (tsc --noEmit)', notes: 'Строгий контроль типов вне сборки.' },
      { name: 'Prettier-стиль', purpose: 'Единое форматирование', notes: 'Следует конвенциям Next.js + shadcn/ui.' },
    ],
  },
]

// ─── Эксплуатация: команды ─────────────────────────────────

interface CommandItem {
  command: string
  description: string
  escalation?: boolean
}

const runCommands: CommandItem[] = [
  { command: 'bash scripts/start-postgres.sh start', description: 'Запуск portable PostgreSQL (127.0.0.1:5432)', escalation: true },
  { command: 'bun run db:push', description: 'Применить схему Prisma к БД', escalation: true },
  { command: 'bun run dev', description: 'Dev-сервер Next.js (Turbopack, :3001)', escalation: true },
  { command: 'bun next dev -p 3000 -H 0.0.0.0', description: 'Альтернативный запуск dev-сервера' },
  { command: 'bun run build', description: 'Production-сборка (standalone)' },
  { command: 'bun run start', description: 'Запуск production-сервера' },
  { command: 'bun run lint', description: 'Проверка ESLint' },
  { command: 'bunx tsc --noEmit', description: 'Проверка типов TypeScript' },
  { command: 'bash scripts/start-postgres.sh stop', description: 'Остановка PostgreSQL' },
  { command: 'bash scripts/start-postgres.sh status', description: 'Статус PostgreSQL' },
]

const architectureNotes = [
  'Единый фреймворк Next.js покрывает и фронтенд (App Router), и бэкенд (Route Handlers) — без отдельного API-сервера.',
  'БД-запросы через Prisma Client, инициализируется в src/lib/db.ts как синглтон.',
  'Состояние UI (активная вкладка, сайдбар) — в Zustand-сторе src/lib/store.ts.',
  'Глобальный поиск и навигация — через setActiveSection, что связывает все модули.',
  'Каскадный выбор «компания → подразделение → должность» — единый компонент CascadePositionSelector, используется во всех модулях.',
  'ИИ-генерация идёт через фабрику провайдеров: выбирается запись AIProvider из БД, расшифровывается ключ, вызывается соответствующий адаптер.',
  'Лента «Журнала действий» агрегирует события из 7 таблиц без дублирования данных — единый виртуальный timeline.',
]

// ─── Компонент ─────────────────────────────────────────────

export function TechStackModule() {
  const [activeTab, setActiveTab] = useState('runtime')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Boxes className="h-6 w-6" /> Стек технологий
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Подробное описание технологий разработки и эксплуатации сервиса «Генератор ДИ — Группа Астра»
        </p>
      </div>

      {/* Краткая сводка */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Workflow className="h-5 w-5 text-primary" />
            <p className="text-sm font-medium">Краткая сводка</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Layers className="h-4 w-4 text-cyan-600" />
              <div>
                <p className="text-xs text-muted-foreground">Фронтенд</p>
                <p className="text-sm font-medium">Next.js 16 + React 19</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Server className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Бэкенд</p>
                <p className="text-sm font-medium">Route Handlers + Prisma</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Database className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">База данных</p>
                <p className="text-sm font-medium">PostgreSQL 16</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Brain className="h-4 w-4 text-violet-600" />
              <div>
                <p className="text-xs text-muted-foreground">ИИ</p>
                <p className="text-sm font-medium">Универсальный коннектор LLM</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Terminal className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground">Рантайм</p>
                <p className="text-sm font-medium">Bun</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Zap className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Сборщик</p>
                <p className="text-sm font-medium">Turbopack</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Shield className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Качество</p>
                <p className="text-sm font-medium">ESLint + tsc</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Lock className="h-4 w-4 text-slate-600" />
              <div>
                <p className="text-xs text-muted-foreground">Безопасность</p>
                <p className="text-sm font-medium">AES-шифрование ключей</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Подробные вкладки по слоям */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 px-1">
          {techGroups.map((group) => (
            <TabsTrigger key={group.id} value={group.id} className="gap-1.5 text-xs">
              <div className={`flex items-center justify-center rounded-md p-1 ${group.iconBg}`}>
                <group.icon className={`h-3 w-3 ${group.iconColor}`} />
              </div>
              {group.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {techGroups.map((group) => (
          <TabsContent key={group.id} value={group.id} className="space-y-4 mt-4">
            <Card className={`border-l-4 ${group.iconBg.replace('bg-', 'border-l-').replace('100', '500')}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`flex items-center justify-center rounded-lg p-2 ${group.iconBg}`}>
                    <group.icon className={`h-5 w-5 ${group.iconColor}`} />
                  </div>
                  {group.title}
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.items.map((item, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                      </div>
                      {item.version && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0 font-mono">{item.version}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.purpose}</p>
                    {item.notes && (
                      <div className="flex items-start gap-1.5 pt-1">
                        <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Архитектурные принципы */}
      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg p-2 bg-indigo-100">
              <GitBranch className="h-5 w-5 text-indigo-600" />
            </div>
            Архитектурные принципы
          </CardTitle>
          <CardDescription>Ключевые решения и паттерны проекта</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {architectureNotes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              <span className="leading-relaxed">{note}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Команды эксплуатации */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg p-2 bg-amber-100">
              <Wrench className="h-5 w-5 text-amber-600" />
            </div>
            Команды эксплуатации
          </CardTitle>
          <CardDescription>Запуск, сборка и проверка сервиса</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {runCommands.map((cmd, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-amber-100 text-amber-700 flex-shrink-0 mt-0.5">
                <Terminal className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground break-all">{cmd.command}</code>
                  {cmd.escalation && (
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">требует эскалации</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{cmd.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Подсказка */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-3">
          <Cpu className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Полная история разработки</p>
            <p className="text-muted-foreground">
              Подробное описание всех фаз и решений — в <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">AGENT_LOG.md</code>. Инструкция по быстрому запуску — в <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">RUN.md</code>.
            </p>
          </div>
          <NavButton section="instructions">К инструкции</NavButton>
        </CardContent>
      </Card>
    </div>
  )
}
