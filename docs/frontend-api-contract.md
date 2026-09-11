# Frontend API contract

The Starling dashboard (`apps/dashboard`) talks to a single JSON REST API. All paths below are relative to **`VITE_API_BASE_URL`** (default `/api`).

## Mock vs real backend

| `VITE_USE_MOCKS` | Behaviour |
|---|---|
| `true` | MSW starts in `src/main.tsx` and intercepts matching `/api/*` requests. Unhandled requests pass through (`onUnhandledRequest: 'bypass'`). |
| `false` or unset | MSW is **not** loaded. Every `api.get/post/patch` call goes directly to `VITE_API_BASE_URL`. |

Set both variables in `.env.development`, `.env.production`, or the shell:

```bash
VITE_USE_MOCKS=false
VITE_API_BASE_URL=https://api.example.com/v1
```

The client (`src/api/client.ts`) builds URLs as `new URL(\`${base}${path}\`)`. Absolute bases (e.g. `https://host/v1`) work; relative bases (e.g. `/api`) resolve against the page origin.

### Errors

Non-2xx responses should return JSON:

```json
{ "message": "Human-readable error" }
```

The client throws `ApiError` with `status` and `message`.

---

## Health (MSW only today)

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ "ok": true, "service": string }` |

Not called by the UI yet; useful for backend liveness.

---

## Agents

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/agents` | — | `Agent[]` |
| GET | `/agents/:id` | — | `Agent` |
| POST | `/agents` | `AgentCreate` | `Agent` (201) |
| PATCH | `/agents/:id` | `AgentUpdate` (partial) | `Agent` |

**`Agent`** (see `src/types/agent.ts`): `id`, `name`, `description`, `status` (`draft` \| `active` \| `archived`), `language`, `voiceEngine`, welcome/prompt fields, nested `llm`, `stt`, `tts`, `telephonyProvider` (`epicode`), `interruptWordCount` (fixed `3`), engine/calling/tools/extraction fields, `createdAt`, `updatedAt`. Builtin tools align with BotCompose `builtin_tools` / `webhook_tools`.

**`AgentCreate`**: same without `id`, `createdAt`, `updatedAt`.

---

## Contact lists

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/contact-lists` | — | `ContactList[]` |
| GET | `/contact-lists/:id` | — | `ContactList` |
| GET | `/contact-lists/:id/contacts` | — | `Contact[]` |
| POST | `/contact-lists/upload` | see below | `ContactList` (201) |
| POST | `/contact-lists/:id/validate` | — | `ContactListValidateResult` |

**Upload body**

```json
{
  "name": "string",
  "sourceFilename": "string (optional)",
  "contacts": [
    {
      "phoneE164": "+919876543210",
      "displayName": "string (optional)",
      "attributes": { "city": "Pune", "loanAmount": 120000 }
    }
  ]
}
```

**`ContactList`**: `id`, `name`, `status` (`ready` \| `processing` \| `failed`), `contactCount`, `validCount`, `invalidCount`, `duplicateCount`, `columns` (string[] attribute keys), `sourceFilename?`, `uploadedAt`, `createdAt`.

**`Contact`**: `id`, `listId`, `phoneE164` (E.164), `displayName?`, `status` (`valid` \| `invalid_number` \| `duplicate` \| `dnd`), `dndFlag`, `attributes`, `createdAt`.

**`ContactListValidateResult`**: `listId`, `status`, `contactCount`, `validCount`, `invalidCount`, `duplicateCount`.

---

## Campaigns

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/campaigns` | — | `Campaign[]` |
| GET | `/campaigns/:id` | — | `Campaign` |
| POST | `/campaigns` | `CampaignCreate` | `Campaign` (201) |
| POST | `/campaigns/:id/start` | — | `Campaign` |
| POST | `/campaigns/:id/pause` | — | `Campaign` |
| POST | `/campaigns/:id/stop` | — | `Campaign` |

