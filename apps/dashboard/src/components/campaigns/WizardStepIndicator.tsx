import { cn } from '@/lib/utils'

type WizardStepIndicatorProps = {
  steps: readonly string[]
  current: number
}

export function WizardStepIndicator({ steps, current }: WizardStepIndicatorProps) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2">
      {steps.map((label, index) => {
        const step = index + 1
        const active = step === current
        const done = step < current
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-6 min-w-6 items-center justify-center rounded-sm border px-1.5 text-xs font-medium',
                active && 'border-text bg-panel text-text',
                done && 'border-live bg-live/15 text-live',
                !active && !done && 'border-line text-muted',
              )}
            >
              {step}
            </span>
            <span className={cn('text-sm', active ? 'text-text' : 'text-muted')}>{label}</span>
            {index < steps.length - 1 ? (
              <span className="mx-1 text-muted" aria-hidden>—</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
