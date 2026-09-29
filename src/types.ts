/**
 * Types & Interfaces for TradePro Central Admin Panel
 */

export type UserRole = 
  | 'PLATFORM_OWNER'
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'TENANT_ADMIN'
  | 'MASTER'
  | 'BROKER'
  | 'SUB_BROKER'
  | 'COMPLIANCE_OFFICER'
  | 'RISK_MANAGER'
  | 'SUPPORT_AGENT'
  | 'CLIENT';

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export type KYCStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';

export type TradeSide = 'BUY' | 'SELL';

export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export type PlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'HYBRID_CUSTOM';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string;
  tenant_name?: string;
  avatar?: string;
  phone?: string;
  status: EntityStatus;
  created_at: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleName?: string;
  tenant_id: string | null;
  tenant_name?: string;
  avatar?: string;
  phone?: string;
  permissions?: string[];
  simulated_tenant_id?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  code: string;
  status: EntityStatus;
  plan?: PlanType;
  tier?: string;
  clients?: number;
  turnover?: string;
  created?: string;
  admin_name?: string;
  admin_email?: string;
  admin_phone?: string;
  domain?: string;
  support_email?: string;
  total_users?: number;
  active_users?: number;
  trading_volume?: string;
  trading_volume_raw?: number;
  pl?: string;
  pl_raw?: number;
  margin?: string;
  commission?: string;
  created_at?: string;
  notes?: string;
}

export interface Master {
  id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  brokers_count: number;
  total_brokers?: number;
  clients_count: number;
  total_clients?: number;
  turnover: string;
  commission?: string;
  commission_earned: string;
  status: EntityStatus;
  region: string;
  created_at: string;
}

export interface Broker {
  id: string;
  master_id: string;
  master_name: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  code: string;
  email: string;
  sub_brokers_count: number;
  total_sub_brokers?: number;
  clients_count: number;
  total_clients?: number;
  turnover: string;
  commission?: string;
  commission_earned: string;
  status: EntityStatus;
  created_at: string;
}

export interface SubBroker {
  id: string;
  broker_id: string;
  broker_name: string;
  master_name?: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  code: string;
  email: string;
  clients_count: number;
  total_clients?: number;
  turnover: string;
  commission?: string;
  commission_earned: string;
  status: EntityStatus;
  created_at: string;
}

export interface Client {
  id: string;
  client_code: string;
  sub_broker_id: string;
  sub_broker_name: string;
  broker_name: string;
  master_name: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  email: string;
  phone: string;
  kyc_status: KYCStatus;
  wallet_balance: number;
  available_margin: number;
  todays_pl: number;
  open_positions_count?: number;
  status: EntityStatus;
  created_at: string;
}

export interface Trade {
  id: string;
  trade_id: string;
  client_id: string;
  client_name: string;
  tenant_id: string;
  tenant_name: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  total_value: number;
  pl: number;
  status: 'EXECUTED' | 'SETTLED' | 'CANCELLED';
  exchange?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  order_id: string;
  client_id?: string;
  client_name: string;
  tenant_id?: string;
  tenant_name: string;
  symbol: string;
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  side: TradeSide;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: string;
}

export interface KYCRecord {
  id: string;
  client_id: string;
  client_name: string;
  tenant_id: string;
  tenant_name: string;
  kyc_status: KYCStatus;
  document_type: string;
  document_status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  assigned_reviewer: string;
  submitted_date: string;
  id_number?: string;
  pan?: string;
  status?: string;
  submitted_at?: string;
  notes?: string;
}

export interface FundDepositItem {
  id?: string;
  txnId: string;
  client: string;
  amount: string;
  method: string;
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED';
  date: string;
  rawAmount: number;
}

export interface FundWithdrawalItem {
  id?: string;
  txnId: string;
  client: string;
  amount: string;
  method: string;
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED';
  date: string;
  rawAmount: number;
}

export interface LedgerRowItem {
  date: string;
  txnId: string;
  account: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'P&L';
  credit: string;
  debit: string;
  balance: string;
  reference: string;
  status: 'COMPLETED' | 'PROCESSING' | 'PENDING';
}

