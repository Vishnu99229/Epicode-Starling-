import type { CampaignCreate } from '../schemas/campaigns.js'

export type CampaignRow = {
  id: string
  name: string
  status: string
  agent_id: string | null
  contact_list_id: string | null
  iravoice_campaign_name: string | null
  pacing: unknown
  calling_window: unknown
  scheduled_at: Date | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

export type CampaignProgress = {
  total: number
  attempted: number
  connected: number
  completed: number
  failed: number
  skipped: number
}

export function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as Record<string, unknown>
}

export function mapCampaign(row: CampaignRow, progress: CampaignProgress) {
  const pacing = parseJsonObject(row.pacing)
  const callingWindow = parseJsonObject(row.calling_window)

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    agentId: row.agent_id ?? '',
    contactListId: row.contact_list_id ?? '',
    iravoiceCampaignName: row.iravoice_campaign_name ?? '',
    pacing: {
      maxConcurrent: Number(pacing.maxConcurrent ?? 20),
      targetCps: Number(pacing.targetCps ?? 2),
      maxAttempts: Number(pacing.maxAttempts ?? 3),
      dialTimeoutSec: Number(pacing.dialTimeoutSec ?? 45),
      retryDelayMinutes: Number(pacing.retryDelayMinutes ?? 30),
      retryOn: Array.isArray(pacing.retryOn) ? pacing.retryOn : ['no_answer', 'busy'],
    },
    callingWindow: {
      timezone: String(callingWindow.timezone ?? 'Asia/Kolkata'),
      startLocal: String(callingWindow.startLocal ?? '09:30'),
      endLocal: String(callingWindow.endLocal ?? '18:30'),
      ...(callingWindow.workingHours
        ? { workingHours: String(callingWindow.workingHours) }
        : {}),
      daysOfWeek: Array.isArray(callingWindow.daysOfWeek)
        ? callingWindow.daysOfWeek.map(Number)
        : [1, 2, 3, 4, 5, 6],
    },
    progress,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export function campaignInsertPayload(body: CampaignCreate) {
  return {
    name: body.name.trim(),
    status: body.status ?? (body.scheduledAt ? 'scheduled' : 'draft'),
    agentId: body.agentId,
    contactListId: body.contactListId,
    iravoiceCampaignName: body.iravoiceCampaignName.trim(),
    pacing: body.pacing,
    callingWindow: body.callingWindow,
    scheduledAt: body.scheduledAt ?? null,
  }
}
