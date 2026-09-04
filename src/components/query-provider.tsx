'use client'

// Провайдер React Query для клиентской части приложения.
// QueryClient создаётся один раз на монтирование дерева (через useState-инициализатор),
// чтобы не пересоздавать кэш при каждом ре-рендере. Дефолты подобраны под
// «живую» синхронизацию трёх путей генерации ДИ: после мутации любой из путей
// инвалидирует ключи (diKeys/positionKeys), и все подписанные экраны обновляются.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Данные считаются свежими 30с — уменьшает лишние рефетчи при
            // переключении между вкладками SPA, но держит UI актуальным.
            staleTime: 30_000,
            // Рефетч при фокусе окна выключен: у нас есть точечная инвалидация
            // после мутаций, а генерация ДИ — дорогая операция, лишние запросы не нужны.
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
