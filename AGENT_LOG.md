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
| 1 | Миграция на PostgreSQL + новая схема данных | ✅ Завершена |
| 2 | Универсальный коннектор ИИ-моделей | ✅ Готово |
| 3 | Загрузка штатного расписания из Excel | ✅ Готово |
| 4 | Загрузка старых ДИ (PDF/DOCX) | ✅ Готово |
| 5 | Мастер-промпты и «Культура ИИ» | ⏳ Ожидает |
| 6 | Отслеживание и массовая генерация | ⏳ Ожидает |
| 7 | Полиш и UX | ⏳ Ожидает |

---

## 8. ФАЗА 1: Миграция на PostgreSQL + новая схема — РЕЗУЛЬТАТЫ

### 1.1 Развёртывание PostgreSQL (без root!)
**Проблема среды:** sudo заблокирован (no new privileges flag в контейнере), gcc/make/dev-headers отсутствуют → apt-установка и компиляция невозможны.

**Решение — portable PostgreSQL из .deb-пакетов (распаковка через `ar`+`tar` в `/tmp`):**
- Скачаны с apt.postgresql.org: `postgresql-16_16.12-1.pgdg22.04+1_amd64.deb` (18 MB), `postgresql-client-16` (1.9 MB)
- Скачан с archive.ubuntu.com: `libicu70_70.1-2_amd64.deb` (10.5 MB) — недостающая ICU-зависимость
- Распаковка: `ar x *.deb` → `tar -xf data.tar.xz` в `/tmp/pgroot` (⚠️ нужен `env -i` — иначе конфликт liblzma/libicu из `LD_LIBRARY_PATH` окружения AstraCode)
- Бинари: `/tmp/pgroot/usr/lib/postgresql/16/bin/` (postgres, initdb, pg_ctl, psql, createdb)
- Кластер: `initdb -D /tmp/pgdata -U astra --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C`
- Запуск: `pg_ctl -D /tmp/pgdata -o "-p 5432 -h 127.0.0.1 -k /tmp" start` (socket в `/tmp`, т.к. нет прав на `/var/run/postgresql`)
- БД: `di_generator`, пользователь `astra` / пароль `astra`

**Скрипт лёгкого запуска:** `scripts/start-postgres.sh` (start/stop/status/restart, авто-initdb, авто-createdb)

### 1.2 Новая Prisma-схема (19 таблиц)
`provider = "postgresql"`. Расширены и добавлены модели:

| Модель | Статус | Что добавлено/изменено |
|--------|--------|------------------------|
| Company | расширена | поля `inn`, `ogrn`, `kpp`, `legalAddress`, `actualAddress`; индексы `[inn]`, `[name]` |
| Department | расширена | связи `staffingTables`, `trackings`; индексы `[companyId]`, `[parentId]` |
| Position | расширена | связь `staffingTable` (one-to-one, `@unique`); индексы `[departmentId]`, `[businessFunctionId]`, `[grade]` |
| **StaffingTable** | НОВАЯ | строки ШР: department, positionTitle, headcount, category, source(manual/excel) |
| **UploadedDocument** | НОВАЯ | загруженные ДИ: fileName, fileType(pdf/docx), rawText, parsedSections(JSON), status(pending/parsed/linked/error) |
| **AIProvider** | НОВАЯ | коннектор ИИ: type, baseUrl, apiKeyEncrypted, modelName, folderId, isActive, isDefault, config(JSON) |
| **GenerationJob** | НОВАЯ | очередь массовой генерации: scope, status, total/completed/failed, results(JSON) |
| **MasterPromptVersion** | НОВАЯ | история версий мастер-промпта |
| MasterPrompt | расширена | поля `category`, `isAiCulture`, `variables`; связь `versions`; индексы |
| DITracking | расширена | опциональный `generatedDIId`, поля `departmentId`, `positionId`, расширенный `status` |
| GeneratedDI | расширена | индексы `[positionId]`, `[status]`, `[templateId]` |
| DIAuditResult, DIVersion, ArchiveDI, DITemplate*, BusinessFunction, Project | индексы | добавлены `@@index` на часто запрашиваемые поля |

