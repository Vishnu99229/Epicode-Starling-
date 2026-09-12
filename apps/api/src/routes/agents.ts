import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { botComposeConfigured } from '../config.js'
import { pool } from '../db.js'
import { notFound, notImplemented } from '../errors.js'
import {
  agentConfigFromCreate,
  botIdForAgent,
  mapAgent,
  mergeAgentUpdate,
} from '../mappers/agents.js'
import { toAddBotPayload } from '../mappers/agent-to-botcompose.js'
import { agentCreateSchema, agentUpdateSchema } from '../schemas/agents.js'
import { addBot } from '../services/botcompose.js'

const idParamsSchema = z.object({
  id: z.string().uuid(),
})

async function fetchAgentRow(id: string) {
  const result = await pool.query(
    `SELECT id, name, description, status, config, botcompose_bot_id, created_at, updated_at
     FROM agents
     WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function registerAgentRoutes(app: FastifyInstance) {
  app.get('/agents', async () => {
    const result = await pool.query(
      `SELECT id, name, description, status, config, botcompose_bot_id, created_at, updated_at
       FROM agents
       ORDER BY updated_at DESC`,
    )
    return result.rows.map(mapAgent)
  })

  app.get('/agents/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const row = await fetchAgentRow(id)
    if (!row) throw notFound('Agent not found')
    return mapAgent(row)
  })

  app.post('/agents', async (request, reply) => {
    const body = agentCreateSchema.parse(request.body)
    const now = new Date()
    const configJson = agentConfigFromCreate(body)

    const result = await pool.query(
      `INSERT INTO agents (name, description, status, config)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name, description, status, config, botcompose_bot_id, created_at, updated_at`,
      [body.name, body.description, body.status ?? 'draft', JSON.stringify(configJson)],
    )

    return reply.status(201).send(mapAgent(result.rows[0]))
  })

  app.patch('/agents/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params)
    const patch = agentUpdateSchema.parse(request.body)

    const existingRow = await fetchAgentRow(id)
    if (!existingRow) throw notFound('Agent not found')

    const existing = mapAgent(existingRow)
    const merged = mergeAgentUpdate(existing, patch)
    agentCreateSchema.parse(merged)

    const result = await pool.query(
      `UPDATE agents
       SET name = $2,
           description = $3,
           status = $4,
           config = $5::jsonb,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, status, config, botcompose_bot_id, created_at, updated_at`,
      [
        id,
        merged.name,
        merged.description,
        merged.status,
        JSON.stringify(agentConfigFromCreate(merged)),
      ],
    )

    return mapAgent(result.rows[0])
  })

  app.post('/agents/:id/activate', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    if (!botComposeConfigured()) {
      throw notImplemented(
        'BotCompose is not configured. Set BOTCOMPOSE_BASE_URL, BOTCOMPOSE_BEARER_TOKEN, and EPICODE_TENANT.',
      )
    }

    const row = await fetchAgentRow(id)
    if (!row) throw notFound('Agent not found')

    const agent = mapAgent(row)
    const { payload, unmapped } = toAddBotPayload(agent, row.botcompose_bot_id)

    request.log.info({ agentId: id, unmapped }, 'Agent → BotCompose unmapped fields')

    await addBot(payload)

    const botId = botIdForAgent(agent.id, row.botcompose_bot_id)

    const result = await pool.query(
      `UPDATE agents
       SET status = 'active',
           botcompose_bot_id = $2,
           updated_at = now()
       WHERE id = $1
       RETURNING id, name, description, status, config, botcompose_bot_id, created_at, updated_at`,
      [id, botId],
    )

    return reply.send(mapAgent(result.rows[0]))
  })
}
