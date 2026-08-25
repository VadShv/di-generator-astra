# syntax=docker/dockerfile:1
# Multi-stage build для Next.js standalone (Bun runtime)

FROM oven/bun:1 AS builder
WORKDIR /app

# Копируем зависимости
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Копируем исходники
COPY . .

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

# Копируем standalone-сборку
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["bun", ".next/standalone/server.js"]
