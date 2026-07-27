#!/bin/bash
# Переустановка portable-бинарей PostgreSQL 16 из сохранённых .deb.
# Бинари в /tmp/pgroot очищаются между сессиями AstraCode, а .deb хранятся
# ВНУТРИ проекта (vendor/pg-debs) и переживают перезапуск.
#
# Использование: bash scripts/ensure-pg-binaries.sh
# Если .deb отсутствуют — скачивает их (нужна сеть).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEB_DIR="$PROJECT_DIR/vendor/pg-debs"
PGROOT="${PGROOT:-/tmp/pgroot}"
PGBIN="$PGROOT/usr/lib/postgresql/16/bin"

# Если бинари уже на месте — ничего не делаем
if [ -x "$PGBIN/postgres" ]; then
  echo "✅ Бинари PostgreSQL уже установлены: $PGBIN/postgres"
  exit 0
fi

mkdir -p "$PGROOT" "$DEB_DIR"

# Доп. бинарные тулзы (ar, tar, zstd) должны быть в системе
command -v ar   >/dev/null 2>&1 || { echo "❌ нет ar (установи binutils)";   exit 1; }
command -v tar  >/dev/null 2>&1 || { echo "❌ нет tar";                     exit 1; }
tar --zstd --help >/dev/null 2>&1 || { echo "❌ tar без поддержки --zstd";  exit 1; }

# Скачиваем недостающие .deb (только если их нет локально)
download_if_missing() {
  local file="$1" url="$2"
  if [ ! -f "$DEB_DIR/$file" ]; then
    echo "⬇️  Скачиваю $file ..."
    curl -sS -L -m 120 -o "$DEB_DIR/$file" "$url"
  fi
}
download_if_missing pgsql16.deb   "https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-16/postgresql-16_16.12-1.pgdg22.04+1_amd64.deb"
download_if_missing pgclient16.deb "https://apt.postgresql.org/pub/repos/apt/pool/main/p/postgresql-16/postgresql-client-16_16.12-1.pgdg22.04+1_amd64.deb"
download_if_missing libicu70.deb  "http://archive.ubuntu.com/ubuntu/pool/main/i/icu/libicu70_70.1-2_amd64.deb"

# Распаковка в чистом окружении (конфликт liblzma/libicu из LD_LIBRARY_PATH AstraCode)
unpack_deb() {
  local deb="$1" tmpdir="$2"
  mkdir -p "$tmpdir"
  (cd "$tmpdir" && ar x "$deb")
  local dt="$(ls "$tmpdir"/data.tar.* | head -1)"
  case "$dt" in
    *.xz)  env -i PATH=/usr/bin:/bin HOME=/tmp tar -xf "$dt" -C "$PGROOT" ;;
    *.zst) env -i PATH=/usr/bin:/bin HOME=/tmp tar --zstd -xf "$dt" -C "$PGROOT" ;;
    *)     echo "❌ неизвестный формат data.tar: $dt"; exit 1 ;;
  esac
}

# Каждый .deb — в свою временную директорию, чтобы data.tar не перезаписывали друг друга
TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT
unpack_deb "$DEB_DIR/pgsql16.deb"   "$TMPROOT/pgsql"
unpack_deb "$DEB_DIR/pgclient16.deb" "$TMPROOT/client"
unpack_deb "$DEB_DIR/libicu70.deb"  "$TMPROOT/icu"

if [ -x "$PGBIN/postgres" ]; then
  echo "✅ Бинари PostgreSQL установлены: $PGBIN/postgres"
else
  echo "❌ Ошибка: postgres не найден после распаковки"
  exit 1
fi
