import { agentSchema, type Agent, type AgentCreate } from '../schemas/agents.js'

type AgentRow = {
  id: string
  name: string
  description: string
  status: Agent['status']
  config: Record<string, unknown>
  botcompose_bot_id: string | null
  created_at: Date
  updated_at: Date
}

export function agentConfigFromCreate(body: AgentCreate): Record<string, unknown> {
  const { name: _n, description: _d, status: _s, ...config } = body
  return config
}

export function mergeAgentUpdate(
  existing: Agent,
  patch: Partial<AgentCreate>,
): AgentCreate {
  return {
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    status: patch.status ?? existing.status,
    language: patch.language ?? existing.language,
    voiceEngine: patch.voiceEngine ?? existing.voiceEngine,
    welcomeMessage: patch.welcomeMessage ?? existing.welcomeMessage,
    ignoreSpeechBeforeWelcome:
      patch.ignoreSpeechBeforeWelcome ?? existing.ignoreSpeechBeforeWelcome,
    welcomeDelayMs: patch.welcomeDelayMs ?? existing.welcomeDelayMs,
    instructions: patch.instructions ?? existing.instructions,
    llm: { ...existing.llm, ...patch.llm },
    stt: { ...existing.stt, ...patch.stt },
    tts: { ...existing.tts, ...patch.tts },
    telephonyProvider: patch.telephonyProvider ?? existing.telephonyProvider,
    voicemailDetectionEnabled:
      patch.voicemailDetectionEnabled ?? existing.voicemailDetectionEnabled,
    voicemailDetectionSec: patch.voicemailDetectionSec ?? existing.voicemailDetectionSec,
    autoReschedule: patch.autoReschedule ?? existing.autoReschedule,
    inboundCallingEnabled: patch.inboundCallingEnabled ?? existing.inboundCallingEnabled,
    outboundTimingEnabled: patch.outboundTimingEnabled ?? existing.outboundTimingEnabled,
    outboundTimingStart: patch.outboundTimingStart ?? existing.outboundTimingStart,
    outboundTimingEnd: patch.outboundTimingEnd ?? existing.outboundTimingEnd,
    outboundDaysOfWeek: patch.outboundDaysOfWeek ?? existing.outboundDaysOfWeek,
    interruptWordCount: 3,
    botInactivityEnabled: patch.botInactivityEnabled ?? existing.botInactivityEnabled,
    botInactivityLimitSec: patch.botInactivityLimitSec ?? existing.botInactivityLimitSec,
    totalCallTimeoutSec: patch.totalCallTimeoutSec ?? existing.totalCallTimeoutSec,
    tools: patch.tools ?? existing.tools,
    webhookUrl: patch.webhookUrl ?? existing.webhookUrl,
    webhookTriggerStatuses: patch.webhookTriggerStatuses ?? existing.webhookTriggerStatuses,
    webhookHeadersEnabled: patch.webhookHeadersEnabled ?? existing.webhookHeadersEnabled,
    webhookHeaders: patch.webhookHeaders ?? existing.webhookHeaders,
    callSummary: patch.callSummary ?? existing.callSummary,
    extractionCategories: patch.extractionCategories ?? existing.extractionCategories,
  }
}

export function mapAgent(row: AgentRow): Agent {
  const config = row.config ?? {}
  return agentSchema.parse({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...config,
  })
}

export function botIdForAgent(agentId: string, existing?: string | null) {
  return existing ?? `starling_${agentId}`
}
