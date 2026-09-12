# Database ↔ UI type gap analysis

**Source of truth:** `apps/dashboard/src/types/*.ts` (Zod schemas)  
**Baseline schema:** `db/migrations/000001_init.up.sql` (Phase 0)  
**Target schema:** `db/migrations/000002_ui_aligned_schema.up.sql`

Legend: **match** = column aligns with UI field · **mismatch** = same concept, wrong shape/name · **missing** = no column/table · **derived** = computed at read time, not stored · **jsonb** = nested UI object stored in JSONB

---

## Summary (Phase 0 → UI-aligned)

| Area | Phase 0 (`000001`) | Gap | Resolution (`000002`) |
|------|-------------------|-----|------------------------|
| Agents | `bot_versions` per campaign | Independent `agents` table missing | New `agents` table |
| Contact lists | None | Lists not first-class | New `contact_lists` table |
| Contacts | `contacts.campaign_id` | Tied to campaign, not list | New `contacts.list_id` |
| Campaigns | `bot_id`, `schedule` | Uses `agentId`, `contactListId`, `iravoiceCampaignName` | Alter `campaigns` |
| Dial queue | None | No job queue table | New `dial_jobs` table |
| Call ledger | `id` PK, `dedupe_key`, `outcome` | Different telephony shape | Replace `call_ledger` |
| CDRs | `raw_json`, scalar metrics | BotCompose transcript/metrics blobs | Replace `cdrs` |
| Analytics | None | All read models | Derived from ledger + CDRs |

---

## `Agent` (`types/agent.ts`)

| UI field | Phase 0 DB | Status | Target (`agents`) |
|----------|------------|--------|-------------------|
| `id` | — | missing | `agents.id` UUID PK |
| `name` | — (only in `add_bot_payload`) | missing | `agents.name` |
| `description` | — | missing | `agents.description` |
| `status` | — | missing | `agents.status` (`agent_status` enum) |
| `language` | — | missing | `agents.config` jsonb |
| `voiceEngine` | — | missing | `agents.config` jsonb |
| `welcomeMessage` | — | missing | `agents.config` jsonb |
| `ignoreSpeechBeforeWelcome` | — | missing | `agents.config` jsonb |
| `welcomeDelayMs` | — | missing | `agents.config` jsonb |
| `instructions` | — | missing | `agents.config` jsonb |
| `llm` (nested) | — | missing | `agents.config` jsonb |
| `stt` (nested) | — | missing | `agents.config` jsonb |
| `tts` (nested) | — | missing | `agents.config` jsonb |
| `telephonyProvider` | — | missing | `agents.config` jsonb |
| `voicemailDetectionEnabled` | — | missing | `agents.config` jsonb |
| `voicemailDetectionSec` | — | missing | `agents.config` jsonb |
| `autoReschedule` | — | missing | `agents.config` jsonb |
| `inboundCallingEnabled` | — | missing | `agents.config` jsonb |
| `outboundTimingEnabled` | — | missing | `agents.config` jsonb |
| `outboundTimingStart` | — | missing | `agents.config` jsonb |
| `outboundTimingEnd` | — | missing | `agents.config` jsonb |
| `outboundDaysOfWeek` | — | missing | `agents.config` jsonb |
| `interruptWordCount` | — | missing | `agents.config` jsonb |
| `botInactivityEnabled` | — | missing | `agents.config` jsonb |
| `botInactivityLimitSec` | — | missing | `agents.config` jsonb |
| `totalCallTimeoutSec` | — | missing | `agents.config` jsonb |
| `tools` | — | missing | `agents.config` jsonb |
| `webhookUrl` | — | missing | `agents.config` jsonb |
| `webhookTriggerStatuses` | — | missing | `agents.config` jsonb |
| `webhookHeadersEnabled` | — | missing | `agents.config` jsonb |
| `webhookHeaders` | — | missing | `agents.config` jsonb |
| `callSummary` | — | missing | `agents.config` jsonb |
| `extractionCategories` | — | missing | `agents.config` jsonb |
| `createdAt` | — | missing | `agents.created_at` |
| `updatedAt` | — | missing | `agents.updated_at` |
| BotCompose `bot_id` | `campaigns.bot_id` | mismatch | `agents.botcompose_bot_id` |
| Full deploy payload | `bot_versions.add_bot_payload` | mismatch | Built from `agents` row at activate time |

**Phase 0 only:** `bot_versions` (campaign-scoped, versioned) — **dropped** in `000002`; versioning not in UI yet.

**Storage note:** `agents.config` holds the Agent object minus `id`, `name`, `description`, `status`, `createdAt`, `updatedAt`. API layer merges columns + config into the Zod `Agent` shape.

---

