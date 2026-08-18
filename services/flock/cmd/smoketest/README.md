# Starling smoke test

Standalone Go program for Phase 0 integration checks against Epicode BotCompose + IraVoice. Reads all configuration from environment variables (see repo [`.env.example`](../../../.env.example)).

**Does not call live Epicode APIs for makecall unless `SMOKE_LIVE=true`.**

## Sub-steps

| Step | Flag | Action |
|------|------|--------|
| 1 | `ADD_SECRETS=true` | POST `add_secret` for deepgram/groq/sarvam keys present in env |
| 2 | always | POST `add_bot` — registers `starling_smoke_test` |
| 3 | always | GET `get_bot` — confirm registration |
| 4 | always | Start local HTTP server on `WEBHOOK_PORT`; log every POST body (pretty JSON + timestamp) |
| 5 | `SMOKE_LIVE=true` | POST `makecall`; log `call_uuid`, `cluster`, `slowdown`, `status_code` |
| 6 | always | Wait **60 seconds** for webhook POSTs, then exit |

## Run

From `services/flock/`:

```bash
# Load env (copy .env.example → .env and fill tokens first)
export $(grep -v '^#' ../../.env | xargs)   # or use direnv / manual export

# Dry run — add_bot + get_bot + webhook server (no makecall)
SMOKE_LIVE=false go run ./cmd/smoketest

# Optional secrets on fresh tenant vishnu
ADD_SECRETS=true SMOKE_LIVE=false go run ./cmd/smoketest

# Live makecall + event capture
SMOKE_LIVE=true go run ./cmd/smoketest
```

Build:

```bash
go build -o bin/smoketest ./cmd/smoketest
```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `BOTCOMPOSE_BASE_URL` | yes | e.g. `https://sandboxwa.epicode.in/api` |
| `BOTCOMPOSE_BEARER_TOKEN` | yes | BotCompose API token |
| `EPICODE_TENANT` | yes | `copter` (sandbox) or `vishnu` (your cluster) |
| `EPICODE_CAMPAIGN` | makecall | e.g. `csdemo2` — IraVoice campaign name |
| `WEBHOOK_PORT` | no | Default `8080` |
| `SMOKE_LIVE` | no | Default `false` |
| `ADD_SECRETS` | no | Default `false` |
| `DEEPGRAM_API_KEY` | add_secret | When `ADD_SECRETS=true` |
| `GROQ_API_KEY` | add_secret | When `ADD_SECRETS=true` |
| `SARVAM_API_KEY` | add_secret | When `ADD_SECRETS=true` |
| `IRAVOICE_MAKECALL_URL` | makecall | e.g. `https://sandboxld.epicode.in/api/makecall` |
| `IRAVOICE_BEARER_TOKEN` | makecall | When `SMOKE_LIVE=true` |
| `TEST_TO_NUMBER` | makecall | SIP extension or phone to dial |
| `EVENT_URL` | makecall | Public URL IraVoice can POST to — must reach `WEBHOOK_PORT` |

## Modes

### Dry (run now against shared sandbox)

Works with **REMOTE_SANDBOX** profile (`tenant=copter`):

- Steps 1 (optional), 2, 3, 4, 6
- Needs: `BOTCOMPOSE_BASE_URL`, `BOTCOMPOSE_BEARER_TOKEN`
- Sandbox usually has secrets pre-provisioned — skip `ADD_SECRETS` unless testing fresh tenant

### Live makecall (needs reachable `event_url`)

Requires **all of**:

- `SMOKE_LIVE=true`
- `IRAVOICE_MAKECALL_URL`, `IRAVOICE_BEARER_TOKEN`
- `TEST_TO_NUMBER` (SIP extension on sandbox or your VM)
- `EVENT_URL` pointing at this process — use **ngrok** / Cloudflare tunnel if Starling runs on your Mac, or VM private IP if IraVoice is same-network
- Step 5 + full event/CDR loop to close Phase 0 gate

### Your own cluster (`tenant=vishnu`)

- Switch to **CLOUD_VM** profile in `.env`
- Fresh tenant may need `ADD_SECRETS=true` with provider keys
- Full end-to-end needs IraVoice installed per [install runbook](../../../../docs/install/iravoice-vm-a.md)

## TODO (auth plug-in points)

- **mTLS client cert** — load from `secrets/` when Epicode provides matching cert (`newHTTPClient` in `main.go`)
- **PEM passphrase** — only if API path requires manual unlock outside irapass install

## Webhook discovery

All POST bodies are logged verbatim (pretty-printed JSON). Use captured payloads to:

- Validate [`iravoice-webhook-event.schema.json`](../../../contracts/epicode/iravoice-webhook-event.schema.json)
- Extend CDR handling in [`cdr-received.schema.json`](../../../contracts/cdr-received.schema.json)
- Reconcile hangup reason fields in [`call-state-machine.md`](../../../docs/call-state-machine.md)
