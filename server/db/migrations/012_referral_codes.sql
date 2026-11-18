-- Migration 012: Add unique referral_code to masters, brokers, and sub_brokers
ALTER TABLE masters ADD COLUMN IF NOT EXISTS referral_code VARCHAR(64);
ALTER TABLE brokers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(64);
ALTER TABLE sub_brokers ADD COLUMN IF NOT EXISTS referral_code VARCHAR(64);

UPDATE masters
SET referral_code = 'MST-' || LPAD(UPPER(RIGHT(REGEXP_REPLACE(id, '[^A-Za-z0-9]', '', 'g'), 4)), 4, '0')
WHERE referral_code IS NULL OR referral_code = '';

UPDATE brokers
SET referral_code = 'BRK-' || LPAD(UPPER(RIGHT(REGEXP_REPLACE(id, '[^A-Za-z0-9]', '', 'g'), 4)), 4, '0')
WHERE referral_code IS NULL OR referral_code = '';

UPDATE sub_brokers
SET referral_code = 'SUB-' || LPAD(UPPER(RIGHT(REGEXP_REPLACE(id, '[^A-Za-z0-9]', '', 'g'), 4)), 4, '0')
WHERE referral_code IS NULL OR referral_code = '';

CREATE INDEX IF NOT EXISTS idx_masters_referral_code ON masters(referral_code);
CREATE INDEX IF NOT EXISTS idx_brokers_referral_code ON brokers(referral_code);
CREATE INDEX IF NOT EXISTS idx_sub_brokers_referral_code ON sub_brokers(referral_code);
