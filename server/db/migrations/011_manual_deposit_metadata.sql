-- Migration 011: Add manual deposit metadata (UTR number and payment proof screenshot URL)
ALTER TABLE fund_deposits ADD COLUMN IF NOT EXISTS utr_number VARCHAR(128);
ALTER TABLE fund_deposits ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS utr_number VARCHAR(128);
ALTER TABLE fund_transactions ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_fund_deposits_utr ON fund_deposits(utr_number);
CREATE INDEX IF NOT EXISTS idx_fund_tx_utr ON fund_transactions(utr_number);

