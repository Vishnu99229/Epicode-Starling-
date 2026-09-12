#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FLOCK_DRY_RUN=true
export FLOCK_ONCE=true
export EVENT_URL="${EVENT_URL:-http://127.0.0.1:8080}"
export BOT_WEBSOCKET_HOST="${BOT_WEBSOCKET_HOST:-bot.example.com}"
export BOT_WEBSOCKET_PORT="${BOT_WEBSOCKET_PORT:-443}"
export BOT_WEBSOCKET_APP="${BOT_WEBSOCKET_APP:-voice}"

echo "==> Sample assembled payload (no database)"
cd "$ROOT_DIR/services/flock"
go test ./internal/dialer -run TestBuildMakecallSample -v

echo
echo "==> Dry-run dial loop (requires seeded dial_job + running Postgres)"
cd "$ROOT_DIR/services/flock"
go run ./cmd/flock
