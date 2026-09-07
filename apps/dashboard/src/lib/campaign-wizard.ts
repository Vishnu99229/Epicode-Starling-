import type { RetryOnOutcome } from '@/types'

export type CampaignWizardState = {
  name: string
  contactListId: string
  agentId: string
  targetCps: number
  maxConcurrent: number
  dialTimeoutSec: number
  startLocal: string
  endLocal: string
  timezone: string
  scheduledAt: string
  maxAttempts: number
  retryDelayMinutes: number
  retryOn: RetryOnOutcome[]
}

export const WIZARD_STEPS = [
  'Basics',
  'Audience',
  'Agent',
  'Pacing & schedule',
  'Retries & review',
] as const

export const DEFAULT_WIZARD_STATE: CampaignWizardState = {
  name: '',
  contactListId: '',
  agentId: '',
  targetCps: 2,
  maxConcurrent: 20,
  dialTimeoutSec: 45,
  startLocal: '09:30',
  endLocal: '18:30',
  timezone: 'Asia/Kolkata',
  scheduledAt: '',
  maxAttempts: 3,
  retryDelayMinutes: 30,
  retryOn: ['no_answer', 'busy'],
}

export function toWorkingHours(startLocal: string, endLocal: string) {
  const start = startLocal.replace(':', '')
  const end = endLocal.replace(':', '')
  return `${start}-${end}`
}

export function slugifyCampaignName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'campaign'
}

export function validateWizardStep(
  step: number,
  state: CampaignWizardState,
): string | null {
  switch (step) {
    case 1:
      if (!state.name.trim()) return 'Campaign name is required.'
      return null
    case 2:
      if (!state.contactListId) return 'Select a contact list.'
      return null
    case 3:
      if (!state.agentId) return 'Select an agent.'
      return null
    case 4: {
      if (state.targetCps < 1 || state.targetCps > 50) {
        return 'Calls per second must be between 1 and 50.'
      }
      if (state.maxConcurrent < 1) return 'Max concurrent calls must be at least 1.'
      if (state.dialTimeoutSec < 1) return 'Dial timeout must be at least 1 second.'
      if (!state.startLocal || !state.endLocal) return 'Working hours are required.'
      if (state.startLocal >= state.endLocal) {
        return 'End time must be after start time.'
      }
      if (!state.timezone) return 'Timezone is required.'
      return null
    }
    case 5:
      if (state.maxAttempts < 1) return 'Max attempts must be at least 1.'
      if (state.retryDelayMinutes < 0) return 'Retry delay cannot be negative.'
      if (state.retryOn.length === 0) return 'Select at least one retry outcome.'
      return null
    default:
      return null
  }
}

export function formatDuration(sec: number) {
  if (sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
