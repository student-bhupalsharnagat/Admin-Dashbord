-- ====================================================
-- MIGRATION 005: LIVE TRADING PLATFORM PROJECTIONS
-- ====================================================

-- 1. Ensure trades table has client_code
ALTER TABLE trades ADD COLUMN IF NOT EXISTS client_code VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_trades_client_code ON trades(client_code);

-- 2. Ensure positions table has realized_pnl, unrealized_pnl, and margin
ALTER TABLE positions ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(16, 2) DEFAULT 0.00;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS unrealized_pnl NUMERIC(16, 2) DEFAULT 0.00;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS margin NUMERIC(16, 2) DEFAULT 0.00;

-- 3. Ensure fund_deposits and fund_withdrawals have updated_at
ALTER TABLE fund_deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE fund_withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