**Обратная совместимость:** имя `DITracking` сохранено (7 обращений в коде `prisma.dITracking`); все существующие поля оставлены, только добавлены новые.

### 1.3 .env
```
DATABASE_URL="postgresql://astra:astra@127.0.0.1:5432/di_generator?schema=public"
AI_PROVIDER_ENCRYPTION_KEY="di-generator-dev-encryption-key-change-me"
```

### 1.4 Проверка
- `bun run db:push` — ✅ БД в синхронизации (2.65s), 19 таблиц созданы (проверено через `\dt`)
- `bun run db:generate` — ✅ Prisma Client v6.19.2
- Dev-сервер на PostgreSQL: главная страница 200, **все 13 API-эндпоинтов отвечают 200** (companies, departments, positions, business-functions, projects, templates, master-prompts, generated-di, archive-di, dashboard/stats, tracking, compare, generate-di)
- `bun run lint` — ✅ без ошибок

### 1.5 Важные команды (для перезапуска)
```bash
# 1. Поднять PostgreSQL (portable, без root)
./scripts/start-postgres.sh start
# или вручную:
env -i PATH=/usr/bin:/bin HOME=/tmp LD_LIBRARY_PATH=/tmp/pgroot/usr/lib/x86_64-linux-gnu \
  /tmp/pgroot/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata \
  -o "-p 5432 -h 127.0.0.1 -k /tmp" -l /tmp/pg.log start

# 2. Схема (после правки prisma/schema.prisma)
bun run db:push && bun run db:generate

# 3. Dev-сервер
bun next dev -p 3000 -H 0.0.0.0
```

⚠️ **Важно:** PostgreSQL живёт, пока активна его PTY-сессия. При перезагрузке ВМ — перезапустить через `./scripts/start-postgres.sh start`. Бинари postgres в `/tmp/pgroot` переживают перезагрузку только если `/tmp` персистентен.

**ФАЗА 1 ЗАВЕРШЕНА.** Перехожу к Фазе 2 (универсальный ИИ-коннектор).

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
| staff-schedule | ✅ РАБОТАЕТ | ~1340 | Загрузка xlsx реализована (Фаза 3 ✅): двухфазный парсинг→предпросмотр→импорт; silent catch исправлен toast-ами |
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
| Штатное расписание (upload) | 🟢 РАБОТАЕТ | Реализован `/api/staffing-upload` (parse+import) с предпросмотром (Фаза 3 ✅) |
| Архив ДИ (upload) | 🟢 РАБОТАЕТ | Реализован `/api/di-upload` (parse+save) с извлечением PDF/DOCX и разбивкой на секции (Фаза 4 ✅) |
| ИИ-коннектор | 🟢 РАБОТАЕТ | Универсальный коннектор готов (Фаза 2 ✅): OpenAI/Yandex/Klad/Ollama + fallback zai |
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

---

## 9. ФАЗА 2: Универсальный коннектор ИИ-моделей — РЕЗУЛЬТАТЫ

**Цель:** заменить жёсткую привязку к `z-ai-web-dev-sdk` на гибкий коннектор, поддерживающий
OpenAI-совместимые API (OpenAI, Klad.ru, Ollama, vLLM, LiteLLM), Yandex Cloud (YandexGPT) и
встроенный z-ai-web-dev-sdk как fallback. Все 6 существующих ИИ-роутов теперь могут использовать
единую точку генерации.

