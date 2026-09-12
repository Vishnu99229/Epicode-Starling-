import type { Agent, FunctionTool } from '../schemas/agents.js'
import { botIdForAgent } from './agents.js'

/**
 * BotCompose add_bot mapper for Starling agents.
 *
 * Known Agent fields with NO BotCompose add_bot equivalent (tracked in `unmapped`):
 * - id, name, description, status, createdAt, updatedAt (Starling metadata)
 * - voiceEngine (language is echoed on welcome_message.language only)
 * - ignoreSpeechBeforeWelcome, welcomeDelayMs
 * - llm.knowledgeBaseIds
 * - stt.keywords, stt.silenceThresholdMs
 * - tts.pitch
 * - telephonyProvider
 * - voicemailDetectionEnabled, voicemailDetectionSec (→ IraVoice call_params via toCallParams)
 * - autoReschedule, inboundCallingEnabled
 * - outboundTimingEnabled, outboundTimingStart, outboundTimingEnd, outboundDaysOfWeek
 * - interruptWordCount
 * - botInactivityEnabled, botInactivityLimitSec (→ IraVoice call_params)
 * - totalCallTimeoutSec (→ IraVoice dial_timeout)
 * - webhookUrl, webhookTriggerStatuses, webhookHeadersEnabled, webhookHeaders (post-call Starling webhooks)
 * - callSummary, extractionCategories
 * - tools[].curl
 *
 * IraVoice-only fields are also listed in toCallParams() when not present on Agent.
 */

export type AddBotPayload = {
  bot_id: string
  welcome_message?: {
    sentence: string
    language?: string
  }
  stt_config?: {
    plugin_name: string
    secret_name?: string
    plugin_data: Record<string, unknown>
  }
  llm_config?: {
    plugin_name: string
    secret_name?: string
    plugin_data: Record<string, unknown>
  }
  tts_config?: {
    plugin_name: string
    secret_name?: string
    plugin_data: Record<string, unknown>
  }
  builtin_tools?: string[]
  webhook_tools?: {
    webhook_url: string
    tools: Array<{
      name: string
      description: string
      parameters?: Record<string, unknown>
    }>
  }
  update_cache?: boolean
}

export type ToAddBotResult = {
  payload: AddBotPayload
  unmapped: string[]
}

export type IraVoiceCallParams = {
  dial_timeout?: number
  call_params?: Record<string, unknown>
  cpa_config?: string
}

export type ToCallParamsResult = {
  params: IraVoiceCallParams
  unmapped: string[]
}

const GROQ_MODEL_MAP: Record<string, string> = {
  'qwen-2.5-32b': 'qwen/qwen-2.5-32b',
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b': 'openai/gpt-oss-120b',
}

const DEEPGRAM_MODEL_MAP: Record<string, string> = {
  'nova-2': 'nova-2',
  'nova-3': 'nova-3',
}

function pushUnmapped(unmapped: string[], field: string, reason?: string) {
  unmapped.push(reason ? `${field} (${reason})` : field)
}

function llmPlugin(agent: Agent, unmapped: string[]) {
  const { provider, baseUrl } = agent.llm
  const pluginName = 'openai_chat_completions'

  const pluginData: Record<string, unknown> = {
    instructions: agent.instructions,
    model: GROQ_MODEL_MAP[agent.llm.model] ?? agent.llm.model,
    temperature: agent.llm.temperature,
    max_tokens: agent.llm.maxTokens,
    reasoning_effort: agent.llm.reasoningEffort,
  }

  if (provider === 'groq') {
    return {
      plugin_name: pluginName,
      secret_name: 'groq',
      plugin_data: {
        ...pluginData,
        base_url: baseUrl?.trim() || 'https://api.groq.com/openai/v1',
      },
    }
  }

  if (provider === 'openai') {
    return {
      plugin_name: pluginName,
      secret_name: 'openai',
      plugin_data: {
        ...pluginData,
        base_url: baseUrl?.trim() || 'https://api.openai.com/v1',
      },
    }
  }

  if (provider === 'azure') {
    if (!baseUrl?.trim()) {
      pushUnmapped(unmapped, 'llm.baseUrl', 'required for azure provider')
    }
    return {
      plugin_name: pluginName,
      secret_name: 'azure',
      plugin_data: {
        ...pluginData,
        base_url: baseUrl?.trim() || '',
      },
    }
  }

  pushUnmapped(unmapped, 'llm.provider', `${provider} has no native BotCompose plugin`)
  return {
    plugin_name: pluginName,
    secret_name: provider,
    plugin_data: {
      ...pluginData,
      base_url: baseUrl?.trim() || '',
    },
  }
}

