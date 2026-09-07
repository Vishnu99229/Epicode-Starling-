import type { AgentStatus } from '@/types'
import { cn } from '@/lib/utils'

const tone: Record<AgentStatus, string> = {
  active: 'bg-live/15 text-live',
  draft: 'bg-idle/20 text-idle',
  archived: 'text-muted bg-panel',
}

export function StatusPill({ status }: { status: AgentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-line px-1.5 py-0.5 text-xs font-medium',
        tone[status],
      )}
    >
      {status}
    </span>
  )
}
