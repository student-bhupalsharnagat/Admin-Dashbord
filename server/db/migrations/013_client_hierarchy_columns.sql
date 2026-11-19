-- --------------------------------------------------------------------
-- 013: Add explicit master and broker lineage columns to clients table
-- --------------------------------------------------------------------

ALTER TABLE clients ADD COLUMN IF NOT EXISTS master_id VARCHAR(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS broker_id VARCHAR(64);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS master_name VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS broker_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_clients_master_id ON clients(master_id);
CREATE INDEX IF NOT EXISTS idx_clients_broker_id ON clients(broker_id);
