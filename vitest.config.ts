import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // Тесты выполняются с NODE_ENV=test (не development/production).
    // auth-options.ts fail-closed без AUTH_SECRET → нужен явный opt-in.
    env: {
      ALLOW_OPEN_ACCESS: 'true',
    },
    // Zod v4 экспортирует `z` через namespace-агрегацию ESM-модулей.
    // В SSR-режиме vitest ломает этот интероп (`z` становится undefined).
    // Инлайн zod в бандл тестов, чтобы ESM-экспорты резолвились корректно.
    server: {
      deps: {
        inline: ['zod'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/lib/db.ts', 'src/lib/logger.ts'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
