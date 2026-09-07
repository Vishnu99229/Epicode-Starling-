import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-text">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
