# syntax=docker/dockerfile:1
# Multi-stage build для Next.js standalone (Bun runtime)

FROM oven/bun:1 AS builder
WORKDIR /app

# Копируем зависимости
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Копируем исходники
COPY . .

# Build-time env vars (передаются через --build-arg, нужны для next build).
ARG AUTH_SECRET
ARG AI_PROVIDER_ENCRYPTION_KEY
ENV AUTH_SECRET=$AUTH_SECRET
ENV AI_PROVIDER_ENCRYPTION_KEY=$AI_PROVIDER_ENCRYPTION_KEY

# Генерируем Prisma клиент и собираем
ENV NEXT_TELEMETRY_DISABLED=1
RUN bunx prisma generate
RUN bun run build

# ───────────────────────────────────────────────
# Production stage
# ───────────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Создаём non-root пользователя для безопасности (Фаза 6, шаг 6.8).
# RCE-уязвимость в приложении не должна давать root-доступ к контейнеру.
RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid 1001 app

# Копируем standalone-сборку
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Prisma engine + CLI для migrate deploy в entrypoint (Фаза 6, шаг 6.9).
# В standalone-сборке node_modules урезан, поэтому копируем только нужное.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Entrypoint: применяет миграции (без потери данных), затем запускает сервер.
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Передаём владение non-root пользователю
RUN chown -R app:app /app

USER app

EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
