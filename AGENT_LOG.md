# AGENT_LOG — Журнал работы над проектом «Генератор ДИ Группы Астра»

> Файл создан для сохранения контекста работы между сессиями и перезагрузками.
> Последнее обновление: 2026-07-25

---

## 1. Структура проекта

**Корневая директория:** `/home/astra/di-generator-astra`

### Основные папки и файлы

| Путь | Назначение |
|------|-----------|
| `src/app/` | Next.js App Router — страницы и API-роуты |
| `src/app/api/` | API-эндпоинты (CRUD + AI-генерация) |
| `src/components/modules/` | 12 функциональных модулей интерфейса |
| `src/components/ui/` | shadcn/ui компоненты (Button, Dialog, Tabs и т.д.) |
| `src/lib/` | `db.ts` (Prisma client), `store.ts` (Zustand), `utils.ts` |
| `src/hooks/` | `use-mobile.ts`, `use-toast.ts` |
| `prisma/schema.prisma` | Схема БД (SQLite, 11 моделей) |
| `agent-ctx/` | Контекстные документы по модулям (Tasks 3,4,6,7,10,S1) |
| `mini-services/` | Вспомогательные мини-сервисы |
| `.zscripts/` | Скрипты запуска/сборки (dev.sh, build.sh, start.sh) |
| `examples/websocket/` | Примеры WS-интеграции |
| `worklog.md` | История изменений (основная фаза: версионирование, массовая генерация, AI-аудит) |

### API-роуты (`src/app/api/`)
`archive-di`, `business-functions`, `companies`, `compare`, `dashboard`, `departments`, `export-di`, `generate-di` (+ `ai-generate`, `ai-section`, `ai-improve`, `ai-audit`, `mass-generate`), `generated-di`, `master-prompts`, `positions`, `projects`, `templates`, `tracking`

### Модули интерфейса (`src/components/modules/`)
`dashboard`, `dictionaries`, `staff-schedule`, `archive`, `templates`, `master-prompts`, `generation`, `mass-generation`, `instructions`, `tracking`, `comparison`, `version-history`, `ai-audit`

---

## 2. Технологический стек

- **Фреймворк:** Next.js 16 (App Router, React 19, TypeScript 5)
- **Язык/Рантайм:** TypeScript + Bun (`bun.lock`, `bun-types`)
- **База данных:** SQLite + Prisma 6 (`@prisma/client`)
- **UI:** Tailwind CSS 4, shadcn/ui, Radix UI, framer-motion, lucide-react
- **Состояние:** Zustand (стор в `src/lib/store.ts`), TanStack Query 5
- **Формы/Валидация:** react-hook-form + zod 4
- **Аутентификация:** next-auth 4
- **i18n:** next-intl
- **AI:** `z-ai-web-dev-sdk` (генерация/аудит ДИ)
- **Работа с документами:** mammoth (DOCX→текст), pdf-parse (PDF), xlsx, sharp, react-markdown, @mdxeditor/editor
- **DnD/Таблицы:** @dnd-kit, @tanstack/react-table
- **Сборка:** `next build` → standalone-сервер; реверс-прокси через Caddyfile
- **Дев-сервер:** `bun run dev` (порт 3000, хост 0.0.0.0)

### Модели БД (Prisma)
`Company`, `Department` (иерархия), `BusinessFunction`, `Project`, `Position`, `ArchiveDI`, `DITemplate` + `DITemplateSection`, `MasterPrompt` (версионируемый), `GeneratedDI` + `GeneratedDISection`, `DITracking`, `DIVersion`, `DIAuditResult` (5 классов правовых ошибок)

---

## 3. Текущее состояние

Система функциональна, содержит **12 модулей** в боковой навигации (6 групп: Обзор, Данные, Настройка, Генерация, Жизненный цикл, Анализ). Реализованы три ключевые фичи последней фазы:
- **Версионирование** ДИ с историей и сравнением версий (автосохранение при правках)
- **Массовая генерация** ДИ по компаниям/подразделениям
- **AI-аудит** с 5 классами правовых ошибок (дублирование ТК РФ, расплывчатые формулировки, противоречия закону, завышенные требования, неполнота разделов)