function sttPlugin(agent: Agent, unmapped: string[]) {
  const { provider, model, language, transcriptTimeoutMs } = agent.stt

  if (provider === 'deepgram') {
    return {
      plugin_name: 'deepgram_streaming',
      secret_name: 'deepgram',
      plugin_data: {
        model: DEEPGRAM_MODEL_MAP[model] ?? model,
        language,
        transcript_timeout: transcriptTimeoutMs / 1000,
      },
    }
  }

  if (provider === 'sarvam') {
    return {
      plugin_name: 'sarvam_streaming',
      secret_name: 'sarvam',
      plugin_data: {
        model: model === 'saarika:v2' ? 'saarika:v2' : model,
        language,
        transcript_timeout: transcriptTimeoutMs / 1000,
      },
    }
  }

  if (provider === 'azure') {
    const pluginName =
      agent.voiceEngine === 'realtime' ? 'azure_realtime' : 'azure_fast'
    return {
      plugin_name: pluginName,
      secret_name: 'azure',
      plugin_data: {
        model,
        language,
        transcript_timeout: transcriptTimeoutMs / 1000,
      },
    }
  }

  pushUnmapped(unmapped, 'stt.provider', `${provider} is not a BotCompose STT plugin`)
  return undefined
}

function ttsPlugin(agent: Agent, unmapped: string[]) {
  const { provider, model, voice, language, speed } = agent.tts

  const pluginMap: Record<string, { plugin_name: string; secret_name: string }> = {
    sarvam: { plugin_name: 'sarvam', secret_name: 'sarvam' },
    elevenlabs: { plugin_name: 'elevenlabs', secret_name: 'elevenlabs' },
    smallest: { plugin_name: 'smallestai', secret_name: 'smallestai' },
    cartesia: { plugin_name: 'cartesia', secret_name: 'cartesia' },
    azure: { plugin_name: 'azure', secret_name: 'azure' },
  }

  const mapped = pluginMap[provider]
  if (!mapped) {
    pushUnmapped(unmapped, 'tts.provider', `${provider} is not a BotCompose TTS plugin`)
    return undefined
  }

  return {
    plugin_name: mapped.plugin_name,
    secret_name: mapped.secret_name,
    plugin_data: {
      model,
      voice,
      language,
      voice_settings: { speed },
    },
  }
}

function parseToolParameters(tool: FunctionTool): Record<string, unknown> | undefined {
  if (!tool.params?.trim()) return {}
  try {
    return JSON.parse(tool.params) as Record<string, unknown>
  } catch {
    return { raw: tool.params }
  }
}

function webhookTools(agent: Agent, unmapped: string[]) {
  const webhookTools = agent.tools.filter(
    (tool) => tool.kind === 'calendar_availability' || tool.kind === 'custom',
  )
  if (webhookTools.length === 0) return undefined

  const endpoint = webhookTools.find((tool) => tool.endpoint?.trim())?.endpoint?.trim()
  if (!endpoint) {
    pushUnmapped(unmapped, 'tools.webhook_url', 'calendar/custom tools need tool.endpoint')
    return undefined
  }

  return {
    webhook_url: endpoint,
    tools: webhookTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: parseToolParameters(tool),
    })),
  }
}