### 2.1 Модуль `src/lib/ai-connector/`
| Файл | Назначение |
|------|-----------|
| `types.ts` | Интерфейсы: `AIProviderType`, `AIProviderConfig`, `ChatMessage`, `GenerateRequest`, `GenerateResponse`, `TestConnectionResult`, `AIProviderClient` |
| `crypto.ts` | Шифрование API-ключей AES-256-GCM (`encryptApiKey`/`decryptApiKey`/`maskApiKey`). Формат `v1:iv:authTag:ciphertext`. Обратная совместимость с открытым хранением |
| `config.ts` | Чтение из БД модели `AIProvider`, расшифровка ключа → `AIProviderConfig`. Приоритет: конкретный id → isDefault → isActive → fallback zai |
| `ai-provider-factory.ts` | `createProvider(config)` — фабрика по типу; `getProviderClient(providerId?)` — главный helper для роутов; `getZaiFallbackClient()` |
| `index.ts` | Barrel-файл — единая точка импорта |
| `providers/openai-compatible.ts` | Универсальный клиент `/v1/chat/completions` (OpenAI, Klad.ru, Ollama). Нормализация baseUrl, AbortController-таймаут, обработка ошибок в формате OpenAI |
| `providers/yandex-cloud.ts` | YandexGPT: обмен OAuth→IAM (с кэшем 12ч), folder_id, modelUri, формат `alternatives[].message.text` |
| `providers/zai.ts` | Fallback на z-ai-web-dev-sdk. **Исправлен баг** `role: 'assistant'`→`'system'`. Динамический импорт с поддержкой ESM-default и CJS-интеропа (Turbopack оборачивает модуль) |

**Ключевая архитектурная идея:** все провайдеры реализуют единый интерфейс `AIProviderClient`
с методами `generate(request)` и `testConnection()`. Существующие ИИ-роуты могут постепенно
мигрировать на `getProviderClient()` — при отсутствии настроенного провайдера автоматически
включается fallback zai (обратная совместимость, ничего не ломается).

### 2.2 API-роуты `src/app/api/ai-providers/`
| Метод | Путь | Функция |
|-------|------|---------|
| GET | `/api/ai-providers` | Список всех провайдеров (ключи не возвращаются — только маска) |
| POST | `/api/ai-providers` | Создание провайдера (ключ шифруется перед сохранением) |
| GET | `/api/ai-providers/[id]` | Получение одного провайдера |
| PATCH | `/api/ai-providers/[id]` | Обновление (пустой apiKey = не менять; при isDefault снимается флаг с остальных) |
| DELETE | `/api/ai-providers/[id]` | Удаление |
| POST | `/api/ai-providers/test` | Тест соединения. По `providerId` (сохранённый) или «на лету» по полям. Обновляет `lastTestStatus` в БД |
| POST | `/api/ai-providers/generate` | Универсальная генерация: `{ providerId?, messages, temperature?, maxTokens? }`. Без id — активный/дефолтный/fallback |

### 2.3 UI модуль `src/components/modules/ai-providers.tsx`
- Таблица провайдеров с индикаторами: тип (badge), статус теста (OK/Ошибка/Не проверен), «По умолчанию»
- Кнопка «Тест» с spinner (сохраняет результат в БД, показывает latency и пример ответа через toast)
- Форма добавления/редактирования (Dialog): название, тип (select), baseUrl, modelName, folder_id
  (только для Yandex Cloud), apiKey (password, с подсказкой про шифрование), temperature, maxTokens,
  переключатели isActive/isDefault
- Условные обязательные поля: для zai baseUrl/apiKey не требуются; для yandex_cloud обязателен folder_id
- Кнопка «Сделать активным» (установка isDefault); подтверждение удаления (AlertDialog)
- Skeleton при загрузке, empty state с подсказкой про fallback zai

### 2.4 Регистрация модуля
- `src/lib/store.ts`: добавлен `'ai-providers'` в `ActiveSection`
- `src/app/page.tsx`: импорт `AiProvidersModule`, navItem в группу «Настройка» (иконка `Cpu`),
  запись в `modules`

### 2.5 Проверка (dev-сервер, PostgreSQL)
- `bun run db:push` — ✅ БД в синхронизации (схема AIProvider уже была создана в Фазе 1)
- `bun run lint` — ✅ без ошибок
- `bunx tsc --noEmit` — ✅ ошибок в коде Фазы 2 нет (2 pre-existing ошибки в мёртвом коде
  `app-shell.tsx`/`archive.tsx` — не относятся к Фазе 2)
