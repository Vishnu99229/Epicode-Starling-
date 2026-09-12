import { z } from 'zod'

export const campaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'stopped',
])

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
  startLocal: z.string(),
  endLocal: z.string(),
  workingHours: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
})

export const campaignProgressSchema = z.object({
  total: z.number().int().nonnegative(),
  attempted: z.number().int().nonnegative(),
  connected: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().default(0),
})

export const campaignCreateSchema = z.object({
  name: z.string().min(1),
  agentId: z.string().uuid(),
  contactListId: z.string().uuid(),
  iravoiceCampaignName: z.string().min(1),
  pacing: campaignPacingSchema,
  callingWindow: callingWindowSchema,
  scheduledAt: z.string().datetime().nullable().optional(),
  status: campaignStatusSchema.optional(),
  progress: campaignProgressSchema.optional(),
})

export type CampaignCreate = z.infer<typeof campaignCreateSchema>
