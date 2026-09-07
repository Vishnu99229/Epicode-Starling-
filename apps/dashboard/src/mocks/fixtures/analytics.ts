import {
  analyticsOverviewSchema,
  callLogSchema,
  campaignStatsSchema,
  type AnalyticsOverview,
  type CallLog,
  type CallOutcome,
  type CampaignStats,
} from '@/types'
import { assertFixtures } from './assert'

const campaignRunning = 'd4000000-0000-4000-8000-000000000001'
const campaignPaused = 'd4000000-0000-4000-8000-000000000004'

function buildSeries(
  seedAttempted: number,
  connectRatio: number,
): CampaignStats['timeSeries'] {
  const points: CampaignStats['timeSeries'] = []
  for (let h = 0; h < 24; h++) {
    const hour = String(h).padStart(2, '0')
    const attempted = Math.max(0, Math.round(seedAttempted * (0.4 + (h % 6) * 0.12)))
    const connected = Math.round(attempted * connectRatio)
    const completed = Math.round(connected * 0.85)
    const failed = Math.max(0, attempted - connected)
    points.push({
      ts: `2026-09-04T${hour}:00:00.000Z`,
      attempted,
      connected,
      completed,
      failed,
    })
  }
  return points
}

export const campaignStats: CampaignStats[] = [
  {
    campaignId: campaignRunning,
    campaignName: 'EMI overdue — live dial',
    attempted: 612,
    connected: 388,
    completed: 340,
    failed: 224,
    skipped: 18,
    connectRate: 388 / 612,
    completionRate: 340 / 612,
    avgDurationSec: 74,
    avgLlmTtfsMs: 420,
    timeSeries: buildSeries(40, 0.62),
  },
  {
    campaignId: campaignPaused,
    campaignName: 'EMI soft reminder — paused',
    attempted: 210,
    connected: 128,
    completed: 110,
    failed: 72,
    skipped: 8,
    connectRate: 128 / 210,
    completionRate: 110 / 210,
    avgDurationSec: 68,
    avgLlmTtfsMs: 390,
    timeSeries: buildSeries(18, 0.58),
  },
]

export const analyticsOverview: AnalyticsOverview = {
  activeCampaigns: 1,
  callsToday: 822,
  connectRateToday: 516 / 822,
  completionRateToday: 450 / 822,
  avgDurationSecToday: 72,
  byOutcome: {
    connected: 340,
    no_answer: 98,
    busy: 42,
    voicemail: 36,
    failed: 48,
    dnd: 12,
    invalid: 8,
    abandoned: 28,
  },
}

const phones = [
  '+919820011001',
  '+919821122334',
  '+919811223344',
  '+919900112233',
  '+919700445566',
  '+919888776655',
  '+919912345678',
  '+919833445566',
  '+919866778899',
  '+919877889900',
]

const names = [
  'Anita Deshmukh',
  'Rahul Mehta',
  'Suresh Iyer',
  'Priya Nair',
  'Farah Khan',
  'Neha Gupta',
  'Imran Qureshi',
  'Kavya Sharma',
  'Ramesh Pillai',
  'Sunita Rao',
]

const outcomeSpread: CallOutcome[] = [
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'connected',
  'no_answer',
  'no_answer',
  'no_answer',
  'no_answer',
  'busy',
  'busy',
  'voicemail',
  'voicemail',
  'failed',
  'failed',
  'failed',
  'dnd',
  'invalid',
  'abandoned',
  'connected',
  'connected',
  'no_answer',
  'busy',
  'voicemail',
  'connected',
]

export const callLogs: CallLog[] = outcomeSpread.map((outcome, i) => {
  const phone = phones[i % phones.length]!
  const displayName = names[i % names.length]!
  const campaignId = i % 3 === 0 ? campaignPaused : campaignRunning
  const durationSec =
    outcome === 'connected'
      ? 45 + (i % 40)
      : outcome === 'voicemail'
        ? 12 + (i % 8)
        : outcome === 'abandoned'
          ? 8 + (i % 10)
          : 0
  const startedAt = `2026-09-04T0${Math.floor(i / 5) + 4}:${String((i * 3) % 60).padStart(2, '0')}:00.000Z`
  const endedAt =
    durationSec > 0
      ? new Date(new Date(startedAt).getTime() + durationSec * 1000).toISOString()
      : startedAt

  return {
    id: `e5000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    campaignId,
    contactId: `c3000000-0000-4000-8000-${String((i % 10) + 1).padStart(12, '0')}`,
    callUuid:
      outcome === 'invalid'
        ? null
        : `f6000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    phoneE164: phone,
    displayName,
    attempt: (i % 3) + 1,
    outcome,
    durationSec,
    errorReason:
      outcome === 'failed'
        ? 'trunk_unavailable'
        : outcome === 'invalid'
          ? 'invalid_e164'
          : null,
    startedAt,
    endedAt: durationSec > 0 || outcome === 'no_answer' || outcome === 'busy' ? endedAt : null,
    transcript:
      outcome === 'connected' && i % 2 === 0
        ? `Agent: Hello, this is Starling calling about your account.\nCaller: Yes, speaking.\nAgent: Your EMI of ₹12,400 is due on the 5th. Can we share a UPI link?\nCaller: Please send it on WhatsApp.`
        : undefined,
  }
})

assertFixtures<CampaignStats>('campaignStats', campaignStatsSchema, campaignStats)
assertFixtures<CallLog>('callLogs', callLogSchema, callLogs)

const overviewCheck = analyticsOverviewSchema.safeParse(analyticsOverview)
if (!overviewCheck.success) {
  throw new Error(`[fixtures] analyticsOverview failed: ${overviewCheck.error.message}`)
}
