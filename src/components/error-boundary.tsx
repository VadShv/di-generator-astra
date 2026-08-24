'use client'

import { Component, type ReactNode } from 'react'

// Error boundary — ловит необработанные ошибки рендеринга.
// В проде: заменить на Sentry.init() + Sentry.ErrorBoundary.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // В проде: Sentry.captureException(error, { extra: errorInfo })
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-destructive mb-2">Что-то пошло не так</p>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            onClick={() => this.setState({ hasError: false })}
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
