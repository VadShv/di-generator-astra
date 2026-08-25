import { describe, it, expect, vi, afterEach } from 'vitest'
import { Semaphore, getDefaultConcurrency } from './semaphore'

describe('Semaphore', () => {
  it('пропускает запросы пока есть permits', async () => {
    const sem = new Semaphore(2)
    let counter = 0
    const fn = async () => { counter++ }

    await Promise.all([sem.run(fn), sem.run(fn)])
    expect(counter).toBe(2)
  })

  it('блокирует запрос когда permits исчерпаны', async () => {
    const sem = new Semaphore(1)
    let order: string[] = []

    const p1 = sem.run(async () => {
      order.push('a-start')
      await new Promise((r) => setTimeout(r, 20))
      order.push('a-end')
    })
    const p2 = sem.run(async () => {
      order.push('b-start')
      order.push('b-end')
    })

    await Promise.all([p1, p2])
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
  })

  it('освобождает permit при ошибке в fn', async () => {
    const sem = new Semaphore(1)

    await expect(sem.run(async () => { throw new Error('fail') })).rejects.toThrow('fail')

    // После ошибки второй запрос должен пройти
    let ok = false
    await sem.run(async () => { ok = true })
    expect(ok).toBe(true)
  })

  it('минимум 1 permit даже при 0', () => {
    const sem = new Semaphore(0)
    expect(sem).toBeDefined()
    let ran = false
    return sem.run(async () => { ran = true }).then(() => expect(ran).toBe(true))
  })

  it('не теряет permits при множественных вызовах', async () => {
    const sem = new Semaphore(2)
    let running = 0
    let maxRunning = 0

    const tasks = Array.from({ length: 10 }, () =>
      sem.run(async () => {
        running++
        if (running > maxRunning) maxRunning = running
        await new Promise((r) => setTimeout(r, 5))
        running--
      })
    )

    await Promise.all(tasks)
    expect(maxRunning).toBeLessThanOrEqual(2)
  })
})

describe('getDefaultConcurrency', () => {
  const originalEnv = process.env.AI_PROVIDER_MAX_CONCURRENCY

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AI_PROVIDER_MAX_CONCURRENCY = originalEnv
    } else {
      delete process.env.AI_PROVIDER_MAX_CONCURRENCY
    }
  })

  it('возвращает 3 по умолчанию', () => {
    delete process.env.AI_PROVIDER_MAX_CONCURRENCY
    expect(getDefaultConcurrency()).toBe(3)
  })

  it('читает значение из env', () => {
    process.env.AI_PROVIDER_MAX_CONCURRENCY = '5'
    expect(getDefaultConcurrency()).toBe(5)
  })

  it('игнорирует нечисловые значения', () => {
    process.env.AI_PROVIDER_MAX_CONCURRENCY = 'abc'
    expect(getDefaultConcurrency()).toBe(3)
  })

  it('игнорирует отрицательные значения', () => {
    process.env.AI_PROVIDER_MAX_CONCURRENCY = '-1'
    expect(getDefaultConcurrency()).toBe(3)
  })

  it('округляет вниз дробные', () => {
    process.env.AI_PROVIDER_MAX_CONCURRENCY = '4.9'
    expect(getDefaultConcurrency()).toBe(4)
  })
})
