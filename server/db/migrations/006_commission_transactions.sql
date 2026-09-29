-- Migration 006: Commission Payout Transactions Table
CREATE TABLE IF NOT EXISTS commission_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  beneficiary VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'Broker',
  amount NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(16) NOT NULL DEFAULT 'INR',
  period VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PAID',
  disbursed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_transactions_tenant ON commission_transactions(tenant_id);