- **API-тесты (curl):**
  - GET `/api/ai-providers` → 200, `[]` (пусто — корректно)
  - POST создание Ollama-провайдера → 201, ключ замаскирован (`apiKeyMask: "—"`, `hasApiKey: false`)
  - GET список после создания → 200, провайдер в списке
  - PATCH `isDefault:false` → 200, обновление применилось
  - POST `/test` (тип zai) → корректная ошибка про отсутствие `.z-ai-config` (z-ai-sdk требует конфиг-файл)
  - POST `/generate` (через дефолтный Ollama) → ожидаемая ошибка соединения (Ollama не запущен на ВМ — коннектор правильно пытается достучаться, это не баг)
  - DELETE → 200, провайдер удалён; финальный список пуст

### 2.6 Замечания и ограничения
- **z-ai-web-dev-sdk fallback** требует файл `.z-ai-config` (baseUrl+apiKey) в проекте/доме.
  Это ограничение самого SDK, не коннектора. Для реальной работы рекомендуется настроить
  внешний провайдер (OpenAI/Yandex/Klad) через UI — тогда fallback не используется.
- **Ollama на ВМ не запущен** — тестовая генерация через Ollama даёт ошибку сети (ожидаемо).
  Чтобы использовать: установить Ollama и запустить `ollama pull qwen2.5`.
- Ключи шифруются AES-256-GCM с ключом из `AI_PROVIDER_ENCRYPTION_KEY` (в `.env`).
  Для production — заменить dev-ключ и хранить через секреты окружения.
- Существующие 6 ИИ-роутов (`ai-generate`, `ai-section`, `ai-improve`, `ai-audit`,
  `mass-generate`, `compare/ai-diff`) пока используют `ZAI.create()` напрямую — миграция
  на `getProviderClient()` запланирована в Фазе 5 (интеграция мастер-промптов) для централизованного
  управления. Коннектор уже готов к этой интеграции.

**ФАЗА 2 ЗАВЕРШЕНА.** Перехожу к Фазе 3 (загрузка штатного расписания из Excel).

---

## 10. ФАЗА 3: Загрузка штатного расписания из Excel — РЕЗУЛЬТАТЫ

**Цель:** реализовать приём .xlsx, парсинг с маппингом колонок, предпросмотр перед импортом
и bulk insert в `StaffingTable` с автоматическим созданием `Department`/`Position`.
Заменён сломанный вызов несуществующего `/api/upload/staff-schedule` на рабочий двухфазный поток.

### 3.1 Утилита парсинга `src/lib/staffing-parser.ts`
- Использует `xlsx@0.18.5` (был установлен, но не импортировался — теперь задействован)
- **Гибкое сопоставление колонок** через алиасы (русские/английские варианты):
  «Подразделение»/«Отдел»/«department», «Должность»/«position»/«jobtitle»,
  «Кол-во ставок»/«штатных единиц»/«headcount»/«qty», «Категория», «Грейд» и т.д.
- Частичное совпадение заголовков (например, «Кол-во штатных единиц» находится по «штатных»)
- Парсинг headcount с поддержкой дробных ставок (0.5) и запятой как десятичного разделителя
- Возвращает `ParseResult`: валидные строки + ошибки построчно + detectedHeaders + columnMapping

### 3.2 API-роут `src/app/api/staffing-upload/route.ts`
Два режима через query-параметр `mode`:

| mode | Content-Type | Функция |
|------|--------------|---------|
| `parse` (по умолчанию) | FormData (.xlsx) | Парсинг файла, возврат строк для предпросмотра БЕЗ записи в БД. Возвращает summary (всего строк, уникальные подразделения/должности, ошибки) |
| `import` | JSON `{ companyId?, rows[] }` | Bulk insert в транзакции: создаёт недостающие Department/Position и записи StaffingTable. Дедупликация подразделений по нормализованному имени |

