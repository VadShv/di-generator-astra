#!/bin/bash
# Запуск portable PostgreSQL 16 для «Генератора ДИ Группы Астра»
# БЕЗ root/sudo: бинарники распакованы из .deb в PGROOT, данные в PGDATA.
#
# Использование:
#   ./scripts/start-postgres.sh        # запустить (если не запущен)
#   ./scripts/start-postgres.sh stop   # остановить
#   ./scripts/start-postgres.sh status # статус
#
# Требования: бинари PostgreSQL в /tmp/pgroot (см. AGENT_LOG.md, Фаза 1).
#
# ПРИМЕЧАНИЕ: кластер хранится ВНУТРИ проекта (./.pgdata), чтобы данные
# переживали перезапуск сессии/контейнера. /tmp/pgdata очищается между
# сессиями AstraCode. Лог работы — /tmp/pg.log (временный).

set -euo pipefail

PGROOT="${PGROOT:-/tmp/pgroot}"
PGBIN="$PGROOT/usr/lib/postgresql/16/bin"
# Путь к данным по умолчанию — внутри проекта (.pgdata), переопределяется через PGDATA.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PGDATA="${PGDATA:-$PROJECT_DIR/.pgdata}"
PGHOST="127.0.0.1"
PGPORT="5432"
PGUSER="astra"
LIBDIR="$PGROOT/usr/lib/x86_64-linux-gnu"

# Чистое окружение, чтобы избежать конфликта liblzma/libicu из AstraCode LD_LIBRARY_PATH
export PATH="/usr/bin:/bin"
export HOME="${HOME:-/tmp}"
export LD_LIBRARY_PATH="$LIBDIR"

# Если бинари не установлены — подсказка
if [ ! -x "$PGBIN/postgres" ]; then
  echo "❌ PostgreSQL бинари не найдены в $PGBIN"
  echo "   См. AGENT_LOG.md (Фаза 1) — инструкция по установке portable PostgreSQL."
  exit 1
fi

# Если кластер не инициализирован — initdb
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "📦 Инициализация кластера PostgreSQL в $PGDATA ..."
  "$PGBIN/initdb" -D "$PGDATA" -U "$PGUSER" \
    --auth-local=trust --auth-host=trust \
    --encoding=UTF8 --locale=C
fi

CMD="${1:-start}"
case "$CMD" in
  start)
    # Проверяем, не запущен ли уже
    if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
      echo "✅ PostgreSQL уже запущен (PID: $("$PGBIN/pg_ctl" -D "$PGDATA" status 2>/dev/null | grep -oE 'PID: [0-9]+' | grep -oE '[0-9]+'))"
      echo "   БД: di_generator | пользователь: $PGUSER | $PGHOST:$PGPORT | данные: $PGDATA"
      exit 0
    fi
    echo "🚀 Запуск PostgreSQL ..."
    "$PGBIN/pg_ctl" -D "$PGDATA" -l /tmp/pg.log \
      -o "-p $PGPORT -h $PGHOST -k /tmp" start
    sleep 2
    # Создаём БД, если нет
    if ! "$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d postgres -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "di_generator"; then
      "$PGBIN/createdb" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" di_generator
      "$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d di_generator \
        -c "ALTER USER $PGUSER WITH PASSWORD 'astra';" >/dev/null
      echo "📦 Создана БД di_generator"
    fi
    echo "✅ PostgreSQL готов: postgresql://astra:astra@$PGHOST:$PGPORT/di_generator"
    echo "   Кластер данных: $PGDATA"
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" stop
    echo "🛑 PostgreSQL остановлен"
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$PGDATA" status
    ;;
  restart)
    "$PGBIN/pg_ctl" -D "$PGDATA" restart
    echo "🔄 PostgreSQL перезапущен"
    ;;
  *)
    echo "Использование: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
