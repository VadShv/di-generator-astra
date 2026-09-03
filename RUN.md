# Запуск проекта di-generator-astra

Промпт-инструкция для агента AstraCode: быстрый и правильный запуск сервиса.
Полная история — в docs/AGENT_LOG.md (разделы 1, 27, 28, 29, 31).

---

## ⚡ БЫСТРЫЙ ЗАПУСК (одна команда)

Запусти проект di-generator-astra (Next.js 16 + Prisma + PostgreSQL):

```
bash scripts/start.sh start     (sandbox_permissions=require_escalated)
```

`scripts/start.sh` делает ВСЁ автоматически и idempotent (не трогает уже
запущенные службы):
1. Переустанавливает portable-бинари PostgreSQL из сохранённых .deb
   (`vendor/pg-debs/`) если `/tmp/pgroot` очищен — без скачивания из сети.
2. Запускает PostgreSQL через `setsid`-демон (кластер `./.pgdata`, чистое
   окружение `env -i`).
3. Синхронизирует схему: `bun run db:push`.
4. Запускает Next.js dev (Turbopack, без `--webpack`) через `setsid`-демон.

Команды:
- `bash scripts/start.sh start` — поднять всё
- `bash scripts/start.sh status` — статус postgres + next
- `bash scripts/start.sh stop` — остановить next + postgres
- `bash scripts/start.sh backup [имя.sql]` — дамп БД в `backups/`
- `bash scripts/start.sh restore <файл.sql>` — восстановить БД из дампа

После запуска сообщи: статус postgres, статус next dev, и что главная + 2-3
БД-роута (`/api/companies`, `/api/dashboard/stats`) отдают 200. Проверять API
через `127.0.0.1`, НЕ `localhost`.

---

## Сохранность данных
- Кластер `./.pgdata` ВНУТРИ проекта → данные сохраняются между сессиями
  AstraCode (среда очищает `/tmp`, но не директорию проекта).
- Бинари PostgreSQL в `/tmp/pgroot` могут очищаться → переустанавливаются
  автоматически из `vendor/pg-debs/` (сохранены в проекте, ~29MB).
- `bun run db:push` — схема всегда в синхронизации с `prisma/schema.prisma`.
- Дамп `backups/*.sql` — переносимый бэкап (можно коммитить/переносить на
  другую машину; восстанавливается на любом PostgreSQL 16).

---

## ⚙️ Как это работает под капотом (fallback, если старт-скрипт сломался)

Полная история — в docs/AGENT_LOG.md, обязательно прочитать разделы 1, 27, 28, 29, 31.

### 1. PostgreSQL (portable, НЕ системный — sudo/systemctl неприменимы)
- Бинари в `/tmp/pgroot` (могут быть очищены между сессиями). Если нет —
  переустановить из .deb по Фазе 1: скачать postgresql-16, postgresql-client-16
  (apt.postgresql.org) и libicu70 (archive.ubuntu.com), распаковать через
  `ar x` + `tar --zstd -xf data.tar.zst` (libicu70 теперь zst, не xz!) в /tmp/pgroot
  с чистым окружением env -i (конфликт liblzma/libicu из LD_LIBRARY_PATH).
  Или просто: `bash scripts/ensure-pg-binaries.sh` (использует сохранённые .deb).
- Кластер данных: `./.pgdata` (внутри проекта, сохраняется между сессиями).
- Запуск ЧЕРЕЗ setsid как отсоединённый демон, иначе AstraCode убьёт процесс
  при переключении PTY-сессии:
  ```
  setsid env -i PATH=/usr/bin:/bin HOME=/tmp LD_LIBRARY_PATH=/tmp/pgroot/usr/lib/x86_64-linux-gnu \
    bash scripts/start-postgres.sh start </dev/null >/dev/null 2>/dev/null & disown
  ```
- Проверить: `ss -tlnp | grep 5432` (должен слушать 127.0.0.1:5432).

### 2. Применить схему (с эскалацией — sandbox блокирует сокеты к БД)
```
bun run db:push   (sandbox_permissions=require_escalated)
```

### 3. Next.js dev — Turbopack (БЫСТРО, по умолчанию)
```
cd /home/astra/di-generator-astra && bun next dev -p 3001 -H 0.0.0.0
```
(или `bun run dev` — запускается через `scripts/start.sh start`).
Turbopack включён по умолчанию (Next 16). Работает БЛАГОДАРЯ фиксу в next.config.ts:
`transpilePackages: ["@prisma/client", ".prisma/client"]` — без него Turbopack
ломает резолвинг @prisma/client (Cannot find module @prisma/client-<hash>, 500 на
всех БД-роутах). См. docs/AGENT_LOG.md раздел 31. НЕ удалять transpilePackages и НЕ
возвращать --webpack (медленнее: 2–4s на первый роут vs 0.05–0.1s на Turbopack).
Запускать через setsid-демон (как postgres) или держать PTY-сессию открытой.

---

## Важно про среду AstraCode (читай docs/AGENT_LOG.md раздел 27.3)
- sandbox делает bwrap --unshare-net: curl/psql/db:push/next dev к localhost
  запускать ТОЛЬКО с sandbox_permissions=require_escalated.
- НЕ использовать shell-редирект в файл (> file, >>, tee) и rm через shell —
  runtime блокирует. Файлы — через write_file/apply_patch; удаление — apply_patch
  с Delete File или bun-скриптом fs.rmSync (через эскалацию).
- Проверять API через 127.0.0.1, НЕ localhost (резолвится в IPv6 ::1, next слушает
  IPv4 — запросы виснут).
- Первый запрос к каждому API-роуту компилируется быстро (Turbopack: 0.05–0.1s),
  прогрев почти не нужен. Если всё же тормозит — проверь, что не слетел
  transpilePackages в next.config.ts.
