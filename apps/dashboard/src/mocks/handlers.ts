import { http, HttpResponse } from 'msw'

import {
  agentCreateSchema,
  agentUpdateSchema,
  campaignCreateSchema,
  type Agent,
  type Campaign,
  type Contact,
  type ContactList,
} from '@/types'
import {
  agents as seedAgents,
  analyticsOverview,
  callLogs as seedCallLogs,
  campaigns as seedCampaigns,
  campaignStats as seedCampaignStats,
  contactLists as seedLists,
  contacts as seedContacts,
  delay,
} from '@/mocks/fixtures'

let agentsStore: Agent[] = structuredClone(seedAgents)
let listsStore: ContactList[] = structuredClone(seedLists)
let contactsStore: Contact[] = structuredClone(seedContacts)
let campaignsStore: Campaign[] = structuredClone(seedCampaigns)

function notFound(message: string) {
  return HttpResponse.json({ message }, { status: 404 })
}

function badRequest(message: string) {
  return HttpResponse.json({ message }, { status: 400 })
}

function newId() {
  return crypto.randomUUID()
}

export const handlers = [
  http.get('/api/health', async () => {
    await delay()
    return HttpResponse.json({ ok: true, service: 'starling-dashboard-mocks' })
  }),

  // —— Agents ——
  http.get('/api/agents', async () => {
    await delay()
    return HttpResponse.json(agentsStore)
  }),

  http.get('/api/agents/:id', async ({ params }) => {
    await delay()
    const agent = agentsStore.find((a) => a.id === params.id)
    if (!agent) return notFound('Agent not found')
    return HttpResponse.json(agent)
  }),

  http.post('/api/agents', async ({ request }) => {
    await delay()
    const body = await request.json()
    const parsed = agentCreateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.message)
    const now = new Date().toISOString()
    const agent: Agent = {
      ...parsed.data,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    agentsStore = [agent, ...agentsStore]
    return HttpResponse.json(agent, { status: 201 })
  }),

  http.patch('/api/agents/:id', async ({ params, request }) => {
    await delay()
    const idx = agentsStore.findIndex((a) => a.id === params.id)
    if (idx < 0) return notFound('Agent not found')
    const body = await request.json()
    const parsed = agentUpdateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.message)
    const updated: Agent = {
      ...agentsStore[idx]!,
      ...parsed.data,
      stt: { ...agentsStore[idx]!.stt, ...parsed.data.stt },
      llm: { ...agentsStore[idx]!.llm, ...parsed.data.llm },
      tts: { ...agentsStore[idx]!.tts, ...parsed.data.tts },
      updatedAt: new Date().toISOString(),
    }
    agentsStore[idx] = updated
    return HttpResponse.json(updated)
  }),

  // —— Contact lists ——
  http.get('/api/contact-lists', async () => {
    await delay()
    return HttpResponse.json(listsStore)
  }),

  http.get('/api/contact-lists/:id', async ({ params }) => {
    await delay()
    const list = listsStore.find((l) => l.id === params.id)
    if (!list) return notFound('Contact list not found')
    return HttpResponse.json(list)
  }),

  http.get('/api/contact-lists/:id/contacts', async ({ params }) => {
    await delay()
    const rows = contactsStore.filter((c) => c.listId === params.id)
    return HttpResponse.json(rows)
  }),

  http.post('/api/contact-lists/upload', async ({ request }) => {
    await delay()
    const body = (await request.json()) as {
      name?: string
      sourceFilename?: string
      contacts?: Array<{
        phoneE164: string
        displayName?: string
        attributes?: Record<string, string | number | boolean>
      }>
    }
    if (!body.name || !Array.isArray(body.contacts)) {
      return badRequest('name and contacts are required')
    }
    const now = new Date().toISOString()
    const listId = newId()
    const columnSet = new Set<string>()
    for (const row of body.contacts) {
      if (row.attributes) {
        for (const key of Object.keys(row.attributes)) columnSet.add(key)
      }
    }
    const list: ContactList = {
      id: listId,
      name: body.name,
      status: 'processing',
      contactCount: body.contacts.length,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      columns: [...columnSet].sort(),
      sourceFilename: body.sourceFilename,
      uploadedAt: now,
      createdAt: now,
    }
    const rows: Contact[] = body.contacts.map((row) => ({
      id: crypto.randomUUID(),
      listId,
      phoneE164: row.phoneE164,
      displayName: row.displayName,
      status: 'valid',
      dndFlag: false,
      attributes: row.attributes ?? {},
      createdAt: now,
    }))
    listsStore = [list, ...listsStore]
    contactsStore = [...rows, ...contactsStore]
    return HttpResponse.json(list, { status: 201 })
  }),

  http.post('/api/contact-lists/:id/validate', async ({ params }) => {
    await delay()
    const idx = listsStore.findIndex((l) => l.id === params.id)
    if (idx < 0) return notFound('Contact list not found')
    const rows = contactsStore.filter((c) => c.listId === params.id)
    const seen = new Set<string>()
    let valid = 0
    let invalid = 0
    let duplicate = 0
    for (const row of rows) {
      const ok = /^\+91[6-9]\d{9}$/.test(row.phoneE164)
      if (!ok) {
        row.status = 'invalid_number'
        invalid += 1
        continue
      }
      if (seen.has(row.phoneE164)) {
        row.status = 'duplicate'
        duplicate += 1
        continue
      }
      seen.add(row.phoneE164)
      if (row.dndFlag) {
        row.status = 'dnd'
      } else {
        row.status = 'valid'
        valid += 1
      }
    }
    const updated: ContactList = {
      ...listsStore[idx]!,
      status: 'ready',
      contactCount: rows.length,
      validCount: valid,
      invalidCount: invalid,
      duplicateCount: duplicate,
    }
    listsStore[idx] = updated
    return HttpResponse.json({
      listId: updated.id,
      status: updated.status,
      contactCount: updated.contactCount,
      validCount: updated.validCount,
      invalidCount: updated.invalidCount,
      duplicateCount: updated.duplicateCount,
    })
  }),

  // —— Campaigns ——
  http.get('/api/campaigns', async () => {
    await delay()
    return HttpResponse.json(campaignsStore)
  }),

  http.get('/api/campaigns/:id', async ({ params }) => {
    await delay()
    const idx = campaignsStore.findIndex((c) => c.id === params.id)
    if (idx < 0) return notFound('Campaign not found')
    const campaign = campaignsStore[idx]!
    if (campaign.status === 'running') {
      const p = campaign.progress
      if (p.attempted < p.total) {
        const bump = Math.min(4, p.total - p.attempted)
        const connectedBump = Math.min(bump, Math.round(bump * 0.65))
        const completedBump = Math.min(connectedBump, Math.round(connectedBump * 0.82))
        const failedBump = bump - connectedBump
        const updated: Campaign = {
          ...campaign,
          progress: {
            ...p,
            attempted: p.attempted + bump,
            connected: p.connected + connectedBump,
            completed: p.completed + completedBump,
            failed: p.failed + failedBump,
          },
          updatedAt: new Date().toISOString(),
        }
        campaignsStore[idx] = updated
        return HttpResponse.json(updated)
      }
    }
    return HttpResponse.json(campaign)
  }),

  http.post('/api/campaigns', async ({ request }) => {
    await delay()
    const body = await request.json()
    const parsed = campaignCreateSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.message)
    const now = new Date().toISOString()
    const list = listsStore.find((l) => l.id === parsed.data.contactListId)
    const campaign: Campaign = {
      id: newId(),
      name: parsed.data.name,
      status: parsed.data.status ?? 'draft',
      agentId: parsed.data.agentId,
      contactListId: parsed.data.contactListId,
      iravoiceCampaignName: parsed.data.iravoiceCampaignName,
      pacing: parsed.data.pacing,
      callingWindow: parsed.data.callingWindow,
      progress: parsed.data.progress ?? {
        total: list?.validCount ?? list?.contactCount ?? 0,
        attempted: 0,
        connected: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      scheduledAt: parsed.data.scheduledAt ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    campaignsStore = [campaign, ...campaignsStore]
    return HttpResponse.json(campaign, { status: 201 })
  }),

  http.post('/api/campaigns/:id/start', async ({ params }) => {
    await delay()
    const idx = campaignsStore.findIndex((c) => c.id === params.id)
    if (idx < 0) return notFound('Campaign not found')
    const now = new Date().toISOString()
    const updated: Campaign = {
      ...campaignsStore[idx]!,
      status: 'running',
      startedAt: campaignsStore[idx]!.startedAt ?? now,
      updatedAt: now,
    }
    campaignsStore[idx] = updated
    return HttpResponse.json(updated)
  }),

  http.post('/api/campaigns/:id/pause', async ({ params }) => {
    await delay()
    const idx = campaignsStore.findIndex((c) => c.id === params.id)
    if (idx < 0) return notFound('Campaign not found')
    const updated: Campaign = {
      ...campaignsStore[idx]!,
      status: 'paused',
      updatedAt: new Date().toISOString(),
    }
    campaignsStore[idx] = updated
    return HttpResponse.json(updated)
  }),

  http.post('/api/campaigns/:id/stop', async ({ params }) => {
    await delay()
    const idx = campaignsStore.findIndex((c) => c.id === params.id)
    if (idx < 0) return notFound('Campaign not found')
    const now = new Date().toISOString()
    const updated: Campaign = {
      ...campaignsStore[idx]!,
      status: 'stopped',
      completedAt: now,
      updatedAt: now,
    }
    campaignsStore[idx] = updated
    return HttpResponse.json(updated)
  }),

  // —— Analytics ——
  http.get('/api/analytics/overview', async () => {
    await delay()
    return HttpResponse.json(analyticsOverview)
  }),

  http.get('/api/analytics/campaigns', async () => {
    await delay()
    return HttpResponse.json(seedCampaignStats)
  }),

  http.get('/api/analytics/campaigns/:id', async ({ params }) => {
    await delay()
    const stats = seedCampaignStats.find((s) => s.campaignId === params.id)
    if (!stats) return notFound('Campaign stats not found')
    return HttpResponse.json(stats)
  }),

  http.get('/api/analytics/call-logs', async ({ request }) => {
    await delay()
    const url = new URL(request.url)
    const campaignId = url.searchParams.get('campaignId')
    const rows = campaignId
      ? seedCallLogs.filter((l) => l.campaignId === campaignId)
      : seedCallLogs
    return HttpResponse.json(rows)
  }),
]
