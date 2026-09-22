-- ====================================================
-- MIGRATION 003: PHASE 5J-B CENTRAL ADMIN <-> TRADING PLATFORM INTEGRATION
-- ====================================================

-- 1. Tenant Configuration Synchronization State
CREATE TABLE IF NOT EXISTS tenant_sync_state (
  tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SYNCED', 'FAILED', 'RETRYING'
  config_version INT NOT NULL DEFAULT 1,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  last_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_sync_status ON tenant_sync_state(sync_status);

-- 2. Inbound Events Deduplication and Audit Trail
CREATE TABLE IF NOT EXISTS processed_events (
  id VARCHAR(128) PRIMARY KEY, -- event_id from Trading Platform
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(128) NOT NULL,
  correlation_id VARCHAR(128),
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED', 'FAILED', 'DUPLICATE'
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processed_events_tenant ON processed_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_type ON processed_events(event_type);
CREATE INDEX IF NOT EXISTS idx_processed_events_created ON processed_events(created_at);

-- 3. White Label Versioning History
CREATE TABLE IF NOT EXISTS white_label_versions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED', -- 'DRAFT', 'PUBLISHED', 'ROLLED_BACK'
  config JSONB NOT NULL,
  published_by VARCHAR(255) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_version UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_white_label_versions_tenant ON white_label_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_white_label_versions_ver ON white_label_versions(tenant_id, version);

-- 4. Extend tenant_branding table with versioning and draft/publish snapshots
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS publish_status VARCHAR(32) DEFAULT 'DRAFT';
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS draft_config JSONB;
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS published_config JSONB;
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS last_published_by VARCHAR(255);
ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS sync_status VARCHAR(32) DEFAULT 'PENDING';
