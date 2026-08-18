# Epicode integration — environment & facts

Starling sits on Epicode **BotCompose** (voicebot) + **IraVoice** (telephony). This doc records confirmed integration facts for Phase 0. **Tokens, API keys, and PEM files live in `.env` / `secrets/` — never in this file.**

Related docs:

- LD API + webhook events: [`reference/iravoice-ld-api.md`](reference/iravoice-ld-api.md)
- Webhook JSON Schema: [`../contracts/epicode/iravoice-webhook-event.schema.json`](../contracts/epicode/iravoice-webhook-event.schema.json)
- VM-A install runbook (workspace): [`../../docs/install/iravoice-vm-a.md`](../../docs/install/iravoice-vm-a.md)
- Env profiles: [`.env.example`](../.env.example)

---

## Tenants & sites

| Profile | Tenant | Site / campaign | Use |
|---------|--------|-----------------|-----|
| **Primary (yours)** | `vishnu` | site `vishnu_test`, `cluster_id` `vishnu_test` | Cloud VMs once DEBs installed |
| **Fallback (shared sandbox)** | `copter` | campaign `csdemo2` | Dry `add_bot` / `get_bot` before your cluster exists |

Switch profiles via `.env.example` blocks (`CLOUD_VM` vs `REMOTE_SANDBOX`).

---

## Sandbox limits

- **20 channels** max concurrent
- **50 CPS** max
- Failures surface at **trunk level** (not Starling-side queuing)

---

## Event model (webhook-only — no NATS)

- IraVoice sends **all** call lifecycle events (`started`, `ringing`, `answered`, `hangup`, plus telemetry) **and** the final **CDR** as HTTP POSTs to **one** `event_url` webhook that Starling hosts (Ledger in Phase 1).
- Events are **always emitted** when `event_url` is configured in makecall `call_params`.
- Starling does **not** use external NATS — no NATS client or consumer anywhere in this repo.
- Ledger dispatches by payload shape: IraVoice envelope (`event_name` + `event_data`) vs BotCompose CDR (`call_info` / `latency_metrics` / `usage_metrics`). See [`contracts/README.md`](../contracts/README.md).

Full webhook schema: [`reference/iravoice-ld-api.md`](reference/iravoice-ld-api.md) + [`iravoice-webhook-event.schema.json`](../contracts/epicode/iravoice-webhook-event.schema.json).

---

## Origination (makecall)

- **Endpoint:** `POST /api/makecall` (HTTP Bearer) — base URL from env (`IRAVOICE_MAKECALL_URL`).
- **Required fields:** `campaign_name`, `to_number`.
- **Correlation:** response `call_uuid` — join key across `call_ledger`, webhook events, and CDR.
- **Backpressure:** response `slowdown: true` → originators must **pause makecall for 60s** (documented for Flock; not implemented in Phase 0).
- **Save `cluster`** from the response — needed for `makecalldirect` handoff later.
- **Stamp correlation in `call_params`:** Starling puts `campaign_id` / `contact_id` in makecall `call_params`; IraVoice echoes them on every webhook event.

---

## Cancel & handoff (later phases)

| API | Purpose |
|-----|---------|
| `dropcall { call_uuid }` | Cancel a call — stop-campaign primitive |
| `stopstream { call_uuid }` | Detach voicebot WebSocket before bridging |
| `makecalldirect { cluster, campaign_name, to_number, … }` | Originate to a specific cluster (reuse `cluster` from first leg) |
| `bridgecalls { first_uuid, second_uuid }` | Join two calls in the same cluster |
| `transfercall { call_uuid, destination, deflect }` | `deflect=true` → SIP REFER to trunk; `false` → internal |

Warm-transfer pattern: makecall (save cluster) → stopstream → makecalldirect (same cluster) → bridgecalls.

---

## CPA & voicemail

- Primary CPA events: **LV** (live human), **AM** (answering machine), **FX** (fax), **SIT**, **IBP**.
- Extended: SL, BP, EAM, CS. First CPA event ~1.75s after answer.
- `stream_on_cpa_events` default `["LV"]`; `drop_on_cpa_events` default `["FX","AM"]`.
- `bot_inactivity_limit` (default 0 = off) — drops call if no bot audio for N seconds; Starling may expose per-campaign.

---

## Recordings

- Accessible in the installed setup once IraVoice is on your VM.
- Shared sandbox: **copyparty** UI for playback (Epicode-provided).

---

## Inbound

- **No API** for inbound dialplan/routing — **DevOps-provisioned** by Epicode.

---

## DND scrubbing

- **Not** performed at the IraVoice gateway.
- Starling's responsibility via `contacts.dnd_flag` before enqueueing dial jobs.

---

## Install topology

