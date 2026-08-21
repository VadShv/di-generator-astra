'use client'

// Клиентский провайдер сессии next-auth (Фаза 5).
// Оборачивает приложение в SessionProvider, чтобы клиентские хуки
// (useSession, signIn/signOut из next-auth/react) работали.

import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'

export function Providers({
  children,
  messages,
  locale,
}: {
  children: ReactNode
  messages: Record<string, unknown>
  locale: string
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionProvider>{children}</SessionProvider>
    </NextIntlClientProvider>
  )
}
