import cors from '@fastify/cors'
import Fastify from 'fastify'

import { config } from './config.js'
import { pool } from './db.js'
import { registerErrorHandler } from './errors.js'
import { registerAgentRoutes } from './routes/agents.js'
import { registerAnalyticsRoutes } from './routes/analytics.js'
import { registerCampaignRoutes } from './routes/campaigns.js'
import { registerContactListRoutes } from './routes/contact-lists.js'

const app = Fastify({ logger: true })

registerErrorHandler(app)

await app.register(cors, {
  origin: config.corsOrigin,
})

await app.register(
  async (api) => {
    api.get('/health', async () => ({ ok: true, service: 'starling-api' }))
    await registerAgentRoutes(api)
    await registerContactListRoutes(api)
    await registerCampaignRoutes(api)
    await registerAnalyticsRoutes(api)
  },
  { prefix: '/api' },
)

const shutdown = async () => {
  await app.close()
  await pool.end()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

try {
  await app.listen({ port: config.port, host: config.host })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
