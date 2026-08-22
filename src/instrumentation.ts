// Next.js instrumentation hook — запускается один раз при старте сервера.
// Запускает опросчик очереди массовой генерации для восстановления
// зависших задач после рестарта процесса.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startQueuePoller } = await import('./lib/di/mass-generate-worker')
    startQueuePoller()
  }
}
