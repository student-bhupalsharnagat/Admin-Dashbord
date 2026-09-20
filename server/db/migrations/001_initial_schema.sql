-- ====================================================================
-- TradeMatrix Central Admin Panel - PostgreSQL Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- ====================================================================

-- Schema Migrations Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- 1. CORE: Tenants, Branding, Custom Domains, Platform Settings
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  subdomain VARCHAR(128) NOT NULL UNIQUE,
  custom_domain VARCHAR(255),
  plan VARCHAR(64) NOT NULL DEFAULT 'ENTERPRISE',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  owner_name VARCHAR(255) NOT NULL,
  owner_email VARCHAR(255) NOT NULL,
  region VARCHAR(64) DEFAULT 'ap-south-1',
  user_count INT DEFAULT 0,
  max_users INT DEFAULT 10000,
  monthly_volume VARCHAR(64) DEFAULT '0',
  monthly_revenue VARCHAR(64) DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

CREATE TABLE IF NOT EXISTS tenant_branding (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  portal_name VARCHAR(255) NOT NULL,
  tagline VARCHAR(255),
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(32) DEFAULT '#3b82f6',
  accent_color VARCHAR(32) DEFAULT '#10b981',
  support_email VARCHAR(255),
  support_phone VARCHAR(64),
  copyright_text VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tenant_branding_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON tenant_branding(tenant_id);

CREATE TABLE IF NOT EXISTS custom_domains (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  ssl_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  dns_target VARCHAR(255) DEFAULT 'cname.tradematrix.io',
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_tenant ON custom_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

CREATE TABLE IF NOT EXISTS platform_settings (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  web_trading_enabled BOOLEAN NOT NULL DEFAULT true,
  web_version VARCHAR(32) NOT NULL DEFAULT 'v4.8.2-stable',
  web_maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  mobile_android_enabled BOOLEAN NOT NULL DEFAULT true,
  mobile_android_version VARCHAR(32) NOT NULL DEFAULT 'v2.14.0',
  mobile_android_force_update BOOLEAN NOT NULL DEFAULT false,
  mobile_ios_enabled BOOLEAN NOT NULL DEFAULT true,
  mobile_ios_version VARCHAR(32) NOT NULL DEFAULT 'v2.14.0',
  mobile_ios_force_update BOOLEAN NOT NULL DEFAULT false,
  api_enabled BOOLEAN NOT NULL DEFAULT true,
  api_rate_limit INT NOT NULL DEFAULT 120,
  ip_whitelist_enabled BOOLEAN NOT NULL DEFAULT false,
  allowed_ips TEXT[] DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_platform_settings_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_tenant ON platform_settings(tenant_id);

-- --------------------------------------------------------------------
-- 2. IDENTITY & HIERARCHY: Roles, Permissions, Users, Masters, Brokers, Sub-Brokers, Clients
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  module VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  description TEXT,
  CONSTRAINT uq_permission_module_action UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global system roles
  name VARCHAR(128) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(64) NOT NULL DEFAULT 'VIEWER',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  password_hash VARCHAR(255),
  phone VARCHAR(64),
  hierarchy_level VARCHAR(32) DEFAULT 'PLATFORM',
  hierarchy_id VARCHAR(64),
  is_suspended BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- MASTER HIERARCHY LEVEL
CREATE TABLE IF NOT EXISTS masters (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  brokers_count INT NOT NULL DEFAULT 0,
  clients_count INT NOT NULL DEFAULT 0,
  turnover VARCHAR(64) NOT NULL DEFAULT '₹0',
  commission VARCHAR(64) NOT NULL DEFAULT '₹0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_masters_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_masters_tenant ON masters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_masters_status ON masters(status);

-- BROKER HIERARCHY LEVEL (Belongs to a Master)
CREATE TABLE IF NOT EXISTS brokers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  master_id VARCHAR(64) NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
  master_name VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  sub_brokers_count INT NOT NULL DEFAULT 0,
  clients_count INT NOT NULL DEFAULT 0,
  turnover VARCHAR(64) NOT NULL DEFAULT '₹0',
  commission VARCHAR(64) NOT NULL DEFAULT '₹0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_brokers_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_brokers_tenant ON brokers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brokers_master ON brokers(master_id);
CREATE INDEX IF NOT EXISTS idx_brokers_status ON brokers(status);

-- SUB-BROKER HIERARCHY LEVEL (Belongs to a Broker)
CREATE TABLE IF NOT EXISTS sub_brokers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  broker_id VARCHAR(64) NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  broker_name VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  clients_count INT NOT NULL DEFAULT 0,
  turnover VARCHAR(64) NOT NULL DEFAULT '₹0',
  commission VARCHAR(64) NOT NULL DEFAULT '₹0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_sub_brokers_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sub_brokers_tenant ON sub_brokers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_brokers_broker ON sub_brokers(broker_id);
CREATE INDEX IF NOT EXISTS idx_sub_brokers_status ON sub_brokers(status);

-- CLIENT HIERARCHY LEVEL (Belongs to a Sub-Broker)
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sub_broker_id VARCHAR(64) NOT NULL REFERENCES sub_brokers(id) ON DELETE CASCADE,
  sub_broker_name VARCHAR(255),
  client_code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  kyc_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  account_type VARCHAR(32) DEFAULT 'TRADING_DEMAT',
  balance NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  equity NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  margin_used NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  total_trades INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_clients_tenant_code UNIQUE (tenant_id, client_code)
);

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_sub_broker ON clients(sub_broker_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_kyc ON clients(kyc_status);

-- --------------------------------------------------------------------
-- 3. COMPLIANCE & FINANCE: KYC Records, Fund Deposits, Withdrawals, Ledger
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_records (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  pan_number VARCHAR(64) NOT NULL,
  aadhaar_number VARCHAR(64) NOT NULL,
  document_type VARCHAR(64) NOT NULL DEFAULT 'PAN_AADHAAR',
  kyc_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kyc_tenant ON kyc_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_client ON kyc_records(client_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_records(kyc_status);

CREATE TABLE IF NOT EXISTS fund_deposits (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  amount NUMERIC(16, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  payment_method VARCHAR(64) NOT NULL,
  transaction_ref VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fund_deposits_tenant ON fund_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fund_deposits_client ON fund_deposits(client_id);
CREATE INDEX IF NOT EXISTS idx_fund_deposits_status ON fund_deposits(status);

CREATE TABLE IF NOT EXISTS fund_withdrawals (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  amount NUMERIC(16, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  bank_name VARCHAR(255) NOT NULL,
  bank_account_number VARCHAR(128) NOT NULL,
  ifsc_code VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fund_withdrawals_tenant ON fund_withdrawals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fund_withdrawals_client ON fund_withdrawals(client_id);
CREATE INDEX IF NOT EXISTS idx_fund_withdrawals_status ON fund_withdrawals(status);

-- IMMUTABLE FINANCIAL LEDGER
CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  entry_type VARCHAR(64) NOT NULL, -- 'DEPOSIT', 'WITHDRAWAL', 'TRADE_BUY', 'TRADE_SELL', 'COMMISSION', 'MARGIN_CALL'
  debit NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  balance_after NUMERIC(16, 2) NOT NULL,
  reference_id VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  is_finalized BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_client ON ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at);

-- IMMUTABILITY TRIGGER ON FINALIZED LEDGER ENTRIES
CREATE OR REPLACE FUNCTION prevent_finalized_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_finalized = true THEN
      RAISE EXCEPTION 'Ledger entries are immutable. Deletion of finalized ledger record % is forbidden.', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_finalized = true THEN
      RAISE EXCEPTION 'Ledger entries are immutable. Modification of finalized ledger record % is forbidden.', OLD.id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_ledger ON ledger_entries;
CREATE TRIGGER trg_immutable_ledger
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_finalized_ledger_modification();

-- --------------------------------------------------------------------
-- 4. TRADING: Orders, Trades, Positions
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  exchange VARCHAR(16) NOT NULL DEFAULT 'NSE',
  order_type VARCHAR(32) NOT NULL DEFAULT 'LIMIT', -- 'MARKET', 'LIMIT', 'STOP_LOSS'
  side VARCHAR(16) NOT NULL, -- 'BUY', 'SELL'
  quantity INT NOT NULL,
  price NUMERIC(16, 2) NOT NULL,
  trigger_price NUMERIC(16, 2),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);

CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trade_id VARCHAR(64) NOT NULL,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  order_id VARCHAR(64),
  symbol VARCHAR(32) NOT NULL,
  exchange VARCHAR(16) NOT NULL DEFAULT 'NSE',
  side VARCHAR(16) NOT NULL,
  quantity INT NOT NULL,
  price NUMERIC(16, 2) NOT NULL,
  total_value NUMERIC(16, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'EXECUTED',
  timestamp VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trades_tenant ON trades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trades_client ON trades(client_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_code VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  exchange VARCHAR(16) NOT NULL DEFAULT 'NSE',
  side VARCHAR(16) NOT NULL,
  quantity INT NOT NULL,
  buy_price NUMERIC(16, 2) NOT NULL,
  current_price NUMERIC(16, 2) NOT NULL,
  pnl NUMERIC(16, 2) NOT NULL DEFAULT 0.00,
  pnl_percentage NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_positions_tenant ON positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_positions_client ON positions(client_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);

-- --------------------------------------------------------------------
-- 5. COMMERCIAL: Commission Plans, Rules, Risk Profiles, Risk Events
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS commission_plans (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  plan_type VARCHAR(64) NOT NULL DEFAULT 'PERCENTAGE_VOLUME',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_plans_tenant ON commission_plans(tenant_id);

CREATE TABLE IF NOT EXISTS commission_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) NOT NULL REFERENCES commission_plans(id) ON DELETE CASCADE,
  asset_class VARCHAR(64) NOT NULL DEFAULT 'EQUITY',
  rate_type VARCHAR(32) NOT NULL DEFAULT 'PERCENTAGE',
  rate_value NUMERIC(10, 4) NOT NULL,
  min_per_trade NUMERIC(10, 2) DEFAULT 0.00,
  max_per_trade NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant ON commission_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_plan ON commission_rules(plan_id);

CREATE TABLE IF NOT EXISTS risk_profiles (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  max_leverage INT NOT NULL DEFAULT 10,
  max_order_value NUMERIC(16, 2) NOT NULL DEFAULT 1000000.00,
  daily_loss_limit NUMERIC(16, 2) NOT NULL DEFAULT 50000.00,
  margin_call_threshold NUMERIC(6, 2) NOT NULL DEFAULT 80.00,
  auto_square_off_threshold NUMERIC(6, 2) NOT NULL DEFAULT 95.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_profiles_tenant ON risk_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS risk_events (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) REFERENCES clients(id) ON DELETE SET NULL,
  client_code VARCHAR(64),
  client_name VARCHAR(255),
  event_type VARCHAR(64) NOT NULL, -- 'MARGIN_CALL', 'AUTO_SQUARE_OFF', 'MAX_ORDER_EXCEEDED'
  severity VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_events_tenant ON risk_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);

-- --------------------------------------------------------------------
-- 6. SECURITY & SYSTEM: Audit Logs, Sessions, Login History, Support, Notifications, Emergency Controls
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for central admin platform logs
  user_id VARCHAR(64),
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(128) NOT NULL,
  module VARCHAR(64) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(64) DEFAULT '127.0.0.1',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  device VARCHAR(128) DEFAULT 'Desktop Chrome',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  token_hash VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_by VARCHAR(255),
  login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

CREATE TABLE IF NOT EXISTS login_history (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64),
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  location VARCHAR(128) DEFAULT 'Mumbai, India',
  status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED'
  reason VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_history_tenant ON login_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON login_history(user_email);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status);

CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number VARCHAR(64) NOT NULL UNIQUE,
  client_id VARCHAR(64) REFERENCES clients(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'TRADING',
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
  assigned_to VARCHAR(255),
  replies JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(64) NOT NULL DEFAULT 'INFO',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE TABLE IF NOT EXISTS emergency_controls (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform-wide emergency controls
  global_trading_active BOOLEAN NOT NULL DEFAULT true,
  global_kill_switch_active BOOLEAN NOT NULL DEFAULT false,
  new_user_creation_enabled BOOLEAN NOT NULL DEFAULT true,
  api_access_enabled BOOLEAN NOT NULL DEFAULT true,
  trading_reason VARCHAR(255),
  trading_paused_at TIMESTAMP WITH TIME ZONE,
  trading_paused_by VARCHAR(255),
  kill_switch_details JSONB DEFAULT NULL,
  frozen_masters JSONB DEFAULT '[]'::jsonb,
  frozen_brokers JSONB DEFAULT '[]'::jsonb,
  frozen_users JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emergency_controls_tenant ON emergency_controls(tenant_id);
