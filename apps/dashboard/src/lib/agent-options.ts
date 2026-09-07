import type { AgentCreate, LlmModel, SttModel } from '@/types'

export const LLM_MODELS: Record<string, { value: LlmModel; label: string }[]> = {
  groq: [
    { value: 'qwen-2.5-32b', label: 'qwen-2.5-32b' },
    { value: 'llama-3.3-70b', label: 'llama-3.3-70b' },
    { value: 'openai/gpt-oss-120b', label: 'gpt-oss-120b' },
  ],
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4o', label: 'gpt-4o' },
  ],
  azure: [
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  ],
  anthropic: [
    { value: 'claude-4-sonnet', label: 'claude-4-sonnet' },
    { value: 'claude-3.5-haiku', label: 'claude-3.5-haiku' },
  ],
  google: [
    { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
  ],
}

export const STT_MODELS: Record<string, { value: SttModel; label: string }[]> = {
  deepgram: [
    { value: 'nova-2', label: 'nova-2' },
    { value: 'nova-3', label: 'nova-3' },
  ],
  azure: [{ value: 'azure-speech', label: 'azure-speech' }],
  elevenlabs: [{ value: 'scribe-v1', label: 'scribe-v1' }],
  gemini: [{ value: 'gemini-asr', label: 'gemini-asr' }],
  gladia: [{ value: 'solaria', label: 'solaria' }],
  google: [{ value: 'chirp-2', label: 'chirp-2' }],
  openai: [{ value: 'whisper-1', label: 'whisper-1' }],
  sarvam: [{ value: 'saarika:v2', label: 'saarika:v2' }],
  smallest: [{ value: 'smallest-asr', label: 'smallest-asr' }],
  soniox: [{ value: 'stt-rt-v3', label: 'stt-rt-v3' }],
}

export const TTS_VOICES: Record<
  string,
  { value: string; label: string; model: string }[]
> = {
  sarvam: [
    { value: 'kabir', label: 'Kabir', model: 'bulbul:v3' },
    { value: 'shubh', label: 'Shubh', model: 'bulbul:v3' },
    { value: 'anushka', label: 'Anushka', model: 'bulbul:v3' },
  ],
  elevenlabs: [
    { value: 'rachel', label: 'Rachel', model: 'eleven_turbo_v2_5' },
    { value: 'adam', label: 'Adam', model: 'eleven_turbo_v2_5' },
  ],
  azure: [
    { value: 'en-IN-NeerjaNeural', label: 'Neerja (en-IN)', model: 'neural' },
    { value: 'en-IN-PrabhatNeural', label: 'Prabhat (en-IN)', model: 'neural' },
  ],
  smallest: [{ value: 'lightning-en', label: 'Lightning EN', model: 'lightning' }],
  cartesia: [{ value: 'sonic-en', label: 'Sonic EN', model: 'sonic-2' }],
}

export const STT_LANGUAGES = [
  { value: 'en-IN', label: 'en-IN' },
  { value: 'hi-IN', label: 'hi-IN' },
  { value: 'en-US', label: 'en-US' },
  { value: 'ta-IN', label: 'ta-IN' },
  { value: 'te-IN', label: 'te-IN' },
]

export const KNOWLEDGE_BASES = [
  { id: 'kb-emi', label: 'EMI policy FAQ' },
  { id: 'kb-kyc', label: 'KYC onboarding guide' },
  { id: 'kb-renewal', label: 'Renewal product sheet' },
]

export const BUILTIN_TOOLS = [
  {
    kind: 'calendar_availability' as const,
    name: 'Calendar availability',
    description: 'Check open slots on a connected calendar.',
  },
  {
    kind: 'book_appointment' as const,
    name: 'Book appointment',
    description: 'Create a booking for a confirmed slot.',
  },
  {
    kind: 'transfer_call' as const,
    name: 'Transfer call',
    description: 'Hand off to a human agent or queue.',
  },
]

export function modelsForLlm(provider: string) {
  return LLM_MODELS[provider] ?? LLM_MODELS.groq!
}

export function modelsForStt(provider: string) {
  return STT_MODELS[provider] ?? STT_MODELS.deepgram!
}

export function voicesForTts(provider: string) {
  return TTS_VOICES[provider] ?? TTS_VOICES.sarvam!
}

export const AGENT_TABS = [
  { id: 'agent', label: 'Agent' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'languages', label: 'Languages' },
  { id: 'calling', label: 'Calling' },
  { id: 'engine', label: 'Engine' },
  { id: 'tools', label: 'Tools' },
  { id: 'extractions', label: 'Extractions' },
] as const

export type AgentTabId = (typeof AGENT_TABS)[number]['id']

export const WEBHOOK_STATUSES = [
  'completed',
  'no_answer',
  'busy',
  'failed',
  'voicemail',
] as const

export const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

export function estimateCost(engine: string) {
  if (engine === 'realtime') {
    return { agent: 2.4, telephony: 1.1, platform: 0.4, total: 3.9 }
  }
  return { agent: 1.6, telephony: 1.1, platform: 0.3, total: 3.0 }
}

export const defaultAgentFormValues: AgentCreate = {
  name: '',
  description: '',
  status: 'draft',
  language: 'en-IN',
  voiceEngine: 'cascaded',
  indiaRouting: true,
  welcomeMessage: '',
  ignoreSpeechBeforeWelcome: false,
  welcomeDelayMs: 0,
  instructions: '',
  llm: {
    provider: 'groq',
    model: 'qwen-2.5-32b',
    temperature: 0.3,
    maxTokens: 256,
    reasoningEffort: 'low',
    knowledgeBaseIds: [],
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  stt: {
    provider: 'deepgram',
    model: 'nova-2',
    language: 'en-IN',
    keywords: '',
    transcriptTimeoutMs: 1200,
    silenceThresholdMs: 800,
  },
  tts: {
    provider: 'sarvam',
    model: 'bulbul:v3',
    voice: 'kabir',
    language: 'en-IN',
    speed: 1.05,
    pitch: 1,
  },
  telephonyProvider: 'epicode',
  voicemailDetectionEnabled: false,
  voicemailDetectionSec: 5,
  autoReschedule: false,
  inboundCallingEnabled: false,
  outboundTimingEnabled: true,
  outboundTimingStart: '09:30',
  outboundTimingEnd: '18:30',
  outboundDaysOfWeek: [1, 2, 3, 4, 5, 6],
  responseRate: 'balanced',
  interruptWordCount: 2,
  userOnlineDetectionEnabled: false,
  userOnlineMessages: {
    hi: 'क्या आप अभी भी लाइन पर हैं?',
    en: 'Are you still there?',
  },
  userOnlineInvokeAfterSec: 8,
  finalCallMessages: {
    hi: 'धन्यवाद, कॉल यहीं समाप्त होती है।',
    en: 'Thank you. This call will now end.',
  },
  hangupOnSilenceEnabled: true,
  hangupOnSilenceSec: 12,
  botInactivityEnabled: false,
  botInactivityLimitSec: 10,
  totalCallTimeoutSec: 300,
  tools: [],
  webhookUrl: '',
  webhookTriggerStatuses: [...WEBHOOK_STATUSES],
  webhookHeadersEnabled: false,
  webhookHeaders: [],
  callSummary: true,
  extractionCategories: [],
}
