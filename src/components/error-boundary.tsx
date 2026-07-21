'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold text-destructive mb-2">Ошибка загрузки модуля</h2>
          <p className="text-muted-foreground text-sm">
            {this.state.error?.message || 'Произошла неизвестная ошибка'}
          </p>
          <button
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
