-- Starling Phase 0 initial schema
-- UUID PKs, FKs, timestamps, enums, and indexes per Phase 0 contract.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');

CREATE TYPE campaign_status AS ENUM (
  'draft',
  'scheduled',
  'running',
  'paused',
  'completed',
  'stopped'
);

CREATE TYPE call_state AS ENUM (
  'queued',
  'dialing',
  'ringing',
  'in_progress',
  'completed',
  'failed',
  'retry_wait',
  'skipped',
  'dead',
  'analyzed'
);

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  epicode_tenant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  bot_id TEXT,
  current_bot_version_id UUID,
  pacing JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  calling_window JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns (id),
  phone_e164 TEXT NOT NULL,
  macro_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  dnd_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contacts_campaign_id_phone_e164_idx
  ON contacts (campaign_id, phone_e164);

CREATE TABLE bot_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns (id),
  version_number INT NOT NULL,
  add_bot_payload JSONB NOT NULL,
  deployed_at TIMESTAMPTZ,
  deployed_by UUID REFERENCES users (id),
  UNIQUE (campaign_id, version_number)
);

-- Deferred FK: campaigns.current_bot_version_id → bot_versions(id)
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_current_bot_version_id_fkey
  FOREIGN KEY (current_bot_version_id) REFERENCES bot_versions (id);

CREATE TABLE call_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns (id),
  contact_id UUID NOT NULL REFERENCES contacts (id),
  attempt INT NOT NULL DEFAULT 1,
  state call_state NOT NULL DEFAULT 'queued',
  dedupe_key TEXT NOT NULL,
  call_uuid TEXT,
  cluster TEXT,
  outcome TEXT,
  error_reason TEXT,
  queued_at TIMESTAMPTZ,
  dialed_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  UNIQUE (dedupe_key)
);

CREATE INDEX call_ledger_campaign_id_state_idx
  ON call_ledger (campaign_id, state);

CREATE INDEX call_ledger_call_uuid_idx
  ON call_ledger (call_uuid);

CREATE TABLE cdrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_uuid TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns (id),
  raw_json JSONB NOT NULL,
  duration_sec NUMERIC,
  llm_ttfs_p95_ms NUMERIC,
  stt_savings_pct NUMERIC,
  tts_savings_pct NUMERIC,
  total_output_tokens INT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cdrs_call_uuid_idx ON cdrs (call_uuid);
