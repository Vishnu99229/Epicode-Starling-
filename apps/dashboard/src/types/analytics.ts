import { z } from 'zod'

export const campaignStatsPointSchema = z.object({
  ts: z.string().datetime(),
  attempted: z.number().int().nonnegative(),
  connected: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export const campaignStatsSchema = z.object({
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  attempted: z.number().int().nonnegative(),
  connected: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  connectRate: z.number().min(0).max(1),
  completionRate: z.number().min(0).max(1),
  avgDurationSec: z.number().nonnegative(),
  avgLlmTtfsMs: z.number().nonnegative().optional(),
  timeSeries: z.array(campaignStatsPointSchema).length(24),
})

export type CampaignStats = z.infer<typeof campaignStatsSchema>
export type CampaignStatsPoint = z.infer<typeof campaignStatsPointSchema>

export const analyticsOverviewSchema = z.object({
  activeCampaigns: z.number().int().nonnegative(),
  callsToday: z.number().int().nonnegative(),
  connectRateToday: z.number().min(0).max(1),
  completionRateToday: z.number().min(0).max(1),
  avgDurationSecToday: z.number().nonnegative(),
  byOutcome: z.record(z.string(), z.number().int().nonnegative()),
})

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>

/** Operator-facing call outcome (derived from ledger + CDR). */
export const callOutcomeSchema = z.enum([
  'connected',
  'no_answer',
  'busy',
  'voicemail',
  'failed',
  'dnd',
  'invalid',
  'abandoned',
])

export const callLogSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  contactId: z.string().uuid().nullable(),
  callUuid: z.string().nullable(),
  phoneE164: z.string(),
  displayName: z.string().optional(),
  attempt: z.number().int().positive(),
  outcome: callOutcomeSchema,
  durationSec: z.number().nonnegative(),
  errorReason: z.string().nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  transcript: z.string().optional(),
})

export type CallLog = z.infer<typeof callLogSchema>
export type CallOutcome = z.infer<typeof callOutcomeSchema>