## `ContactList` (`types/contact.ts`)

| UI field | Phase 0 DB | Status | Target (`contact_lists`) |
|----------|------------|--------|--------------------------|
| `id` | — | missing | `contact_lists.id` |
| `name` | — | missing | `contact_lists.name` |
| `status` | — | missing | `contact_lists.status` (`contact_list_status`) |
| `contactCount` | — | missing | `contact_lists.contact_count` |
| `validCount` | — | missing | `contact_lists.valid_count` |
| `invalidCount` | — | missing | `contact_lists.invalid_count` |
| `duplicateCount` | — | missing | `contact_lists.duplicate_count` |
| `columns` | — | missing | `contact_lists.columns` text[] |
| `sourceFilename` | — | missing | `contact_lists.source_filename` |
| `uploadedAt` | — | missing | `contact_lists.uploaded_at` |
| `createdAt` | — | missing | `contact_lists.created_at` |

---

## `Contact` (`types/contact.ts`)

| UI field | Phase 0 DB | Status | Target (`contacts`) |
|----------|------------|--------|---------------------|
| `id` | `contacts.id` | match | `contacts.id` |
| `listId` | `contacts.campaign_id` | mismatch | `contacts.list_id` FK |
| `phoneE164` | `contacts.phone_e164` | match | `contacts.phone_number` |
| `displayName` | — | missing | `contacts.name` |
| `status` | — (only `dnd_flag`) | mismatch | `contacts.row_status` enum |
| `dndFlag` | `contacts.dnd_flag` | mismatch | **derived** from `row_status = 'dnd'` |
| `attributes` | `contacts.macro_fields` | mismatch | `contacts.attributes` jsonb |
| `createdAt` | `contacts.created_at` | match | `contacts.created_at` |

---

## `Campaign` (`types/campaign.ts`)

| UI field | Phase 0 DB | Status | Target (`campaigns`) |
|----------|------------|--------|----------------------|
| `id` | `campaigns.id` | match | `campaigns.id` |
| `name` | `campaigns.name` | match | `campaigns.name` |
| `status` | `campaigns.status` | match | `campaigns.status` |
| `agentId` | `campaigns.bot_id` | mismatch | `campaigns.agent_id` FK → `agents` |
| `contactListId` | — | missing | `campaigns.contact_list_id` FK |
| `iravoiceCampaignName` | — | missing | `campaigns.iravoice_campaign_name` |
| `pacing` | `campaigns.pacing` | match | `campaigns.pacing` jsonb |
| `callingWindow` | `campaigns.calling_window` | match | `campaigns.calling_window` jsonb |
| `scheduledAt` | `campaigns.schedule` | mismatch | `campaigns.scheduled_at` |
| `startedAt` | — | missing | `campaigns.started_at` |
| `completedAt` | — | missing | `campaigns.completed_at` |
| `createdAt` | `campaigns.created_at` | match | `campaigns.created_at` |
| `updatedAt` | `campaigns.updated_at` | match | `campaigns.updated_at` |
| `progress` | — | missing | **derived** from `dial_jobs` + `call_ledger` |
| `tenantId` (not in UI) | `campaigns.tenant_id` | extra | Kept for multi-tenant Phase 1 |

**Comment on `iravoice_campaign_name`:** IraVoice uses “campaign” for a **trunk grouping** (capacity + caller-ID pool). Starling `campaigns` is an **operator outbound job**. Same word, different entity — see migration comment.

---

## `Campaign.pacing` / `Campaign.callingWindow` (nested JSON)

| UI field | Phase 0 (`campaigns.pacing` / `calling_window`) | Status |
|----------|--------------------------------------------------|--------|
| `maxConcurrent` | jsonb key (if present) | match in jsonb |
| `targetCps` | jsonb key | match in jsonb |
| `maxAttempts` | jsonb key | match in jsonb |
| `dialTimeoutSec` | jsonb key | match in jsonb |
| `retryDelayMinutes` | jsonb key | match in jsonb |
| `retryOn` | jsonb key | match in jsonb |
| `timezone` | `calling_window` jsonb | match in jsonb |
| `startLocal` / `endLocal` | jsonb keys | match in jsonb |
| `workingHours` | jsonb key | match in jsonb |
| `daysOfWeek` | jsonb key | match in jsonb |

---

## `DialJob` (new — Flock claim queue)

Not in UI types; implied by campaign start + Flock. Maps to `dial_jobs`:

| Column | Purpose |
|--------|---------|
| `id` | Job identity |
| `campaign_id` | Parent campaign |
| `contact_id` | Row to dial |
| `attempt_no` | Matches UI `CallLog.attempt` |
| `state` | `pending` → `claimed` → `dialing` → `done` / `failed` |
| `next_attempt_at` | Retry scheduling (`retryDelayMinutes`) |
| `claimed_at` | Flock worker lease |
| `call_uuid` | IraVoice correlation after makecall |
| `created_at` | Enqueue time |

