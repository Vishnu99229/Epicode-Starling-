import { createHash } from 'node:crypto'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type LedgerRow = {
  call_uuid: string
  campaign_id: string
  contact_id: string | null
  dial_job_id: string | null
  state: string
  cpa_event: string | null
  hangup_cause: string | null
  duration_sec: string | number | null
  started_at: Date | null
  answered_at: Date | null
  ended_at: Date | null
  phone_number: string | null
  contact_name: string | null
  attempt_no: number | null
  transcript: unknown
  latency_metrics: unknown
}

export function deriveOutcome(row: LedgerRow): string {
  const hangup = `${row.hangup_cause ?? ''}`.toLowerCase()
  const cpa = `${row.cpa_event ?? ''}`.toUpperCase()

  if (cpa === 'AM') return 'voicemail'
  if (hangup.includes('busy')) return 'busy'
  if (row.answered_at) {
    if (row.state === 'completed' || row.state === 'analyzed') return 'connected'
    return 'connected'
  }
  if (hangup.includes('no_answer') || hangup.includes('no answer')) return 'no_answer'
  if (row.state === 'completed' || row.state === 'analyzed') return 'no_answer'
  return 'failed'
}

function callLogId(row: LedgerRow): string {
  if (row.dial_job_id) return row.dial_job_id
  if (UUID_RE.test(row.call_uuid)) return row.call_uuid
  const hash = createHash('sha256').update(row.call_uuid).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

export function mapCallLog(row: LedgerRow) {
  const transcript = renderTranscript(row.transcript)
  const durationSec = Number(row.duration_sec ?? 0)

  return {
    id: callLogId(row),
    campaignId: row.campaign_id,
    contactId: row.contact_id,
    callUuid: row.call_uuid,
    phoneE164: row.phone_number ?? '',
    ...(row.contact_name ? { displayName: row.contact_name } : {}),
    attempt: row.attempt_no ?? 1,
    outcome: deriveOutcome(row),
    durationSec,
    errorReason: row.hangup_cause,
    startedAt: (row.started_at ?? row.ended_at ?? new Date()).toISOString(),
    endedAt: row.ended_at?.toISOString() ?? null,
    ...(transcript ? { transcript } : {}),
  }
}

function renderTranscript(raw: unknown): string | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return JSON.stringify(raw)
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return ''
      const role = 'role' in entry ? String((entry as { role: unknown }).role) : 'unknown'
      const text = 'text' in entry ? String((entry as { text: unknown }).text) : ''
      return `${role}: ${text}`
    })
    .filter(Boolean)
    .join('\n')
}

export function extractAvgLlmTtfs(latency: unknown): number | undefined {
  if (!latency || typeof latency !== 'object') return undefined
  const obj = latency as Record<string, unknown>
  const llm = obj.llm
  if (!llm || typeof llm !== 'object') return undefined
  const llmObj = llm as Record<string, unknown>
  const value = llmObj.ttfs_mean_ms ?? llmObj.ttfs_p95_ms ?? llmObj.ttfs_mean
  return value == null ? undefined : Number(value)
}

export function buildTimeSeries(
  rows: Array<{ started_at: Date | null; answered_at: Date | null; state: string }>,
) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    ts: bucketTimestamp(hour),
    attempted: 0,
    connected: 0,
    completed: 0,
    failed: 0,
  }))

  for (const row of rows) {
    if (!row.started_at) continue
    const hour = row.started_at.getUTCHours()
    const bucket = buckets[hour]
    if (!bucket) continue
    bucket.attempted += 1
    if (row.answered_at) bucket.connected += 1
    if (row.state === 'completed' || row.state === 'analyzed') bucket.completed += 1
    if (!row.answered_at && (row.state === 'completed' || row.state === 'analyzed')) {
      bucket.failed += 1
    }
  }

  return buckets
}

function bucketTimestamp(hour: number) {
  const now = new Date()
  now.setUTCMinutes(0, 0, 0)
  now.setUTCHours(hour, 0, 0, 0)
  return now.toISOString()
}
