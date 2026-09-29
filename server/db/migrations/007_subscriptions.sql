-- Migration 007: Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_name VARCHAR(255) NOT NULL,
  plan VARCHAR(64) NOT NULL DEFAULT 'PROFESSIONAL',
  monthly_fee VARCHAR(64) NOT NULL DEFAULT '₹799/mo',
  renewal_date VARCHAR(64) NOT NULL,
  brokers_used INT NOT NULL DEFAULT 0,
  brokers_limit VARCHAR(32) NOT NULL DEFAULT '25',
  clients_used INT NOT NULL DEFAULT 0,
  clients_limit VARCHAR(32) NOT NULL DEFAULT '1000',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
