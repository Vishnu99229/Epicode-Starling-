# IraVoice LD (Distributor) API — Reference

Source: https://ld.epicode.in/documentation (IraVoice API 2.0.0). Canonical reference for how Starling originates calls and receives events. Ledger and Flock are built against this.

## Concepts
- Cluster — media servers in one region running IraVoice; associated with one or more SIP trunks.
- Trunk — a SIP trunk to a telephony provider; belongs to one cluster; usable by one or more campaigns.
- Campaign — logical grouping of trunks; makecall picks a trunk + caller-ID by real-time capacity.

## makecall — originate outbound
POST /api/makecall (HTTPBearer). Required: campaign_name, to_number. Optional: from_number, call_params, channel_vars, cpa_config, dial_timeout (default 30).

Response fields:
- call_uuid — correlation key; present only on success.
- slowdown — if true, pause makecall 60s (queue saturation / backpressure).
- status — "OK" = success.
- status_code — 0 = success, non-zero = error.
- cluster — cluster handling the call (save it; needed for makecalldirect handoff).

Error responses (Flock retry logic must differentiate):
- 400 invalid token → config error, don't retry.
- 403 campaign not allowed in current hours OR cluster down → retry later, in-window.
- 404 unknown campaign/cluster → config error, alert.
- 409 no trunks assigned → provisioning issue, alert.
- 422 validation error → payload bug, alert.
- 500 internal error → backoff retry.
- 503 all clusters unreachable → backoff retry, alert.

## call_params (in makecall)
- event_url — HTTP webhook receiving call lifecycle events via POST. Always emitted if configured.
- stream_on_cpa_events (default ["LV"]) / drop_on_cpa_events (default ["FX","AM"]) — CPA-driven auto actions.
- bot_inactivity_limit (default 0 = disabled) — drops the call if no bot audio for N seconds. This is the silence-nudge behavior seen in testing. Starling exposes it per-campaign.
- disable_recording (default false).
- call_params is echoed back on every webhook event → stamp Starling campaign_id/contact_id here for correlation beyond call_uuid.

## CPA events
Primary: LV (live human), AM (answering machine), FX (fax), SIT, IBP. Extended: SL, BP, EAM, CS. First CPA event ~1.75s after answer.

## Webhook Event URL Payload — the schema Ledger parses
Envelope: { event_name, event_data }. event_data requires timestamp, call_uuid, call_params; additionalProperties true (events carry extras like dialer_ip, gateway, network_ip, direction — store raw).

Full event_name enum (note iravoice:: prefix):
iravoice::started, iravoice::ringing, iravoice::answered, iravoice::botaudio_stream_started, iravoice::speech, iravoice::silent, iravoice::play_paused, iravoice::play_stopped, iravoice::play_done, iravoice::dtmf, iravoice::hangup, iravoice::stream_stopped, iravoice::call_quality

Ledger state-machine mapping:
- iravoice::started → DIALING
- iravoice::ringing → RINGING
- iravoice::answered → IN_PROGRESS (record answered_at)
- iravoice::hangup → COMPLETED (record ended_at; await CDR → ANALYZED)
- iravoice::stream_stopped → log (near hangup)
- speech / silent / play_* / dtmf / botaudio_stream_started / call_quality → telemetry, log to raw, no transition

## Call-control APIs (later phases — human handoff)
- dropcall {call_uuid} — cancel a call (stop-campaign primitive).
- makecalldirect {cluster, campaign_name, to_number, ...} — call a specific cluster (reuse cluster from original makecall to route the agent leg to the same cluster).
- stopstream {call_uuid} — detach the voicebot websocket before bridging.
- bridgecalls {first_uuid, second_uuid} — join two calls in the same cluster.
- transfercall {call_uuid, destination, deflect} — deflect=true → SIP REFER to trunk; false → internal (extension/queue).

Warm-transfer pattern: makecall (save cluster) → stopstream → makecalldirect(same cluster, agent campaign) → bridgecalls.

## WebSocket model (BotCompose media side — not Ledger)
TEXT frames = JSON control/events; BINARY = 16-bit Linear PCM. wss:// only. This streaming path is handled by BotCompose, distinct from the event_url webhook Ledger handles.