### Известные риски
- Фоновые процессы умирают между вызовами bash — дев-сервер нужно перезапускать каждую сессию
- После изменений Prisma-схемы требуется `bun run db:push` + перегенерация клиента + очистка `.next`

---

## 4. План дальнейших действий

### Приоритеты из worklog.md (рекомендации следующей фазы)
1. **E2E-тестирование** массовой генерации (создать шаблон → выбрать подразделения → запустить)
2. **E2E-тестирование** AI-аудита (сгенерировать ДИ → запустить аудит)
3. **Тестирование** восстановления версии (редактирование → откат к предыдущей)
4. **Экспорт в DOCX** (пакет `docx`) — пока реализован только `export-di` заглушка
5. **Пакетное удаление** массово сгенерированных ДИ
6. **Фильтрация/поиск** в модуле массовой генерации
7. **Визуальный полиш** (анимации, улучшение стиля)

### Рабочий процесс
- Каждую сессию: проверять состояние дев-сервера, при необходимости перезапускать (`cd /home/astra/di-generator-astra && bun run dev`)
- После правок схемы — `bun run db:push && bun run db:generate`
- Перед завершением задачи — `bun run lint` (ESLint 9, flat-config)
- Логировать сюда ключевые изменения и решения

---

## 5. Журнал сессий

### Сессия 2026-07-25 (инициализация)
- ✅ Изучена структура проекта: Next.js 16 + Prisma 6 (SQLite) + Bun + shadcn/ui + Zustand
- ✅ Проанализированы `package.json`, `prisma/schema.prisma`, `worklog.md`, `agent-ctx/`
- ✅ Создан файл `AGENT_LOG.md` (этот документ)
- ⏳ Ожидание дальнейших инструкций пользователя

### Сессия 2026-07-25 (развёртывание SaaS локально)
- ✅ Окружение ВМ: Bun отсутствовал → установлен через `curl -fsSL https://bun.sh/install` в `~/.bun/bin` (v1.3.14)
- ✅ `.env`: исправлен `DATABASE_URL` со старого пути `/home/z/my-project/db/custom.db` → `file:/home/astra/di-generator-astra/db/custom.db`
- ✅ `bun install`: зависимости установлены (нужны env `BUN_TMPDIR=/tmp/buntmp` + `BUN_INSTALL=/home/astra/.bun` в песочнице)
- ✅ `bun run db:generate`: Prisma-клиент v6.19.2 сгенерирован (скачан query engine с binaries.prisma.sh)
- ✅ `bun run db:push`: SQLite-БД создана в `db/custom.db`, 11 моделей синхронизированы со схемой
- ✅ **Баг-фикс Prisma 6 + Turbopack**: API-роуты падали с `Cannot find module '@prisma/client-2c3a283f134fdcb6'`. Prisma 6 использует виртуальный хешированный модуль, который Turbopack не резолвит. Фикс — добавлен `serverExternalPackages: ["@prisma/client", ".prisma/client"]` в `next.config.ts`, чтобы Next загружал Prisma как внешний модуль через рантайм Node
- ✅ Дев-сервер запущен: `bun run dev` → Next.js 16.1.3 (Turbopack), http://0.0.0.0:3000, Ready ~800ms
- ✅ Проверка: главная страница 200, все 12 API-эндпоинтов отвечают 200 (`/api/dashboard/stats`, `/api/companies`, `/api/positions`, `/api/templates`, `/api/master-prompts`, `/api/generated-di`, `/api/archive-di`, `/api/tracking`, `/api/compare` и др.). БД пустая (ожидаемо).

#### Изменённые файлы
- `.env` — DATABASE_URL переведён на локальный путь
- `next.config.ts` — добавлен `serverExternalPackages` для совместимости Prisma 6 + Turbopack
- `db/custom.db` — создана SQLite-БД (новая, пустая)

