#!/usr/bin/env bash
# Автобэкап PostgreSQL для DI Generator с шифрованием.
# Запуск через cron: 0 2 * * * /home/user1/di-generator-astra/scripts/backup-db.sh
# или вручную: bash scripts/backup-db.sh
#
# Шифрование: openssl AES-256-CBC, ключ из env BACKUP_ENCRYPTION_KEY.
# Восстановление:
#   openssl enc -d -aes-256-cbc -salt -pbkdf2 -in <file>.sql.gz.enc -pass env:BACKUP_ENCRYPTION_KEY | gunzip | psql ...

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

# Проверка ключа шифрования
if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ ОШИБКА: BACKUP_ENCRYPTION_KEY не задан. Установите env-переменную перед запуском." >&2
  echo "   export BACKUP_ENCRYPTION_KEY='your-secret-key'" >&2
  exit 1
fi

# Создаём директорию
mkdir -p "$BACKUP_DIR"

# Имя файла с датой
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

echo "📦 Бэкап БД ${DB_NAME} → ${ENCRYPTED_FILE}"

# Проверяем PGPASSWORD
if [ -z "${PGPASSWORD:-}" ]; then
  export PGPASSWORD="astra"
fi

# Дамп + сжатие + шифрование (pipeline — незашифрованный файл не сохраняется на диск)
PGPASSWORD="$PGPASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --verbose 2>/dev/null | gzip | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -out "$ENCRYPTED_FILE"

# Удаляем промежуточный незашифрованный файл (если вдруг остался)
rm -f "$BACKUP_FILE"

SIZE=$(du -h "$ENCRYPTED_FILE" | cut -f1)
echo "✅ Зашифрованный бэкап создан: ${ENCRYPTED_FILE} (${SIZE})"

# Проверка целостности: пробуем расшифровать первые байты
if ! openssl enc -d -aes-256-cbc -pbkdf2 -in "$ENCRYPTED_FILE" -pass env:BACKUP_ENCRYPTION_KEY 2>/dev/null | head -c 1 >/dev/null; then
  echo "❌ ОШИБКА: проверка расшифровки не удалась. Бэкап может быть повреждён." >&2
  exit 1
fi
echo "🔍 Проверка расшифровки: OK"

# Удаляем старые бэкапы (оставляем последние MAX_BACKUPS)
cd "$BACKUP_DIR"
OLD_BACKUPS=$(ls -1t ${DB_NAME}_*.sql.gz.enc 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)))
if [ -n "$OLD_BACKUPS" ]; then
  echo "🧹 Удаление старых бэкапов:"
  echo "$OLD_BACKUPS" | while read -r f; do
    rm -f "$f"
    echo "  — $f"
  done
fi

echo "Готово. Всего бэкапов: $(ls -1 ${DB_NAME}_*.sql.gz.enc 2>/dev/null | wc -l)"
