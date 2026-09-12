import { botComposeConfigured, config } from '../config.js'
import type { AddBotPayload } from '../mappers/agent-to-botcompose.js'

export async function addBot(payload: AddBotPayload): Promise<void> {
  if (!botComposeConfigured()) {
    throw new Error('BotCompose is not configured')
  }

  const url = new URL('/add_bot', config.botComposeBaseUrl!)
  url.searchParams.set('tenant_id', config.epicodeTenant!)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.botComposeBearerToken}`,
      'tenant-id': config.epicodeTenant!,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`BotCompose add_bot failed (${response.status}): ${body}`)
  }
}