#### Команды для перезапуска дев-сервера (шпаргалка)
```bash
cd /home/astra/di-generator-astra
export PATH="/home/astra/.bun/bin:$PATH"
export BUN_TMPDIR=/tmp/buntmp
export BUN_INSTALL=/home/astra/.bun
bun run dev   # http://0.0.0.0:3000
```
- Остановить сервер: `pkill -f "next dev"; pkill -f "start-server.js"`
- После правки `prisma/schema.prisma`: `bun run db:push && bun run db:generate` (затем перезапуск dev)

#### Замечание
- `/api/dashboard` (корень) → 404: реальный эндпоинт на `/api/dashboard/stats` (так и задумано)
- `/api/export-di` (корень) → 400 без параметров: ожидает id ДИ, это норма
- Dev-сервер работает в PTY-сессии, при перезагрузке ВМ нужно перезапускать вручную

---

## 6. Генеральный план доработки

Полный план по 8 фазам. После каждой фазы — git commit + обновление этого лога.
Цель: лёгкий подъём сервиса, миграция на PostgreSQL + Node.js, универсальный ИИ-коннектор,
загрузка ШР из Excel, загрузка старых ДИ (PDF/DOCX), развитие мастер-промптов,
отслеживание и массовая генерация, полиш UX.

| Фаза | Содержание | Статус |
|------|-----------|--------|
| 0 | Аудит и развёртывание | ✅ Завершена |
| 1 | Миграция на PostgreSQL + новая схема данных | ⏳ Ожидает |
| 2 | Универсальный коннектор ИИ-моделей | ⏳ Ожидает |
| 3 | Загрузка штатного расписания из Excel | ⏳ Ожидает |
| 4 | Загрузка старых ДИ (PDF/DOCX) | ⏳ Ожидает |
| 5 | Мастер-промпты и «Культура ИИ» | ⏳ Ожидает |
| 6 | Отслеживание и массовая генерация | ⏳ Ожидает |
| 7 | Полиш и UX | ⏳ Ожидает |

---

## 7. ФАЗА 0: Аудит и развёртывание — РЕЗУЛЬТАТЫ

### 0.1 Развёртывание (подтверждено)
- `bun install` — 888 пакетов, без изменений (зависимости уже установлены)
- `bun run db:generate` — Prisma Client v6.19.2 сгенерирован
- `bun run db:push` — SQLite-БД `db/custom.db` синхронизирована (14 моделей)
- Дев-сервер: `bun next dev -p 3000 -H 0.0.0.0` (Next.js 16.1.3 Turbopack), Ready ~700ms
- Проверка через `dev.log`: главная страница и все API отвечают 200
- ⚠️ Сетевая изоляция sandbox: dev-сервер в PTY-сессии невидим из диагностических `curl`/`ss` в других сессиях. Проверять только через `dev.log` или из браузера пользователя.

### 0.2 Аудит Prisma-схемы (14 моделей)
Существующие модели: `Company`, `Department` (с иерархией parent/children), `BusinessFunction`,
`Project`, `Position` (ШР: grade, headcount, functions), `ArchiveDI`, `DITemplate`,
`DITemplateSection`, `GeneratedDI` (status, versioning), `GeneratedDISection`,
`DITracking`, `DIVersion`, `DIAuditResult` (5 категорий правового аудита), `MasterPrompt`.

**Что есть, но требует доработки (Фаза 1):**
- ❌ `provider = "sqlite"` → нужен PostgreSQL
- ❌ Нет отдельной модели `LegalEntity` (роль `Company` — но без ИНН/ОГРН/адреса)
- ❌ Нет модели `StaffingTable` (ШР как отдельная сущность со ставками)
- ❌ Нет модели `AIProvider` (коннектор ИИ — провайдер, ключ, модель)
- ❌ Нет модели `UploadedDocument` (загруженные старые ДИ с распознанным текстом)
- ❌ Нет полей ИНН/ОГРН/адреса в Company
- ❌ Нет индексов на часто запрашиваемые поля
- ⚠️ `MasterPrompt` без категорий и без явного версионирования через историю