export function toAddBotPayload(
  agent: Agent,
  botcomposeBotId?: string | null,
): ToAddBotResult {
  const unmapped: string[] = []

  pushUnmapped(unmapped, 'voiceEngine')
  if (agent.ignoreSpeechBeforeWelcome) pushUnmapped(unmapped, 'ignoreSpeechBeforeWelcome')
  if (agent.welcomeDelayMs > 0) pushUnmapped(unmapped, 'welcomeDelayMs')
  if (agent.llm.knowledgeBaseIds.length > 0) pushUnmapped(unmapped, 'llm.knowledgeBaseIds')
  if (agent.stt.keywords.trim()) pushUnmapped(unmapped, 'stt.keywords')
  pushUnmapped(unmapped, 'stt.silenceThresholdMs')
  pushUnmapped(unmapped, 'tts.pitch')
  pushUnmapped(unmapped, 'telephonyProvider')
  pushUnmapped(unmapped, 'voicemailDetectionEnabled')
  pushUnmapped(unmapped, 'voicemailDetectionSec')
  pushUnmapped(unmapped, 'autoReschedule')
  pushUnmapped(unmapped, 'inboundCallingEnabled')
  pushUnmapped(unmapped, 'outboundTimingEnabled')
  pushUnmapped(unmapped, 'outboundTimingStart')
  pushUnmapped(unmapped, 'outboundTimingEnd')
  pushUnmapped(unmapped, 'outboundDaysOfWeek')
  pushUnmapped(unmapped, 'interruptWordCount')
  pushUnmapped(unmapped, 'botInactivityEnabled')
  pushUnmapped(unmapped, 'botInactivityLimitSec')
  pushUnmapped(unmapped, 'totalCallTimeoutSec')
  if (agent.webhookUrl.trim()) pushUnmapped(unmapped, 'webhookUrl')
  if (agent.webhookTriggerStatuses.length > 0) pushUnmapped(unmapped, 'webhookTriggerStatuses')
  if (agent.webhookHeadersEnabled) pushUnmapped(unmapped, 'webhookHeadersEnabled')
  if (agent.webhookHeaders.length > 0) pushUnmapped(unmapped, 'webhookHeaders')
  if (agent.callSummary) pushUnmapped(unmapped, 'callSummary')
  if (agent.extractionCategories.length > 0) pushUnmapped(unmapped, 'extractionCategories')

  const stt_config = sttPlugin(agent, unmapped)
  const llm_config = llmPlugin(agent, unmapped)
  const tts_config = ttsPlugin(agent, unmapped)

  const builtin_tools = agent.tools
    .filter((tool) => tool.kind === 'transfer_call')
    .map(() => 'transfer_call')

  const webhook_tools = webhookTools(agent, unmapped)

  const payload: AddBotPayload = {
    bot_id: botIdForAgent(agent.id, botcomposeBotId),
    welcome_message: {
      sentence: agent.welcomeMessage,
      language: agent.tts.language || agent.language,
    },
    update_cache: true,
  }

  if (stt_config) payload.stt_config = stt_config
  if (llm_config) payload.llm_config = llm_config
  if (tts_config) payload.tts_config = tts_config
  if (builtin_tools.length > 0) payload.builtin_tools = [...new Set(builtin_tools)]
  if (webhook_tools) payload.webhook_tools = webhook_tools

  return { payload, unmapped }
}

/**
 * IraVoice makecall parameters derived from Agent settings.
 * These must NOT be sent to BotCompose add_bot.
 */
export function toCallParams(agent: Agent): ToCallParamsResult {
  const unmapped: string[] = []
  const call_params: Record<string, unknown> = {}

  if (agent.botInactivityEnabled && agent.botInactivityLimitSec > 0) {
    call_params.bot_inactivity_limit = agent.botInactivityLimitSec
  }

  const params: IraVoiceCallParams = {
    dial_timeout: agent.totalCallTimeoutSec,
  }

  if (agent.voicemailDetectionEnabled) {
    call_params.drop_on_cpa_events = ['AM', 'FX']
    pushUnmapped(
      unmapped,
      'cpa_config',
      'IraVoice CPA profile name is ops-provisioned; Agent has no cpa_config field',
    )
    if (agent.voicemailDetectionSec > 0) {
      pushUnmapped(unmapped, 'voicemailDetectionSec', 'no IraVoice call_params field')
    }
  }

  if (Object.keys(call_params).length > 0) {
    params.call_params = call_params
  }

  return { params, unmapped }
}
