-- Starling UI-aligned schema (reconciles dashboard Zod types with Phase 0).
-- Replaces campaign-scoped bot_versions/contacts and reshapes call_ledger + cdrs.
-- Destructive to Phase 0 dial/ledger data; safe for empty dev databases.

CREATE TYPE agent_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE contact_list_status AS ENUM ('processing', 'ready', 'failed');

CREATE TYPE contact_row_status AS ENUM (
  'valid',
  'invalid_number',
  'duplicate',
  'dnd'
);

CREATE TYPE dial_job_state AS ENUM (
  'pending',
  'claimed',
  'dialing',
  'done',
  'failed'
);

-- Drop Phase 0 tables that conflict with the UI-aligned model (order: dependents first).
DROP TABLE IF EXISTS call_ledger CASCADE;
DROP TABLE IF EXISTS cdrs CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS bot_versions CASCADE;

ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS campaigns_current_bot_version_id_fkey;

ALTER TABLE campaigns
  DROP COLUMN IF EXISTS bot_id,
  DROP COLUMN IF EXISTS current_bot_version_id,
  DROP COLUMN IF EXISTS schedule;

-- ---------------------------------------------------------------------------
-- agents — independent reusable voice bots (maps to dashboard Agent + add_bot)
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status agent_status NOT NULL DEFAULT 'draft',
  -- Full Agent object minus id, name, description, status, createdAt, updatedAt.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  botcompose_bot_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agents_status_idx ON agents (status);

-- ---------------------------------------------------------------------------
-- contact_lists — reusable CSV uploads (maps to dashboard ContactList)
-- ---------------------------------------------------------------------------
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status contact_list_status NOT NULL DEFAULT 'processing',
  columns TEXT[] NOT NULL DEFAULT '{}',
  contact_count INT NOT NULL DEFAULT 0,
  valid_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  source_filename TEXT,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- contacts — rows within a list (maps to dashboard Contact)
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists (id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_status contact_row_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contacts_phone_e164_chk CHECK (phone_number ~ '^\+[1-9]\d{7,14}$')
);

CREATE INDEX contacts_list_id_row_status_idx ON contacts (list_id, row_status);

CREATE INDEX contacts_list_id_phone_number_idx ON contacts (list_id, phone_number);

-- ---------------------------------------------------------------------------
-- campaigns — operator outbound jobs (alter Phase 0 table)
-- ---------------------------------------------------------------------------
ALTER TABLE campaigns
  ADD COLUMN agent_id UUID REFERENCES agents (id),
  ADD COLUMN contact_list_id UUID REFERENCES contact_lists (id),
  ADD COLUMN iravoice_campaign_name TEXT,
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN started_at TIMESTAMPTZ,
  ADD COLUMN completed_at TIMESTAMPTZ;

COMMENT ON COLUMN campaigns.iravoice_campaign_name IS
  'IraVoice trunk-grouping campaign_name passed to makecall (capacity + caller-ID pool). '
  'This is NOT the same entity as this Starling campaigns row (operator outbound job).';

CREATE INDEX campaigns_agent_id_idx ON campaigns (agent_id);

CREATE INDEX campaigns_contact_list_id_idx ON campaigns (contact_list_id);

-- ---------------------------------------------------------------------------
-- dial_jobs — Flock claim queue (one row per dial attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE dial_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns (id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  attempt_no INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  state dial_job_state NOT NULL DEFAULT 'pending',
  next_attempt_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  call_uuid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX dial_jobs_claim_idx ON dial_jobs (campaign_id, state, next_attempt_at);

CREATE INDEX dial_jobs_call_uuid_idx ON dial_jobs (call_uuid)
  WHERE call_uuid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- call_ledger — live call state keyed by IraVoice call_uuid
-- ---------------------------------------------------------------------------
CREATE TABLE call_ledger (
  call_uuid TEXT PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns (id),
  contact_id UUID NOT NULL REFERENCES contacts (id),
  dial_job_id UUID REFERENCES dial_jobs (id),
  cluster TEXT,
  state call_state NOT NULL DEFAULT 'queued',
  cpa_event TEXT,
  from_number TEXT,
  to_number TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_sec NUMERIC,
  hangup_cause TEXT,
  recording_ref TEXT,
  raw_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX call_ledger_campaign_id_state_idx ON call_ledger (campaign_id, state);

CREATE INDEX call_ledger_contact_id_idx ON call_ledger (contact_id);

CREATE INDEX call_ledger_dial_job_id_idx ON call_ledger (dial_job_id);

-- ---------------------------------------------------------------------------
-- cdrs — BotCompose post-call payload (1:1 with call_ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE cdrs (
  call_uuid TEXT PRIMARY KEY REFERENCES call_ledger (call_uuid) ON DELETE CASCADE,
  transcript JSONB,
  latency_metrics JSONB,
  usage JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
