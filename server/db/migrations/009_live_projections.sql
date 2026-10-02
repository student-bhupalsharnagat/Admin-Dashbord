-- ====================================================
-- MIGRATION 009: LIVE PROJECTION TABLES & INDEXES
-- ====================================================

-- 1. Wallets Projection Table
CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  client_code VARCHAR(64),
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  balance NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  equity NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  used_margin NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  available_margin NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(16) NOT NULL DEFAULT 'INR',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_wallets_tenant_client UNIQUE (tenant_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_wallets_tenant ON wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallets_client ON wallets(client_id);

-- 2. Unified Fund Transactions Table (Deposits & Withdrawals)
CREATE TABLE IF NOT EXISTS fund_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  client_code VARCHAR(64),
  type VARCHAR(32) NOT NULL DEFAULT 'DEPOSIT', -- DEPOSIT | WITHDRAWAL
  amount NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  method VARCHAR(64) DEFAULT 'BANK_TRANSFER',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING | COMPLETED | APPROVED | REJECTED | FAILED
  reference_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fund_tx_tenant ON fund_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fund_tx_client ON fund_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_fund_tx_status ON fund_transactions(status);

-- 3. KYC Records Table / Projection
CREATE TABLE IF NOT EXISTS kyc (
  id VARCHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL,
  client_code VARCHAR(64),
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  pan_number VARCHAR(32),
  aadhaar_number VARCHAR(32),
  documents_submitted JSONB DEFAULT '[]',
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_kyc_tenant_client UNIQUE (tenant_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_kyc_tenant ON kyc(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc(status);

ALTER TABLE kyc_records ALTER COLUMN email DROP NOT NULL;
ALTER TABLE kyc_records ALTER COLUMN pan_number DROP NOT NULL;
ALTER TABLE kyc_records ALTER COLUMN aadhaar_number DROP NOT NULL;

-- 4. Additional Indexes & Columns for Idempotent Projections
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_code VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE trades ADD COLUMN IF NOT EXISTS client_code VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_trades_tenant ON trades(tenant_id);

ALTER TABLE positions ADD COLUMN IF NOT EXISTS client_code VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON ledger_entries(tenant_id);
ALTER TABLE risk_events ADD COLUMN IF NOT EXISTS description TEXT;
CREATE INDEX IF NOT EXISTS idx_risk_events_tenant ON risk_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
