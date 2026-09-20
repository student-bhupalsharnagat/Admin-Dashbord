-- Migration 002: Add hierarchy and session columns for Phase 4 Auth & RBAC
-- Preserves existing tables and data

-- 1. Users table enhancements for hierarchy and security
ALTER TABLE users ADD COLUMN IF NOT EXISTS hierarchy_level VARCHAR(32) DEFAULT 'PLATFORM';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hierarchy_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- 2. Sessions table enhancements for JWT / revocation / expiry tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours');
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255);

-- 3. Additional performance indexes for auth and tenant scoping
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
