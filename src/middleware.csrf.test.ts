// Тесты CSRF-защиты в middleware (Фаза 2, шаг 2.3).
// Проверяем чистую функцию isCsrfAllowed: fail-closed для мутаций без заголовков.

import { describe, it, expect } from 'vitest'
import { isCsrfAllowed } from './middleware'

describe('isCsrfAllowed', () => {
  it('пропускает GET/HEAD без CSRF-проверки', () => {
    expect(isCsrfAllowed('GET', '/api/templates', null, null, null)).toBe(true)
    expect(isCsrfAllowed('HEAD', '/api/templates', null, null, null)).toBe(true)
  })

  it('пропускает мутации вне /api/', () => {
    expect(isCsrfAllowed('POST', '/login', null, null, null)).toBe(true)
    expect(isCsrfAllowed('DELETE', '/positions', null, null, null)).toBe(true)
  })

  it('блокирует curl-мутацию без заголовков (fail-closed)', () => {
    expect(isCsrfAllowed('POST', '/api/templates', null, null, null)).toBe(false)
    expect(isCsrfAllowed('PUT', '/api/templates/1', null, null, null)).toBe(false)
    expect(isCsrfAllowed('DELETE', '/api/templates/1', null, null, null)).toBe(false)
    expect(isCsrfAllowed('PATCH', '/api/ai-providers/1', null, null, null)).toBe(false)
  })

  it('блокирует мутацию без origin даже при наличии host', () => {
    expect(isCsrfAllowed('POST', '/api/templates', null, null, 'app.local')).toBe(false)
  })

  it('блокирует мутацию без host даже при наличии origin', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', null, 'https://app.local', null)
    ).toBe(false)
  })

  it('пропускает не-браузерную мутацию с валидным origin===host', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', null, 'https://app.local', 'app.local')
    ).toBe(true)
  })

  it('блокирует не-браузерную мутацию с origin!==host', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', null, 'https://evil.com', 'app.local')
    ).toBe(false)
  })

  it('блокирует не-браузерную мутацию с невалидным origin (URL parse fail)', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', null, 'not-a-url', 'app.local')
    ).toBe(false)
  })

  it('браузер same-origin пропускается', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', 'same-origin', 'https://app.local', 'app.local')
    ).toBe(true)
  })

  it('браузер same-origin пропускается даже без origin/host заголовков', () => {
    expect(isCsrfAllowed('POST', '/api/templates', 'same-origin', null, null)).toBe(true)
  })

  it('браузер none (user-initiated) пропускается', () => {
    expect(isCsrfAllowed('POST', '/api/templates', 'none', null, null)).toBe(true)
  })

  it('браузер cross-site блокируется', () => {
    expect(
      isCsrfAllowed('POST', '/api/templates', 'cross-site', 'https://app.local', 'app.local')
    ).toBe(false)
  })

  it('браузер same-origin имеет приоритет над отсутствием origin (не блокируется)', () => {
    // sec-fetch-site есть и валиден → пропуск, origin не требуется.
    expect(isCsrfAllowed('POST', '/api/templates', 'same-origin', null, null)).toBe(true)
  })

  it('браузер cross-site блокируется независимо от origin', () => {
    // sec-fetch-site=cross-site → блок, даже если origin совпадает.
    expect(
      isCsrfAllowed('POST', '/api/templates', 'cross-site', 'https://app.local', 'app.local')
    ).toBe(false)
  })
})
