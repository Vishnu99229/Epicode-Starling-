import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { pool, withTransaction } from '../db.js'
import { badRequest, notFound, serviceUnavailable } from '../errors.js'
import { isConfigured as isIraVoiceConfigured } from '../lib/iravoice-config.js'
import { computeCampaignProgress } from '../lib/progress.js'
import { resolveTenantId } from '../lib/tenant.js'
import { campaignInsertPayload, mapCampaign, type CampaignRow } from '../mappers/campaigns.js'
import { campaignCreateSchema } from '../schemas/campaigns.js'
import { dropCalls } from '../services/iravoice.js'

const idParamsSchema = z.object({
  id: z.string().uuid(),
})

const campaignSelect = `
  SELECT id::text, name, status, agent_id::text, contact_list_id::text,
         iravoice_campaign_name, pacing, calling_window,
         scheduled_at, started_at, completed_at, created_at, updated_at
  FROM campaigns
`

async function fetchCampaignRow(id: string) {
  const result = await pool.query(`${campaignSelect} WHERE id = $1::uuid`, [id])
  return (result.rows[0] as CampaignRow | undefined) ?? null
}

async function mapCampaignWithProgress(row: CampaignRow) {
  const progress = await computeCampaignProgress(pool, row.id, row.contact_list_id)
  return mapCampaign(row, progress)
}

