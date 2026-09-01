'use client'

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** При изменении этих значений error-состояние сбрасывается автоматически. */
  resetKeys?: unknown[]
  /** Кастомный fallback; если не задан — используется стандартный UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

// Error boundary — ловит необработанные ошибки рендеринга.
// Используется вокруг динамически загружаемых модулей, чтобы ошибка
// в одном модуле не роняла всё приложение (особенно при быстрых
// переключениях вкладок, когда динамические импорты и fetch-запросы
// могут гоняться).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Автосброс при изменении resetKeys — например, при переключении вкладки.
    if (this.state.hasError && prevProps.resetKeys && this.props.resetKeys) {
      const changed = prevProps.resetKeys.some(
        (key, i) => key !== this.props.resetKeys?.[i]
      )
      if (changed) {
        this.setState({ hasError: false, error: undefined })
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error || new Error('Unknown'), this.reset)
      }
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-lg font-medium text-destructive mb-2">Что-то пошло не так</p>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            onClick={this.reset}
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