---

## `CallLog` (`types/analytics.ts`) ↔ `call_ledger` + `cdrs`

| UI field | Phase 0 | Status | Target |
|----------|---------|--------|--------|
| `id` | `call_ledger.id` | mismatch | **derived** — API UUID from `dial_job_id` or hash |
| `campaignId` | `call_ledger.campaign_id` | match | `call_ledger.campaign_id` |
| `contactId` | `call_ledger.contact_id` | match | `call_ledger.contact_id` |
| `callUuid` | `call_ledger.call_uuid` | match | `call_ledger.call_uuid` PK |
| `phoneE164` | — | missing | **derived** join `contacts.phone_number` |
| `displayName` | — | missing | **derived** join `contacts.name` |
| `attempt` | `call_ledger.attempt` | match | **derived** from `dial_jobs.attempt_no` |
| `outcome` | `call_ledger.outcome` TEXT | mismatch | **derived** from `state`, `cpa_event`, `hangup_cause` |
| `durationSec` | `cdrs.duration_sec` | mismatch | `call_ledger.duration_sec` |
| `errorReason` | `call_ledger.error_reason` | mismatch | **derived** from `hangup_cause` |
| `startedAt` | `call_ledger.dialed_at` | mismatch | `call_ledger.started_at` |
| `endedAt` | `call_ledger.ended_at` | match | `call_ledger.ended_at` |
| `transcript` | — | missing | **derived** render `cdrs.transcript` jsonb |

### `call_ledger` (telephony state — new shape)

| Column | Maps from IraVoice / Ledger |
|--------|----------------------------|
| `call_uuid` | makecall response + webhooks |
| `dial_job_id` | originating job |
| `cluster` | makecall response |
| `state` | `call_state` enum (`call-state-machine.md`) |
| `cpa_event` | IraCPA LV/AM/FX/… |
| `from_number` / `to_number` | webhook `event_data` |
| `answered_at` / `ended_at` | lifecycle events |
| `hangup_cause` | hangup payload |
| `recording_ref` | IraVoice recording path/URL |
| `raw_events` | append-only webhook envelopes |

---

## `CDR` (BotCompose) ↔ `cdrs`

| BotCompose / UI | Phase 0 `cdrs` | Target `cdrs` |
|-----------------|----------------|---------------|
| `call_transcript` | inside `raw_json` | `transcript` jsonb |
| `latency_metrics` | scalar `llm_ttfs_p95_ms` | `latency_metrics` jsonb |
| `usage_metrics` | token/savings scalars | `usage` jsonb |
| `call_uuid` | `call_uuid` (non-FK) | PK + FK → `call_ledger` |

---

## Analytics read models (no tables)

| UI type | Storage strategy |
|---------|------------------|
| `AnalyticsOverview` | SQL aggregate over `call_ledger` + `campaigns` for today |
| `CampaignStats` | Per-campaign aggregates + 24-point time series |
| `CampaignStatsPoint` | Bucketed query on `call_ledger.started_at` |
| `Campaign.progress` | Counts from `dial_jobs` / `call_ledger` by campaign |

---

## UI fields with no dedicated column (by design)

| Field | Reason |
|-------|--------|
| Agent nested config (llm, stt, tts, tools, …) | `agents.config` jsonb |
| `Contact.dndFlag` | Redundant with `row_status = 'dnd'`; API sets both |
| `Campaign.progress` | Computed at read time |
| `CallLog.id` | Synthetic UUID in API layer |
| `CallLog.outcome` | Mapped from ledger state + CPA |
| `CallLog.transcript` | Rendered from `cdrs.transcript` jsonb array |
| `AnalyticsOverview.*` | Aggregate queries |
| `CampaignStats.*` | Aggregate queries + time bucketing |
| `avgLlmTtfsMs` | `cdrs.latency_metrics->llm->ttfs_mean` or p95 |

---

## Phase 0 tables retained unchanged

| Table | Notes |
|-------|-------|
| `tenants` | Multi-tenant scaffold |
| `users` | Auth scaffold |
| `schema_migrations` | Migration tracker |

## Phase 0 tables replaced in `000002`

| Table | Action |
|-------|--------|
| `bot_versions` | Dropped |
| `contacts` | Dropped and recreated (`list_id`) |
| `call_ledger` | Dropped and recreated (`call_uuid` PK) |
| `cdrs` | Dropped and recreated (FK to ledger) |
| `campaigns` | Altered (drop `bot_id`, `schedule`, `current_bot_version_id`; add UI FKs) |
