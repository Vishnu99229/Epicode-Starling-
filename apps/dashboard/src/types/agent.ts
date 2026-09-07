import { z } from 'zod'

const num = z.coerce.number()

export const agentStatusSchema = z.enum(['draft', 'active', 'archived'])
export const voiceEngineSchema = z.enum(['cascaded', 'realtime'])
export const reasoningEffortSchema = z.enum(['low', 'medium', 'high'])
export const llmProviderSchema = z.enum([
  'groq',
  'openai',
  'azure',
  'anthropic',
  'google',
])
export const llmModelSchema = z.enum([
  'qwen-2.5-32b',
  'llama-3.3-70b',
  'openai/gpt-oss-120b',
  'gpt-4o-mini',
  'gpt-4o',
  'claude-4-sonnet',
  'claude-3.5-haiku',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
])
export const sttProviderSchema = z.enum([
  'azure',
  'deepgram',
  'elevenlabs',
  'gemini',
  'gladia',
  'google',
  'openai',
  'sarvam',
  'smallest',
  'soniox',
])
export const sttModelSchema = z.enum([
  'nova-2',
  'nova-3',
  'azure-speech',
  'scribe-v1',
  'gemini-asr',
  'solaria',
  'chirp-2',
  'whisper-1',
  'saarika:v2',
  'smallest-asr',
  'stt-rt-v3',
])
export const ttsProviderSchema = z.enum([
  'sarvam',
  'elevenlabs',
  'azure',
  'smallest',
  'cartesia',
])
export const telephonyProviderSchema = z.enum(['epicode'])
export const responseRateSchema = z.enum(['rapid', 'balanced', 'patient'])
export const extractionTypeSchema = z.enum(['text', 'number', 'boolean', 'enum'])
export const webhookStatusSchema = z.enum([
  'completed',
  'no_answer',
  'busy',
  'failed',
  'voicemail',
])
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
export const functionToolKindSchema = z.enum([
  'calendar_availability',
  'book_appointment',
  'transfer_call',
  'custom',
])

export const headerRowSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export const functionToolSchema = z.object({
  id: z.string().min(1),
  kind: functionToolKindSchema,
  name: z.string().min(1),
  description: z.string(),
  endpoint: z.string().optional(),
  method: httpMethodSchema.optional(),
  params: z.string().optional(),
  curl: z.string().optional(),
})

export const extractionCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  type: extractionTypeSchema,
})

export const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  status: agentStatusSchema,
  language: z.string().min(2),
  voiceEngine: voiceEngineSchema,
  indiaRouting: z.boolean(),

  welcomeMessage: z.string(),
  ignoreSpeechBeforeWelcome: z.boolean(),
  welcomeDelayMs: num.min(0).max(5000),
  instructions: z.string().min(1, 'Prompt is required'),

  llm: z.object({
    provider: llmProviderSchema,
    model: llmModelSchema,
    temperature: num.min(0).max(1),
    maxTokens: num.int().positive(),
    reasoningEffort: reasoningEffortSchema,
    knowledgeBaseIds: z.array(z.string()),
    baseUrl: z.string().url().optional().or(z.literal('')),
  }),

  stt: z.object({
    provider: sttProviderSchema,
    model: sttModelSchema,
    language: z.string().min(2),
    keywords: z.string(),
    transcriptTimeoutMs: num.int().positive(),
    silenceThresholdMs: num.int().positive(),
  }),
  tts: z.object({
    provider: ttsProviderSchema,
    model: z.string().min(1),
    voice: z.string().min(1, 'Voice is required'),
    language: z.string().min(2),
    speed: num.min(0.5).max(2),
    pitch: num.min(0.5).max(2),
  }),

  telephonyProvider: telephonyProviderSchema,
  voicemailDetectionEnabled: z.boolean(),
  voicemailDetectionSec: num.min(0),
  autoReschedule: z.boolean(),
  inboundCallingEnabled: z.boolean(),
  outboundTimingEnabled: z.boolean(),
  outboundTimingStart: z.string(),
  outboundTimingEnd: z.string(),
  outboundDaysOfWeek: z.array(num.int().min(0).max(6)),

  responseRate: responseRateSchema,
  interruptWordCount: num.min(0).max(10),
  userOnlineDetectionEnabled: z.boolean(),
  userOnlineMessages: z.object({
    hi: z.string(),
    en: z.string(),
  }),
  userOnlineInvokeAfterSec: num.min(0),
  finalCallMessages: z.object({
    hi: z.string(),
    en: z.string(),
  }),
  hangupOnSilenceEnabled: z.boolean(),
  hangupOnSilenceSec: num.min(0),
  botInactivityEnabled: z.boolean(),
  botInactivityLimitSec: num.min(0),
  totalCallTimeoutSec: num.int().positive(),

  tools: z.array(functionToolSchema),
  webhookUrl: z.string(),
  webhookTriggerStatuses: z.array(webhookStatusSchema),
  webhookHeadersEnabled: z.boolean(),
  webhookHeaders: z.array(headerRowSchema),
  callSummary: z.boolean(),
  extractionCategories: z.array(extractionCategorySchema),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const agentCreateSchema = agentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const agentUpdateSchema = agentCreateSchema.partial()

export type Agent = z.infer<typeof agentSchema>
export type AgentStatus = z.infer<typeof agentStatusSchema>
export type AgentCreate = z.infer<typeof agentCreateSchema>
export type AgentUpdate = z.infer<typeof agentUpdateSchema>
export type LlmProvider = z.infer<typeof llmProviderSchema>
export type LlmModel = z.infer<typeof llmModelSchema>
export type SttProvider = z.infer<typeof sttProviderSchema>
export type SttModel = z.infer<typeof sttModelSchema>
export type TtsProvider = z.infer<typeof ttsProviderSchema>
export type TelephonyProvider = z.infer<typeof telephonyProviderSchema>
export type FunctionTool = z.infer<typeof functionToolSchema>
export type ExtractionCategory = z.infer<typeof extractionCategorySchema>
