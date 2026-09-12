# Frontend API contract

The Starling dashboard (`apps/dashboard`) talks to a single JSON REST API. All paths below are relative to **`VITE_API_BASE_URL`** (default `/api`).

**Phase 1F:** Campaign + analytics routes are implemented in `apps/api`. The dashboard defaults to **`VITE_USE_MOCKS=false`** with a Vite dev proxy (`/api` → `http://127.0.0.1:3000`).

## Mock vs real backend

| `VITE_USE_MOCKS` | Behaviour |
|---|---|
| `true` | MSW starts in `src/main.tsx` and intercepts matching `/api/*` requests. Unhandled requests pass through (`onUnhandledRequest: 'bypass'`). |
| `false` or unset | MSW is **not** loaded. Every `api.get/post/patch` call goes directly to `VITE_API_BASE_URL`. |

Set both variables in `.env.development`, `.env.production`, or the shell:

```bash
VITE_USE_MOCKS=false
VITE_API_BASE_URL=/api
```

The client (`src/api/client.ts`) builds URLs as `new URL(\`${base}${path}\`)`. Absolute bases (e.g. `https://host/v1`) work; relative bases (e.g. `/api`) resolve against the page origin.

In local dev with mocks off, `vite.config.ts` proxies `/api` to the Fastify API on port 3000.

### Errors

Non-2xx responses should return JSON:

```json
{ "message": "Human-readable error" }
```

The client throws `ApiError` with `status` and `message`.

---

## Health

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ "ok": true, "service": "starling-api" }` |

Not called by the UI yet; useful for liveness checks.

---

## Agents

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/agents` | — | `Agent[]` |
| GET | `/agents/:id` | — | `Agent` |
| POST | `/agents` | `AgentCreate` | `Agent` (201) |
| PATCH | `/agents/:id` | `AgentUpdate` (partial) | `Agent` |
| POST | `/agents/:id/activate` | — | `Agent` |

**`Agent`** (see `src/types/agent.ts`): `id`, `name`, `description`, `status` (`draft` \| `active` \| `archived`), `language`, `voiceEngine`, welcome/prompt fields, nested `llm`, `stt`, `tts`, `telephonyProvider` (`epicode`), `interruptWordCount` (fixed `3`), engine/calling/tools/extraction fields, `createdAt`, `updatedAt`. Builtin tools align with BotCompose `builtin_tools` / `webhook_tools`.

**`AgentCreate`**: same without `id`, `createdAt`, `updatedAt`.

**Backend note:** `POST /agents/:id/activate` registers the agent on BotCompose and sets `botcompose_bot_id`. The dashboard currently sets `status: "active"` via `PATCH` only and **does not call activate**. Campaign start requires `status === "active"` **and** a non-null `botcompose_bot_id` in the database.

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

**Backend note:** Invalid numbers are stored with a placeholder E.164 in Postgres; the API returns the original raw value in `phoneE164` for `invalid_number` rows. Internal `_rawPhone` is stripped from `attributes` in API responses.

---

## Campaigns

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/campaigns` | — | `Campaign[]` |
| GET | `/campaigns/:id` | — | `Campaign` (includes `progress`) |
| POST | `/campaigns` | `CampaignCreate` | `Campaign` (201) |
| POST | `/campaigns/:id/start` | — | `Campaign` |
| POST | `/campaigns/:id/pause` | — | `Campaign` |
| POST | `/campaigns/:id/stop` | — | `Campaign` |

**`Campaign`**: `id`, `name`, `status` (`draft` \| `scheduled` \| `running` \| `paused` \| `completed` \| `stopped`), `agentId`, `contactListId`, `iravoiceCampaignName`, `pacing`, `callingWindow`, `progress`, `scheduledAt`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`.

**`pacing`**: `maxConcurrent`, `targetCps`, `maxAttempts`, `dialTimeoutSec`, `retryDelayMinutes`, `retryOn` (`no_answer` \| `busy` \| `failed`[]).

**`callingWindow`**: `timezone`, `startLocal`, `endLocal` (HH:mm), `workingHours?` (HHMM-HHMM), `daysOfWeek` (0–6).

**`progress`**: `total`, `attempted`, `connected`, `completed`, `failed`, `skipped` — computed from `dial_jobs`, `call_ledger`, and non-valid contacts on every GET.

**`CampaignCreate`**: `name`, `agentId`, `contactListId`, `iravoiceCampaignName`, `pacing`, `callingWindow`, optional `scheduledAt`, optional `status`, optional `progress`.

### Campaign control semantics

| Action | Behaviour |
|---|---|
| **Start** | Validates agent is `active` with `botcompose_bot_id`; validates `iravoiceCampaignName`; expands valid contacts into `dial_jobs` (once, skipping invalid/duplicate/dnd); sets `status=running`. |
| **Pause** | Sets `status=paused`. IraVoice has no pause API — Flock stops claiming new jobs; in-flight calls continue. |
| **Stop** | Calls IraVoice `dropcall` for in-flight `call_uuid`s (when IraVoice env is configured); fails pending/claimed `dial_jobs`; sets `status=stopped`. |

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

### Analytics data sources

| Field | Source |
|---|---|
| Call counts, outcomes, duration | `call_ledger` |
| `transcript` | `cdrs.transcript` (optional; omitted when empty) |
| `avgLlmTtfsMs` | `cdrs.latency_metrics.llm.ttfs_mean_ms` (optional; omitted when no CDR metrics) |
| `timeSeries` | 24 UTC-hour buckets for **today** from `call_ledger.started_at` (differs from MSW fixture dates) |
| `byOutcome` on overview | All-time ledger rows (MSW used a fixed fixture subset) |

**`CallLog.id`**: prefers `dial_job_id`; falls back to `call_uuid` if UUID-shaped; otherwise a deterministic UUID derived from `call_uuid`.

---

## Endpoint summary table

| Method | Path | Used by |
|---|---|---|
| GET | `/health` | Ops / liveness |
| GET | `/agents` | Agents list, campaign wizard |
| GET | `/agents/:id` | Agent builder |
| POST | `/agents` | Agent builder (create) |
| PATCH | `/agents/:id` | Agent builder (update) |
| POST | `/agents/:id/activate` | Not wired in UI yet |
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

## UI fields the backend does not yet provide

| UI expectation | Status |
|---|---|
| `POST /agents/:id/activate` from agent builder | API exists; **dashboard not wired** — use activate (or set `botcompose_bot_id` manually) before campaign start |
| Rich fixture data when DB is empty | Real API returns `[]` / zero metrics until data exists |
| `transcript` on every call log | Only when BotCompose CDR webhook has populated `cdrs.transcript` |
| `avgLlmTtfsMs` on campaign stats | Only when `cdrs.latency_metrics` has LLM TTFS data |
| Remote dropcall on campaign stop | Only when `IRAVOICE_BASE_URL`, `IRAVOICE_BEARER_TOKEN`, and `EPICODE_TENANT` are set |
| `campaign.status === "completed"` auto-transition | Flock/ledger does not yet flip campaign to `completed` when all jobs finish |
| India mobile validation on upload | Validation runs on `POST /contact-lists/:id/validate` (same as MSW) |

Types are the source of truth for the UI: `apps/dashboard/src/types/*.ts` (Zod schemas).
