# Database migrations

Phase 0 uses a lightweight **psql apply script** (no golang-migrate binary required).

## Prerequisites

```bash
docker compose up -d   # Postgres must be healthy
```

Connection (matches `.env.example`):

```
postgres://starling:starling@localhost:5432/starling?sslmode=disable
```

## Apply

From the `starling/` repo root:

```bash
chmod +x db/migrate.sh   # once
./db/migrate.sh
```

The script:

1. Ensures a `schema_migrations` tracking table exists
2. Applies every `db/migrations/*.up.sql` in filename order
3. Skips versions already recorded

## Files

| File | Purpose |
|------|---------|
| `migrations/000001_init.up.sql` | Initial schema: tenants, users, campaigns, contacts, bot_versions, call_ledger, cdrs |

## Inspect

```bash
docker compose exec -T postgres psql -U starling -d starling -c '\dt'
```