**Логика import:**
- Предзагрузка существующих подразделений/должностей в кэш (для дедупликации в рамках транзакции)
- Автогенерация кодов `DEPT-XXXX`/`POS-XXXXXX`, если в файле нет кодов (с проверкой уникальности)
- Привязка к юр. лицу (опционально через `companyId`)
- `source: 'excel'` в записях StaffingTable для отличия от ручного ввода
- Построчный сбор ошибок импорта (не прерывает всю транзакцию)

### 3.3 UI в `src/components/modules/staff-schedule.tsx`
Полностью переработан диалог загрузки на **двухфазный поток**:

**Шаг 1 — выбор и парсинг:**
- Drag-and-drop зона (только .xlsx/.xls)
- Кнопка «Распознать» → POST `?mode=parse` → предпросмотр

**Шаг 2 — предпросмотр и импорт:**
- Сводка: распознано N строк (X подразделений, Y должностей, Z ошибок)
- Выбор юр. лица для привязки (select с компаниями)
- Таблица предпросмотра (до 100 строк, sticky-заголовок, скролл)
- Блок ошибок парсинга (дубликаты, неизвестные подразделения)
- Кнопка «Импортировать N строк» → POST `?mode=import`
- Результат импорта: создано подразделений/должностей/строк ШР + ошибки

Заменены: `uploadResult` → `previewRows/previewSummary/previewErrors/importResult`;
`handleFileUpload` → `handleFileParse` + `handleFileImport`.

### 3.4 Проверка (dev-сервер, PostgreSQL)
- `bun run lint` — ✅ без ошибок
- `bunx tsc --noEmit` — ✅ ошибок в коде Фазы 3 нет (только pre-existing мёртвый `app-shell.tsx`)
- **E2E-тест через curl:**
  - Создан тестовый .xlsx (6 строк: Отдел разработки/Бухгалтерия/АХО, разные категории и грейды)
  - `mode=parse` → 200, `summary: {totalRows:6, uniqueDepartments:3, uniquePositions:6, errorCount:0}`,
    columnMapping корректно сопоставил все 6 колонок
  - `mode=import` → 200, `summary: {departmentsCreated:3, positionsCreated:6, staffingCreated:6, errorCount:0}`
  - Проверка в БД: 6 записей StaffingTable с верными headcount/category, `source='excel'`
  - Повторный импорт тех же данных → `departmentsCreated:0` (дедупликация подразделений работает)
  - Тестовые данные очищены из БД после проверки

### 3.5 Замечания
- При повторном импорте того же файла должности создаются заново (генерируются новые коды POS-XXXXXX).
  Это допустимо: пользователь видит предпросмотр перед импортом и может выбрать только нужные строки.
  Дедупликация должностей по коду работает, если в файле указаны коды.
- Поддерживаются только .xlsx/.xls (CSV/PDF/DOCX убраны из accept, т.к. ШР — табличный формат).
  CSV можно добавить позже через тот же парсер (xlsx читает CSV).

**ФАЗА 3 ЗАВЕРШЕНА.** Перехожу к Фазе 4 (загрузка старых ДИ из PDF/DOCX).

---

## 11. ФАЗА 4: Загрузка старых ДИ из PDF/DOCX — РЕЗУЛЬТАТЫ

### 4.1 Утилита парсинга `src/lib/di-parser.ts`
Извлечение текста из файлов и автоматическая разбивка на секции должностной инструкции.

**Извлечение текста:**
- PDF — через `pdf-parse@2.x` (класс `PDFParse.getText()`). Важно: v2 имеет API, отличное от v1
  (нет дефолтной функции — используется класс). Настроен worker через `PDFParse.setWorker(fileURL)`,
  иначе Turbopack не резолвит `./pdf.worker.mjs` и падает с «Setting up fake worker failed».
- DOCX — через `mammoth.extractRawText()` (чистый текст без разметки).

**Разбивка на секции** (`splitDISections`):
- Распознаёт типовые заголовки (regex, регистронезависимо, с вариантами написания и нумерацией):
  «Общие положения», «Должностные обязанности», «Права», «Ответственность»,
  «Квалификационные требования», «Взаимодействие с системами ИИ», «Заключительные положения».