export interface DashboardKPIs {
  total_masters?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  total_brokers?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  total_clients?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  commission_earned?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  todays_turnover?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  total_turnover?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  total_pl?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  net_pl?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  pending_kyc?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  open_tickets?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  total_sub_brokers?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  active_clients?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  pending_deposits?: {
    value?: number | string;
    amount?: number | string;
    formatted_amount?: string;
    badge?: string;
    subtitle?: string;
  };
  pending_withdrawals?: {
    value?: number | string;
    amount?: number | string;
    formatted_amount?: string;
    badge?: string;
    subtitle?: string;
  };
  open_positions?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  pending_orders?: {
    value?: number | string;
    badge?: string;
    subtitle?: string;
  };
  trading_volume?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  used_margin?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  available_margin?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  equity?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  realized_pl?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
  unrealized_pl?: {
    value?: string | number;
    raw?: number;
    badge?: string;
    subtitle?: string;
  };
}

export interface VolumeCommissionChartPoint {
  date: string;
  displayDate: string;
  volume: number;      // in Millions
  commission: number;  // in Thousands/Lakhs
}

export interface ClientGrowthChartPoint {
  month: string;
  clients: number;
}

export interface DailyPLPoint {
  day: string;
  displayDay: string;
  pl: number;          // in thousands
  isProfit: boolean;
}

