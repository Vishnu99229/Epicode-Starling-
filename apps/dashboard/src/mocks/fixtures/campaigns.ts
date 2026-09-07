import { campaignSchema, type Campaign } from '@/types'
import { assertFixtures } from './assert'

const agentEmi = 'a1000000-0000-4000-8000-000000000001'
const agentKyc = 'a1000000-0000-4000-8000-000000000002'
const agentPolicy = 'a1000000-0000-4000-8000-000000000003'
const agentDelivery = 'a1000000-0000-4000-8000-000000000004'

const listEmi = 'b2000000-0000-4000-8000-000000000001'
const listKyc = 'b2000000-0000-4000-8000-000000000002'
const listRenewal = 'b2000000-0000-4000-8000-000000000003'

const pacingDefaults = {
  dialTimeoutSec: 45,
  retryDelayMinutes: 30,
  retryOn: ['no_answer', 'busy'] as Array<'no_answer' | 'busy' | 'failed'>,
}

const istWindow = {
  timezone: 'Asia/Kolkata',
  startLocal: '09:30',
  endLocal: '18:30',
  workingHours: '0930-1830',
  daysOfWeek: [1, 2, 3, 4, 5, 6],
}

export const campaigns: Campaign[] = [
  {
    id: 'd4000000-0000-4000-8000-000000000001',
    name: 'EMI overdue — live dial',
    status: 'running',
    agentId: agentEmi,
    contactListId: listEmi,
    iravoiceCampaignName: 'vishnu_emi_out',
    pacing: { maxConcurrent: 20, targetCps: 2, maxAttempts: 3, ...pacingDefaults },
    callingWindow: istWindow,
    progress: {
      total: 1840,
      attempted: 612,
      connected: 388,
      completed: 340,
      failed: 224,
      skipped: 18,
    },
    scheduledAt: '2026-09-03T04:00:00.000Z',
    startedAt: '2026-09-04T04:00:00.000Z',
    completedAt: null,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-04T08:10:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000002',
    name: 'KYC abandoned — draft',
    status: 'draft',
    agentId: agentKyc,
    contactListId: listKyc,
    iravoiceCampaignName: 'vishnu_kyc_out',
    pacing: { maxConcurrent: 10, targetCps: 1.5, maxAttempts: 2, ...pacingDefaults },
    callingWindow: istWindow,
    progress: {
      total: 250,
      attempted: 0,
      connected: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-09-04T07:58:00.000Z',
    updatedAt: '2026-09-04T07:58:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000003',
    name: 'Policy renewal — scheduled',
    status: 'scheduled',
    agentId: agentPolicy,
    contactListId: listRenewal,
    iravoiceCampaignName: 'vishnu_renewal_out',
    pacing: { maxConcurrent: 8, targetCps: 1, maxAttempts: 2, ...pacingDefaults },
    callingWindow: {
      ...istWindow,
      startLocal: '10:00',
      endLocal: '17:00',
      workingHours: '1000-1700',
    },
    progress: {
      total: 12,
      attempted: 0,
      connected: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    },
    scheduledAt: '2026-09-05T04:30:00.000Z',
    startedAt: null,
    completedAt: null,
    createdAt: '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T15:20:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000004',
    name: 'EMI soft reminder — paused',
    status: 'paused',
    agentId: agentEmi,
    contactListId: listEmi,
    iravoiceCampaignName: 'vishnu_emi_soft',
    pacing: { maxConcurrent: 15, targetCps: 1.5, maxAttempts: 2, ...pacingDefaults },
    callingWindow: istWindow,
    progress: {
      total: 1840,
      attempted: 210,
      connected: 128,
      completed: 110,
      failed: 72,
      skipped: 8,
    },
    scheduledAt: '2026-09-01T04:00:00.000Z',
    startedAt: '2026-09-01T04:05:00.000Z',
    completedAt: null,
    createdAt: '2026-08-30T11:00:00.000Z',
    updatedAt: '2026-09-02T06:00:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000005',
    name: 'Delivery confirm — completed',
    status: 'completed',
    agentId: agentDelivery,
    contactListId: listRenewal,
    iravoiceCampaignName: 'vishnu_delivery_out',
    pacing: { maxConcurrent: 25, targetCps: 3, maxAttempts: 2, ...pacingDefaults },
    callingWindow: {
      timezone: 'Asia/Kolkata',
      startLocal: '08:00',
      endLocal: '20:00',
      workingHours: '0800-2000',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
    progress: {
      total: 12,
      attempted: 12,
      connected: 9,
      completed: 9,
      failed: 3,
      skipped: 0,
    },
    scheduledAt: '2026-08-25T02:30:00.000Z',
    startedAt: '2026-08-25T02:35:00.000Z',
    completedAt: '2026-08-25T11:40:00.000Z',
    createdAt: '2026-08-24T08:00:00.000Z',
    updatedAt: '2026-08-25T11:40:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000006',
    name: 'KYC blast — stopped',
    status: 'stopped',
    agentId: agentKyc,
    contactListId: listKyc,
    iravoiceCampaignName: 'vishnu_kyc_blast',
    pacing: { maxConcurrent: 10, targetCps: 2, maxAttempts: 1, ...pacingDefaults },
    callingWindow: istWindow,
    progress: {
      total: 250,
      attempted: 44,
      connected: 19,
      completed: 15,
      failed: 22,
      skipped: 3,
    },
    scheduledAt: '2026-08-20T04:00:00.000Z',
    startedAt: '2026-08-20T04:10:00.000Z',
    completedAt: '2026-08-20T06:00:00.000Z',
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-08-20T06:00:00.000Z',
  },
]

assertFixtures<Campaign>('campaigns', campaignSchema, campaigns)
