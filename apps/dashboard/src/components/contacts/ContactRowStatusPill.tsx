import type { ContactRowStatus } from '@/types'
import { cn } from '@/lib/utils'

const tone: Record<ContactRowStatus, string> = {
  valid: 'bg-live/15 text-live',
  invalid_number: 'bg-fail/15 text-fail',
  duplicate: 'bg-warn/15 text-warn',
  dnd: 'bg-idle/20 text-idle',
}

const label: Record<ContactRowStatus, string> = {
  valid: 'valid',
  invalid_number: 'invalid',
  duplicate: 'duplicate',
  dnd: 'dnd',
}

export function ContactRowStatusPill({ status }: { status: ContactRowStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border border-line px-1.5 py-0.5 text-[11px] font-medium',
        tone[status],
      )}
    >
      {label[status]}
    </span>
  )
}