export interface WhiteLabelConfig {
  tenant_id: string;
  tenant_name: string;
  brand_name?: string;
  short_name?: string;
  tagline?: string;
  company_name?: string;
  logo_url: string;
  logo_light_url?: string;
  logo_dark_url?: string;
  favicon_url: string;
  app_icon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color?: string;
  background_color?: string;
  surface_color?: string;
  text_color?: string;
  success_color?: string;
  warning_color?: string;
  error_color?: string;
  login_branding?: string;
  login_background_url?: string;
  login_title?: string;
  login_subtitle?: string;
  welcome_text?: string;
  support_contact?: string;
  custom_domain: string;
  support_email: string;
  support_phone?: string;
  company_address?: string;
  website_url?: string;
  help_support_url?: string;
  footer_text: string;
  footer_copyright?: string;
  terms_url: string;
  privacy_url: string;
  risk_disclosure_url?: string;
  disclaimer_url?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sync_status?: 'SYNCED' | 'FAILED' | 'PENDING';
  last_published_at?: string;
  last_published_by?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export type TenantBranding = WhiteLabelConfig;

export interface TenantDomain {
  id: string;
  tenant_id: string;
  tenant_name: string;
  domain: string;
  domain_type: 'CUSTOM' | 'SUBDOMAIN' | 'TRADING' | 'SUPPORT';
  verification_status: 'VERIFIED' | 'PENDING' | 'FAILED';
  is_verified?: boolean;
  is_primary: boolean;
  ssl_status: 'ACTIVE' | 'PROVISIONING' | 'PENDING';
  created_at: string;
}

export interface TenantPlatformConfig {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  web_trading_enabled: boolean;
  mobile_trading_enabled: boolean;
  registration_enabled: boolean;
  forgot_password_enabled: boolean;
  support_enabled: boolean;
  notifications_enabled: boolean;
  api_enabled: boolean;
  trading_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message?: string;
  created_at: string;
  updated_at: string;
}

export interface BrandingAuditLog {
  id: string;
  actor: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  action:
    | 'BRANDING_UPDATED'
    | 'BRANDING_PUBLISHED'
    | 'BRANDING_ROLLED_BACK'
    | 'DOMAIN_ADDED'
    | 'DOMAIN_CHANGED'
    | 'DOMAIN_VERIFIED'
    | 'DOMAIN_DISABLED'
    | 'PLATFORM_CONFIG_UPDATED'
    | 'TRADING_ENABLED'
    | 'TRADING_DISABLED'
    | 'REGISTRATION_ENABLED'
    | 'REGISTRATION_DISABLED'
    | 'API_ENABLED'
    | 'API_DISABLED';
  entity: string;
  old_value: string;
  new_value: string;
  timestamp: string;
  created_at?: string;
  ip_address: string;
  reason?: string;
  details?: any;
}

export interface SupportTicketMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  isStaff?: boolean;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  tenant_id: string;
  tenant_name: string;
  subject: string;
  client_name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  created_at: string;
  category?: string;
  messages?: SupportTicketMessage[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_role: string;
  tenant_name: string;
  action: string;
  resource: string;
  ip_address: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
}

export interface SubscriptionPlan {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan_name: string;
  pricing_model: 'FIXED_MONTHLY' | 'PER_USER' | 'VOLUME_TIERED' | 'HYBRID';
  monthly_base_fee: number;
  volume_rate_bps: number;
  user_limit: number;
  current_users: number;
  renewal_date: string;
  status: 'ACTIVE' | 'OVERDUE' | 'TRIAL';
}

export interface DashboardData {
  kpis: DashboardKPIs;
  volumeCommission: VolumeCommissionChartPoint[];
  clientGrowth: ClientGrowthChartPoint[];
  dailyPL: DailyPLPoint[];
  dailyPLBadge?: string;
  recentTrades: Trade[];
  pendingKYC: KYCRecord[];
  tenants: Tenant[];
}

export interface LedgerEntry {
  id: string;
  entry_type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance_after: number;
  account_name: string;
  reference: string;
  timestamp: string;
}

// ----------------------------------------------------
// Emergency Controls Types
// ----------------------------------------------------
export interface EmergencyControlsState {
  globalTradingActive: boolean;
  globalKillSwitchActive: boolean;
  tradingReason?: string;
  trading_paused_at?: string;
  trading_paused_by?: string;
  killSwitchDetails?: {
    triggeredBy: string;
    triggeredAt: string;
    reason: string;
    ipAddress?: string;
  };
  newUserCreationEnabled: boolean;
  apiAccessEnabled: boolean;
  frozenMasters: Array<{
    masterId: string;
    masterName: string;
    frozenBy: string;
    frozenAt: string;
    reason: string;
  }>;
  frozenBrokers: Array<{
    brokerId: string;
    brokerName: string;
    frozenBy: string;
    frozenAt: string;
    reason: string;
  }>;
  frozenUsers: Array<{
    userId: string;
    userName: string;
    frozenBy: string;
    frozenAt: string;
    reason: string;
  }>;
}

// ----------------------------------------------------
// Master Limits & Master-Wise Management
// ----------------------------------------------------
export interface MasterLimits {
  master_id: string;
  master_name: string;
  max_total_users: number;
  current_total_users: number;
  max_active_users: number;
  current_active_users: number;
  max_brokers: number;
  current_brokers: number;
  max_sub_brokers: number;
  current_sub_brokers: number;
  max_clients: number;
  current_clients: number;
  max_trading_volume_daily: number; // in rupees
  current_trading_volume_daily: number;
  max_api_requests_daily: number;
  current_api_requests_daily: number;
  status: 'NORMAL' | 'APPROACHING_LIMIT' | 'EXCEEDED';
  last_updated: string;
}

export interface MasterPricingConfig {
  master_id: string;
  master_name: string;
  plan: string;
  base_price_monthly: number;
  user_based_pricing: number; // per user fee
  active_user_pricing: number; // per active user
  trading_volume_bps: number; // basis points on turnover
  other_charges: number;
  effective_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED';
}

export interface MasterBrokerageConfig {
  master_id: string;
  master_name: string;
  equity_delivery_brokerage: number; // %
  equity_intraday_brokerage: number; // %
  futures_brokerage: number; // per order or %
  options_brokerage: number; // per lot or per order
  transaction_charges_bps: number;
  platform_charges_monthly: number;
  turnover_charge_bps: number;
  custom_rules?: string;
  effective_date: string;
}

export interface MasterApiPermission {
  master_id: string;
  master_name: string;
  api_enabled: boolean;
  read_access: boolean;
  trading_order_access: boolean;
  account_access: boolean;
  reporting_access: boolean;
  user_management_access: boolean;
  webhook_access: boolean;
  rate_limit_per_minute: number;
}

export interface MasterBrandingConfig {
  master_id: string;
  master_name: string;
  brand_name: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  theme_mode: 'dark' | 'light' | 'hybrid';
  login_page_branding: string;
  custom_domain: string;
  sub_domain: string;
  footer_text: string;
  support_contact: string;
  support_email: string;
}

export interface MasterSubscriptionConfig {
  master_id: string;
  master_name: string;
  plan_name: string;
  start_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED';
  auto_renew: boolean;
  user_limit: number;
  features: string[];
  notes?: string;
}

export interface MasterRevenueData {
  master_id: string;
  master_name: string;
  total_revenue: number;
  brokerage_revenue: number;
  platform_charges: number;
  other_charges: number;
  turnover: number;
  monthly_growth_rate: number;
  brokers_revenue: Array<{
    broker_id: string;
    broker_name: string;
    revenue: number;
    turnover: number;
  }>;
}

// ----------------------------------------------------
// Monitoring Types
// ----------------------------------------------------
export interface LoginHistoryItem {
  id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  login_time: string;
  logout_time?: string;
  ip_address: string;
  device: string;
  browser: string;
  os: string;
  status: 'SUCCESS' | 'FAILED';
  failure_reason?: string;
}

export interface SessionItem {
  id: string;
  session_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  ip_address: string;
  device: string;
  browser: string;
  login_time: string;
  last_activity: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface OrderAuditTrailItem {
  id: string;
  order_id: string;
  user_name: string;
  action: 'ORDER_CREATED' | 'ORDER_MODIFIED' | 'ORDER_CANCELLED' | 'ORDER_EXECUTED' | 'ORDER_REJECTED';
  symbol: string;
  old_value: string;
  new_value: string;
  timestamp: string;
  ip_address: string;
  session_id: string;
}

export interface ApiActivityItem {
  id: string;
  api_key_alias: string;
  user_name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  timestamp: string;
  status_code: number;
  ip_address: string;
  request_id: string;
  rate_limit_remaining: number;
  latency_ms: number;
}

export interface SuspiciousActivityAlert {
  id: string;
  type: 'FAILED_LOGIN_REPEATED' | 'MULTIPLE_IPS' | 'HIGH_ORDER_RATE' | 'UNUSUAL_SESSION' | 'API_SPIKE';
  title: string;
  description: string;
  user_identifier: string;
  ip_address: string;
  severity: 'HIGH' | 'CRITICAL' | 'MEDIUM';
  timestamp: string;
  status: 'UNRESOLVED' | 'RESOLVED';
}

export interface UserCreationLogItem {
  id: string;
  created_by_name: string;
  created_by_role: string;
  target_user_name: string;
  target_user_email: string;
  assigned_role: string;
  tenant_or_master: string;
  timestamp: string;
  source: string;
}

export interface DataDeletionLogItem {
  id: string;
  performed_by_name: string;
  entity_type: string;
  target_id: string;
  target_name: string;
  deletion_type: 'SOFT_DELETE' | 'DEACTIVATED';
  reason: string;
  timestamp: string;
  ip_address: string;
}

export interface ConfigurationChangeLogItem {
  id: string;
  config_module: 'BROKERAGE' | 'PRICING' | 'LIMITS' | 'API_PERMISSIONS' | 'BRANDING' | 'SUBSCRIPTION' | 'EMERGENCY_CONTROLS' | 'SYSTEM_SETTINGS';
  setting_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  timestamp: string;
  reason: string;
  ip_address: string;
}

// ----------------------------------------------------
// Platform Management (Web & Mobile Trading Platform)
// ----------------------------------------------------
export interface PlatformManagementConfig {
  web_trading_enabled: boolean;
  web_version: string;
  web_maintenance_mode: boolean;
  mobile_android_enabled: boolean;
  mobile_android_min_version: string;
  mobile_ios_enabled: boolean;
  mobile_ios_min_version: string;
  mobile_maintenance_mode: boolean;
  broadcast_message?: string;
  last_updated: string;
}

// ----------------------------------------------------
// Role-Based Access Control (RBAC)
// ----------------------------------------------------

export type ResourceModule =
  | 'DASHBOARD'
  | 'TENANTS'
  | 'MASTERS'
  | 'BROKERS'
  | 'SUB_BROKERS'
  | 'CLIENTS'
  | 'DOWNLINE_TREE'
  | 'TRADING_ORDERS'
  | 'TRADES'
  | 'POSITIONS'
  | 'FUNDS'
  | 'LEDGER'
  | 'COMMISSIONS'
  | 'RISK_LIMITS'
  | 'KYC'
  | 'REPORTS'
  | 'NOTIFICATIONS'
  | 'SUPPORT'
  | 'SUBSCRIPTIONS'
  | 'WHITE_LABEL'
  | 'AUDIT_LOGS'
  | 'SETTINGS_CONTROLS'
  | 'ROLES_PERMISSIONS';

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'EXPORT'
  | 'APPROVE'
  | 'EXECUTE';

export interface RoleDefinition {
  id: string;
  name: string;
  code: UserRole | string;
  description: string;
  isSystemRole: boolean;
  userCount: number;
  badgeColor: string;
  permissions: Record<ResourceModule, PermissionAction[]>;
  createdAt: string;
  updatedAt: string;
}

export interface RbacUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  roleName: string;
  tenantId: string;
  tenantName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  twoFactorEnabled: boolean;
  customPermissions?: Partial<Record<ResourceModule, PermissionAction[]>>;
  lastLogin: string;
  avatar?: string;
}

export interface RbacAuditLogItem {
  id: string;
  actorName: string;
  actorRole: string;
  action: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED' | 'PERMISSIONS_MODIFIED' | 'USER_ASSIGNED';
  targetRoleOrUser: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}



