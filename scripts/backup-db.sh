#!/usr/bin/env bash
# Автобэкап PostgreSQL для DI Generator.
# Запуск через cron: 0 2 * * * /home/user1/di-generator-astra/scripts/backup-db.sh
# или вручную: bash scripts/backup-db.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
DB_NAME="di_generator"
DB_USER="astra"
DB_HOST="127.0.0.1"
DB_PORT="5432"

# Максимальное кол-во бэкапов (старые удаляются)
MAX_BACKUPS=14

# Создаём директорию
mkdir -p "$BACKUP_DIR"

# Имя файла с датой
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "📦 Бэкап БД ${DB_NAME} → ${BACKUP_FILE}"

# Проверяем PGPASSWORD
if [ -z "${PGPASSWORD:-}" ]; then
  export PGPASSWORD="astra"
fi

# Дамп + сжатие
PGPASSWORD="$PGPASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --verbose 2>/dev/null | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Бэкап создан: ${BACKUP_FILE} (${SIZE})"

# Удаляем старые бэкапы (оставляем последние MAX_BACKUPS)
cd "$BACKUP_DIR"
OLD_BACKUPS=$(ls -1t ${DB_NAME}_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)))
if [ -n "$OLD_BACKUPS" ]; then
  echo "🧹 Удаление старых бэкапов:"
  echo "$OLD_BACKUPS" | while read -r f; do
    rm -f "$f"
    echo "  — $f"
  done
fi

echo "Готово. Всего бэкапов: $(ls -1 ${DB_NAME}_*.sql.gz 2>/dev/null | wc -l)"