**`Campaign`**: `id`, `name`, `status` (`draft` \| `scheduled` \| `running` \| `paused` \| `completed` \| `stopped`), `agentId`, `contactListId`, `iravoiceCampaignName`, `pacing`, `callingWindow`, `progress`, `scheduledAt`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`.

**`pacing`**: `maxConcurrent`, `targetCps`, `maxAttempts`, `dialTimeoutSec`, `retryDelayMinutes`, `retryOn` (`no_answer` \| `busy` \| `failed`[]).

**`callingWindow`**: `timezone`, `startLocal`, `endLocal` (HH:mm), `workingHours?` (HHMM-HHMM), `daysOfWeek` (0–6).

**`progress`**: `total`, `attempted`, `connected`, `completed`, `failed`, `skipped`.

**`CampaignCreate`**: `name`, `agentId`, `contactListId`, `iravoiceCampaignName`, `pacing`, `callingWindow`, optional `scheduledAt`, optional `status`, optional `progress`.

Running campaigns: UI polls `GET /campaigns/:id` every 5s.

---

## Analytics

| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/analytics/overview` | — | `AnalyticsOverview` |
| GET | `/analytics/campaigns` | — | `CampaignStats[]` |
| GET | `/analytics/campaigns/:id` | — | `CampaignStats` |
| GET | `/analytics/call-logs` | `campaignId?` | `CallLog[]` |

**`AnalyticsOverview`**: `activeCampaigns`, `callsToday`, `connectRateToday`, `completionRateToday`, `avgDurationSecToday`, `byOutcome` (record of outcome → count).

**`CampaignStats`**: `campaignId`, `campaignName`, aggregate counts, `connectRate`, `completionRate`, `avgDurationSec`, `avgLlmTtfsMs?`, `timeSeries` (24 points: `ts`, `attempted`, `connected`, `completed`, `failed`).

**`CallLog`**: `id`, `campaignId`, `contactId?`, `callUuid?`, `phoneE164`, `displayName?`, `attempt`, `outcome`, `durationSec`, `errorReason?`, `startedAt`, `endedAt?`, `transcript?`.

---

## Endpoint summary table

| Method | Path | Used by |
|---|---|---|
| GET | `/agents` | Agents list, campaign wizard |
| GET | `/agents/:id` | Agent builder |
| POST | `/agents` | Agent builder (create) |
| PATCH | `/agents/:id` | Agent builder (update) |
| GET | `/contact-lists` | Contacts list, campaign wizard, detail joins |
| GET | `/contact-lists/:id` | Contact list detail |
| GET | `/contact-lists/:id/contacts` | Contact list detail |
| POST | `/contact-lists/upload` | Contact upload wizard |
| POST | `/contact-lists/:id/validate` | Post-upload validation |
| GET | `/campaigns` | Campaigns list, analytics filter |
| GET | `/campaigns/:id` | Campaign detail (polled when running) |
| POST | `/campaigns` | Campaign wizard |
| POST | `/campaigns/:id/start` | Campaign detail |
| POST | `/campaigns/:id/pause` | Campaign detail |
| POST | `/campaigns/:id/stop` | Campaign detail |
| GET | `/analytics/overview` | Analytics overview |
| GET | `/analytics/campaigns` | Analytics “all campaigns” time series |
| GET | `/analytics/campaigns/:id` | Analytics per-campaign view |
| GET | `/analytics/call-logs` | Analytics, campaign detail, call logs page |

---

## Backend gaps vs a minimal API

The UI expects the shapes above. If your backend predates this dashboard, implement or align:

1. **`completionRateToday`** on `/analytics/overview` (0–1).
2. **`GET /analytics/campaigns`** — list of `CampaignStats` (not only per-id).
3. **`columns`** on `ContactList` — attribute keys for dynamic table columns.
4. **`transcript`** (optional) on `CallLog` — for expandable rows on `/analytics/calls`.
5. **Extended `campaign.pacing`** — `dialTimeoutSec`, `retryDelayMinutes`, `retryOn[]`.
6. **`callingWindow.workingHours`** — `HHMM-HHMM` string (UI also sends `startLocal` / `endLocal`).
7. **`telephonyProvider: "epicode"`** on agents (enum locked in schema).
8. **India mobile validation** on contact validate — MSW uses `/^\+91[6-9]\d{9}$/`; upload accepts any E.164 until validate runs.
9. **Campaign progress updates** while `status === "running"` — detail view polls and expects changing `progress` counts.

Types are the source of truth: `src/types/*.ts` (Zod schemas).
