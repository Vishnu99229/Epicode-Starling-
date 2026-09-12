import { toAddBotPayload, toCallParams } from '../src/mappers/agent-to-botcompose.js'
import type { Agent } from '../src/schemas/agents.js'

const fixtureAgent: Agent = {
  id: 'a1000000-0000-4000-8000-000000000001',
  name: 'Loan EMI reminder',
  description:
    'Outbound bot that reminds borrowers of upcoming EMI due dates and offers a repayment link or callback to collections.',
  status: 'active',
  language: 'en-IN',
  voiceEngine: 'cascaded',
  welcomeMessage: 'Hello, this is an important reminder about your loan EMI.',
  ignoreSpeechBeforeWelcome: false,
  welcomeDelayMs: 0,
  instructions:
    'You are a polite collections assistant for an Indian NBFC. Confirm the customer name, state the EMI amount and due date, offer to share a UPI payment link, and escalate to a human if they dispute the balance. Keep replies under two sentences. Speak in clear Indian English.',
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
  interruptWordCount: 3,
  botInactivityEnabled: true,
  botInactivityLimitSec: 12,
  totalCallTimeoutSec: 180,
  tools: [],
  webhookUrl: '',
  webhookTriggerStatuses: ['completed', 'no_answer', 'busy', 'failed', 'voicemail'],
  webhookHeadersEnabled: false,
  webhookHeaders: [],
  callSummary: true,
  extractionCategories: [],
  createdAt: '2026-08-12T06:30:00.000Z',
  updatedAt: '2026-09-04T08:00:00.000Z',
}

const { payload, unmapped } = toAddBotPayload(fixtureAgent)
const callParams = toCallParams(fixtureAgent)

console.log(JSON.stringify({ payload, unmapped, callParams }, null, 2))
