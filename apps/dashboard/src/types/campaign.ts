import { z } from 'zod'

/** Matches Postgres campaign_status enum. */
export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'stopped',
])

export const campaignProgressSchema = z.object({
  total: z.number().int().nonnegative(),
  attempted: z.number().int().nonnegative(),
  connected: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().default(0),
})

export const retryOnOutcomeSchema = z.enum(['no_answer', 'busy', 'failed'])

export const campaignPacingSchema = z.object({
  maxConcurrent: z.number().int().positive().default(20),
  targetCps: z.number().positive().default(2),
  maxAttempts: z.number().int().positive().default(3),
  dialTimeoutSec: z.number().int().positive().default(45),
  retryDelayMinutes: z.number().int().nonnegative().default(30),
  retryOn: z.array(retryOnOutcomeSchema).min(1).default(['no_answer', 'busy']),
})

export const callingWindowSchema = z.object({
  timezone: z.string().default('Asia/Kolkata'),
  startLocal: z.string(), // HH:mm
  endLocal: z.string(),
  /** Working hours as HHMM-HHMM for IraVoice / operator display. */
  workingHours: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
})

export const campaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: campaignStatusSchema,
  agentId: z.string().uuid(),
  contactListId: z.string().uuid(),
  /** IraVoice campaign_name used in makecall. */
  iravoiceCampaignName: z.string().min(1),
  pacing: campaignPacingSchema,
  callingWindow: callingWindowSchema,
  progress: campaignProgressSchema,
  scheduledAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Campaign = z.infer<typeof campaignSchema>
export type CampaignStatus = z.infer<typeof campaignStatusSchema>
export type CampaignProgress = z.infer<typeof campaignProgressSchema>
export type RetryOnOutcome = z.infer<typeof retryOnOutcomeSchema>

export const campaignCreateSchema = campaignSchema.omit({
  id: true,
  status: true,
  progress: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: campaignStatusSchema.optional(),
  progress: campaignProgressSchema.optional(),
})
export type CampaignCreate = z.infer<typeof campaignCreateSchema>
