#!/bin/bash
# Полный запуск di-generator-astra: PostgreSQL + схема + Next.js dev (Turbopack).
# Предназначен для отсоединённого запуска в среде AstraCode:
#   bash scripts/start.sh            # запустить (через setsid внутри)
#   bash scripts/start.sh status     # статус служб
#   bash scripts/start.sh stop       # остановить next + postgres
#
# Важно:
#   - Next.js запускается на Turbopack (без --webpack). Prisma работает благодаря
#     transpilePackages в next.config.ts (см. AGENT_LOG.md раздел 31).
#     НЕ возвращать --webpack (медленнее в 30-40 раз) и НЕ удалять transpilePackages.
#   - Обе службы запускаются через setsid как демоны — переживают переключение
#     PTY-сессий AstraCode.
#   - Кластер данных в ./.pgdata (внутри проекта) — данные сохраняются между
#     сессиями. Бинари в /tmp/pgroot (могут очищаться — переустанавливаются
#     автоматически из сохранённых .deb в vendor/pg-debs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PGROOT="${PGROOT:-/tmp/pgroot}"
PGLIB="$PGROOT/usr/lib/x86_64-linux-gnu"
PGDATA="${PGDATA:-$PROJECT_DIR/.pgdata}"
NEXT_PORT="${NEXT_PORT:-3001}"
CLEAN_ENV="env -i PATH=/usr/bin:/bin HOME=/tmp LD_LIBRARY_PATH=$PGLIB"

cd "$PROJECT_DIR"

# Bun должен быть в PATH
export PATH="/home/astra/.bun/bin:${PATH:-}"
export BUN_INSTALL="/home/astra/.bun"
export BUN_TMPDIR="${BUN_TMPDIR:-/tmp/buntmp}"
mkdir -p "$BUN_TMPDIR"

CMD="${1:-start}"
case "$CMD" in
  start)
    # 1) Бинари PostgreSQL (переустановка из .deb если /tmp/pgroot пуст)
    if [ ! -x "$PGROOT/usr/lib/postgresql/16/bin/postgres" ]; then
      echo "📦 Устанавливаю portable-бинари PostgreSQL из vendor/pg-debs ..."
      bash scripts/ensure-pg-binaries.sh
    fi

    # 2) Запуск PostgreSQL через setsid-демон (чистое окружение)
    if ss -tlnp 2>/dev/null | grep -q ':5432'; then
      echo "✅ PostgreSQL уже слушает :5432"
    else
      echo "🚀 Запуск PostgreSQL (setsid-демон, PGDATA=$PGDATA) ..."
      setsid $CLEAN_ENV bash scripts/start-postgres.sh start \
        </dev/null >/dev/null 2>/dev/null & disown
      sleep 4
    fi
    ss -tlnp 2>/dev/null | grep -q ':5432' \
      || { echo "❌ PostgreSQL не поднялся на :5432"; exit 1; }

    # 3) Синхронизация схемы Prisma
    echo "🔄 Синхронизация схемы (bun run db:push) ..."
    bun run db:push 2>&1 | tail -4 || echo "⚠️  db:push завершился с ошибкой (продолжаю)"

    # 4) Next.js dev (Turbopack — без --webpack; transpilePackages в next.config.ts)
    if ss -tlnp 2>/dev/null | grep -q ":$NEXT_PORT"; then
      echo "✅ Next.js уже слушает :$NEXT_PORT"
    else
      echo "🚀 Запуск Next.js dev (Turbopack, setsid-демон, :$NEXT_PORT) ..."
      setsid bun next dev -p "$NEXT_PORT" -H 0.0.0.0 \
        </dev/null >/dev/null 2>/dev/null & disown
      echo "⏳ Жду загрузки Next.js ..."
      sleep 15
    fi

    echo ""
    echo "========================================"
    echo "✅ Сервис поднят:"
    echo "   PostgreSQL : 127.0.0.1:5432  (данные: $PGDATA)"
    echo "   Next.js    : http://localhost:$NEXT_PORT  (Turbopack)"
    echo "   Данные БД сохраняются между сессиями AstraCode."
    echo "========================================"
    ;;

  status)
    echo "--- PostgreSQL (:5432) ---"
    ss -tlnp 2>/dev/null | grep ':5432' && echo "✅ слушает" || echo "❌ не запущен"
    echo "--- Next.js (:$NEXT_PORT) ---"
    ss -tlnp 2>/dev/null | grep ":$NEXT_PORT" && echo "✅ слушает" || echo "❌ не запущен"
    ;;

  stop)
    echo "🛑 Остановка Next.js ..."
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "start-server" 2>/dev/null || true
    if [ -x "$PGROOT/usr/lib/postgresql/16/bin/pg_ctl" ]; then
      echo "🛑 Остановка PostgreSQL ..."
      $CLEAN_ENV "$PGROOT/usr/lib/postgresql/16/bin/pg_ctl" -D "$PGDATA" stop 2>/dev/null || true
    fi
    sleep 2
    bash "$0" status
  ;;

  backup)
    bash "$SCRIPT_DIR/backup-db.sh" "${2:-}"
    ;;

  restore)
    FILE="${2:-}"
    if [ -z "$FILE" ]; then
      echo "Использование: $0 restore <файл.sql>   (из backups/)"
      echo "Доступные дампы:"
      ls -1 "$PROJECT_DIR/backups/"*.sql 2>/dev/null | xargs -n1 basename 2>/dev/null || echo "  (нет дампов)"
      exit 1
    fi
    SRC="$PROJECT_DIR/backups/$FILE"
    [ -f "$SRC" ] || SRC="$FILE"
    if [ ! -f "$SRC" ]; then
      echo "❌ Файл дампа не найден: $FILE (и в backups/, и как абсолютный путь)"
      exit 1
    fi
    if [ ! -x "$PGROOT/usr/lib/postgresql/16/bin/postgres" ]; then
      echo "📦 Бинари PostgreSQL не найдены — устанавливаю ..."
      bash scripts/ensure-pg-binaries.sh
    fi
    if ! ss -tlnp 2>/dev/null | grep -q ':5432'; then
      echo "🚀 PostgreSQL не запущен — запускаю ..."
      setsid $CLEAN_ENV bash scripts/start-postgres.sh start \
        </dev/null >/dev/null 2>/dev/null & disown
      sleep 4
    fi
    echo "♻️  Восстановление БД из дампа: $SRC"
    echo "   (текущие данные будут заменены — дамп использует --clean --if-exists)"
    PGBIN="$PGROOT/usr/lib/postgresql/16/bin"
    env -i PATH=/usr/bin:/bin HOME=/tmp LD_LIBRARY_PATH="$PGLIB" \
      "$PGBIN/psql" -h 127.0.0.1 -p 5432 -U astra -d di_generator \
      -v ON_ERROR_STOP=1 -f "$SRC" 2>&1 | tail -8
    echo "✅ Восстановление завершено. Перепроверь схему: bun run db:push"
    ;;

*)
echo "Использование: $0 {start|status|stop|backup|restore}"
echo "  backup  [имя.sql]            — дамп БД в backups/"
echo "  restore <файл.sql>           — восстановить БД из дампа (из backups/)"
 exit 1
  ;;
esac
