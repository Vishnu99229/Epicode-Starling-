# Starling contracts

JSON Schema (draft-07) definitions for Starling's internal message shapes and the external IraVoice webhook payload. See also [`docs/reference/iravoice-ld-api.md`](../docs/reference/iravoice-ld-api.md) for the full LD API reference.

## Dispatch model (single `event_url`)

IraVoice and BotCompose both POST to the **same** `event_url` configured in makecall `call_params`. Ledger dispatches by payload shape:

| Shape | Contract | Detection |
|-------|----------|-----------|
| IraVoice lifecycle event | [`epicode/iravoice-webhook-event.schema.json`](epicode/iravoice-webhook-event.schema.json) | Has `event_name` + `event_data` (IraVoice envelope) |
| BotCompose CDR | [`cdr-received.schema.json`](cdr-received.schema.json) | Has `call_info`, `latency_metrics`, and/or `usage_metrics` (CDR shape) |

When a payload matches the IraVoice envelope, validate against `iravoice-webhook-event.schema.json` and store the full raw body (including `event_data` extras such as `dialer_ip`, `gateway`, `network_ip`, `direction`).

## Correlation via `call_params`

`call_params` from makecall is **echoed on every IraVoice webhook event**. Starling stamps `campaign_id` and `contact_id` into `call_params` at origination time so Ledger can correlate beyond `call_uuid` alone.

## State transitions vs telemetry

Only these IraVoice events drive `call_ledger` state transitions (via [`call-state-change.schema.json`](call-state-change.schema.json)):

- `iravoice::started` → DIALING
- `iravoice::ringing` → RINGING
- `iravoice::answered` → IN_PROGRESS
- `iravoice::hangup` → COMPLETED (then CDR → ANALYZED)

These events are **telemetry only** — log the raw payload, no state transition:

- `iravoice::speech`, `iravoice::silent`
- `iravoice::play_paused`, `iravoice::play_stopped`, `iravoice::play_done`
- `iravoice::dtmf`, `iravoice::botaudio_stream_started`, `iravoice::call_quality`
- `iravoice::stream_stopped` (logged near hangup; may appear in `call-state-change.source_event` for audit but does not advance the primary lifecycle)

## Contract index

| File | Producer | Consumer | Purpose |
|------|----------|----------|---------|
| [`epicode/iravoice-webhook-event.schema.json`](epicode/iravoice-webhook-event.schema.json) | IraVoice (external POST) | Ledger webhook receiver | Canonical IraVoice event_url payload (LD API 2.0.0) |
| [`call-state-change.schema.json`](call-state-change.schema.json) | Ledger webhook receiver | Ledger state writer, WebSocket aggregator | Internal message when a lifecycle event transitions `call_ledger` |
| [`dial-job.schema.json`](dial-job.schema.json) | Campaign launcher | Flock | Single origination work item (Redis SETNX on `dedupe_key`) |
| [`cdr-received.schema.json`](cdr-received.schema.json) | Ledger webhook receiver | Ledger CDR store, Python enrichment | Wraps BotCompose CDR from the same webhook endpoint |
