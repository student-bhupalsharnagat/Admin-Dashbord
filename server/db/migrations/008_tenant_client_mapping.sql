-- Migration 008: Add trading_tenant_id and allow unassigned clients in hierarchy
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trading_tenant_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_tenants_trading_tenant_id ON tenants(trading_tenant_id);

-- Drop NOT NULL constraint on clients.sub_broker_id to allow unassigned clients under tenant
ALTER TABLE clients ALTER COLUMN sub_broker_id DROP NOT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referral_code VARCHAR(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS broker_code VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_clients_referral_code ON clients(referral_code);
