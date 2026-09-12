import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { pool } from '../db.js'
import { notFound } from '../errors.js'
import {
  buildTimeSeries,
  extractAvgLlmTtfs,
  mapCallLog,
  type LedgerRow,
} from '../mappers/analytics.js'

const idParamsSchema = z.object({
  id: z.string().uuid(),
})

const callLogsQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
})

const ledgerSelect = `
  SELECT
    cl.call_uuid,
    cl.campaign_id::text,
    cl.contact_id::text,
    cl.dial_job_id::text,
    cl.state::text,
    cl.cpa_event,
    cl.hangup_cause,
    cl.duration_sec,
    cl.started_at,
    cl.answered_at,
    cl.ended_at,
    COALESCE(cl.to_number, ct.phone_number) AS phone_number,
    ct.name AS contact_name,
    dj.attempt_no,
    cdr.transcript,
    cdr.latency_metrics
  FROM call_ledger cl
  LEFT JOIN contacts ct ON ct.id = cl.contact_id
  LEFT JOIN dial_jobs dj ON dj.id = cl.dial_job_id
  LEFT JOIN cdrs cdr ON cdr.call_uuid = cl.call_uuid
`

async function fetchLedgerRows(campaignId?: string) {
  const params: string[] = []
  let where = ''
  if (campaignId) {
    params.push(campaignId)
    where = `WHERE cl.campaign_id = $1::uuid`
  }
  const result = await pool.query(
    `${ledgerSelect} ${where} ORDER BY cl.started_at DESC NULLS LAST, cl.updated_at DESC`,
    params,
  )
  return result.rows as LedgerRow[]
}

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.get('/analytics/overview', async () => {
    const today = await pool.query(
      `SELECT
         COUNT(*)::int AS calls_today,
         COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS connected_today,
         COUNT(*) FILTER (WHERE state IN ('completed', 'analyzed'))::int AS completed_today,
         COALESCE(AVG(duration_sec) FILTER (WHERE duration_sec IS NOT NULL), 0) AS avg_duration
       FROM call_ledger
       WHERE started_at >= date_trunc('day', now())`,
    )

    const active = await pool.query(
      `SELECT COUNT(*)::int AS count FROM campaigns WHERE status = 'running'`,
    )

    const rows = await fetchLedgerRows()
    const byOutcome: Record<string, number> = {}
    for (const row of rows) {
      const mapped = mapCallLog(row)
      byOutcome[mapped.outcome] = (byOutcome[mapped.outcome] ?? 0) + 1
    }

    const stats = today.rows[0] ?? {}
    const callsToday = Number(stats.calls_today ?? 0)
    const connectedToday = Number(stats.connected_today ?? 0)
    const completedToday = Number(stats.completed_today ?? 0)

    return {
      activeCampaigns: Number(active.rows[0]?.count ?? 0),
      callsToday,
      connectRateToday: callsToday > 0 ? connectedToday / callsToday : 0,
      completionRateToday: callsToday > 0 ? completedToday / callsToday : 0,
      avgDurationSecToday: Number(stats.avg_duration ?? 0),
      byOutcome,
    }
  })

  app.get('/analytics/campaigns', async () => {
    const campaigns = await pool.query(
      `SELECT id::text, name FROM campaigns ORDER BY updated_at DESC`,
    )
    const stats = []
    for (const campaign of campaigns.rows) {
      stats.push(await buildCampaignStats(campaign.id as string, campaign.name as string))
    }
    return stats
  })

  app.get('/analytics/campaigns/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const campaign = await pool.query(`SELECT id::text, name FROM campaigns WHERE id = $1::uuid`, [
      id,
    ])
    if (!campaign.rows[0]) throw notFound('Campaign not found')
    return buildCampaignStats(id, campaign.rows[0].name as string)
  })

  app.get('/analytics/call-logs', async (request) => {
    const query = callLogsQuerySchema.parse(request.query)
    const rows = await fetchLedgerRows(query.campaignId)
    return rows.map(mapCallLog)
  })
}

async function buildCampaignStats(campaignId: string, campaignName: string) {
  const rows = await fetchLedgerRows(campaignId)
  const attempted = rows.length
  const connected = rows.filter((row) => row.answered_at).length
  const completed = rows.filter((row) => row.state === 'completed' || row.state === 'analyzed').length
  const failed = rows.filter((row) => deriveFailed(row)).length
  const skipped = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM contacts c
     INNER JOIN campaigns camp ON camp.contact_list_id = c.list_id
     WHERE camp.id = $1::uuid AND c.row_status != 'valid'`,
    [campaignId],
  )

  const durations = rows
    .map((row) => Number(row.duration_sec ?? 0))
    .filter((value) => value > 0)
  const avgDurationSec =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

  const ttfs = rows
    .map((row) => extractAvgLlmTtfs(row.latency_metrics))
    .filter((value): value is number => value != null && !Number.isNaN(value))
  const avgLlmTtfsMs =
    ttfs.length > 0 ? ttfs.reduce((a, b) => a + b, 0) / ttfs.length : undefined

  return {
    campaignId,
    campaignName,
    attempted,
    connected,
    completed,
    failed,
    skipped: Number(skipped.rows[0]?.count ?? 0),
    connectRate: attempted > 0 ? connected / attempted : 0,
    completionRate: attempted > 0 ? completed / attempted : 0,
    avgDurationSec,
    ...(avgLlmTtfsMs != null ? { avgLlmTtfsMs } : {}),
    timeSeries: buildTimeSeries(rows),
  }
}

function deriveFailed(row: LedgerRow) {
  return !row.answered_at && (row.state === 'completed' || row.state === 'analyzed')
}
