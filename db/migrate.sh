#!/usr/bin/env bash
# Apply SQL migrations in order via docker compose Postgres.
# Usage (from repo root): ./db/migrate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "error: postgres service is not running. Start with: docker compose up -d" >&2
  exit 1
fi

docker compose exec -T postgres \
  psql -U starling -d starling -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );"

shopt -s nullglob
for file in "$ROOT"/db/migrations/*.up.sql; do
  version="$(basename "$file" .up.sql)"
  already="$(docker compose exec -T postgres \
    psql -U starling -d starling -tAc \
    "SELECT 1 FROM schema_migrations WHERE version = '${version}'")"
  if [[ "${already}" == "1" ]]; then
    echo "skip  ${version}"
    continue
  fi
  echo "apply ${version}"
  docker compose exec -T postgres \
    psql -U starling -d starling -v ON_ERROR_STOP=1 < "$file"
  docker compose exec -T postgres \
    psql -U starling -d starling -v ON_ERROR_STOP=1 \
    -c "INSERT INTO schema_migrations (version) VALUES ('${version}');"
done

echo "migrations complete"
