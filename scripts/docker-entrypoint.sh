#!/bin/sh
# Docker entrypoint для production (Фаза 6, шаг 6.9).
# Применяет Prisma-миграции (идемпотентно, без --accept-data-loss),
# затем запускает сервер.
#
# В отличие от db:push --accept-data-loss, migrate deploy не удаляет данные:
# применяет только pending-миграции в правильном порядке.
set -e

echo "🔄 Применение Prisma-миграций (migrate deploy) ..."
npx prisma migrate deploy

echo "🚀 Запуск сервера ..."
exec bun .next/standalone/server.js
