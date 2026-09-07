import { defaultAgentFormValues } from '@/lib/agent-options'
import { agentSchema, type Agent } from '@/types'
import { assertFixtures } from './assert'

const now = '2026-09-04T08:00:00.000Z'

function agent(
  partial: Pick<Agent, 'id' | 'name' | 'description' | 'status' | 'welcomeMessage' | 'instructions' | 'createdAt' | 'updatedAt'> &
    Partial<Agent>,
): Agent {
  return {
    ...defaultAgentFormValues,
    language: 'en-IN',
    ...partial,
    stt: {
      ...defaultAgentFormValues.stt,
      ...partial.stt,
    },
    llm: {
      ...defaultAgentFormValues.llm,
      ...partial.llm,
    },
    tts: {
      ...defaultAgentFormValues.tts,
      ...partial.tts,
    },
  }
}

export const agents: Agent[] = [
  agent({
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Loan EMI reminder',
    description:
      'Outbound bot that reminds borrowers of upcoming EMI due dates and offers a repayment link or callback to collections.',
    status: 'active',
    welcomeMessage: 'Hello, this is an important reminder about your loan EMI.',
    instructions:
      'You are a polite collections assistant for an Indian NBFC. Confirm the customer name, state the EMI amount and due date, offer to share a UPI payment link, and escalate to a human if they dispute the balance. Keep replies under two sentences. Speak in clear Indian English.',
    llm: { ...defaultAgentFormValues.llm, reasoningEffort: 'low' },
    tts: { ...defaultAgentFormValues.tts, voice: 'kabir', speed: 1.05 },
    hangupOnSilenceSec: 12,
    botInactivityEnabled: true,
    botInactivityLimitSec: 12,
    totalCallTimeoutSec: 180,
    createdAt: '2026-08-12T06:30:00.000Z',
    updatedAt: now,
  }),
  agent({
    id: 'a1000000-0000-4000-8000-000000000002',
    name: 'KYC verification callback',
    description:
      'Calls applicants who abandoned video KYC mid-flow and guides them to complete Aadhaar / PAN verification.',
    status: 'active',
    welcomeMessage: 'Hi, calling from onboarding about your pending KYC verification.',
    instructions:
      'Help the customer resume KYC. Ask if they have Aadhaar and PAN ready, explain the video KYC steps briefly, and offer to send the secure link on WhatsApp. Do not ask for full Aadhaar number on the call. If they refuse, schedule a callback.',
    stt: { ...defaultAgentFormValues.stt, transcriptTimeoutMs: 1300, silenceThresholdMs: 850 },
    tts: { ...defaultAgentFormValues.tts, voice: 'shubh', speed: 1 },
    hangupOnSilenceSec: 12,
    botInactivityEnabled: true,
    botInactivityLimitSec: 15,
    totalCallTimeoutSec: 240,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: now,
  }),
  agent({
    id: 'a1000000-0000-4000-8000-000000000003',
    name: 'Policy renewal',
    description:
      'Life / health insurance renewal reminder with premium quote and grace-period warnings.',
    status: 'draft',
    welcomeMessage: 'Hello, this is a courtesy call about your insurance policy renewal.',
    instructions:
      'Remind the policyholder of renewal date and premium. Offer renewal on the same plan or a quick quote for upgrade. If they want to cancel, capture reason and offer a callback from an advisor. Never pressure the customer.',
    llm: { ...defaultAgentFormValues.llm, reasoningEffort: 'medium' },
    tts: { ...defaultAgentFormValues.tts, voice: 'anushka', speed: 1 },
    hangupOnSilenceSec: 12,
    botInactivityEnabled: true,
    botInactivityLimitSec: 20,
    totalCallTimeoutSec: 300,
    createdAt: '2026-09-01T04:15:00.000Z',
    updatedAt: '2026-09-02T11:00:00.000Z',
  }),
  agent({
    id: 'a1000000-0000-4000-8000-000000000004',
    name: 'Delivery confirmation',
    description:
      'Confirms COD / address for last-mile delivery and captures preferred time slot.',
    status: 'archived',
    welcomeMessage: 'Hi, calling to confirm your delivery for today.',
    instructions:
      'Confirm the delivery address and preferred slot. If the customer wants to reschedule, capture a new date. For COD, reconfirm the amount. Keep it short — this is a high-volume logistics bot.',
    stt: { ...defaultAgentFormValues.stt, transcriptTimeoutMs: 1100, silenceThresholdMs: 750 },
    tts: { ...defaultAgentFormValues.tts, voice: 'kabir', speed: 1.1 },
    hangupOnSilenceSec: 12,
    botInactivityEnabled: true,
    botInactivityLimitSec: 10,
    totalCallTimeoutSec: 90,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-08-20T14:00:00.000Z',
  }),
]

assertFixtures<Agent>('agents', agentSchema, agents)
