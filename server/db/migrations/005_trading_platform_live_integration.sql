-- 005_trading_platform_live_integration.sql
-- Live Data Projection & Indexing for Trading Platform Integration

-- 1. Ensure trades table has client_code column
ALTER TABLE trades ADD COLUMN IF NOT EXISTS client_code VARCHAR(64);

-- 2. Populate client_code from clients table if null
UPDATE trades t
SET client_code = c.client_code
FROM clients c
WHERE t.client_id = c.id AND (t.client_code IS NULL OR t.client_code = '');

-- 3. High performance indexes for live dashboard and real-time event aggregation
CREATE INDEX IF NOT EXISTS idx_trades_client_code ON trades(client_code);
CREATE INDEX IF NOT EXISTS idx_trades_tenant_created ON trades(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_positions_tenant_status ON positions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_deposits_tenant_status ON fund_deposits(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fund_withdrawals_tenant_status ON fund_withdrawals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_status ON clients(tenant_id, status);
