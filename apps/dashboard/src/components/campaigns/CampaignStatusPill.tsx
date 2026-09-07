import type { CampaignStatus } from '@/types'
import { cn } from '@/lib/utils'

const tone: Record<CampaignStatus, string> = {
  running: 'bg-live/15 text-live',
  paused: 'bg-warn/15 text-warn',
  stopped: 'bg-fail/15 text-fail',
  completed: 'text-muted bg-panel',
  draft: 'bg-idle/20 text-idle',
  scheduled: 'bg-idle/20 text-idle',
}

export function CampaignStatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-line px-1.5 py-0.5 text-xs font-medium capitalize',
        tone[status],
      )}
    >
      {status}
    </span>
  )
}
