-- --------------------------------------------------------------------
-- 014: Hierarchy Reassignment, Credentials, and Commission Share
-- --------------------------------------------------------------------

ALTER TABLE masters ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE masters ADD COLUMN IF NOT EXISTS commission_share NUMERIC(8, 2) DEFAULT 40.00;

ALTER TABLE brokers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS master_id VARCHAR(64);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS master_name VARCHAR(255);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS commission_share NUMERIC(8, 2) DEFAULT 40.00;

ALTER TABLE sub_brokers ADD COLUMN IF NOT EXISTS master_id VARCHAR(64);
ALTER TABLE sub_brokers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE sub_brokers ADD COLUMN IF NOT EXISTS commission_share NUMERIC(8, 2) DEFAULT 20.00;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sub_brokers_master_id ON sub_brokers(master_id);