### 0.3 Аудит UI (13 модулей в `src/app/page.tsx`)
Активная оболочка — `src/app/page.tsx` (151 строка, `'use client'`): сайдбар с 13 пунктами
в 7 группах + flip-card логотип. Все 13 модулей подключены через `modules: Record<ActiveSection, ReactNode>`.
⚠️ Мёртвый код: `src/components/app-shell.tsx` и `src/components/error-boundary.tsx` — нигде не импортируются.
⚠️ `src/app/page.tsx.bak` — бэкап главной страницы рядом.

| Модуль | Статус | Строк | Что нужно исправить |
|--------|--------|-------|---------------------|
| dashboard | ✅ РАБОТАЕТ | 169 | Лента «Последние действия» захардкодена; ошибки без toast |
| staff-schedule | ✅ РАБОТАЕТ | 1275 | **Вызывает несуществующий `/api/upload/staff-schedule`**; silent catch; фейковый прогресс |
| dictionaries | ✅ РАБОТАЕТ | 621 | Блокировка удаления только UI-предупреждением |
| archive | ✅ РАБОТАЕТ | 505 | **Вызывает несуществующий `/api/upload/archive-di`**; silent catch; фейковый прогресс |
| templates | ✅ РАБОТАЕТ | 328 | Неиспользуемый импорт `StarOff` |
| master-prompts | ✅ РАБОТАЕТ | 395 | Silent catch справочников; нет категорий промптов |
| generation | ✅ РАБОТАЕТ | 1060 | Неиспользуемые импорты; двойной `await res.json()`; нет прогресса генерации |
| mass-generation | ✅ РАБОТАЕТ | 440 | Фейковый прогресс (30→80→100) |
| tracking | ✅ РАБОТАЕТ | 228 | Silent catch |
| version-history | ✅ РАБОТАЕТ | 444 | Дублирует `computeDiff` из comparison; `aiGenerated:true` при восстановлении |
| comparison | ✅ РАБОТАЕТ | 209 | Наивный diff без LCS |
| ai-audit | ✅ РАБОТАЕТ | 767 | Фейковый прогресс |
| instructions | ⚠️ ЗАГЛУШКА | 775 | Статичный контент; 14 неиспользуемых импортов иконок |

### 0.4 Аудит API (29 роутов, 28 реальных + 1 заглушка)
Все роуты используют Prisma через `@/lib/db`. ИИ-интеграция в 6 роутах через `z-ai-web-dev-sdk` (SDK `ZAI`).

**КРИТИЧНО — сломанные upload-эндпоинты (вызываются из UI, но не существуют):**
- `POST /api/upload/archive-di` — нет роута (archive.tsx:196)
- `POST /api/upload/staff-schedule` — нет роута (staff-schedule.tsx:426)

**ИИ-роуты (6, все реальны):**
- `generate-di/ai-generate` — полная генерация ДИ по всем секциям шаблона
- `generate-di/ai-section` — генерация одной секции
- `generate-di/ai-improve` — улучшение секции
- `generate-di/ai-audit` — аудит по 5 классам правовых ошибок
- `generate-di/mass-generate` — массовая генерация
- `compare/ai-diff` — ИИ-сравнение версий

**Сквозные проблемы API:**
- ⚠️ `role: 'assistant'` для системного промпта во всех 6 ИИ-роутах (должно быть `'system'`)
- ⚠️ Дублирование `resolveMasterPromptInternal` в 3 копиях с разными стратегиями
- ⚠️ `deleteMany`+пересоздание секций без транзакции (generate-di PUT, templates PUT)
- ⚠️ `any`-типизация в export-di, export-di/docx
- ⚠️ `export-di/docx` НЕ генерирует docx на сервере — отдаёт JSON для клиентской сборки
- ⚠️ Корневой `/api/route.ts` — заглушка `{ message: "Hello, world!" }`
- ⚠️ Локализация ошибок в `projects/route.ts` на английском
- ⚠️ `dashboard/stats` в catch возвращает нули со статусом 200 (маскирует ошибку)

