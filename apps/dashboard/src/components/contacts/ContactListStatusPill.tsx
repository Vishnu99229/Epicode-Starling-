import type { ContactListStatus } from '@/types'
import { cn } from '@/lib/utils'

const tone: Record<ContactListStatus, string> = {
  ready: 'bg-live/15 text-live',
  processing: 'bg-warn/15 text-warn',
  failed: 'bg-fail/15 text-fail',
}

const label: Record<ContactListStatus, string> = {
  ready: 'ready',
  processing: 'processing',
  failed: 'failed',
}

export function ContactListStatusPill({ status }: { status: ContactListStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-line px-1.5 py-0.5 text-xs font-medium',
        tone[status],
      )}
    >
      {label[status]}
    </span>
  )
}
