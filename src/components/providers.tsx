'use client'

// Клиентский провайдер сессии next-auth (Фаза 5).
// Оборачивает приложение в SessionProvider, чтобы клиентские хуки
// (useSession, signIn/signOut из next-auth/react) работали.
// Также инициализирует Sentry на клиенте.

import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { isSentryEnabled, SENTRY_DSN, SENTRY_ENV } from '@/lib/sentry'
import { QueryProvider } from '@/components/query-provider'

function initClientSentry() {
  if (!isSentryEnabled()) return
  if (typeof window === 'undefined') return
  if ((window as unknown as { __sentry_init__?: boolean }).__sentry_init__) return

  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [Sentry.browserTracingIntegration()],
    })
    ;(window as unknown as { __sentry_init__?: boolean }).__sentry_init__ = true
  })
}

export function Providers({
  children,
  messages,
  locale,
}: {
  children: ReactNode
  messages: Record<string, unknown>
  locale: string
}) {
  useEffect(() => {
    initClientSentry()
  }, [])

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionProvider>
        <QueryProvider>{children}</QueryProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  )
}