### 0.5 Аудит инфраструктуры
- **ИИ-провайдер**: только `z-ai-web-dev-sdk@0.0.18` — жёсткая привязка к одному SDK, нет гибкого коннектора
- **Парсинг файлов**: `mammoth` (docx), `pdf-parse` (pdf), `xlsx` (excel) — **установлены, но НЕ импортируются нигде**
- **Мёртвые зависимости**: `next-auth`, `next-intl`, `next-themes` — установлены, не используются
- **React-query**: `@tanstack/react-query` установлен, но `QueryClientProvider` не подключён — серверный state на «голом» fetch
- **TypeScript**: `strict: true`, но `noImplicitAny: false` + `next.config.ts: ignoreBuildErrors: true` — типобезопасность фактически отключена на билде
- **Shared types**: нет папки `types/`, типы API-ответов переопределяются в каждом модуле и расходятся
- **mini-services/**: пусто (только `.gitkeep`)
- **Единый error handling**: нет, каждый роут дублирует try/catch
- **layout.tsx**: провайдер только `<Toaster />`, нет QueryClientProvider/ThemeProvider

### 0.6 Сводная таблица: Модуль → Статус → Что исправить
| Модуль/Слой | Статус | Приоритетные исправления |
|-------------|--------|--------------------------|
| Штатное расписание (upload) | 🔴 СЛОМАНО | Создать `/api/upload/staff-schedule` с парсингом xlsx (Фаза 3) |
| Архив ДИ (upload) | 🔴 СЛОМАНО | Создать `/api/upload/archive-di` с извлечением текста pdf/docx (Фаза 4) |
| ИИ-коннектор | 🟡 ОГРАНИЧНО | Заменить жёсткий z-ai-sdk на универсальный коннектор (Фаза 2) |
| БД (SQLite) | 🟡 РАБОТАЕТ | Мигрировать на PostgreSQL + расширить схему (Фаза 1) |
| Экспорт docx | 🟡 ЧАСТИЧНО | Серверная генерация docx или документация клиентской (Фаза 7) |
| Мастер-промпты | 🟡 РАБОТАЕТ | Добавить категории, «Культуру ИИ», переменные (Фаза 5) |
| Отслеживание | 🟡 РАБОТАЕТ | Дерево подразделений, цветовая индикация, экспорт (Фаза 6) |
| Массовая генерация | 🟡 РАБОТАЕТ | Очередь с реальным прогрессом, пакетный аудит (Фаза 6) |
| Остальные CRUD-модули | 🟢 РАБОТАЕТ | Полиш: toast, loading, empty states (Фаза 7) |

### 0.7 Команды запуска (актуальные)
```bash
# 1. Установить зависимости (нужны env-переменные песочницы Bun)
cd /home/astra/di-generator-astra
export PATH="/home/astra/.bun/bin:$PATH"
export BUN_TMPDIR=/tmp/buntmp
export BUN_INSTALL=/home/astra/.bun
bun install

# 2. БД (SQLite — временно, до Фазы 1)
bun run db:generate
bun run db:push --accept-data-loss

# 3. Дев-сервер
bun next dev -p 3000 -H 0.0.0.0   # http://localhost:3000
# или: bun run dev (пишет лог в dev.log через tee)

# Остановить: pkill -f "next dev"; pkill -f "start-server.js"
# После правки schema.prisma: bun run db:push && bun run db:generate
```

**Возможные ошибки и решения:**
- `EADDRINUSE port 3000` — зависший процесс: `pkill -f "next dev"`, подождать 2-3 сек
- `Cannot find module '@prisma/client-2c3a283f134fdcb6'` — Turbopack не резолвит Prisma 6 (фикс уже в `next.config.ts`: `serverExternalPackages`)
- Сервер «не виден» из других сессий — сетевая изоляция sandbox, проверять через `dev.log` или браузер
- `bun run dev` игнорирует доп. аргументы — всегда поднимает порт 3000 из package.json
- Node.js не установлен — только bun (для `next`-бинаря использовать `bun next ...`)

**ФАЗА 0 ЗАВЕРШЕНА.** Перехожу к Фазе 1 (PostgreSQL + новая схема).