export async function registerCampaignRoutes(app: FastifyInstance) {
  app.get('/campaigns', async () => {
    const result = await pool.query(`${campaignSelect} ORDER BY updated_at DESC`)
    const rows = result.rows as CampaignRow[]
    return Promise.all(rows.map((row) => mapCampaignWithProgress(row)))
  })

  app.get('/campaigns/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const row = await fetchCampaignRow(id)
    if (!row) throw notFound('Campaign not found')
    return mapCampaignWithProgress(row)
  })

  app.post('/campaigns', async (request, reply) => {
    const body = campaignCreateSchema.parse(request.body)
    const payload = campaignInsertPayload(body)
    const tenantId = await resolveTenantId(pool)

    const list = await pool.query(
      `SELECT id, valid_count FROM contact_lists WHERE id = $1::uuid`,
      [payload.contactListId],
    )
    if (!list.rows[0]) throw badRequest('Contact list not found')

    const agent = await pool.query(`SELECT id FROM agents WHERE id = $1::uuid`, [
      payload.agentId,
    ])
    if (!agent.rows[0]) throw badRequest('Agent not found')

    const result = await pool.query(
      `INSERT INTO campaigns (
         tenant_id, name, status, agent_id, contact_list_id,
         iravoice_campaign_name, pacing, calling_window, scheduled_at
       ) VALUES (
         $1::uuid, $2, $3, $4::uuid, $5::uuid,
         $6, $7::jsonb, $8::jsonb, $9
       )
       RETURNING id::text, name, status, agent_id::text, contact_list_id::text,
                 iravoice_campaign_name, pacing, calling_window,
                 scheduled_at, started_at, completed_at, created_at, updated_at`,
      [
        tenantId,
        payload.name,
        payload.status,
        payload.agentId,
        payload.contactListId,
        payload.iravoiceCampaignName,
        JSON.stringify(payload.pacing),
        JSON.stringify(payload.callingWindow),
        payload.scheduledAt,
      ],
    )

    const row = result.rows[0] as CampaignRow
    const listRow = list.rows[0]
    const skippedResult = await pool.query(
      `SELECT COUNT(*)::int AS skipped
       FROM contacts
       WHERE list_id = $1::uuid AND row_status != 'valid'`,
      [payload.contactListId],
    )
    const progress = {
      total: Number(listRow.valid_count ?? 0) + Number(skippedResult.rows[0]?.skipped ?? 0),
      attempted: 0,
      connected: 0,
      completed: 0,
      failed: 0,
      skipped: Number(skippedResult.rows[0]?.skipped ?? 0),
    }
    return reply.status(201).send(mapCampaign(row, progress))
  })

  app.post('/campaigns/:id/start', async (request) => {
    const { id } = idParamsSchema.parse(request.params)

    if (!isIraVoiceConfigured()) {
      throw serviceUnavailable('IraVoice env not configured — cannot start campaigns')
    }

    return withTransaction(async (client) => {
      const campaignResult = await client.query(`${campaignSelect} WHERE id = $1::uuid`, [id])
      const row = campaignResult.rows[0] as CampaignRow | undefined
      if (!row) throw notFound('Campaign not found')

      if (!row.agent_id) throw badRequest('Campaign has no agent')
      if (!row.contact_list_id) throw badRequest('Campaign has no contact list')
      if (!row.iravoice_campaign_name?.trim()) {
        throw badRequest('iravoiceCampaignName is required before starting')
      }

      const agentResult = await client.query(
        `SELECT id::text, status, botcompose_bot_id
         FROM agents WHERE id = $1::uuid`,
        [row.agent_id],
      )
      const agent = agentResult.rows[0]
      if (!agent) throw badRequest('Agent not found')
      if (agent.status !== 'active') {
        throw badRequest('Agent must be active before starting a campaign')
      }
      if (!agent.botcompose_bot_id) {
        throw badRequest('Agent must be activated on BotCompose (botcompose_bot_id missing)')
      }

      const contacts = await client.query(
        `SELECT id::text
         FROM contacts
         WHERE list_id = $1::uuid AND row_status = 'valid'`,
        [row.contact_list_id],
      )

      const existingJobs = await client.query(
        `SELECT COUNT(*)::int AS count FROM dial_jobs WHERE campaign_id = $1::uuid`,
        [id],
      )
      if (Number(existingJobs.rows[0]?.count ?? 0) === 0) {
        for (const contact of contacts.rows) {
          await client.query(
            `INSERT INTO dial_jobs (campaign_id, contact_id, attempt_no, state)
             VALUES ($1::uuid, $2::uuid, 1, 'pending')`,
            [id, contact.id],
          )
        }
      }

      const updated = await client.query(
        `UPDATE campaigns
         SET status = 'running',
             started_at = COALESCE(started_at, now()),
             updated_at = now()
         WHERE id = $1::uuid
         RETURNING id::text, name, status, agent_id::text, contact_list_id::text,
                   iravoice_campaign_name, pacing, calling_window,
                   scheduled_at, started_at, completed_at, created_at, updated_at`,
        [id],
      )

      const updatedRow = updated.rows[0] as CampaignRow
      const progress = await computeCampaignProgress(client, id, updatedRow.contact_list_id)
      return mapCampaign(updatedRow, progress)
    })
  })

  // IraVoice has no "pause campaign" API — pause means Flock stops claiming jobs.
  // In-flight calls continue until they hang up naturally.
  app.post('/campaigns/:id/pause', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const result = await pool.query(
      `UPDATE campaigns
       SET status = 'paused', updated_at = now()
       WHERE id = $1::uuid
       RETURNING id::text, name, status, agent_id::text, contact_list_id::text,
                 iravoice_campaign_name, pacing, calling_window,
                 scheduled_at, started_at, completed_at, created_at, updated_at`,
      [id],
    )
    if (!result.rows[0]) throw notFound('Campaign not found')
    const row = result.rows[0] as CampaignRow
    const progress = await computeCampaignProgress(pool, id, row.contact_list_id)
    return mapCampaign(row, progress)
  })

  app.post('/campaigns/:id/stop', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const iraVoiceReady = isIraVoiceConfigured()

    const inFlight = await pool.query(
      `SELECT call_uuid
       FROM call_ledger
       WHERE campaign_id = $1::uuid
         AND state IN ('dialing', 'ringing', 'in_progress')`,
      [id],
    )
    const callUuids = inFlight.rows
      .map((row) => row.call_uuid as string)
      .filter(Boolean)

    if (callUuids.length > 0 && iraVoiceReady) {
      await dropCalls(callUuids)
    }

    await pool.query(
      `UPDATE dial_jobs
       SET state = 'failed', claimed_at = NULL
       WHERE campaign_id = $1::uuid AND state IN ('pending', 'claimed')`,
      [id],
    )

    const result = await pool.query(
      `UPDATE campaigns
       SET status = 'stopped',
           completed_at = now(),
           updated_at = now()
       WHERE id = $1::uuid
       RETURNING id::text, name, status, agent_id::text, contact_list_id::text,
                 iravoice_campaign_name, pacing, calling_window,
                 scheduled_at, started_at, completed_at, created_at, updated_at`,
      [id],
    )
    if (!result.rows[0]) throw notFound('Campaign not found')
    const row = result.rows[0] as CampaignRow
    const progress = await computeCampaignProgress(pool, id, row.contact_list_id)
    const campaign = mapCampaign(row, progress)

    if (!iraVoiceReady) {
      return {
        ...campaign,
        warning: 'IraVoice env not configured — in-flight calls were NOT dropped',
      }
    }

    return campaign
  })
}
