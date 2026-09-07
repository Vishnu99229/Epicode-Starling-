import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

type RouteErrorBoundaryProps = {
  children: ReactNode
  routeName?: string
}

type State = { error: Error | null }

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RouteErrorBoundary${this.props.routeName ? `: ${this.props.routeName}` : ''}]`, error, info)
  }

  private retry = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="border border-line bg-panel px-4 py-8 text-center">
          <p className="text-sm text-text">Something went wrong rendering this page.</p>
          <p className="mt-1 text-sm text-muted">{this.state.error.message}</p>
          <Button type="button" className="mt-4" onClick={this.retry}>
            Retry
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
