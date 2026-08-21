// Конфигурация next-intl v4 (App Router, request-based) — Фаза 8: i18n.
// Единая точка загрузки сообщений для серверных и клиентских компонентов.
// Поддержка нескольких локалей заложена, но по умолчанию — русский.

import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'

export const locales = ['ru'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'ru'

export default getRequestConfig(async () => {
  const locale = defaultLocale
  if (!locales.includes(locale as Locale)) notFound()

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
