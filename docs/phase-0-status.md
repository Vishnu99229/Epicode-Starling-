# Phase 0 status

Starling Phase 0 = **scaffold, schema, contracts, docs, guarded smoke test**. No business logic, no services carrying real traffic.

Last updated: scaffold complete (Steps 1–8). Live Epicode integration **not** verified end-to-end yet.

---

## What's built

| Area | Location | Status |
|------|----------|--------|
| Monorepo scaffold | [`apps/`](../apps/), [`services/`](../services/) | Done — stubs only |
| API stub (Fastify/TS) | [`apps/api/`](../apps/api/) | Boots, logs `api up` |
| Web stub (React/Vite) | [`apps/web/`](../apps/web/) | Blank landing page; builds |
| Flock stub (Go) | [`services/flock/cmd/flock/`](../services/flock/cmd/flock/) | Prints `flock: not implemented` |
| Ledger stub (Go) | [`services/ledger/cmd/ledger/`](../services/ledger/cmd/ledger/) | Prints `ledger: not implemented` |
| Local infra | [`docker-compose.yml`](../docker-compose.yml) | Postgres 16 + Redis 7 (**no NATS**) |
| Env profiles | [`.env.example`](../.env.example) | CLOUD_VM + REMOTE_SANDBOX |
| Postgres schema | [`db/migrations/000001_init.up.sql`](../db/migrations/000001_init.up.sql) | 7 domain tables + `schema_migrations` |
| Migration runner | [`db/migrate.sh`](../db/migrate.sh) | psql via docker compose |
| Internal contracts | [`contracts/`](../contracts/) | dial-job, call-state-change, cdr-received |
| IraVoice webhook schema | [`contracts/epicode/iravoice-webhook-event.schema.json`](../contracts/epicode/iravoice-webhook-event.schema.json) | From LD API 2.0.0 |
| LD API reference | [`docs/reference/iravoice-ld-api.md`](reference/iravoice-ld-api.md) | makecall, webhooks, handoff notes |
| Epicode env facts | [`docs/epicode-env.md`](epicode-env.md) | Confirmed facts + OPEN ITEMS |
| Call state machine | [`docs/call-state-machine.md`](call-state-machine.md) | Authority for Phase 1 Flock/Ledger |
| VM-A install runbook | [`../../docs/install/iravoice-vm-a.md`](../../docs/install/iravoice-vm-a.md) | Workspace-level (outside `starling/`) |
| Smoke test | [`services/flock/cmd/smoketest/`](../services/flock/cmd/smoketest/) | add_bot/get_bot/webhook/makecall (guarded) |
| Git | `starling/.git` | Initialized; initial commit pending |

---

## Verified locally (on dev machine)

| Check | Result |
|-------|--------|
| `docker compose up -d` | Postgres + Redis **healthy** (5432 / 6379) |
| `./db/migrate.sh` | Migration `000001_init` applied; 8 tables present |
| `go build ./services/flock/...` | flock stub + smoketest compile |
| `go build ./services/ledger/...` | ledger stub compiles |
| `npm run start` (api) | Listens; logs `api up` |
| `npm run build` (web) | Production build succeeds |
| Contract JSON parse | All 5 `.json` schemas valid |
| Live Epicode API calls | **Not run** in scaffold pass (needs your tokens) |
| End-to-end smoke (makecall → events → CDR) | **Not run** — blocked on tokens + reachable `EVENT_URL` |

---

## Phase 0 exit gate

Gate closes when live smoke passes on **your** cluster: `add_bot` → `makecall` → IraVoice events + CDR at webhook → schemas reconciled.

| # | Gate item | Owner | Status |
|---|-----------|-------|--------|
| 1 | DEB packages received (ira-dependency-repo, irabase, iravoice, iracluster) | Epicode (Sharadhi) | ☐ pending |
| 2 | Cloud VMs provisioned (VM-A IraVoice, VM-B FreeSWITCH) | Epicode | ☐ pending |
| 3 | IraVoice installed on VM-A | You | ☐ pending — runbook ready |
| 4 | FreeSWITCH + SIP gateway configured | You + Tripthi | ☐ pending |
| 5 | Bearer tokens for tenant `vishnu` in `.env` | Epicode / you | ☐ pending |
| 6 | Provider secrets on `vishnu` (or `ADD_SECRETS=true`) | You | ☐ pending |
| 7 | `TEST_TO_NUMBER` — SIP extension reachable | You | ☐ pending |
| 8 | `EVENT_URL` reachable from IraVoice (tunnel or same-network) | You | ☐ pending |
| 9 | Dry smoke: add_bot + get_bot on sandbox `copter` | You | ☐ ready to run |
| 10 | Live smoke: `SMOKE_LIVE=true` makecall | You | ☐ blocked on 1–8 |
| 11 | Webhook payloads captured; CDR schema reconciled | You | ☐ after #10 |
| 12 | Install runbook Step 7 paths backfilled from real VM | You | ☐ after #3 |

---

## What you can do now (no VM required)

```bash
cd starling
docker compose up -d
./db/migrate.sh

# Optional: boot stubs
cd apps/api && npm run start
cd apps/web && npm run dev

# Dry smoke against shared sandbox (fill BOTCOMPOSE_BEARER_TOKEN in .env)
cd services/flock
SMOKE_LIVE=false go run ./cmd/smoketest
```

Requires: `BOTCOMPOSE_BASE_URL`, `BOTCOMPOSE_BEARER_TOKEN`, `EPICODE_TENANT=copter` (REMOTE_SANDBOX profile).

---

## After VMs + DEBs arrive

1. Install VM-A per [iravoice-vm-a runbook](../../docs/install/iravoice-vm-a.md); backfill exact systemd/log paths in Step 7.
2. Switch `.env` to **CLOUD_VM** profile (`tenant=vishnu`, your makecall/BotCompose URLs).
3. Set `EVENT_URL` to a URL IraVoice can reach (ngrok if smoketest runs on Mac).
4. Run full smoke:

```bash
SMOKE_LIVE=true go run ./cmd/smoketest
```

5. Paste captured webhook/CDR samples into OPEN ITEMS in [`epicode-env.md`](epicode-env.md) and extend [`cdr-received.schema.json`](../contracts/cdr-received.schema.json) if needed.

---

## Explicitly out of scope (Phase 0)

- Flock pacing / retry implementation
- Ledger webhook receiver (Phase 1)
- NATS or any non-webhook event transport
- Campaign business logic, web UI beyond stub
- Install scripting (deferred until manual install proven)

---

## Next phase (Phase 1 preview)

- Implement Ledger: single `event_url` HTTP receiver, dispatch IraVoice vs CDR, drive [`call-state-machine.md`](call-state-machine.md)
- Implement Flock: consume dial jobs, makecall + backpressure (`slowdown` 60s)
- Wire API to Postgres + Redis

---

## Quick links

- Env & open items: [`epicode-env.md`](epicode-env.md)
- State machine: [`call-state-machine.md`](call-state-machine.md)
- Smoke test: [`services/flock/cmd/smoketest/README.md`](../services/flock/cmd/smoketest/README.md)
- Contracts: [`contracts/README.md`](../contracts/README.md)
