-- ====================================================
-- MIGRATION 004: PLATFORM CONTROLS & FEATURES ENHANCEMENT
-- ====================================================

-- 1. Extend platform_settings with all production feature toggles
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS trading_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS support_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS withdrawal_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS options_trading_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_leverage INT NOT NULL DEFAULT 20;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT '';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS broadcast_message TEXT DEFAULT '';

-- 2. Extend custom_domains with domain_type
ALTER TABLE custom_domains ADD COLUMN IF NOT EXISTS domain_type VARCHAR(32) NOT NULL DEFAULT 'CUSTOM';

-- 3. Support fractional quantities in orders, trades, and positions for multi-asset classes
ALTER TABLE orders ALTER COLUMN quantity TYPE NUMERIC(16, 4);
ALTER TABLE trades ALTER COLUMN quantity TYPE NUMERIC(16, 4);
ALTER TABLE positions ALTER COLUMN quantity TYPE NUMERIC(16, 4);

-- 4. Commercial: Commission Transactions Table
CREATE TABLE IF NOT EXISTS commission_transactions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  beneficiary VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL DEFAULT 'Broker',
  amount NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  period VARCHAR(64) NOT NULL DEFAULT 'Current Cycle',
  status VARCHAR(32) NOT NULL DEFAULT 'PAID',
  date VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_txns_tenant ON commission_transactions(tenant_id);
