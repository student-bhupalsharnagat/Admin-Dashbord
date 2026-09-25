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
