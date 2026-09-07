import { Button } from '@/components/ui/button'

type QueryErrorPanelProps = {
  message: string
  onRetry: () => void
  hint?: string
}

export function QueryErrorPanel({ message, onRetry, hint }: QueryErrorPanelProps) {
  return (
    <div
      role="alert"
      className="border border-line bg-panel px-4 py-6"
    >
      <p className="text-sm text-fail">{message}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
