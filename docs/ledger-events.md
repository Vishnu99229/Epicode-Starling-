# Ledger webhook events

Living record of payloads observed at Starling Ledger (`services/ledger`). IraVoice POSTs lifecycle events to `call_params.event_url`; BotCompose POSTs CDRs to a separate Ledger route.

**Routes**

| Method | Path | Source |
|--------|------|--------|
| `POST` | `/webhooks/iravoice` | IraVoice `event_url` lifecycle events |
| `POST` | `/webhooks/botcompose-cdr` | BotCompose post-call CDR |
| `GET` | `/healthz` | Liveness |

Ledger always responds `200 {"ok":true}` quickly and processes asynchronously.

---

## IraVoice envelope

Observed shape (matches [`contracts/epicode/iravoice-webhook-event.schema.json`](../contracts/epicode/iravoice-webhook-event.schema.json)):

```json
{
  "event_name": "iravoice::answered",
  "event_data": {
    "timestamp": "2026-09-12T08:50:00Z",
    "call_uuid": "f1000000-0000-4000-8000-000000000001",
    "call_params": {
      "bot_id": "starling_smoke_test",
      "campaign_id": "c1000000-0000-4000-8000-000000000001",
      "contact_id": "ct000000-0000-4000-8000-000000000001",
      "event_url": "https://ledger.example/webhooks/iravoice"
    },
    "tenant_id": "copter",
    "call_type": "outbound",
    "to_number": "+919876543210",
    "from_number": "+911140000000",
    "cluster": "sandbox-ld-1"
  }
}
```

`event_data` carries additional fields in production (`dialer_ip`, `gateway`, `network_ip`, `direction`, `read_sampling_rate`, `write_sampling_rate`, …). Ledger appends the **full raw body** to `call_ledger.raw_events` without dropping unknown keys.

### Lifecycle `event_name` values (state transitions)

| `event_name` | `call_ledger.state` | Timestamp column | Notes |
|--------------|---------------------|------------------|-------|
| `iravoice::started` | `dialing` | `started_at` ← `event_data.timestamp` | May duplicate makecall-side `dialing` |
| `iravoice::ringing` | `ringing` | — | |
| `iravoice::answered` | `in_progress` | `answered_at` ← `event_data.timestamp` | Out-of-order `answered` before `ringing` is tolerated |
| `iravoice::hangup` | `completed` | `ended_at` ← `event_data.timestamp` | Awaits CDR → `analyzed` |

### Telemetry `event_name` values (no state change)

Logged to `raw_events` only:

- `iravoice::speech`
- `iravoice::silent`
- `iravoice::play_paused`, `iravoice::play_stopped`, `iravoice::play_done`
- `iravoice::dtmf`
- `iravoice::botaudio_stream_started`
- `iravoice::call_quality`
- `iravoice::stream_stopped`

### Fields extracted on hangup / CPA (best-effort)

| Ledger column | Observed / candidate JSON paths |
|---------------|----------------------------------|
| `hangup_cause` | `event_data.hangup_cause`, `hangup_reason`, `sip_hangup_cause`, `reason`, `cause` |
| `cpa_event` | `event_data.cpa_event`, `cpa_result`, `cpa`, `cpa_status` |
| `duration_sec` | `event_data.duration_sec`, `duration`, `billsec` |
| `cluster` | `event_data.cluster`, `event_data.call_params.cluster` |
| `from_number` / `to_number` | `event_data.from_number`, `event_data.to_number` |

**TODO (live capture):** confirm canonical hangup reason field names from first production `iravoice::hangup` payload.

### Correlation

| Field | Source |
|-------|--------|
| `call_uuid` | `event_data.call_uuid` (required for upsert) |
| `campaign_id` | `event_data.call_params.campaign_id` (Starling-stamped at makecall) |
| `contact_id` | `event_data.call_params.contact_id` |
| `dial_job_id` | `event_data.call_params.dial_job_id` (optional) |

If `call_uuid` is missing, Ledger logs the body and still returns `200` (no IraVoice retry storm).

---

## BotCompose CDR

Route: `POST /webhooks/botcompose-cdr`

Observed / expected shape (from contracts + smoke-test notes):

```json
{
  "call_info": {
    "call_uuid": "f1000000-0000-4000-8000-000000000001"
  },
  "call_transcript": [
    { "role": "assistant", "text": "Hello..." },
    { "role": "user", "text": "Hi" }
  ],
  "latency_metrics": {
    "llm": { "ttfs_mean_ms": 420, "ttfs_p95_ms": 890 }
  },
  "usage_metrics": {
    "llm_tokens": { "prompt": 1200, "completion": 340 }
  }
}
```

| `cdrs` column | JSON source |
|---------------|-------------|
| `transcript` | `call_transcript` |
| `latency_metrics` | `latency_metrics` |
| `usage` | `usage_metrics` |

`call_uuid` resolved from top-level `call_uuid` or `call_info.call_uuid`.

On insert, Ledger sets `call_ledger.state = analyzed` when the row is `completed`.

---

## Local verification

```bash
# Terminal 1
cd services/ledger && go run ./cmd/ledger

# Terminal 2
./scripts/fake-event.sh
```

Env:

- `DATABASE_URL` — Postgres (default `postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable`)
- `LEDGER_URL` — Ledger base URL (default `http://127.0.0.1:8080`)
- `PORT` / `WEBHOOK_PORT` — Ledger listen port (default `8080`)

---

## Changelog

| Date | Source | Notes |
|------|--------|-------|
| 2026-09-12 | `scripts/fake-event.sh` | Synthetic started → ringing → answered → hangup sequence; `hangup_cause=NORMAL_CLEARING`, `cpa_event=LV`, `duration_sec=32.5` |