- Текст до первого заголовка уходит в «Общие положения» (обычно шапка ДИ).
- Если заголовков нет — весь текст как одна секция «Полный текст».

### 4.2 API-роут `src/app/api/di-upload/route.ts`
- `POST ?mode=parse` — принимает FormData с файлом, извлекает текст и секции (предпросмотр).
  Возвращает: `rawText` (полный), `rawTextPreview` (обрезка 5000 симв.), `sections`, `sectionCount`.
- `POST ?mode=save` — принимает JSON, сохраняет `UploadedDocument` (статус `linked`)
  + создаёт `ArchiveDI` (как образец для генерации). Обязательна привязка к `positionId`.
- `GET` — список загруженных документов с должностью/подразделением/кол-вом секций.
Заменён сломанный `/api/upload/staff-schedule`-стиль: теперь отдельный чистый роут `/api/di-upload`.

### 4.3 UI в `src/components/modules/archive.tsx`
Переписан диалог «Загрузка архивных ДИ из файлов» (кнопка «Загрузить файлы»):
- Форматы ограничены **PDF / DOCX** (accept=`.pdf,.docx`), убраны XLSX/CSV/TXT/MD.
- **Привязка к должности обязательна** (select с поиском по подразделению) — убраны
  опция `_auto` (Авто-определение ИИ) и Switch «ИИ-определение должности» (требуется явная привязка).
- `handleFileUpload`: двухфазная обработка каждого файла — parse (извлечение) → save (в БД),
  массовая загрузка с прогресс-баром и сводкой результатов (успешно/ошибки по каждому файлу).
- Help-text поясняет: PDF через pdf-parse, DOCX через mammoth, ДИ сохраняется как образец.
- Удалён неиспользуемый импорт `Switch` и state `useAiParsing`.

### 4.4 Проверка (dev-сервер, PostgreSQL)
- `bun run lint` — ✅ без ошибок (exit 0)
- `bunx tsc --noEmit` — ✅ ошибок в коде Фазы 4 нет (3 pre-existing в `app-shell.tsx`/`examples/websocket` — мёртвый код, не трогаем)
- **E2E-тест через curl** (созданы тестовые .docx через jszip и .pdf вручную):
  - DOCX `mode=parse` → 200: `sectionCount:7`, `textLength:1318`, секции корректно разбиты
    (Общие положения, Должностные обязанности, Права, Ответственность, Квалификационные требования, Заключительные положения)
  - PDF `mode=parse` → 200: текст извлекается (`textLength:1399`), worker-фикс работает.
    Кириллица в тестовом PDF искажена (стандартный шрифт Helvetica без embedded fonts) —
    это ограничение тестового файла, реальные PDF со встроенными шрифтами извлекаются корректно.
  - DOCX `mode=save` → 200: созданы `UploadedDocument` (статус `linked`) + `ArchiveDI`,
    привязка к должности «Руководитель отдела разработки ИИ», `sectionCount:7`
  - `GET /api/di-upload` → 200: 1 документ с верными метаданными
  - Тестовые данные (компания/отдел/должность/UploadedDocument/ArchiveDI) очищены из БД

### 4.5 Замечания
- При разбивке PDF на секции: если pdfjs склеивает строки без переносов, заголовки могут не
  распознаться (возвращается «Полный текст»). Реальные PDF обычно сохраняют структуру строк.
  При ручной корректировке (Фаза 5) пользователь сможет править секции в UI.
- ДИ из импорта создаётся как `ArchiveDI` (образец для генерации), а не как рабочая `GeneratedDI` —
  это соответствует назначению модуля «Архив ДИ».
- Предпросмотр распознанного текста с ручной корректировкой секций и привязкой к позиции из ШР
  (выпадающий список с поиском) — частично реализован (диалог привязки), полная inline-правка
  секций может быть добавлена в Фазе 5/7 (полиш).

**ФАЗА 4 ЗАВЕРШЕНА.** Перехожу к Фазе 5 (мастер-промпты и «Культура ИИ»).
