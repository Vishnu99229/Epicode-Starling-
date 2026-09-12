#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://starling:starling@127.0.0.1:5433/starling?sslmode=disable}"
LEDGER_URL="${LEDGER_URL:-http://127.0.0.1:8080}"

TENANT_ID="11111111-1111-4111-8111-111111111111"
CAMPAIGN_ID="c1000000-0000-4000-8000-000000000001"
LIST_ID="l1000000-0000-4000-8000-000000000001"
CONTACT_ID="ct000000-0000-4000-8000-000000000001"
CALL_UUID="${CALL_UUID:-f1000000-0000-4000-8000-000000000001}"
TO_NUMBER="${TO_NUMBER:-+919876543210}"
FROM_NUMBER="${FROM_NUMBER:-+911140000000}"
CLUSTER="${CLUSTER:-sandbox-ld-1}"

echo "==> Seeding tenant/campaign/contact fixtures"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO tenants (id, name, epicode_tenant_id)
VALUES ('$TENANT_ID', 'Ledger fake tenant', 'copter')
ON CONFLICT DO NOTHING;

INSERT INTO campaigns (id, tenant_id, name, status)
VALUES ('$CAMPAIGN_ID', '$TENANT_ID', 'Ledger fake campaign', 'running')
ON CONFLICT DO NOTHING;

INSERT INTO contact_lists (id, name, status, columns, contact_count, valid_count)
VALUES ('$LIST_ID', 'Ledger fake list', 'ready', ARRAY['phone'], 1, 1)
ON CONFLICT DO NOTHING;

INSERT INTO contacts (id, list_id, phone_number, name, row_status)
VALUES ('$CONTACT_ID', '$LIST_ID', '$TO_NUMBER', 'Fake Contact', 'valid')
ON CONFLICT DO NOTHING;
SQL

post_event() {
  local event_name="$1"
  local timestamp="$2"
  local extra_json="${3:-}"

  local payload
  payload=$(cat <<JSON
{
  "event_name": "$event_name",
  "event_data": {
    "timestamp": "$timestamp",
    "call_uuid": "$CALL_UUID",
    "tenant_id": "copter",
    "call_type": "outbound",
    "to_number": "$TO_NUMBER",
    "from_number": "$FROM_NUMBER",
    "cluster": "$CLUSTER",
    "call_params": {
      "bot_id": "starling_fake_event",
      "campaign_id": "$CAMPAIGN_ID",
      "contact_id": "$CONTACT_ID",
      "event_url": "$LEDGER_URL/webhooks/iravoice"
    }
    ${extra_json}
  }
}
JSON
)

  echo "==> POST $event_name"
  curl -fsS -X POST "$LEDGER_URL/webhooks/iravoice" \
    -H 'Content-Type: application/json' \
    -d "$payload"
  echo
  sleep 0.2
}

BASE_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RING_TS="$(date -u -v+2S +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+2 seconds' +"%Y-%m-%dT%H:%M:%SZ")"
ANSWER_TS="$(date -u -v+5S +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+5 seconds' +"%Y-%m-%dT%H:%M:%SZ")"
HANGUP_TS="$(date -u -v+35S +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d '+35 seconds' +"%Y-%m-%dT%H:%M:%SZ")"

post_event "iravoice::started" "$BASE_TS"
post_event "iravoice::ringing" "$RING_TS"
post_event "iravoice::answered" "$ANSWER_TS"
post_event "iravoice::hangup" "$HANGUP_TS" ', "hangup_cause": "NORMAL_CLEARING", "duration_sec": 32.5, "cpa_event": "LV"'

echo "==> Waiting for async ledger writes"
sleep 1

echo "==> call_ledger row"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
SELECT call_uuid, state, cluster, cpa_event, hangup_cause,
       started_at IS NOT NULL AS has_started,
       answered_at IS NOT NULL AS has_answered,
       ended_at IS NOT NULL AS has_ended,
       jsonb_array_length(raw_events) AS event_count
FROM call_ledger
WHERE call_uuid = '$CALL_UUID';
"
