#!/bin/bash
# Дамп БД di_generator в SQL-файл (pg_dump, plain format).
# Сохраняет схему + данные. Файлы кладутся в ./backups/ (внутри проекта,
# переживают перезапуск сессий; не в git — см. .gitignore).
#
# Использование:
#   bash scripts/backup-db.sh                # дамп в backups/di_generator_YYYY-MM-DD_HHMMSS.sql
#   bash scripts/backup-db.sh mydump.sql     # дамп в backups/mydump.sql
#
# Требует запущенного PostgreSQL (bash scripts/start.sh start).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PGROOT="${PGROOT:-/tmp/pgroot}"
PGBIN="$PGROOT/usr/lib/postgresql/16/bin"
PGLIB="$PGROOT/usr/lib/x86_64-linux-gnu"
PGHOST="127.0.0.1"
PGPORT="5432"
PGUSER="astra"
PGDATABASE="di_generator"
BACKUP_DIR="$PROJECT_DIR/backups"

# Бинари должны быть установлены
if [ ! -x "$PGBIN/pg_dump" ]; then
  echo "📦 Бинари PostgreSQL не найдены — устанавливаю из vendor/pg-debs ..."
  bash "$SCRIPT_DIR/ensure-pg-binaries.sh"
fi

# Проверка, что БД запущена
if ! ss -tlnp 2>/dev/null | grep -q ":$PGPORT"; then
  echo "❌ PostgreSQL не запущен на :$PGPORT. Сначала: bash scripts/start.sh start"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Имя файла: аргумент или таймстамп
if [ -n "${1:-}" ]; then
  OUT="$BACKUP_DIR/$1"
  case "$OUT" in
    *.sql) ;;
    *)  OUT="$OUT.sql" ;;
  esac
else
  OUT="$BACKUP_DIR/${PGDATABASE}_$(date +%Y-%m-%d_%H%M%S).sql"
fi

echo "📦 Дамп БД «$PGDATABASE» → $OUT ..."

# Чистое окружение (конфликт liblzma/libicu из LD_LIBRARY_PATH AstraCode)
env -i PATH=/usr/bin:/bin HOME=/tmp LD_LIBRARY_PATH="$PGLIB" \
  "$PGBIN/pg_dump" -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-privileges --clean --if-exists \
  -f "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✅ Дамп сохранён: $OUT ($SIZE)"
echo "   Восстановление: bash scripts/start.sh restore $(basename "$OUT")"