- **DEB packages**, **Debian 12 amd64**.
- Phase 0 test topology: **two VMs** — VM-A IraVoice + VM-B FreeSWITCH, SIP gateway between them, dial a **SIP extension** (no PSTN).
- Install runbook: [`../../docs/install/iravoice-vm-a.md`](../../docs/install/iravoice-vm-a.md) (VM-A; VM-B + gateway with Epicode/Tripthi).

---

## Auth & secrets

| Item | Location | Notes |
|------|----------|-------|
| BotCompose / IraVoice bearer tokens | `.env` | `BOTCOMPOSE_BEARER_TOKEN`, `IRAVOICE_BEARER_TOKEN` |
| Provider keys (Deepgram, Groq, Sarvam) | `.env` | Optional `add_secret` on fresh tenant `vishnu` |
| Site private key | `secrets/vishnu_test.pem` | Provisioned; consumed by irapass/iracluster at install (no manual unlock step per Epicode DevOps) |
| mTLS client cert | `secrets/` (TBD) | See OPEN ITEMS |

---

## BotCompose (voicebot)

- **Base URL:** env `BOTCOMPOSE_BASE_URL`
- Register bots via `add_bot` / confirm via `get_bot`
- Media streaming: WebSocket (`wss://`), TEXT = JSON control, BINARY = 16-bit Linear PCM — handled by BotCompose, **not** Ledger's `event_url` webhook

---

## OPEN ITEMS

Paste answers here as they arrive from Epicode. Do not put secret values in this section — reference where they live in `.env` / `secrets/`.

### Provisioning & install

| Item | Status | Answer / location |
|------|--------|-------------------|
| DEB package delivery (ira-dependency-repo, irabase, iravoice, iracluster) | ☐ pending | Drive folders in install runbook; confirm versions received from Sharadhi |
| Cloud VMs provisioned (VM-A IraVoice, VM-B FreeSWITCH) | ☐ pending | |
| VM-A private IP (for `nats_url` on box / gateway config) | ☐ pending | |
| VM public IPs / SSH access | ☐ pending | |
| FreeSWITCH + SIP gateway config | ☐ pending | Tripthi / Epicode DevOps |
| Install runbook validated on real box | ☐ pending | Step 7 verify paths backfilled into runbook |

### Auth & tokens

| Item | Status | Answer / location |
|------|--------|-------------------|
| `BOTCOMPOSE_BEARER_TOKEN` (tenant `vishnu`) | ☐ pending | `.env` |
| `IRAVOICE_BEARER_TOKEN` (tenant `vishnu`) | ☐ pending | `.env` |
| Sandbox bearer tokens (tenant `copter`) | ☐ pending | `.env` — for dry smoke test |
| mTLS matching client cert (if required for API calls) | ☐ pending | `secrets/` + note path here |
| Key passphrase (if required outside irapass install path) | ☐ pending | Only if smoke/API path needs manual unlock |

### Schemas & contracts

| Item | Status | Answer / location |
|------|--------|-------------------|
| IraVoice webhook event schema | ☑ done | [`reference/iravoice-ld-api.md`](reference/iravoice-ld-api.md), [`iravoice-webhook-event.schema.json`](../contracts/epicode/iravoice-webhook-event.schema.json) |
| BotCompose CDR payload schema (field-level) | ☐ pending | Capture from smoke-test webhook logs → extend `cdr-received.schema.json` |
| Exact CDR → `ANALYZED` enrichment fields | ☐ pending | Phase 1 |

### Smoke test / Phase 0 gate

| Item | Status | Answer / location |
|------|--------|-------------------|
| `TEST_TO_NUMBER` (SIP extension) | ☐ pending | `.env` |
| `EVENT_URL` reachable from IraVoice (tunnel or same-network) | ☐ pending | `.env` |
| Provider secrets on tenant `vishnu` (deepgram/groq/sarvam) | ☐ pending | `.env` or pre-provisioned on sandbox |
| End-to-end smoke: add_bot → makecall → events → CDR | ☐ pending | `SMOKE_LIVE=true` |

---

## Quick reference — env vars (values in `.env` only)

| Variable | Purpose |
|----------|---------|
| `BOTCOMPOSE_BASE_URL` | BotCompose API base |
| `IRAVOICE_MAKECALL_URL` | makecall endpoint |
| `EPICODE_TENANT` | `vishnu` or `copter` |
| `EPICODE_SITE` / `EPICODE_CAMPAIGN` | Site or sandbox campaign name |
| `EVENT_URL` | Public URL IraVoice POSTs events + CDR to |
| `WEBHOOK_PORT` | Local ledger/smoke receiver port |
| `TEST_TO_NUMBER` | Dial target for live smoke |
| `SMOKE_LIVE` | Gate live makecall (default `false`) |
| `ADD_SECRETS` | Optional add_secret before add_bot |

See [`.env.example`](../.env.example) for full profile blocks.
