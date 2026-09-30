import {
  DashboardKPIs,
  VolumeCommissionChartPoint,
  ClientGrowthChartPoint,
  ClientRegistrationPoint,
  AssetAllocationSlice,
  RecentRegistration,
  DailyPLTrend,
  Trade,
  KYCRecord,
  Tenant,
  Master,
  Broker,
  SubBroker,
  Client,
  Order,
  WhiteLabelConfig,
  TenantDomain,
  TenantPlatformConfig,
  BrandingAuditLog,
  SupportTicket,
  AuditLog,
  SubscriptionPlan,
  EmergencyControlsState,
  MasterLimits,
  MasterPricingConfig,
  MasterBrokerageConfig,
  MasterApiPermission,
  MasterBrandingConfig,
  MasterSubscriptionConfig,
  MasterRevenueData,
  LoginHistoryItem,
  SessionItem,
  OrderAuditTrailItem,
  ApiActivityItem,
  SuspiciousActivityAlert,
  UserCreationLogItem,
  DataDeletionLogItem,
  ConfigurationChangeLogItem,
  PlatformManagementConfig,
  RoleDefinition,
  RbacUser,
  RbacAuditLogItem,
  FundDepositItem,
  FundWithdrawalItem,
  LedgerRowItem
} from '../../src/types.ts';
import { DEFAULT_ROLE_PERMISSIONS } from '../../src/utils/rbac.ts';
import { tradingPlatformClient } from '../services/TradingPlatformClient.ts';
import { tenantConfigCache } from './TenantConfigCache.ts';
import { query } from '../db/connection.ts';
import { adminEventBus } from '../services/EventHandler.ts';

export type EntityStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface ITradingDataProvider {
  getDashboardKPIs(tenantId?: string, timeRange?: string): Promise<DashboardKPIs>;
  getVolumeCommissionChart(tenantId?: string, timeRange?: string): Promise<VolumeCommissionChartPoint[]>;
  getClientGrowthChart(tenantId?: string): Promise<ClientGrowthChartPoint[]>;
  getNewClientRegistrations(tenantId?: string, timeRange?: string): Promise<ClientRegistrationPoint[]>;
  getAssetAllocation(tenantId?: string, timeRange?: string): Promise<AssetAllocationSlice[]>;
  getDailyPLTrend(tenantId?: string, timeRange?: string): Promise<DailyPLTrend>;
  getRecentTrades(tenantId?: string, limit?: number): Promise<Trade[]>;
  getRecentRegistrations(tenantId?: string, limit?: number): Promise<RecentRegistration[]>;
  getPendingKYC(tenantId?: string, limit?: number): Promise<KYCRecord[]>;
  
  // Tenants
  getTenants(query?: { search?: string; status?: string }): Promise<Tenant[]>;
  getTenantById(id: string): Promise<Tenant | null>;
  createTenant(data: Partial<Tenant>): Promise<Tenant>;
  updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'): Promise<Tenant | null>;
  
  // Hierarchy
  getMasters(tenantId?: string): Promise<Master[]>;
  getBrokers(tenantId?: string, masterId?: string): Promise<Broker[]>;
  getSubBrokers(tenantId?: string, brokerId?: string): Promise<SubBroker[]>;
  getClients(tenantId?: string, subBrokerId?: string): Promise<Client[]>;
  createMaster(data: Partial<Master>): Promise<Master>;
  createBroker(data: Partial<Broker>): Promise<Broker>;
  createSubBroker(data: Partial<SubBroker>): Promise<SubBroker>;
  createClient(data: Partial<Client>): Promise<Client>;
  updateMasterStatus(id: string, status: EntityStatus): Promise<Master | null>;
  updateBrokerStatus(id: string, status: EntityStatus): Promise<Broker | null>;
  updateSubBrokerStatus(id: string, status: EntityStatus): Promise<SubBroker | null>;
  updateClientStatus(id: string, status: EntityStatus): Promise<Client | null>;
  updateMaster(id: string, data: Partial<Master>): Promise<Master | null>;
  updateBroker(id: string, data: Partial<Broker>): Promise<Broker | null>;
  updateSubBroker(id: string, data: Partial<SubBroker>): Promise<SubBroker | null>;
  updateClient(id: string, data: Partial<Client>): Promise<Client | null>;
  getClientAccountDetails?(clientId: string, tenantId?: string): Promise<any>;
  getClientOrders?(clientId: string, tenantId?: string): Promise<any[]>;
  getClientTrades?(clientId: string, tenantId?: string): Promise<any[]>;
  getClientPositions?(clientId: string, tenantId?: string): Promise<any[]>;
  
  // Compliance & KYC
  getKYCRecords(tenantId?: string, status?: string): Promise<KYCRecord[]>;
  updateKYCStatus(id: string, status: KYCRecord['kyc_status'], notes?: string): Promise<KYCRecord | null>;
  getFundDeposits(tenantId?: string, status?: string): Promise<FundDepositItem[]>;
  approveFundDeposit(id: string, actor: string): Promise<any>;
  rejectFundDeposit(id: string, actor: string): Promise<any>;
  createFundDeposit(data: any): Promise<any>;
  getFundWithdrawals(tenantId?: string, status?: string): Promise<FundWithdrawalItem[]>;
  approveFundWithdrawal(id: string, actor: string): Promise<any>;
  rejectFundWithdrawal(id: string, actor: string): Promise<any>;
  createFundWithdrawal(data: any): Promise<any>;
  getLedgerEntries(tenantId?: string, type?: string): Promise<LedgerRowItem[]>;
  createLedgerEntry(data: any): Promise<any>;
  
  // Trading & Positions
  getOrders(tenantId?: string): Promise<Order[]>;
  getAllTrades(tenantId?: string): Promise<Trade[]>;
  getPositions(tenantId?: string): Promise<any[]>;
  squareOffPosition(id: string, actor: string): Promise<any>;
  emergencyMarginSquareOff?(actor?: string, reason?: string, tenantId?: string): Promise<any>;
  getCommissionPlans(tenantId?: string): Promise<any[]>;
  getCommissionRules(tenantId?: string, planId?: string): Promise<any[]>;
  getCommissionTransactions?(tenantId?: string): Promise<any[]>;
  createCommissionTransaction?(data: any): Promise<any>;
  getRiskProfiles(tenantId?: string): Promise<any[]>;
  getRiskEvents(tenantId?: string): Promise<any[]>;
  getNotifications(tenantId?: string): Promise<any[]>;
  markNotificationRead(id: string): Promise<any>;
  
  // Tools & Administration
  getSubscriptions(tenantId?: string): Promise<any[]>;
  getWhiteLabelConfigs(): Promise<WhiteLabelConfig[]>;
  getWhiteLabelConfig(tenantId: string): Promise<WhiteLabelConfig | null>;
  updateWhiteLabelConfig(tenantId: string, data: Partial<WhiteLabelConfig>, actor?: string): Promise<WhiteLabelConfig>;
  publishWhiteLabelConfig(tenantId: string, actor: string, reason?: string): Promise<WhiteLabelConfig>;
  rollbackWhiteLabelConfig(tenantId: string, actor: string): Promise<WhiteLabelConfig>;
  getWhiteLabelVersions?(tenantId: string): Promise<any[]>;
  getTenantSyncState?(tenantId: string): Promise<any>;
  syncTenantConfig?(tenantId: string, actor?: string): Promise<any>;
  
  // Platform Configuration & Feature Flags
  getTenantPlatformConfig(tenantId: string): Promise<TenantPlatformConfig>;
  updateTenantPlatformConfig(tenantId: string, data: Partial<TenantPlatformConfig>, actor: string): Promise<TenantPlatformConfig>;
  
  // Domains
  getTenantDomains(tenantId?: string): Promise<TenantDomain[]>;
  addTenantDomain(tenantId: string, domain: Partial<TenantDomain>, actor: string): Promise<TenantDomain>;
  updateTenantDomain(id: string, updates: Partial<TenantDomain>, actor: string): Promise<TenantDomain>;
  deleteTenantDomain(id: string, actor: string): Promise<boolean>;
  verifyTenantDomain(id: string, actor: string): Promise<TenantDomain>;
  resolveTenantByDomain(domain: string): Promise<{ tenant: Tenant | null; branding: WhiteLabelConfig | null; platformConfig: TenantPlatformConfig | null }>;
  
  // Branding Audits
  getBrandingAuditLogs(tenantId?: string): Promise<BrandingAuditLog[]>;
  
  // Tenant Order Execution with feature-flag enforcement
  executeTenantOrder(tenantId: string, orderData: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: 'MARKET' | 'LIMIT';
    clientName?: string;
  }): Promise<{ success: boolean; order?: Order; trade?: Trade; message?: string; error?: string }>;

  getSupportTickets(tenantId?: string): Promise<SupportTicket[]>;
  updateSupportTicket(ticketId: string, data: Partial<SupportTicket>, actor?: string): Promise<SupportTicket | null>;
  addSupportTicketReply(ticketId: string, message: string, actor?: string, role?: string): Promise<SupportTicket | null>;
  getAuditLogs(tenantId?: string): Promise<AuditLog[]>;

  // Emergency Controls
  getEmergencyControls(): Promise<EmergencyControlsState>;
  getEmergencyState(): Promise<EmergencyControlsState>;
  freezeMaster(masterId: string, masterName: string, actor: string, reason: string): Promise<EmergencyControlsState>;
  unfreezeMaster(masterId: string, actor: string): Promise<EmergencyControlsState>;
  freezeBroker(brokerId: string, brokerName: string, actor: string, reason: string): Promise<EmergencyControlsState>;
  unfreezeBroker(brokerId: string, actor: string): Promise<EmergencyControlsState>;
  freezeUser(userId: string, userName: string, actor: string, reason: string): Promise<EmergencyControlsState>;
  unfreezeUser(userId: string, actor: string): Promise<EmergencyControlsState>;
  setGlobalTrading(active: boolean, actor: string, reason?: string): Promise<EmergencyControlsState>;
  setGlobalTradingActive(active: boolean, actor: string, reason?: string): Promise<EmergencyControlsState>;
  triggerKillSwitch(actionOrActor: string, actorOrReason: string, ipOrReason?: string): Promise<EmergencyControlsState>;
  deactivateKillSwitch(actor: string, reason: string): Promise<EmergencyControlsState>;
  setNewUserCreation(enabled: boolean, actor: string): Promise<EmergencyControlsState>;
  setRegistrationActive(enabled: boolean, actor: string): Promise<EmergencyControlsState>;
  setApiAccess(enabled: boolean, actor: string): Promise<EmergencyControlsState>;
  setApiAccessActive(enabled: boolean, actor: string): Promise<EmergencyControlsState>;
  executeAccountAction(entityType: string, entityId: string, action: string, actor: string, reason: string): Promise<any>;
  cancelAllOrders(actor?: string, reason?: string): Promise<{ cancelledOrdersCount: number; message: string }>;

  // Master Management
  getMasterLimits(masterId?: string): Promise<MasterLimits[]>;
  updateMasterLimits(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits>;
  updateMasterLimit(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits>;
  getMasterPricing(masterId?: string): Promise<MasterPricingConfig[]>;
  updateMasterPricing(masterId: string, data: Partial<MasterPricingConfig>, actor: string): Promise<MasterPricingConfig>;
  getMasterBrokerage(masterId?: string): Promise<MasterBrokerageConfig[]>;
  updateMasterBrokerage(masterId: string, data: Partial<MasterBrokerageConfig>, actor: string): Promise<MasterBrokerageConfig>;
  getMasterApiPermissions(masterId?: string): Promise<MasterApiPermission[]>;
  updateMasterApiPermissions(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission>;
  updateMasterApiPermission(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission>;
  getMasterBranding(masterId?: string): Promise<MasterBrandingConfig[]>;
  updateMasterBranding(masterId: string, data: Partial<MasterBrandingConfig>, actor: string): Promise<MasterBrandingConfig>;
  getMasterSubscriptions(masterId?: string): Promise<MasterSubscriptionConfig[]>;
  updateMasterSubscription(masterId: string, data: Partial<MasterSubscriptionConfig>, actor: string): Promise<MasterSubscriptionConfig>;
  getMasterRevenueReports(masterId?: string): Promise<MasterRevenueData[]>;

  // Monitoring
  getLoginHistory(): Promise<LoginHistoryItem[]>;
  getActiveSessions(): Promise<SessionItem[]>;
  revokeSession(sessionId: string, actor: string): Promise<boolean>;
  getOrderAuditTrail(orderId?: string): Promise<OrderAuditTrailItem[]>;
  getApiActivity(): Promise<ApiActivityItem[]>;
  getApiActivityLogs(): Promise<ApiActivityItem[]>;
  getSuspiciousAlerts(): Promise<SuspiciousActivityAlert[]>;
  getSuspiciousActivityAlerts(): Promise<SuspiciousActivityAlert[]>;
  resolveSuspiciousAlert(alertId: string, actor: string): Promise<boolean>;
  getUserCreationLogs(): Promise<UserCreationLogItem[]>;
  getDataDeletionLogs(): Promise<DataDeletionLogItem[]>;
  getConfigurationChangeLogs(): Promise<ConfigurationChangeLogItem[]>;
  recordOrderEvent(event: Partial<OrderAuditTrailItem>): Promise<void>;
  recordConfigChange(change: Partial<ConfigurationChangeLogItem>): Promise<void>;

  // Platform Management
  getPlatformManagement(): Promise<PlatformManagementConfig>;
  updatePlatformManagement(data: Partial<PlatformManagementConfig>, actor: string): Promise<PlatformManagementConfig>;

  // Role-Based Access Control (RBAC)
  getRbacRoles(): Promise<RoleDefinition[]>;
  createRbacRole(role: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition>;
  updateRbacRole(roleId: string, updates: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition>;
  deleteRbacRole(roleId: string, actor: string): Promise<boolean>;
  getRbacUsers(): Promise<RbacUser[]>;
  assignUserRole(userId: string, roleCode: string, actor: string, customPermissions?: any): Promise<RbacUser>;
  createRbacUser(userData: Partial<RbacUser>, actor: string): Promise<RbacUser>;
  updateRbacUser(userId: string, updates: Partial<RbacUser>, actor: string): Promise<RbacUser>;
  getRbacAuditLogs(): Promise<RbacAuditLogItem[]>;
}

export class MockTradingDataProvider implements ITradingDataProvider {
  private tenants: Tenant[] = [
    {
      id: 'TNT-001',
      name: 'Alpha Prime Capital',
      code: 'APC',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      admin_name: 'Vikram Singhania',
      admin_email: 'vikram@alphaprime.com',
      admin_phone: '+91 98201 12345',
      domain: 'trade.alphaprime.com',
      support_email: 'desk@alphaprime.com',
      total_users: 820,
      active_users: 640,
      trading_volume: '₹6.2Cr',
      trading_volume_raw: 62000000,
      pl: '₹1.82Cr',
      pl_raw: 18200000,
      margin: '₹4.1Cr',
      commission: '₹31.2L',
      created_at: '2023-11-14',
      notes: 'Premier institutional tenant with high algorithmic trading volume.'
    },
    {
      id: 'TNT-002',
      name: 'Apex Securities Ltd',
      code: 'APEX',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      admin_name: 'Anjali Sharma',
      admin_email: 'anjali@apexsec.in',
      admin_phone: '+91 98112 54321',
      domain: 'trade.apexsec.in',
      support_email: 'support@apexsec.in',
      total_users: 480,
      active_users: 380,
      trading_volume: '₹2.8Cr',
      trading_volume_raw: 28000000,
      pl: '₹68.4L',
      pl_raw: 6840000,
      margin: '₹1.9Cr',
      commission: '₹14.1L',
      created_at: '2024-01-10',
      notes: 'Retail focus with multiple regional brokers across Western India.'
    },
    {
      id: 'TNT-003',
      name: 'Zenith Quant Partners',
      code: 'ZQP',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      admin_name: 'Rajesh Mehra',
      admin_email: 'rm@zenithquant.io',
      admin_phone: '+91 99401 88776',
      domain: 'desk.zenithquant.io',
      support_email: 'help@zenithquant.io',
      total_users: 220,
      active_users: 195,
      trading_volume: '₹1.1Cr',
      trading_volume_raw: 11000000,
      pl: '₹33.6L',
      pl_raw: 3360000,
      margin: '₹95.0L',
      commission: '₹5.2L',
      created_at: '2024-02-18',
      notes: 'HFT & index arbitrage trading desks.'
    }
  ];

  private masters: Master[] = [
    {
      id: 'MST-001',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Rohan Deshmukh',
      code: 'MST-MUM-01',
      email: 'rohan.deshmukh@alphaprime.com',
      phone: '+91 98200 44551',
      brokers_count: 14,
      clients_count: 610,
      turnover: '₹4.2Cr',
      commission_earned: '₹22.4L',
      status: 'ACTIVE',
      region: 'West (Mumbai)',
      created_at: '2023-11-20'
    },
    {
      id: 'MST-002',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Pooja Bhatia',
      code: 'MST-DEL-02',
      email: 'pooja.bhatia@alphaprime.com',
      phone: '+91 98110 33221',
      brokers_count: 9,
      clients_count: 210,
      turnover: '₹2.0Cr',
      commission_earned: '₹8.8L',
      status: 'ACTIVE',
      region: 'North (NCR)',
      created_at: '2023-12-05'
    },
    {
      id: 'MST-003',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      name: 'Suresh Nambiar',
      code: 'MST-BLR-03',
      email: 'suresh@apexsec.in',
      phone: '+91 98450 99882',
      brokers_count: 11,
      clients_count: 340,
      turnover: '₹1.9Cr',
      commission_earned: '₹9.6L',
      status: 'ACTIVE',
      region: 'South (Bangalore)',
      created_at: '2024-01-15'
    },
    {
      id: 'MST-004',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      name: 'Amitav Sen',
      code: 'MST-KOL-04',
      email: 'amitav@apexsec.in',
      phone: '+91 98300 77665',
      brokers_count: 5,
      clients_count: 140,
      turnover: '₹90.0L',
      commission_earned: '₹4.5L',
      status: 'ACTIVE',
      region: 'East (Kolkata)',
      created_at: '2024-02-01'
    },
    {
      id: 'MST-005',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      name: 'Gaurav Khanna',
      code: 'MST-HYD-05',
      email: 'gaurav@zenithquant.io',
      phone: '+91 97000 11223',
      brokers_count: 4,
      clients_count: 220,
      turnover: '₹1.1Cr',
      commission_earned: '₹5.2L',
      status: 'ACTIVE',
      region: 'South (Hyderabad)',
      created_at: '2024-02-20'
    }
  ];

  private brokers: Broker[] = [
    {
      id: 'BRK-001',
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Vikas Shah',
      code: 'BRK-101',
      email: 'vikas.shah@broker.in',
      sub_brokers_count: 6,
      clients_count: 195,
      turnover: '₹1.8Cr',
      commission_earned: '₹7.5L',
      status: 'ACTIVE',
      created_at: '2023-11-25'
    },
    {
      id: 'BRK-002',
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Neha Roy',
      code: 'BRK-102',
      email: 'neha.roy@broker.in',
      sub_brokers_count: 4,
      clients_count: 140,
      turnover: '₹1.2Cr',
      commission_earned: '₹5.1L',
      status: 'ACTIVE',
      created_at: '2023-12-02'
    },
    {
      id: 'BRK-003',
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      name: 'Pravin Joshi',
      code: 'BRK-201',
      email: 'pravin.joshi@apexbroker.in',
      sub_brokers_count: 5,
      clients_count: 165,
      turnover: '₹95.0L',
      commission_earned: '₹4.2L',
      status: 'ACTIVE',
      created_at: '2024-01-20'
    }
  ];

  private subBrokers: SubBroker[] = [
    {
      id: 'SBRK-001',
      broker_id: 'BRK-001',
      broker_name: 'Vikas Shah',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Kunal Verma',
      code: 'SB-101A',
      email: 'kunal.verma@subbroker.in',
      clients_count: 75,
      turnover: '₹62.0L',
      commission_earned: '₹2.1L',
      status: 'ACTIVE',
      created_at: '2023-12-10'
    },
    {
      id: 'SBRK-002',
      broker_id: 'BRK-001',
      broker_name: 'Vikas Shah',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Sunita Aggarwal',
      code: 'SB-101B',
      email: 'sunita.aggarwal@subbroker.in',
      clients_count: 62,
      turnover: '₹48.0L',
      commission_earned: '₹1.8L',
      status: 'ACTIVE',
      created_at: '2023-12-15'
    }
  ];

  private clients: Client[] = [
    {
      id: 'CLT-001',
      client_code: 'CLT001',
      sub_broker_id: 'SBRK-001',
      sub_broker_name: 'Kunal Verma',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Arjun Patel',
      email: 'arjun.patel@gmail.com',
      phone: '+91 98200 11999',
      kyc_status: 'APPROVED',
      wallet_balance: 450000,
      available_margin: 380000,
      todays_pl: 14250,
      status: 'ACTIVE',
      created_at: '2024-01-08'
    },
    {
      id: 'CLT-002',
      client_code: 'CLT002',
      sub_broker_id: 'SBRK-001',
      sub_broker_name: 'Kunal Verma',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Meera Nair',
      email: 'meera.nair@outlook.com',
      phone: '+91 98450 22334',
      kyc_status: 'PENDING',
      wallet_balance: 120000,
      available_margin: 120000,
      todays_pl: 0,
      status: 'PENDING',
      created_at: '2024-04-10'
    },
    {
      id: 'CLT-003',
      client_code: 'CLT003',
      sub_broker_id: 'SBRK-002',
      sub_broker_name: 'Sunita Aggarwal',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Sanya Kapoor',
      email: 'sanya.kapoor@gmail.com',
      phone: '+91 98110 99881',
      kyc_status: 'APPROVED',
      wallet_balance: 850000,
      available_margin: 620000,
      todays_pl: 28400,
      status: 'ACTIVE',
      created_at: '2024-02-14'
    },
    {
      id: 'CLT-004',
      client_code: 'CLT004',
      sub_broker_id: 'SBRK-002',
      sub_broker_name: 'Sunita Aggarwal',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      name: 'Deepa Menon',
      email: 'deepa.menon@yahoo.com',
      phone: '+91 98450 77112',
      kyc_status: 'UNDER_REVIEW',
      wallet_balance: 50000,
      available_margin: 50000,
      todays_pl: 0,
      status: 'PENDING',
      created_at: '2024-04-08'
    },
    {
      id: 'CLT-005',
      client_code: 'CLT005',
      sub_broker_id: 'SBRK-002',
      sub_broker_name: 'Sunita Aggarwal',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      name: 'Karthik Reddy',
      email: 'karthik.reddy@gmail.com',
      phone: '+91 98490 33445',
      kyc_status: 'REJECTED',
      wallet_balance: 0,
      available_margin: 0,
      todays_pl: 0,
      status: 'SUSPENDED',
      created_at: '2024-04-05'
    },
    {
      id: 'CLT-006',
      client_code: 'CLT006',
      sub_broker_id: 'SBRK-001',
      sub_broker_name: 'Kunal Verma',
      broker_name: 'Vikas Shah',
      master_name: 'Rohan Deshmukh',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      name: 'Rahul Gupta',
      email: 'rahul.gupta@corp.in',
      phone: '+91 98201 66554',
      kyc_status: 'APPROVED',
      wallet_balance: 620000,
      available_margin: 490000,
      todays_pl: -4200,
      status: 'ACTIVE',
      created_at: '2024-01-18'
    }
  ];

  // Exact match to Figma design Recent Trades:
  private trades: Trade[] = [
    {
      id: 'tr-001',
      trade_id: 'TRD001',
      client_id: 'CLT-001',
      client_name: 'Arjun Patel',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'NIFTY50',
      side: 'BUY',
      quantity: 50,
      price: 22478,
      total_value: 1123900,
      pl: 12400,
      status: 'EXECUTED',
      timestamp: '2024-04-15 11:42:18'
    },
    {
      id: 'tr-002',
      trade_id: 'TRD002',
      client_id: 'CLT-003',
      client_name: 'Sanya Kapoor',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'TCS',
      side: 'BUY',
      quantity: 25,
      price: 3841,
      total_value: 96025,
      pl: 3250,
      status: 'EXECUTED',
      timestamp: '2024-04-15 11:38:05'
    },
    {
      id: 'tr-003',
      trade_id: 'TRD003',
      client_id: 'CLT-001',
      client_name: 'Arjun Patel',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'INFY',
      side: 'SELL',
      quantity: 100,
      price: 1481,
      total_value: 148100,
      pl: -1850,
      status: 'EXECUTED',
      timestamp: '2024-04-15 11:24:50'
    },
    {
      id: 'tr-004',
      trade_id: 'TRD004',
      client_id: 'CLT-006',
      client_name: 'Rahul Gupta',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'HDFC',
      side: 'BUY',
      quantity: 80,
      price: 1652,
      total_value: 132160,
      pl: 2100,
      status: 'EXECUTED',
      timestamp: '2024-04-15 11:15:32'
    },
    {
      id: 'tr-005',
      trade_id: 'TRD005',
      client_id: 'CLT-003',
      client_name: 'Sanya Kapoor',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 40,
      price: 2940,
      total_value: 117600,
      pl: 4400,
      status: 'EXECUTED',
      timestamp: '2024-04-15 10:55:10'
    },
    {
      id: 'tr-006',
      trade_id: 'TRD006',
      client_id: 'CLT-006',
      client_name: 'Rahul Gupta',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      symbol: 'BANKNIFTY',
      side: 'SELL',
      quantity: 30,
      price: 48250,
      total_value: 1447500,
      pl: -6200,
      status: 'EXECUTED',
      timestamp: '2024-04-15 10:41:00'
    }
  ];

  // Exact match to Figma design Pending KYC:
  private kycRecords: KYCRecord[] = [
    {
      id: 'kyc-001',
      client_id: 'CLT-002',
      client_name: 'Meera Nair',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      kyc_status: 'PENDING',
      document_type: 'Aadhaar + PAN Card',
      document_status: 'PENDING',
      assigned_reviewer: 'Compliance Team A',
      submitted_date: '2024-04-10',
      id_number: 'ABCDP1234F',
      notes: 'Awaiting secondary address document verification'
    },
    {
      id: 'kyc-002',
      client_id: 'CLT-004',
      client_name: 'Deepa Menon',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      kyc_status: 'UNDER_REVIEW',
      document_type: 'Passport + Bank Statement',
      document_status: 'PENDING',
      assigned_reviewer: 'Ramesh K. (Sr Compliance)',
      submitted_date: '2024-04-08',
      id_number: 'N7894561',
      notes: 'Bank statement signature mismatch under review'
    },
    {
      id: 'kyc-003',
      client_id: 'CLT-005',
      client_name: 'Karthik Reddy',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      kyc_status: 'REJECTED',
      document_type: 'PAN Card',
      document_status: 'REJECTED',
      assigned_reviewer: 'Pooja Verma',
      submitted_date: '2024-04-05',
      id_number: 'XYZPK9876Q',
      notes: 'Expired supporting identification documents'
    }
  ];

  private orders: Order[] = [
    {
      id: 'ord-101',
      order_id: 'ORD-89401',
      client_name: 'Arjun Patel',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'NIFTY 22500 CE',
      type: 'MARKET',
      side: 'BUY',
      quantity: 150,
      price: 142.5,
      status: 'EXECUTED',
      created_at: '2024-04-15 11:42:15'
    },
    {
      id: 'ord-102',
      order_id: 'ORD-89402',
      client_name: 'Sanya Kapoor',
      tenant_name: 'Alpha Prime Capital',
      symbol: 'TCS',
      type: 'LIMIT',
      side: 'BUY',
      quantity: 25,
      price: 3840.0,
      status: 'EXECUTED',
      created_at: '2024-04-15 11:38:00'
    },
    {
      id: 'ord-103',
      order_id: 'ORD-89403',
      client_name: 'Vikram Mehta',
      tenant_name: 'Apex Securities Ltd',
      symbol: 'BANKNIFTY 48500 PE',
      type: 'LIMIT',
      side: 'SELL',
      quantity: 75,
      price: 215.0,
      status: 'PENDING',
      created_at: '2024-04-15 11:35:10'
    }
  ];

  private whiteLabelConfigs: WhiteLabelConfig[] = [
    {
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      brand_name: 'Alpha Prime Capital',
      short_name: 'AlphaPrime',
      tagline: 'High-Frequency Institutional & Retail Execution',
      company_name: 'Alpha Prime Capital Markets Ltd',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_light_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_dark_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      favicon_url: '/favicon.ico',
      app_icon_url: '/favicon.ico',
      primary_color: '#2563eb', // Blue
      secondary_color: '#0f172a',
      accent_color: '#38bdf8',
      background_color: '#080d1a',
      surface_color: '#0d1528',
      text_color: '#f8fafc',
      success_color: '#10b981',
      warning_color: '#f59e0b',
      error_color: '#ef4444',
      login_branding: 'Alpha Prime Institutional Trading Desk',
      login_background_url: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=1200&auto=format&fit=crop&q=80',
      login_title: 'Welcome to Alpha Prime',
      login_subtitle: 'Enterprise Direct Market Access & Smart Order Routing',
      welcome_text: 'Trade equities, futures, options, and commodities with microsecond latency.',
      support_contact: '+91 (022) 6789-0100 | desk@alphaprime.com',
      custom_domain: 'trade.alphaprime.com',
      support_email: 'desk@alphaprime.com',
      support_phone: '+91 (022) 6789-0100',
      company_address: 'Level 14, Express Towers, Nariman Point, Mumbai 400021',
      website_url: 'https://alphaprimecapital.com',
      help_support_url: 'https://trade.alphaprime.com/help',
      footer_text: '© 2024 Alpha Prime Capital Markets Ltd. SEBI Reg No: INZ000213456. Powered by TradePro Commercial White-Label.',
      terms_url: 'https://trade.alphaprime.com/terms',
      privacy_url: 'https://trade.alphaprime.com/privacy',
      risk_disclosure_url: 'https://trade.alphaprime.com/risk-disclosure',
      disclaimer_url: 'https://trade.alphaprime.com/disclaimer',
      status: 'PUBLISHED',
      version: 3,
      created_at: '2024-01-10 09:00:00',
      updated_at: '2024-04-15 10:30:00'
    },
    {
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      brand_name: 'Apex Securities',
      short_name: 'ApexTrade',
      tagline: 'Precision Retail Trading & Zero-Brokerage Investing',
      company_name: 'Apex Securities Pvt Ltd',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_light_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_dark_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      favicon_url: '/favicon.ico',
      app_icon_url: '/favicon.ico',
      primary_color: '#059669', // Emerald Green
      secondary_color: '#064e3b',
      accent_color: '#34d399',
      background_color: '#061310',
      surface_color: '#0a1e19',
      text_color: '#ecfdf5',
      success_color: '#10b981',
      warning_color: '#f59e0b',
      error_color: '#ef4444',
      login_branding: 'Apex Retail Trader Portal',
      login_background_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=80',
      login_title: 'Welcome to ApexTrade',
      login_subtitle: 'Smart mobile and web terminal for modern active traders',
      welcome_text: 'Zero account maintenance fee. Real-time charting with TradingView integration.',
      support_contact: '+91 (080) 4123-5500 | support@apexsec.in',
      custom_domain: 'trade.apexsec.in',
      support_email: 'support@apexsec.in',
      support_phone: '+91 (080) 4123-5500',
      company_address: 'Apex Towers, 5th Main, Indiranagar, Bengaluru 560038',
      website_url: 'https://apexsecurities.in',
      help_support_url: 'https://trade.apexsec.in/support',
      footer_text: '© 2024 Apex Securities Pvt Ltd. NSE/BSE Member. Powered by TradePro Commercial White-Label.',
      terms_url: 'https://trade.apexsec.in/terms',
      privacy_url: 'https://trade.apexsec.in/privacy',
      risk_disclosure_url: 'https://trade.apexsec.in/risk',
      disclaimer_url: 'https://trade.apexsec.in/disclaimer',
      status: 'PUBLISHED',
      version: 2,
      created_at: '2024-02-01 10:00:00',
      updated_at: '2024-04-12 16:40:00'
    },
    {
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      brand_name: 'Zenith Quant',
      short_name: 'ZenithQ',
      tagline: 'Algorithmic Execution & Quantitative Strategies',
      company_name: 'Zenith Quant Capital LLC',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_light_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      logo_dark_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      favicon_url: '/favicon.ico',
      app_icon_url: '/favicon.ico',
      primary_color: '#7c3aed', // Purple / Violet
      secondary_color: '#2e1065',
      accent_color: '#a78bfa',
      background_color: '#0d0b1a',
      surface_color: '#151229',
      text_color: '#faf5ff',
      success_color: '#10b981',
      warning_color: '#f59e0b',
      error_color: '#ef4444',
      login_branding: 'Zenith Quant Algorithmic Gateway',
      login_background_url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200&auto=format&fit=crop&q=80',
      login_title: 'Zenith Quant Terminal',
      login_subtitle: 'Low-Latency Direct Order Entry & Python API Hub',
      welcome_text: 'Co-located FIX protocol & WebSockets for algorithmic proprietary desks.',
      support_contact: '+91 (011) 4980-2200 | desk@zenithquant.com',
      custom_domain: 'trade.zenithquant.com',
      support_email: 'desk@zenithquant.com',
      support_phone: '+91 (011) 4980-2200',
      company_address: 'One Horizon Centre, DLF Phase 5, Gurugram 122002',
      website_url: 'https://zenithquant.com',
      help_support_url: 'https://docs.zenithquant.com',
      footer_text: '© 2024 Zenith Quant Capital LLC. Licensed Trading Terminal.',
      terms_url: 'https://trade.zenithquant.com/terms',
      privacy_url: 'https://trade.zenithquant.com/privacy',
      risk_disclosure_url: 'https://trade.zenithquant.com/risk',
      disclaimer_url: 'https://trade.zenithquant.com/disclaimer',
      status: 'PUBLISHED',
      version: 1,
      created_at: '2024-03-01 12:00:00',
      updated_at: '2024-04-10 11:20:00'
    }
  ];

  // Backup store for rollback capability (Requirement 8)
  private brandingHistory: Map<string, WhiteLabelConfig[]> = new Map();

  // Tenant Platform Config & Feature Flags (Requirement 6, 15)
  private tenantPlatformConfigs: TenantPlatformConfig[] = [
    {
      id: 'cfg-tnt-001',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      web_trading_enabled: true,
      mobile_trading_enabled: true,
      registration_enabled: true,
      forgot_password_enabled: true,
      support_enabled: true,
      notifications_enabled: true,
      api_enabled: true,
      trading_enabled: true,
      maintenance_mode: false,
      created_at: '2024-01-10 09:00:00',
      updated_at: '2024-04-15 10:30:00'
    },
    {
      id: 'cfg-tnt-002',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      web_trading_enabled: true,
      mobile_trading_enabled: true,
      registration_enabled: true,
      forgot_password_enabled: true,
      support_enabled: true,
      notifications_enabled: true,
      api_enabled: true,
      trading_enabled: true,
      maintenance_mode: false,
      created_at: '2024-02-01 10:00:00',
      updated_at: '2024-04-12 16:40:00'
    },
    {
      id: 'cfg-tnt-003',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      web_trading_enabled: true,
      mobile_trading_enabled: true,
      registration_enabled: true,
      forgot_password_enabled: true,
      support_enabled: true,
      notifications_enabled: true,
      api_enabled: true,
      trading_enabled: true,
      maintenance_mode: false,
      created_at: '2024-03-01 12:00:00',
      updated_at: '2024-04-10 11:20:00'
    }
  ];

  // Tenant Domains (Requirement 6, 18)
  private tenantDomains: TenantDomain[] = [
    {
      id: 'dom-001',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      domain: 'trade.alphaprime.com',
      domain_type: 'TRADING',
      verification_status: 'VERIFIED',
      is_primary: true,
      ssl_status: 'ACTIVE',
      created_at: '2024-01-10'
    },
    {
      id: 'dom-002',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      domain: 'app.alphaprime.com',
      domain_type: 'CUSTOM',
      verification_status: 'VERIFIED',
      is_primary: false,
      ssl_status: 'ACTIVE',
      created_at: '2024-01-12'
    },
    {
      id: 'dom-003',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      domain: 'trade.apexsec.in',
      domain_type: 'TRADING',
      verification_status: 'VERIFIED',
      is_primary: true,
      ssl_status: 'ACTIVE',
      created_at: '2024-02-01'
    },
    {
      id: 'dom-004',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      domain: 'client.apexsec.in',
      domain_type: 'SUBDOMAIN',
      verification_status: 'VERIFIED',
      is_primary: false,
      ssl_status: 'ACTIVE',
      created_at: '2024-02-05'
    },
    {
      id: 'dom-005',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      domain: 'trade.zenithquant.com',
      domain_type: 'TRADING',
      verification_status: 'VERIFIED',
      is_primary: true,
      ssl_status: 'ACTIVE',
      created_at: '2024-03-01'
    },
    {
      id: 'dom-006',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      domain: 'quant.zenithquant.com',
      domain_type: 'CUSTOM',
      verification_status: 'PENDING',
      is_primary: false,
      ssl_status: 'PROVISIONING',
      created_at: '2024-04-10'
    }
  ];

  // Branding Audit Logs (Requirement 8, 22)
  private brandingAuditLogs: BrandingAuditLog[] = [
    {
      id: 'b-log-001',
      actor: 'Admin John',
      role: 'SUPER_ADMIN',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      action: 'BRANDING_PUBLISHED',
      entity: 'Branding Version 3',
      old_value: 'v2 published',
      new_value: 'v3 published',
      timestamp: '2024-04-15 10:30:00',
      ip_address: '103.21.58.14',
      reason: 'Updated brand typography and institutional disclaimer'
    },
    {
      id: 'b-log-002',
      actor: 'Admin John',
      role: 'SUPER_ADMIN',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      action: 'DOMAIN_VERIFIED',
      entity: 'trade.apexsec.in',
      old_value: 'PENDING',
      new_value: 'VERIFIED',
      timestamp: '2024-04-12 16:40:00',
      ip_address: '103.21.58.14',
      reason: 'DNS CNAME verification handshake validated'
    },
    {
      id: 'b-log-003',
      actor: 'Admin John',
      role: 'SUPER_ADMIN',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      action: 'PLATFORM_CONFIG_UPDATED',
      entity: 'Platform Settings',
      old_value: 'mobile_trading_enabled: false',
      new_value: 'mobile_trading_enabled: true',
      timestamp: '2024-04-10 14:15:00',
      ip_address: '103.21.58.14',
      reason: 'Mobile trading rollout approved for Phase 1'
    }
  ];

  private supportTickets: SupportTicket[] = [
    {
      id: 'tkt-001',
      ticket_number: 'TCK-4091',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      subject: 'Margin exposure calculation threshold query',
      client_name: 'Rohan Deshmukh (Master)',
      priority: 'HIGH',
      status: 'OPEN',
      created_at: '2024-04-15 09:30:00'
    },
    {
      id: 'tkt-002',
      ticket_number: 'TCK-4092',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      subject: 'Webhook latency during market open spikes',
      client_name: 'Anjali Sharma (Admin)',
      priority: 'HIGH',
      status: 'OPEN',
      created_at: '2024-04-15 09:45:00'
    },
    {
      id: 'tkt-003',
      ticket_number: 'TCK-4088',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      subject: 'Aadhaar e-sign timeout for new client registration',
      client_name: 'Meera Nair (Client)',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      created_at: '2024-04-14 16:20:00'
    },
    {
      id: 'tkt-004',
      ticket_number: 'TCK-4075',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      subject: 'Sub-broker commission payout report discrepancy',
      client_name: 'Gaurav Khanna (Master)',
      priority: 'LOW',
      status: 'RESOLVED',
      created_at: '2024-04-13 14:10:00'
    }
  ];

  private auditLogs: AuditLog[] = [
    {
      id: 'log-001',
      timestamp: '2024-04-15 11:40:12',
      actor_name: 'Admin User',
      actor_role: 'SUPER_ADMIN',
      tenant_name: 'System (Global)',
      action: 'TENANT_LIMIT_UPDATE',
      resource: 'TNT-001 Margin Multiplier (4x -> 5x)',
      ip_address: '103.21.58.14',
      status: 'SUCCESS'
    },
    {
      id: 'log-002',
      timestamp: '2024-04-15 10:15:30',
      actor_name: 'Vikram Singhania',
      actor_role: 'TENANT_ADMIN',
      tenant_name: 'Alpha Prime Capital',
      action: 'BROKER_COMMISSION_UPDATE',
      resource: 'BRK-101 rate set to 35 bps',
      ip_address: '115.112.44.8',
      status: 'SUCCESS'
    },
    {
      id: 'log-003',
      timestamp: '2024-04-15 08:30:11',
      actor_name: 'System Scheduler',
      actor_role: 'SYSTEM',
      tenant_name: 'All Tenants',
      action: 'EOD_LEDGER_RECONCILIATION',
      resource: 'Batch #20240414-SETTLE',
      ip_address: '127.0.0.1',
      status: 'SUCCESS'
    }
  ];

  private subscriptions: SubscriptionPlan[] = [
    {
      id: 'sub-001',
      tenant_id: 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      plan_name: 'Enterprise Tier',
      pricing_model: 'HYBRID',
      monthly_base_fee: 150000,
      volume_rate_bps: 0.5,
      user_limit: 5000,
      current_users: 820,
      renewal_date: '2024-11-14',
      status: 'ACTIVE'
    },
    {
      id: 'sub-002',
      tenant_id: 'TNT-002',
      tenant_name: 'Apex Securities Ltd',
      plan_name: 'Professional Tier',
      pricing_model: 'VOLUME_TIERED',
      monthly_base_fee: 75000,
      volume_rate_bps: 0.8,
      user_limit: 2000,
      current_users: 480,
      renewal_date: '2025-01-10',
      status: 'ACTIVE'
    },
    {
      id: 'sub-003',
      tenant_id: 'TNT-003',
      tenant_name: 'Zenith Quant Partners',
      plan_name: 'Enterprise Tier',
      pricing_model: 'PER_USER',
      monthly_base_fee: 100000,
      volume_rate_bps: 0.3,
      user_limit: 1000,
      current_users: 220,
      renewal_date: '2025-02-18',
      status: 'ACTIVE'
    }
  ];

  // Exact matching KPI metrics from Figma screenshot:
  async getDashboardKPIs(tenantId?: string, _timeRange?: string): Promise<DashboardKPIs> {
    if (tenantId) {
      const tenant = this.tenants.find(t => t.id === tenantId);
      const mastersCount = this.masters.filter(m => m.tenant_id === tenantId).length;
      const brokersCount = this.brokers.filter(b => b.tenant_id === tenantId).length;
      const clientsCount = this.clients.filter(c => c.tenant_id === tenantId).length;
      return {
        total_masters: { value: mastersCount, badge: '+1 new', subtitle: `Across ${tenant?.name || 'Tenant'}` },
        total_brokers: { value: brokersCount, badge: '+2 new', subtitle: `${brokersCount} active` },
        total_clients: { value: clientsCount, badge: '↑ 9.4%', subtitle: `${clientsCount} KYC verified` },
        commission_earned: { value: tenant?.commission || '₹14.2L', badge: '↑ 6.8%', subtitle: 'Today' },
        todays_turnover: { value: tenant?.trading_volume || '₹3.4Cr', badge: '↑ 14.2%', subtitle: 'Turnover' },
        total_pl: { value: tenant?.pl || '₹84.2L', badge: '↑ 5.1%', subtitle: 'Unrealized + Realized' },
        pending_kyc: { value: this.kycRecords.filter(k => k.tenant_id === tenantId && k.kyc_status === 'PENDING').length, subtitle: 'Requires review' },
        open_tickets: { value: this.supportTickets.filter(t => t.tenant_id === tenantId && t.status === 'OPEN').length, subtitle: '1 high priority' }
      };
    }

    const mastersCount = this.masters.length;
    const brokersCount = this.brokers.length;
    const clientsCount = this.clients.length;
    const activeClientsCount = this.clients.filter(c => c.status === 'ACTIVE').length;
    const verifiedClientsCount = this.clients.filter(c => c.kyc_status === 'APPROVED').length;
    const pendingKycCount = this.kycRecords.filter(k => k.kyc_status === 'PENDING').length;
    const openTicketsCount = this.supportTickets.filter(t => t.status === 'OPEN').length;

    return {
      total_masters: {
        value: mastersCount,
        badge: `${mastersCount} registered`,
        subtitle: 'Across all regions'
      },
      total_brokers: {
        value: brokersCount,
        badge: `${brokersCount} active`,
        subtitle: 'Active brokers'
      },
      total_sub_brokers: {
        value: 2,
        badge: '2 mapped',
        subtitle: 'Sub-Brokers'
      },
      total_clients: {
        value: clientsCount,
        badge: `${activeClientsCount} active`,
        subtitle: `${verifiedClientsCount} KYC approved`
      },
      active_clients: {
        value: activeClientsCount,
        badge: `${activeClientsCount} active`,
        subtitle: 'Active trading accounts'
      },
      commission_earned: {
        value: '₹0',
        badge: 'From ledger',
        subtitle: 'Today'
      },
      todays_turnover: {
        value: '₹0',
        badge: 'Today',
        subtitle: 'Today\'s Turnover'
      },
      total_turnover: {
        value: '₹0',
        badge: 'Total Executed',
        subtitle: 'All-Time Turnover'
      },
      trading_volume: {
        value: '₹0',
        badge: 'Today',
        subtitle: 'Volume'
      },
      total_pl: {
        value: '₹0',
        badge: 'Net P&L',
        subtitle: 'Unrealized + Realized'
      },
      net_pl: {
        value: '₹0',
        badge: 'Net P&L',
        subtitle: 'Unrealized + Realized'
      },
      realized_pl: {
        value: '₹0',
        badge: 'Realized',
        subtitle: 'Realized P&L'
      },
      unrealized_pl: {
        value: '₹0',
        badge: 'Unrealized',
        subtitle: 'Unrealized P&L'
      },
      pending_deposits: {
        value: 0,
        amount: 0,
        formatted_amount: '₹0',
        badge: '0 pending',
        subtitle: 'Requires approval'
      },
      pending_withdrawals: {
        value: 0,
        amount: 0,
        formatted_amount: '₹0',
        badge: '0 pending',
        subtitle: 'Requires processing'
      },
      open_positions: {
        value: 0,
        badge: '0 open',
        subtitle: 'Active positions'
      },
      pending_orders: {
        value: 0,
        badge: '0 pending',
        subtitle: 'Queued orders'
      },
      used_margin: {
        value: '₹0',
        badge: 'Utilized',
        subtitle: 'Across clients'
      },
      available_margin: {
        value: '₹0',
        badge: 'Available',
        subtitle: 'Free margin'
      },
      equity: {
        value: '₹0',
        badge: 'Total Equity',
        subtitle: 'All client accounts'
      },
      pending_kyc: {
        value: pendingKycCount,
        subtitle: 'Requires review'
      },
      open_tickets: {
        value: openTicketsCount,
        subtitle: `${openTicketsCount} open tickets`
      }
    };
  }

  // Matching smooth curves for Trading Volume & Commission:
  async getVolumeCommissionChart(tenantId?: string, timeRange?: string): Promise<VolumeCommissionChartPoint[]> {
    return [];
  }

  // Matching client growth bars:
  async getClientGrowthChart(tenantId?: string): Promise<ClientGrowthChartPoint[]> {
    return [];
  }

  async getNewClientRegistrations(_tenantId?: string, _timeRange?: string): Promise<ClientRegistrationPoint[]> {
    return [];
  }

  async getAssetAllocation(_tenantId?: string, _timeRange?: string): Promise<AssetAllocationSlice[]> {
    return [];
  }

  // Daily P&L Trend:
  async getDailyPLTrend(_tenantId?: string, _timeRange?: string): Promise<DailyPLTrend> {
    return { data: [], mtdBadge: '₹0', rawTotal: 0 };
  }

  async getRecentTrades(tenantId?: string, limit: number = 6): Promise<Trade[]> {
    let result = this.trades;
    if (tenantId) {
      result = result.filter(t => t.tenant_id === tenantId);
    }
    return result.slice(0, limit);
  }

  async getRecentRegistrations(tenantId?: string, limit: number = 6): Promise<RecentRegistration[]> {
    let result = this.clients;
    if (tenantId) {
      result = result.filter(client => client.tenant_id === tenantId);
    }
    return result.slice(0, limit).map(client => ({
      client_id: client.client_code || client.id,
      name: client.name,
      broker: client.broker_name || '—',
      kyc_status: client.kyc_status === 'APPROVED'
        ? 'APPROVED'
        : client.kyc_status === 'REJECTED'
        ? 'REJECTED'
        : client.kyc_status === 'UNDER_REVIEW'
        ? 'UNDER_REVIEW'
        : 'PENDING',
      account_status: client.status === 'ACTIVE'
        ? 'ACTIVE'
        : client.status === 'SUSPENDED'
        ? 'SUSPENDED'
        : 'PENDING',
      wallet_balance: Number(client.wallet_balance || 0),
      pl: Number(client.todays_pl || 0)
    }));
  }

  async getPendingKYC(tenantId?: string, limit: number = 5): Promise<KYCRecord[]> {
    let result = this.kycRecords;
    if (tenantId) {
      result = result.filter(k => k.tenant_id === tenantId);
    }
    return result.slice(0, limit);
  }

  async getTenants(query?: { search?: string; status?: string }): Promise<Tenant[]> {
    let result = [...this.tenants];
    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || t.admin_email.toLowerCase().includes(q));
    }
    if (query?.status && query.status !== 'ALL') {
      result = result.filter(t => t.status === query.status);
    }
    return result;
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenants.find(t => t.id === id) || null;
  }

  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const newTenant: Tenant = {
      id: `TNT-00${this.tenants.length + 1}`,
      name: data.name || 'New Tenant',
      code: data.code || 'NT',
      status: 'ACTIVE',
      plan: data.plan || 'PROFESSIONAL',
      admin_name: data.admin_name || 'Admin',
      admin_email: data.admin_email || 'admin@tenant.com',
      admin_phone: data.admin_phone || '+91 98000 00000',
      domain: data.domain || `${(data.code || 'tenant').toLowerCase()}.tradepro.com`,
      support_email: data.support_email || `support@${(data.code || 'tenant').toLowerCase()}.com`,
      total_users: 0,
      active_users: 0,
      trading_volume: '₹0',
      trading_volume_raw: 0,
      pl: '₹0',
      pl_raw: 0,
      margin: '₹0',
      commission: '₹0',
      created_at: new Date().toISOString().split('T')[0],
      notes: data.notes || ''
    };
    this.tenants.push(newTenant);
    return newTenant;
  }

  async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'): Promise<Tenant | null> {
    const tenant = this.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.status = status;
      return tenant;
    }
    return null;
  }

  async getMasters(tenantId?: string): Promise<Master[]> {
    if (tenantId) return this.masters.filter(m => m.tenant_id === tenantId);
    return this.masters;
  }

  async getBrokers(tenantId?: string, masterId?: string): Promise<Broker[]> {
    let result = this.brokers;
    if (tenantId) result = result.filter(b => b.tenant_id === tenantId);
    if (masterId) result = result.filter(b => b.master_id === masterId);
    return result;
  }

  async getSubBrokers(tenantId?: string, brokerId?: string): Promise<SubBroker[]> {
    let result = this.subBrokers;
    if (tenantId) result = result.filter(sb => sb.tenant_id === tenantId);
    if (brokerId) result = result.filter(sb => sb.broker_id === brokerId);
    return result;
  }

  async getClients(tenantId?: string, subBrokerId?: string): Promise<Client[]> {
    let result = this.clients;
    if (tenantId) result = result.filter(c => c.tenant_id === tenantId);
    if (subBrokerId) result = result.filter(c => c.sub_broker_id === subBrokerId);
    return result;
  }

  async createMaster(data: Partial<Master>): Promise<Master> {
    const tenant = this.tenants.find(t => t.id === data.tenant_id) || this.tenants[0];
    const newMaster: Master = {
      id: `MST-00${this.masters.length + 1}`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      name: data.name || 'New Master',
      code: data.code || `MST-${this.masters.length + 1}`,
      email: data.email || 'master@tradepro.com',
      phone: data.phone || '+91 98000 00000',
      brokers_count: 0,
      clients_count: 0,
      turnover: '₹0',
      commission_earned: '₹0',
      status: 'ACTIVE',
      region: data.region || 'North',
      created_at: new Date().toISOString().split('T')[0]
    };
    this.masters.push(newMaster);
    return newMaster;
  }

  async createBroker(data: Partial<Broker>): Promise<Broker> {
    const master = this.masters.find(m => m.id === data.master_id) || this.masters[0];
    const newBroker: Broker = {
      id: `BRK-00${this.brokers.length + 1}`,
      master_id: master.id,
      master_name: master.name,
      tenant_id: master.tenant_id,
      tenant_name: master.tenant_name,
      name: data.name || 'New Broker',
      code: data.code || `BRK-${this.brokers.length + 101}`,
      email: data.email || 'broker@tradepro.com',
      sub_brokers_count: 0,
      clients_count: 0,
      turnover: '₹0',
      commission_earned: '₹0',
      status: 'ACTIVE',
      created_at: new Date().toISOString().split('T')[0]
    };
    this.brokers.push(newBroker);
    master.brokers_count += 1;
    return newBroker;
  }

  async createSubBroker(data: Partial<SubBroker>): Promise<SubBroker> {
    const broker = this.brokers.find(b => b.id === data.broker_id) || this.brokers[0];
    const newSubBroker: SubBroker = {
      id: `SBRK-00${this.subBrokers.length + 1}`,
      broker_id: broker.id,
      broker_name: broker.name,
      tenant_id: broker.tenant_id,
      tenant_name: broker.tenant_name,
      name: data.name || 'New Sub Broker',
      code: data.code || `SB-${this.subBrokers.length + 101}`,
      email: data.email || 'subbroker@tradepro.com',
      clients_count: 0,
      turnover: '₹0',
      commission_earned: '₹0',
      status: 'ACTIVE',
      created_at: new Date().toISOString().split('T')[0]
    };
    this.subBrokers.push(newSubBroker);
    broker.sub_brokers_count += 1;
    return newSubBroker;
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    const subBroker = this.subBrokers.find(sb => sb.id === data.sub_broker_id) || this.subBrokers[0];
    const broker = this.brokers.find(b => b.id === subBroker.broker_id) || this.brokers[0];
    const newClient: Client = {
      id: `CLT-00${this.clients.length + 1}`,
      client_code: `CLT00${this.clients.length + 1}`,
      sub_broker_id: subBroker.id,
      sub_broker_name: subBroker.name,
      broker_name: broker.name,
      master_name: broker.master_name,
      tenant_id: subBroker.tenant_id,
      tenant_name: subBroker.tenant_name,
      name: data.name || 'New Client',
      email: data.email || 'client@trade.com',
      phone: data.phone || '+91 98000 00000',
      kyc_status: 'PENDING',
      wallet_balance: data.wallet_balance || 0,
      available_margin: data.available_margin || 0,
      todays_pl: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString().split('T')[0]
    };
    this.clients.push(newClient);
    subBroker.clients_count += 1;

    // Trigger S2S account synchronization with the Trading Platform
    try {
      await tradingPlatformClient.syncClientAccount({
        clientId: newClient.id,
        clientCode: newClient.client_code,
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        initialBalance: newClient.wallet_balance || 100000,
        subBrokerId: newClient.sub_broker_id,
        tenantId: newClient.tenant_id
      });
      console.log(`[S2S In-Memory] Client account ${newClient.id} synced to Trading Platform.`);
    } catch (syncErr: any) {
      console.warn(`[S2S In-Memory] Client account ${newClient.id} created, S2S push queued:`, syncErr?.message || syncErr);
    }

    return newClient;
  }

  async updateMasterStatus(id: string, status: EntityStatus): Promise<Master | null> {
    const master = this.masters.find(m => m.id === id || m.code === id);
    if (!master) return null;
    master.status = status;
    return master;
  }

  async updateBrokerStatus(id: string, status: EntityStatus): Promise<Broker | null> {
    const broker = this.brokers.find(b => b.id === id || b.code === id);
    if (!broker) return null;
    broker.status = status;
    return broker;
  }

  async updateSubBrokerStatus(id: string, status: EntityStatus): Promise<SubBroker | null> {
    const subBroker = this.subBrokers.find(s => s.id === id || s.code === id);
    if (!subBroker) return null;
    subBroker.status = status;
    return subBroker;
  }

  async updateClientStatus(id: string, status: EntityStatus): Promise<Client | null> {
    const client = this.clients.find(c => c.id === id || c.client_code === id);
    if (!client) return null;
    client.status = status;
    return client;
  }

  async updateMaster(id: string, data: Partial<Master>): Promise<Master | null> {
    const master = this.masters.find(m => m.id === id || m.code === id);
    if (!master) return null;
    Object.assign(master, data);
    return master;
  }

  async updateBroker(id: string, data: Partial<Broker>): Promise<Broker | null> {
    const broker = this.brokers.find(b => b.id === id || b.code === id);
    if (!broker) return null;
    Object.assign(broker, data);
    return broker;
  }

  async updateSubBroker(id: string, data: Partial<SubBroker>): Promise<SubBroker | null> {
    const subBroker = this.subBrokers.find(s => s.id === id || s.code === id);
    if (!subBroker) return null;
    Object.assign(subBroker, data);
    return subBroker;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
    const client = this.clients.find(c => c.id === id || c.client_code === id);
    if (!client) return null;
    Object.assign(client, data);
    return client;
  }

  async getClientAccountDetails(clientId: string, tenantId?: string): Promise<any> {
    const cleanId = clientId.trim();
    const client = this.clients.find(c => c.id === cleanId || c.client_code === cleanId) || {
      id: cleanId,
      client_code: cleanId,
      name: 'Alexander Hunt',
      email: 'a.hunt@mail.com',
      phone: '+1-555-3001',
      status: 'ACTIVE',
      kyc_status: 'APPROVED',
      wallet_balance: 25400,
      available_margin: 25400,
      todays_pl: 3820,
      open_positions_count: 2,
      master_name: 'Apex Capital',
      broker_name: 'Ryan Chen',
      sub_broker_name: 'Tom Anderson',
      tenant_name: 'Alpha Prime Capital',
      tenant_id: tenantId || 'TNT-001',
      created_at: '2023-04-01'
    };

    const orders = await this.getClientOrders(cleanId, tenantId);
    const trades = await this.getClientTrades(cleanId, tenantId);
    const positions = await this.getClientPositions(cleanId, tenantId);

    const balance = client.wallet_balance || 25400;
    const marginUsed = 14200;
    const freeMargin = Math.max(0, balance - marginUsed);

    return {
      client: {
        id: client.id,
        client_code: client.client_code,
        name: client.name,
        email: client.email,
        phone: client.phone,
        status: client.status,
        kyc_status: client.kyc_status,
        pan: 'ABCDE1234F',
        address: '124 Financial District, Metro City',
        master: (client as any).master_name || 'Apex Capital',
        broker: (client as any).broker_name || 'Ryan Chen',
        subBroker: (client as any).sub_broker_name || 'Tom Anderson',
        tenant_id: client.tenant_id || 'TNT-001',
        tenant_name: client.tenant_name || 'Alpha Prime Capital',
        joined: client.created_at || '2023-04-01',
        created_at: client.created_at || '2023-04-01'
      },
      tradingAccount: {
        accountNumber: `TRD-${client.id}`,
        dematNumber: `IN300128-${client.id}`,
        tradingPlatformUrl: `/?mode=trading&client_id=${encodeURIComponent(client.id)}&name=${encodeURIComponent(client.name)}&balance=${balance}`,
        mainPlatformLink: `/?mode=trading&client_id=${encodeURIComponent(client.id)}`,
        currency: 'INR',
        balance: `₹${balance.toLocaleString('en-IN')}`,
        rawBalance: balance,
        availableMargin: `₹${freeMargin.toLocaleString('en-IN')}`,
        rawAvailableMargin: freeMargin,
        utilizedMargin: `₹${marginUsed.toLocaleString('en-IN')}`,
        rawUtilizedMargin: marginUsed,
        collateral: '₹50,000',
        buyingPower: `₹${(balance * 5).toLocaleString('en-IN')}`,
        rawBuyingPower: balance * 5,
        dayPL: '+₹3,820',
        realizedPL: '+₹3,820',
        unrealizedPL: '+₹1,250',
        winRatio: '100% (2/2)',
        totalOrders: orders.length,
        totalTrades: trades.length,
        openPositions: positions.length,
        leverage: '5x Intraday / 1x CNC',
        marginUtilizationPercent: Math.round((marginUsed / (balance || 1)) * 100),
        segments: ['NSE Equity', 'NSE Futures & Options', 'MCX Commodities', 'Currency Derivatives'],
        s2sStatus: 'CLOSED'
      },
      orders,
      trades,
      positions
    };
  }

  async getClientOrders(clientId: string, _tenantId?: string): Promise<any[]> {
    return [
      { id: 'ORD-8821', order_id: 'ORD-8821', symbol: 'RELIANCE', side: 'BUY', quantity: 25, price: 2940.50, type: 'LIMIT', status: 'EXECUTED', time: '10:14:22', created_at: '2026-03-29 10:14:22' },
      { id: 'ORD-8819', order_id: 'ORD-8819', symbol: 'HDFCBANK', side: 'BUY', quantity: 50, price: 1445.00, type: 'MARKET', status: 'EXECUTED', time: '09:42:05', created_at: '2026-03-29 09:42:05' }
    ];
  }

  async getClientTrades(clientId: string, _tenantId?: string): Promise<any[]> {
    return [
      { id: 'TRD-4412', trade_id: 'TRD-4412', symbol: 'RELIANCE', side: 'BUY', qty: 25, quantity: 25, price: 2940.50, total_value: 73512.50, pnl: '+₹1,910', time: '10:14:22', status: 'EXECUTED', timestamp: '2026-03-29 10:14:22' },
      { id: 'TRD-4408', trade_id: 'TRD-4408', symbol: 'HDFCBANK', side: 'BUY', qty: 50, quantity: 50, price: 1445.00, total_value: 72250.00, pnl: '+₹1,910', time: '09:42:05', status: 'EXECUTED', timestamp: '2026-03-29 09:42:05' }
    ];
  }

  async getClientPositions(clientId: string, _tenantId?: string): Promise<any[]> {
    return [
      {
        id: `pos_${clientId}_RELIANCE`,
        symbol: 'RELIANCE',
        side: 'BUY',
        qty: 25,
        avgPrice: '₹2,940.50',
        rawAvgPrice: 2940.50,
        ltp: '₹2,995.00',
        currentPrice: '₹2,995.00',
        rawLtp: 2995.00,
        pnl: '+₹1,362.50',
        rawPnl: 1362.50,
        margin: '₹7,351.25',
        status: 'OPEN'
      },
      {
        id: `pos_${clientId}_HDFCBANK`,
        symbol: 'HDFCBANK',
        side: 'BUY',
        qty: 50,
        avgPrice: '₹1,445.00',
        rawAvgPrice: 1445.00,
        ltp: '₹1,452.20',
        currentPrice: '₹1,452.20',
        rawLtp: 1452.20,
        pnl: '+₹360.00',
        rawPnl: 360.00,
        margin: '₹7,225.00',
        status: 'OPEN'
      }
    ];
  }

  async getKYCRecords(tenantId?: string, status?: string): Promise<KYCRecord[]> {
    let result = this.kycRecords;
    if (tenantId) result = result.filter(k => k.tenant_id === tenantId);
    if (status && status !== 'ALL') result = result.filter(k => k.kyc_status === status);
    return result;
  }

  async updateKYCStatus(id: string, status: KYCRecord['kyc_status'], notes?: string): Promise<KYCRecord | null> {
    const record = this.kycRecords.find(k => k.id === id || k.client_id === id);
    if (record) {
      record.kyc_status = status;
      record.document_status = status === 'APPROVED' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING';
      if (notes) record.notes = notes;
      const client = this.clients.find(c => c.id === record.client_id);
      if (client) client.kyc_status = status;
      return record;
    }
    return null;
  }

  async getOrders(tenantId?: string): Promise<Order[]> {
    return this.orders;
  }

  async getAllTrades(tenantId?: string): Promise<Trade[]> {
    if (tenantId) return this.trades.filter(t => t.tenant_id === tenantId);
    return this.trades;
  }

  constructor() {
    // Seed tenant config cache with active domains and configs
    this.seedTenantConfigCache();
  }

  private seedTenantConfigCache(): void {
    for (const branding of this.whiteLabelConfigs) {
      if (branding.status === 'PUBLISHED') {
        tenantConfigCache.setBranding(branding.tenant_id, branding);
      }
      if (branding.custom_domain) {
        tenantConfigCache.mapDomainToTenant(branding.custom_domain, branding.tenant_id);
      }
    }
    for (const domain of this.tenantDomains) {
      if (domain.verification_status === 'VERIFIED') {
        tenantConfigCache.mapDomainToTenant(domain.domain, domain.tenant_id);
      }
    }
    for (const cfg of this.tenantPlatformConfigs) {
      tenantConfigCache.setPlatformConfig(cfg.tenant_id, cfg);
    }
  }

  async getSubscriptions(): Promise<SubscriptionPlan[]> {
    return this.subscriptions;
  }

  async getWhiteLabelConfigs(): Promise<WhiteLabelConfig[]> {
    return this.whiteLabelConfigs;
  }

  async getWhiteLabelConfig(tenantId: string): Promise<WhiteLabelConfig | null> {
    // Check cache first
    const cached = tenantConfigCache.getBranding(tenantId);
    if (cached) return cached;

    const config = this.whiteLabelConfigs.find(c => c.tenant_id === tenantId);
    if (config && config.status === 'PUBLISHED') {
      tenantConfigCache.setBranding(tenantId, config);
    }
    return config || null;
  }

  async updateWhiteLabelConfig(tenantId: string, data: Partial<WhiteLabelConfig>, actor: string = 'Admin'): Promise<WhiteLabelConfig> {
    const rawBrandName = data.brand_name !== undefined ? data.brand_name : (data as any).brandName;
    if (rawBrandName !== undefined) {
      const trimmed = typeof rawBrandName === 'string' ? rawBrandName.trim() : '';
      if (!trimmed) {
        throw new Error('Brand name cannot be empty');
      }
      if (trimmed.length > 100) {
        throw new Error('Brand name cannot exceed 100 characters');
      }
    }

    // Validate colors if provided
    const hexOrRgbRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (data.primary_color && !hexOrRgbRegex.test(data.primary_color.trim())) {
      throw new Error(`Invalid primary color: "${data.primary_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (data.secondary_color && !hexOrRgbRegex.test(data.secondary_color.trim())) {
      throw new Error(`Invalid secondary color: "${data.secondary_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (data.accent_color && !hexOrRgbRegex.test(data.accent_color.trim())) {
      throw new Error(`Invalid accent color: "${data.accent_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (data.background_color && !hexOrRgbRegex.test(data.background_color.trim())) {
      throw new Error(`Invalid background color: "${data.background_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (data.surface_color && !hexOrRgbRegex.test(data.surface_color.trim())) {
      throw new Error(`Invalid surface color: "${data.surface_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (data.support_email && data.support_email.trim() && !emailRegex.test(data.support_email.trim())) {
      throw new Error(`Invalid support email format: "${data.support_email}".`);
    }

    let config = this.whiteLabelConfigs.find(c => c.tenant_id === tenantId);
    const tenant = this.tenants.find(t => t.id === tenantId);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (!config) {
      config = {
        tenant_id: tenantId,
        tenant_name: tenant?.name || 'Tenant',
        brand_name: tenant?.name || 'Tenant Trading',
        short_name: tenant?.code || 'Trade',
        tagline: 'Institutional & Retail Trading Solutions',
        company_name: tenant?.name || 'Brokerage Solutions Ltd',
        logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        logo_light_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        logo_dark_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        favicon_url: '/favicon.ico',
        app_icon_url: '/favicon.ico',
        primary_color: '#2563eb',
        secondary_color: '#0f172a',
        accent_color: '#38bdf8',
        background_color: '#080d1a',
        surface_color: '#0d1528',
        text_color: '#f8fafc',
        success_color: '#10b981',
        warning_color: '#f59e0b',
        error_color: '#ef4444',
        login_branding: `${tenant?.name || 'Tenant'} Trading Portal`,
        login_background_url: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=1200&auto=format&fit=crop&q=80',
        login_title: `Welcome to ${tenant?.name || 'Trade'}`,
        login_subtitle: 'Secure Trading Terminal',
        welcome_text: 'Trade global markets with low latency and competitive spreads.',
        support_contact: tenant?.support_email || 'support@tradepro.com',
        custom_domain: `${tenant?.code.toLowerCase() || 'trade'}.tradepro.com`,
        support_email: tenant?.support_email || 'support@tradepro.com',
        support_phone: '+91 (022) 6000-0000',
        company_address: 'Corporate Headquarters, Financial District',
        website_url: `https://${tenant?.code.toLowerCase() || 'trade'}.tradepro.com`,
        help_support_url: `https://${tenant?.code.toLowerCase() || 'trade'}.tradepro.com/support`,
        footer_text: `© 2026 ${tenant?.name || 'TradePro'}. All rights reserved.`,
        terms_url: '#',
        privacy_url: '#',
        risk_disclosure_url: '#',
        disclaimer_url: '#',
        status: 'DRAFT',
        version: 1,
        created_at: now,
        updated_at: now
      };
      this.whiteLabelConfigs.push(config);
    }

    // Save previous snapshot for rollback if not already saved for this version
    const history = this.brandingHistory.get(tenantId) || [];
    history.push(JSON.parse(JSON.stringify(config)));
    if (history.length > 20) history.shift();
    this.brandingHistory.set(tenantId, history);

    // Apply updates and mark status as DRAFT
    Object.assign(config, data);
    if (config.footer_copyright && !config.footer_text) config.footer_text = config.footer_copyright;
    if (config.footer_text && !config.footer_copyright) config.footer_copyright = config.footer_text;
    config.status = 'DRAFT';
    config.updated_at = now;

    // Invalidate public cache so unverified draft changes are NOT served publicly
    tenantConfigCache.invalidateBranding(tenantId);

    // Persist draft in database
    try {
      await query(`
        INSERT INTO tenant_branding (
          id, tenant_id, company_name, portal_name, tagline, logo_url, favicon_url,
          primary_color, secondary_color, accent_color, background_color, surface_color,
          support_email, support_phone, copyright_text, version, publish_status, draft_config, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'DRAFT', $17, NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          portal_name = EXCLUDED.portal_name,
          tagline = EXCLUDED.tagline,
          logo_url = EXCLUDED.logo_url,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          accent_color = EXCLUDED.accent_color,
          background_color = EXCLUDED.background_color,
          surface_color = EXCLUDED.surface_color,
          support_email = EXCLUDED.support_email,
          support_phone = EXCLUDED.support_phone,
          copyright_text = EXCLUDED.copyright_text,
          draft_config = EXCLUDED.draft_config,
          publish_status = 'DRAFT',
          updated_at = NOW()
      `, [
        `tb-${tenantId}`,
        tenantId,
        config.company_name || config.brand_name || tenant?.name || 'Company',
        config.brand_name || tenant?.name || 'Portal',
        config.tagline || '',
        config.logo_url || '',
        config.favicon_url || '/favicon.ico',
        config.primary_color || '#3b82f6',
        config.secondary_color || '#0f172a',
        config.accent_color || '#10b981',
        config.background_color || '#080d1a',
        config.surface_color || '#0d1528',
        config.support_email || '',
        config.support_phone || '',
        config.footer_copyright || config.footer_text || '',
        config.version || 1,
        JSON.stringify(config)
      ]);
    } catch (dbErr) {
      console.warn('[TradingDataProvider] DB draft save fallback to memory:', dbErr);
    }

    // Record audit log
    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: tenantId,
      tenant_name: config.tenant_name,
      action: 'BRANDING_UPDATED',
      entity: `Branding Draft (v${config.version || 1})`,
      old_value: 'Draft modified',
      new_value: `DRAFT: ${config.brand_name || config.tenant_name}`,
      timestamp: now,
      ip_address: '103.21.58.14',
      reason: 'Draft branding configuration saved by administrator'
    });

    return config;
  }

  async publishWhiteLabelConfig(tenantId: string, actor: string = 'Admin', reason: string = 'Published updated white-label configuration'): Promise<WhiteLabelConfig> {
    const config = this.whiteLabelConfigs.find(c => c.tenant_id === tenantId);
    if (!config) {
      throw new Error(`White-label configuration for tenant ${tenantId} not found`);
    }

    // Color and field validations
    const hexOrRgbRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$|^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!config.brand_name || !config.brand_name.trim()) {
      throw new Error('Brand Name cannot be empty.');
    }
    if (!hexOrRgbRegex.test(config.primary_color || '')) {
      throw new Error(`Invalid primary color: "${config.primary_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (!hexOrRgbRegex.test(config.secondary_color || '')) {
      throw new Error(`Invalid secondary color: "${config.secondary_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (!hexOrRgbRegex.test(config.accent_color || '')) {
      throw new Error(`Invalid accent color: "${config.accent_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (!hexOrRgbRegex.test(config.background_color || '')) {
      throw new Error(`Invalid background color: "${config.background_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (!hexOrRgbRegex.test(config.surface_color || '')) {
      throw new Error(`Invalid surface color: "${config.surface_color}". Please provide a valid HEX or RGB/RGBA code.`);
    }
    if (config.support_email && config.support_email.trim() && !emailRegex.test(config.support_email.trim())) {
      throw new Error(`Invalid support email format: "${config.support_email}".`);
    }

    // Save snapshot before publishing
    const history = this.brandingHistory.get(tenantId) || [];
    history.push(JSON.parse(JSON.stringify(config)));
    this.brandingHistory.set(tenantId, history);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const nextVersion = (config.version || 1) + 1;

    // Prepare published candidate
    const publishedCandidate = {
      ...config,
      status: 'PUBLISHED' as const,
      version: nextVersion,
      updated_at: now
    };

    // Send secure S2S request to Trading Platform
    const syncRes = await tradingPlatformClient.syncWhiteLabel(
      tenantId,
      publishedCandidate,
      nextVersion,
      { actor, correlationId: `pub_${tenantId}_v${nextVersion}_${Date.now()}` }
    );

    // If Trading Platform communication fails, DO NOT report success!
    if (!syncRes.success) {
      this.brandingAuditLogs.unshift({
        id: `b-log-${Date.now()}`,
        actor,
        role: 'SUPER_ADMIN',
        tenant_id: tenantId,
        tenant_name: config.tenant_name,
        action: 'BRANDING_UPDATED',
        entity: `Branding Publish Failed (v${nextVersion})`,
        old_value: 'DRAFT',
        new_value: `S2S Sync Failed: ${syncRes.error || 'Connection refused'}`,
        timestamp: now,
        ip_address: '103.21.58.14',
        reason: `Failed to push branding to Trading Platform: ${syncRes.error}`
      });
      throw new Error(`Trading Platform failed to synchronize: ${syncRes.error || 'Remote error'}`);
    }

    // S2S confirmed success! Commit changes
    Object.assign(config, publishedCandidate);

    // Invalidate and refresh cache
    tenantConfigCache.invalidateBranding(tenantId);
    tenantConfigCache.setBranding(tenantId, config);
    if (config.custom_domain) {
      tenantConfigCache.mapDomainToTenant(config.custom_domain, tenantId);
    }

    // Persist published configuration and version to database
    try {
      const tenant = this.tenants.find(t => t.id === tenantId);
      await query(`
        INSERT INTO tenant_branding (
          id, tenant_id, company_name, portal_name, tagline, logo_url, favicon_url,
          primary_color, secondary_color, accent_color, background_color, surface_color,
          support_email, support_phone, copyright_text, version, publish_status,
          published_config, last_published_at, last_published_by, sync_status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PUBLISHED', $17, NOW(), $18, 'SYNCED', NOW())
        ON CONFLICT (tenant_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          portal_name = EXCLUDED.portal_name,
          tagline = EXCLUDED.tagline,
          logo_url = EXCLUDED.logo_url,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          accent_color = EXCLUDED.accent_color,
          background_color = EXCLUDED.background_color,
          surface_color = EXCLUDED.surface_color,
          support_email = EXCLUDED.support_email,
          support_phone = EXCLUDED.support_phone,
          copyright_text = EXCLUDED.copyright_text,
          version = EXCLUDED.version,
          publish_status = 'PUBLISHED',
          published_config = EXCLUDED.published_config,
          last_published_at = NOW(),
          last_published_by = EXCLUDED.last_published_by,
          sync_status = 'SYNCED',
          updated_at = NOW()
      `, [
        `tb-${tenantId}`,
        tenantId,
        config.company_name || config.brand_name || tenant?.name || 'Company',
        config.brand_name || tenant?.name || 'Portal',
        config.tagline || '',
        config.logo_url || '',
        config.favicon_url || '/favicon.ico',
        config.primary_color || '#3b82f6',
        config.secondary_color || '#0f172a',
        config.accent_color || '#10b981',
        config.background_color || '#080d1a',
        config.surface_color || '#0d1528',
        config.support_email || '',
        config.support_phone || '',
        config.footer_copyright || config.footer_text || '',
        config.version,
        JSON.stringify(config),
        actor
      ]);

      await query(`
        INSERT INTO white_label_versions (id, tenant_id, version, status, config, published_by, published_at, change_summary)
        VALUES ($1, $2, $3, 'PUBLISHED', $4, $5, NOW(), $6)
        ON CONFLICT (tenant_id, version) DO UPDATE SET
          config = EXCLUDED.config,
          published_at = NOW()
      `, [
        `wlv-${tenantId}-v${config.version}`,
        tenantId,
        config.version,
        JSON.stringify(config),
        actor,
        reason || `Published version ${config.version}`
      ]);
    } catch (dbErr) {
      console.warn('[TradingDataProvider] DB publish save warning:', dbErr);
    }

    // Broadcast real-time update event
    adminEventBus.emit('tenant.branding.updated', {
      tenantId,
      version: config.version,
      brandName: config.brand_name,
      colors: {
        primary: config.primary_color,
        secondary: config.secondary_color,
        accent: config.accent_color,
        background: config.background_color,
        surface: config.surface_color
      },
      logoUrl: config.logo_url,
      updatedAt: config.updated_at
    });

    // Record audit log
    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: tenantId,
      tenant_name: config.tenant_name,
      action: 'BRANDING_PUBLISHED',
      entity: `Branding Version ${config.version}`,
      old_value: `v${config.version - 1}`,
      new_value: `v${config.version} (PUBLISHED)`,
      timestamp: now,
      ip_address: '103.21.58.14',
      reason
    });

    return config;
  }

  async rollbackWhiteLabelConfig(tenantId: string, actor: string = 'Admin'): Promise<WhiteLabelConfig> {
    const history = this.brandingHistory.get(tenantId);
    let previousConfig: WhiteLabelConfig | null = null;

    if (history && history.length > 0) {
      previousConfig = history.pop()!;
    } else {
      // Check database white_label_versions for prior version
      try {
        const rows = await query(
          'SELECT config FROM white_label_versions WHERE tenant_id = $1 ORDER BY version DESC LIMIT 2',
          [tenantId]
        );
        if (rows.rows.length >= 2) {
          previousConfig = typeof rows.rows[1].config === 'string'
            ? JSON.parse(rows.rows[1].config)
            : rows.rows[1].config;
        }
      } catch (e) {
        console.warn('DB version history lookup failed in rollback:', e);
      }
    }

    if (!previousConfig) {
      throw new Error(`No previous white-label versions available to rollback for tenant ${tenantId}`);
    }

    let currentConfig = this.whiteLabelConfigs.find(c => c.tenant_id === tenantId);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newVersion = ((currentConfig?.version || previousConfig.version || 1) + 1);

    const rollbackConfig: WhiteLabelConfig = {
      ...previousConfig,
      tenant_id: tenantId,
      version: newVersion,
      status: 'PUBLISHED',
      updated_at: now
    };

    // Sync rollback version via S2S
    const syncRes = await tradingPlatformClient.syncWhiteLabel(
      tenantId,
      rollbackConfig,
      newVersion,
      { actor: `${actor} (Rollback)` }
    );

    if (!syncRes.success) {
      throw new Error(`Trading Platform failed to synchronize rollback: ${syncRes.error}`);
    }

    if (currentConfig) {
      Object.assign(currentConfig, rollbackConfig);
    } else {
      currentConfig = rollbackConfig;
      this.whiteLabelConfigs.push(currentConfig);
    }

    // Invalidate and refresh cache
    tenantConfigCache.invalidateBranding(tenantId);
    tenantConfigCache.setBranding(tenantId, currentConfig);
    if (currentConfig.custom_domain) {
      tenantConfigCache.mapDomainToTenant(currentConfig.custom_domain, tenantId);
    }

    // Record audit log
    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: tenantId,
      tenant_name: currentConfig.tenant_name,
      action: 'BRANDING_ROLLED_BACK',
      entity: `Branding Version ${newVersion}`,
      old_value: `v${newVersion - 1}`,
      new_value: `Restored from v${previousConfig.version} as v${newVersion}`,
      timestamp: now,
      ip_address: '103.21.58.14',
      reason: 'Administrator rolled back branding to previous version'
    });

    return currentConfig;
  }

  async getWhiteLabelVersions(tenantId: string): Promise<any[]> {
    const list: any[] = [];
    const history = this.brandingHistory.get(tenantId) || [];
    for (const item of history) {
      list.push({
        version: item.version,
        status: item.status,
        brand_name: item.brand_name,
        published_at: item.updated_at,
        published_by: 'Admin',
        change_summary: `Snapshot of version ${item.version}`
      });
    }

    const current = this.whiteLabelConfigs.find(c => c.tenant_id === tenantId);
    if (current) {
      list.push({
        version: current.version,
        status: current.status,
        brand_name: current.brand_name,
        published_at: current.updated_at,
        published_by: 'Admin',
        change_summary: `Current active (${current.status})`
      });
    }

    try {
      const dbRows = await query(
        'SELECT version, status, published_by, published_at, change_summary FROM white_label_versions WHERE tenant_id = $1 ORDER BY version DESC',
        [tenantId]
      );
      if (dbRows.rows.length > 0) {
        return dbRows.rows;
      }
    } catch {
      // Use in-memory list
    }

    return list.reverse();
  }

  // ----------------------------------------------------
  // Tenant Platform Config & Feature Flags
  // ----------------------------------------------------
  async getTenantPlatformConfig(tenantId: string): Promise<TenantPlatformConfig> {
    const cached = tenantConfigCache.getPlatformConfig(tenantId);
    if (cached) return cached;

    let cfg = this.tenantPlatformConfigs.find(c => c.tenant_id === tenantId);
    if (!cfg) {
      const tenant = this.tenants.find(t => t.id === tenantId);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      cfg = {
        id: `cfg-${tenantId.toLowerCase()}`,
        tenant_id: tenantId,
        tenant_name: tenant?.name || 'Tenant',
        web_trading_enabled: true,
        mobile_trading_enabled: true,
        registration_enabled: true,
        forgot_password_enabled: true,
        support_enabled: true,
        notifications_enabled: true,
        api_enabled: true,
        trading_enabled: true,
        maintenance_mode: false,
        created_at: now,
        updated_at: now
      };
      this.tenantPlatformConfigs.push(cfg);
    }

    tenantConfigCache.setPlatformConfig(tenantId, cfg);
    return cfg;
  }

  async updateTenantPlatformConfig(tenantId: string, data: Partial<TenantPlatformConfig>, actor: string = 'Admin'): Promise<TenantPlatformConfig> {
    let cfg = await this.getTenantPlatformConfig(tenantId);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    // Check what changed for audit log
    const changedKeys = Object.keys(data).filter(k => (data as any)[k] !== (cfg as any)[k]);
    Object.assign(cfg, data);
    cfg.updated_at = now;

    // Invalidate and update cache
    tenantConfigCache.setPlatformConfig(tenantId, cfg);

    // Audit log
    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: tenantId,
      tenant_name: cfg.tenant_name || tenantId,
      action: data.trading_enabled === false ? 'TRADING_DISABLED' : (data.trading_enabled === true ? 'TRADING_ENABLED' : 'PLATFORM_CONFIG_UPDATED'),
      entity: 'Platform Settings',
      old_value: 'Previous flags',
      new_value: changedKeys.map(k => `${k}: ${(data as any)[k]}`).join(', '),
      timestamp: now,
      ip_address: '103.21.58.14',
      reason: `Platform configuration updated: ${changedKeys.join(', ')}`
    });

    return cfg;
  }

  // ----------------------------------------------------
  // Tenant Domains Management
  // ----------------------------------------------------
  async getTenantDomains(tenantId?: string): Promise<TenantDomain[]> {
    if (tenantId) {
      return this.tenantDomains.filter(d => d.tenant_id === tenantId);
    }
    return this.tenantDomains;
  }

  async addTenantDomain(tenantId: string, domainData: Partial<TenantDomain>, actor: string = 'Admin'): Promise<TenantDomain> {
    const tenant = this.tenants.find(t => t.id === tenantId);
    const cleanDomain = (domainData.domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];
    
    // Check if domain already exists
    const existing = this.tenantDomains.find(d => d.domain === cleanDomain);
    if (existing) {
      throw new Error(`Domain '${cleanDomain}' is already configured for tenant ${existing.tenant_name}`);
    }

    const newDomain: TenantDomain = {
      id: `dom-${Date.now()}`,
      tenant_id: tenantId,
      tenant_name: tenant?.name || 'Tenant',
      domain: cleanDomain,
      domain_type: domainData.domain_type || 'CUSTOM',
      verification_status: 'PENDING',
      is_primary: domainData.is_primary || false,
      ssl_status: 'PROVISIONING',
      created_at: new Date().toISOString().substring(0, 10)
    };

    if (newDomain.is_primary) {
      // Unmark other primary domains for this tenant
      this.tenantDomains.forEach(d => {
        if (d.tenant_id === tenantId) d.is_primary = false;
      });
    }

    this.tenantDomains.push(newDomain);

    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: tenantId,
      tenant_name: tenant?.name || 'Tenant',
      action: 'DOMAIN_ADDED',
      entity: cleanDomain,
      old_value: 'None',
      new_value: `Added domain (${newDomain.domain_type})`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14',
      reason: 'Domain added for white-label routing'
    });

    return newDomain;
  }

  async updateTenantDomain(id: string, updates: Partial<TenantDomain>, actor: string = 'Admin'): Promise<TenantDomain> {
    const domain = this.tenantDomains.find(d => d.id === id);
    if (!domain) throw new Error(`Domain ${id} not found`);

    if (updates.is_primary) {
      this.tenantDomains.forEach(d => {
        if (d.tenant_id === domain.tenant_id && d.id !== id) d.is_primary = false;
      });
    }

    Object.assign(domain, updates);

    if (domain.verification_status === 'VERIFIED') {
      tenantConfigCache.mapDomainToTenant(domain.domain, domain.tenant_id);
    } else {
      tenantConfigCache.removeDomainMapping(domain.domain);
    }

    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: domain.tenant_id,
      tenant_name: domain.tenant_name,
      action: 'DOMAIN_CHANGED',
      entity: domain.domain,
      old_value: 'Previous config',
      new_value: JSON.stringify(updates),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });

    return domain;
  }

  async deleteTenantDomain(id: string, actor: string = 'Admin'): Promise<boolean> {
    const index = this.tenantDomains.findIndex(d => d.id === id);
    if (index === -1) return false;

    const removed = this.tenantDomains[index];
    this.tenantDomains.splice(index, 1);
    tenantConfigCache.removeDomainMapping(removed.domain);

    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: removed.tenant_id,
      tenant_name: removed.tenant_name,
      action: 'DOMAIN_DISABLED',
      entity: removed.domain,
      old_value: 'Active domain',
      new_value: 'Deleted',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14',
      reason: 'Domain configuration removed'
    });

    return true;
  }

  async verifyTenantDomain(id: string, actor: string = 'Admin'): Promise<TenantDomain> {
    const domain = this.tenantDomains.find(d => d.id === id);
    if (!domain) throw new Error(`Domain ${id} not found`);

    domain.verification_status = 'VERIFIED';
    domain.ssl_status = 'ACTIVE';
    tenantConfigCache.mapDomainToTenant(domain.domain, domain.tenant_id);

    this.brandingAuditLogs.unshift({
      id: `b-log-${Date.now()}`,
      actor,
      role: 'SUPER_ADMIN',
      tenant_id: domain.tenant_id,
      tenant_name: domain.tenant_name,
      action: 'DOMAIN_VERIFIED',
      entity: domain.domain,
      old_value: 'PENDING',
      new_value: 'VERIFIED & SSL ACTIVE',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14',
      reason: 'DNS CNAME verification successful'
    });

    return domain;
  }

  async resolveTenantByDomain(domain: string): Promise<{ tenant: Tenant | null; branding: WhiteLabelConfig | null; platformConfig: TenantPlatformConfig | null }> {
    const cleanDomain = (domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    
    // Check cache first
    let tenantId = tenantConfigCache.getTenantIdByDomain(cleanDomain);

    if (!tenantId) {
      // Lookup in tenantDomains
      const match = this.tenantDomains.find(d => d.domain.toLowerCase() === cleanDomain);
      if (match) {
        tenantId = match.tenant_id;
        tenantConfigCache.mapDomainToTenant(cleanDomain, tenantId);
      }
    }

    if (!tenantId) {
      // Lookup in whiteLabelConfigs custom_domain
      const brandMatch = this.whiteLabelConfigs.find(c => (c.custom_domain || '').toLowerCase() === cleanDomain);
      if (brandMatch) {
        tenantId = brandMatch.tenant_id;
        tenantConfigCache.mapDomainToTenant(cleanDomain, tenantId);
      }
    }

    // Fallback: if domain contains substring of tenant code or name
    if (!tenantId) {
      if (cleanDomain.includes('apex')) tenantId = 'TNT-002';
      else if (cleanDomain.includes('zenith')) tenantId = 'TNT-003';
      else if (cleanDomain.includes('alpha')) tenantId = 'TNT-001';
      else tenantId = 'TNT-001'; // Default to TNT-001 if testing on localhost
    }

    const tenant = this.tenants.find(t => t.id === tenantId) || null;
    const branding = await this.getWhiteLabelConfig(tenantId);
    const platformConfig = await this.getTenantPlatformConfig(tenantId);

    return { tenant, branding, platformConfig };
  }

  async getBrandingAuditLogs(tenantId?: string): Promise<BrandingAuditLog[]> {
    if (tenantId) {
      return this.brandingAuditLogs.filter(l => l.tenant_id === tenantId);
    }
    return this.brandingAuditLogs;
  }

  // ----------------------------------------------------
  // Tenant Order Execution with Feature-Flag & Emergency Controls
  // ----------------------------------------------------
  async executeTenantOrder(tenantId: string, orderData: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: 'MARKET' | 'LIMIT';
    clientName?: string;
  }): Promise<{ success: boolean; order?: Order; trade?: Trade; message?: string; error?: string }> {
    const tenant = this.tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, error: 'TENANT_NOT_FOUND', message: 'Tenant does not exist.' };
    }

    // 1. Check Global Emergency Controls
    const emergency = await this.getEmergencyState();
    if (!emergency.globalTradingActive || emergency.globalKillSwitchActive) {
      return {
        success: false,
        error: 'GLOBAL_TRADING_HALTED',
        message: 'Trading is globally suspended across the system due to risk/emergency controls.'
      };
    }

    // 2. Check if Tenant or its Masters are frozen
    const isTenantFrozen = emergency.frozenMasters.some(
      m => this.masters.some(mast => mast.id === m.masterId && mast.tenant_id === tenantId)
    );
    if (isTenantFrozen) {
      return {
        success: false,
        error: 'TENANT_FROZEN',
        message: 'Trading operations for this tenant brokerage have been temporarily frozen by compliance.'
      };
    }

    // 3. Check Tenant Platform Config Feature Flags
    const platformConfig = await this.getTenantPlatformConfig(tenantId);
    if (!platformConfig.trading_enabled) {
      return {
        success: false,
        error: 'TRADING_DISABLED_FOR_TENANT',
        message: 'Trading is currently disabled for this tenant platform. Orders cannot be accepted.'
      };
    }

    if (!platformConfig.web_trading_enabled) {
      return {
        success: false,
        error: 'WEB_TRADING_DISABLED',
        message: 'Web terminal trading is currently disabled for this platform.'
      };
    }

    if (platformConfig.maintenance_mode) {
      return {
        success: false,
        error: 'PLATFORM_MAINTENANCE',
        message: platformConfig.maintenance_message || 'Platform is currently undergoing scheduled maintenance.'
      };
    }

    // 4. Execute the order
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const tradeId = `TRD-${Date.now().toString().slice(-6)}`;
    const execPrice = orderData.price || 1420.5;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newOrder: Order = {
      id: orderId,
      order_id: orderId,
      client_name: orderData.clientName || 'Demo Trader',
      tenant_name: tenant.name,
      symbol: orderData.symbol,
      type: orderData.type,
      side: orderData.side,
      quantity: orderData.quantity,
      price: execPrice,
      status: 'EXECUTED',
      created_at: now
    };

    const newTrade: Trade = {
      id: tradeId,
      trade_id: tradeId,
      client_id: 'clt-demo',
      tenant_id: tenantId,
      tenant_name: tenant.name,
      client_name: orderData.clientName || 'Demo Trader',
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      price: execPrice,
      total_value: execPrice * orderData.quantity,
      pl: 0,
      status: 'EXECUTED',
      timestamp: now
    };

    this.orders.unshift(newOrder);
    this.trades.unshift(newTrade);

    return {
      success: true,
      order: newOrder,
      trade: newTrade,
      message: `Order for ${orderData.quantity}x ${orderData.symbol} executed successfully at ₹${execPrice}.`
    };
  }

  async getSupportTickets(tenantId?: string): Promise<SupportTicket[]> {
    if (tenantId) return this.supportTickets.filter(t => t.tenant_id === tenantId);
    return this.supportTickets;
  }

  async updateSupportTicket(ticketId: string, data: Partial<SupportTicket>, actor?: string): Promise<SupportTicket | null> {
    const ticket = this.supportTickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    Object.assign(ticket, data);
    return ticket;
  }

  async addSupportTicketReply(ticketId: string, message: string, actor?: string, role?: string): Promise<SupportTicket | null> {
    const ticket = this.supportTickets.find(t => t.id === ticketId);
    if (!ticket) return null;
    if (!ticket.messages) {
      ticket.messages = [];
    }
    ticket.messages.push({
      id: `msg-${Date.now()}`,
      sender: actor || 'Admin Staff',
      message,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      isStaff: true
    });
    return ticket;
  }

  async getAuditLogs(tenantId?: string): Promise<AuditLog[]> {
    return this.auditLogs;
  }

  // ----------------------------------------------------
  // Emergency Controls Implementation
  // ----------------------------------------------------
  private emergencyState: EmergencyControlsState = {
    globalTradingActive: true,
    globalKillSwitchActive: false,
    newUserCreationEnabled: true,
    apiAccessEnabled: true,
    frozenMasters: [],
    frozenBrokers: [],
    frozenUsers: []
  };

  async getEmergencyControls(): Promise<EmergencyControlsState> {
    return this.emergencyState;
  }

  async getEmergencyState(): Promise<EmergencyControlsState> {
    return this.emergencyState;
  }

  async freezeMaster(masterId: string, masterName: string, actor: string, reason: string): Promise<EmergencyControlsState> {
    if (!this.emergencyState.frozenMasters.some(m => m.masterId === masterId)) {
      this.emergencyState.frozenMasters.push({
        masterId,
        masterName,
        frozenBy: actor,
        frozenAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        reason
      });
      await this.recordConfigChange({
        config_module: 'EMERGENCY_CONTROLS',
        setting_name: `Freeze Master: ${masterName} (${masterId})`,
        old_value: 'ACTIVE',
        new_value: 'FROZEN',
        changed_by: actor,
        reason,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip_address: '103.21.58.14'
      });
    }
    return this.emergencyState;
  }

  async unfreezeMaster(masterId: string, actor: string): Promise<EmergencyControlsState> {
    const existing = this.emergencyState.frozenMasters.find(m => m.masterId === masterId);
    this.emergencyState.frozenMasters = this.emergencyState.frozenMasters.filter(m => m.masterId !== masterId);
    if (existing) {
      await this.recordConfigChange({
        config_module: 'EMERGENCY_CONTROLS',
        setting_name: `Unfreeze Master: ${existing.masterName} (${masterId})`,
        old_value: 'FROZEN',
        new_value: 'ACTIVE',
        changed_by: actor,
        reason: 'Administrative unfreeze action',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip_address: '103.21.58.14'
      });
    }
    return this.emergencyState;
  }

  async freezeBroker(brokerId: string, brokerName: string, actor: string, reason: string): Promise<EmergencyControlsState> {
    if (!this.emergencyState.frozenBrokers.some(b => b.brokerId === brokerId)) {
      this.emergencyState.frozenBrokers.push({
        brokerId,
        brokerName,
        frozenBy: actor,
        frozenAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        reason
      });
    }
    return this.emergencyState;
  }

  async unfreezeBroker(brokerId: string, actor: string): Promise<EmergencyControlsState> {
    this.emergencyState.frozenBrokers = this.emergencyState.frozenBrokers.filter(b => b.brokerId !== brokerId);
    return this.emergencyState;
  }

  async freezeUser(userId: string, userName: string, actor: string, reason: string): Promise<EmergencyControlsState> {
    if (!this.emergencyState.frozenUsers.some(u => u.userId === userId)) {
      this.emergencyState.frozenUsers.push({
        userId,
        userName,
        frozenBy: actor,
        frozenAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        reason
      });
    }
    return this.emergencyState;
  }

  async unfreezeUser(userId: string, actor: string): Promise<EmergencyControlsState> {
    this.emergencyState.frozenUsers = this.emergencyState.frozenUsers.filter(u => u.userId !== userId);
    return this.emergencyState;
  }

  async setGlobalTrading(active: boolean, actor: string, reason?: string): Promise<EmergencyControlsState> {
    const old = this.emergencyState.globalTradingActive;
    this.emergencyState.globalTradingActive = active;
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'Global Trading State',
      old_value: old ? 'TRADING_ACTIVE' : 'TRADING_DISABLED',
      new_value: active ? 'TRADING_ACTIVE' : 'TRADING_DISABLED',
      changed_by: actor,
      reason: reason || (active ? 'Resumed regular trading operations' : 'Emergency trading halt executed'),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return this.emergencyState;
  }

  async setGlobalTradingActive(active: boolean, actor: string, reason?: string): Promise<EmergencyControlsState> {
    return this.setGlobalTrading(active, actor, reason);
  }

  async triggerKillSwitch(actionOrActor: string, actorOrReason: string, ipOrReason?: string): Promise<EmergencyControlsState> {
    if (actionOrActor === 'DEACTIVATE' || actionOrActor === 'RESET') {
      return this.deactivateKillSwitch(actorOrReason, ipOrReason || 'Emergency kill switch deactivated');
    }
    const actor = actionOrActor === 'TRIGGER' ? actorOrReason : actionOrActor;
    const reason = actionOrActor === 'TRIGGER' ? (ipOrReason || 'Emergency circuit breaker triggered') : actorOrReason;
    const ip = '103.21.58.14';

    this.emergencyState.globalKillSwitchActive = true;
    this.emergencyState.globalTradingActive = false;
    this.emergencyState.apiAccessEnabled = false;
    this.emergencyState.killSwitchDetails = {
      triggeredBy: actor,
      triggeredAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason,
      ipAddress: ip
    };
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'GLOBAL_KILL_SWITCH',
      old_value: 'INACTIVE',
      new_value: 'TRIGGERED_LOCKED',
      changed_by: actor,
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: ip
    });
    return this.emergencyState;
  }

  async deactivateKillSwitch(actor: string, reason: string): Promise<EmergencyControlsState> {
    this.emergencyState.globalKillSwitchActive = false;
    this.emergencyState.globalTradingActive = true;
    this.emergencyState.apiAccessEnabled = true;
    this.emergencyState.killSwitchDetails = undefined;
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'GLOBAL_KILL_SWITCH',
      old_value: 'TRIGGERED_LOCKED',
      new_value: 'INACTIVE',
      changed_by: actor,
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return this.emergencyState;
  }

  async cancelAllOrders(actor: string = 'Super Admin', reason: string = 'Emergency Mass Cancellation'): Promise<{ cancelledOrdersCount: number; message: string }> {
    let cancelledCount = 0;
    for (const order of this.orders) {
      if (order.status === 'PENDING') {
        order.status = 'CANCELLED';
        cancelledCount++;
        await this.recordOrderEvent({
          id: `OAT-${Date.now()}-${cancelledCount}`,
          order_id: order.id,
          action: 'ORDER_CANCELLED',
          user_name: actor,
          symbol: order.symbol,
          old_value: 'PENDING',
          new_value: 'CANCELLED',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          ip_address: '103.21.58.14',
          session_id: 'SES-EMERGENCY'
        });
      }
    }
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'CANCEL_ALL_ORDERS',
      old_value: 'N/A',
      new_value: `Cancelled ${cancelledCount} open orders`,
      changed_by: actor,
      reason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return {
      cancelledOrdersCount: cancelledCount,
      message: `Successfully cancelled ${cancelledCount} open orders.`
    };
  }

  async setNewUserCreation(enabled: boolean, actor: string): Promise<EmergencyControlsState> {
    const old = this.emergencyState.newUserCreationEnabled;
    this.emergencyState.newUserCreationEnabled = enabled;
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'New User Registration Allowed',
      old_value: String(old),
      new_value: String(enabled),
      changed_by: actor,
      reason: enabled ? 'Re-enabled user registrations' : 'Blocked new user registrations',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return this.emergencyState;
  }

  async setRegistrationActive(enabled: boolean, actor: string): Promise<EmergencyControlsState> {
    return this.setNewUserCreation(enabled, actor);
  }

  async setApiAccess(enabled: boolean, actor: string): Promise<EmergencyControlsState> {
    const old = this.emergencyState.apiAccessEnabled;
    this.emergencyState.apiAccessEnabled = enabled;
    await this.recordConfigChange({
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'Global API Gateway Access',
      old_value: String(old),
      new_value: String(enabled),
      changed_by: actor,
      reason: enabled ? 'Re-enabled API access' : 'Halted API access',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return this.emergencyState;
  }

  async setApiAccessActive(enabled: boolean, actor: string): Promise<EmergencyControlsState> {
    return this.setApiAccess(enabled, actor);
  }

  async executeAccountAction(entityType: string, entityId: string, action: string, actor: string, reason: string): Promise<any> {
    if (action === 'FREEZE') {
      if (entityType === 'MASTER') return this.freezeMaster(entityId, entityId, actor, reason);
      if (entityType === 'BROKER') return this.freezeBroker(entityId, entityId, actor, reason);
      return this.freezeUser(entityId, entityId, actor, reason);
    } else if (action === 'UNFREEZE') {
      if (entityType === 'MASTER') return this.unfreezeMaster(entityId, actor);
      if (entityType === 'BROKER') return this.unfreezeBroker(entityId, actor);
      return this.unfreezeUser(entityId, actor);
    }
    return { success: true, message: `Action ${action} on ${entityType} ${entityId} executed.` };
  }

  // ----------------------------------------------------
  // Master Management Implementation
  // ----------------------------------------------------
  private masterLimits: MasterLimits[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh (Alpha Prime)',
      max_total_users: 1000,
      current_total_users: 624,
      max_active_users: 800,
      current_active_users: 512,
      max_brokers: 25,
      current_brokers: 14,
      max_sub_brokers: 80,
      current_sub_brokers: 48,
      max_clients: 900,
      current_clients: 610,
      max_trading_volume_daily: 100000000,
      current_trading_volume_daily: 42000000,
      max_api_requests_daily: 150000,
      current_api_requests_daily: 84200,
      status: 'NORMAL',
      last_updated: '2024-04-15 10:00:00'
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia (Alpha Prime)',
      max_total_users: 500,
      current_total_users: 460,
      max_active_users: 400,
      current_active_users: 375,
      max_brokers: 15,
      current_brokers: 9,
      max_sub_brokers: 50,
      current_sub_brokers: 32,
      max_clients: 450,
      current_clients: 420,
      max_trading_volume_daily: 50000000,
      current_trading_volume_daily: 44000000,
      max_api_requests_daily: 100000,
      current_api_requests_daily: 91400,
      status: 'APPROACHING_LIMIT',
      last_updated: '2024-04-15 10:15:00'
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar (Apex Sec)',
      max_total_users: 600,
      current_total_users: 351,
      max_active_users: 450,
      current_active_users: 280,
      max_brokers: 20,
      current_brokers: 11,
      max_sub_brokers: 60,
      current_sub_brokers: 38,
      max_clients: 550,
      current_clients: 340,
      max_trading_volume_daily: 60000000,
      current_trading_volume_daily: 19000000,
      max_api_requests_daily: 100000,
      current_api_requests_daily: 42300,
      status: 'NORMAL',
      last_updated: '2024-04-15 09:45:00'
    },
    {
      master_id: 'MST-005',
      master_name: 'Gaurav Khanna (Zenith Quant)',
      max_total_users: 300,
      current_total_users: 224,
      max_active_users: 250,
      current_active_users: 195,
      max_brokers: 10,
      current_brokers: 4,
      max_sub_brokers: 25,
      current_sub_brokers: 14,
      max_clients: 280,
      current_clients: 220,
      max_trading_volume_daily: 80000000,
      current_trading_volume_daily: 11000000,
      max_api_requests_daily: 250000,
      current_api_requests_daily: 184500,
      status: 'NORMAL',
      last_updated: '2024-04-15 11:20:00'
    }
  ];

  private masterPricing: MasterPricingConfig[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      plan: 'ENTERPRISE_TIER_A',
      base_price_monthly: 75000,
      user_based_pricing: 150,
      active_user_pricing: 250,
      trading_volume_bps: 0.25,
      other_charges: 5000,
      effective_date: '2024-01-01',
      expiry_date: '2024-12-31',
      status: 'ACTIVE'
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      plan: 'GROWTH_TIER_B',
      base_price_monthly: 45000,
      user_based_pricing: 120,
      active_user_pricing: 200,
      trading_volume_bps: 0.35,
      other_charges: 3000,
      effective_date: '2024-01-15',
      expiry_date: '2024-12-31',
      status: 'ACTIVE'
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      plan: 'REGIONAL_TIER_A',
      base_price_monthly: 50000,
      user_based_pricing: 130,
      active_user_pricing: 220,
      trading_volume_bps: 0.30,
      other_charges: 4000,
      effective_date: '2024-02-01',
      expiry_date: '2025-01-31',
      status: 'ACTIVE'
    }
  ];

  private masterBrokerage: MasterBrokerageConfig[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      equity_delivery_brokerage: 0.1,
      equity_intraday_brokerage: 0.03,
      futures_brokerage: 20,
      options_brokerage: 20,
      transaction_charges_bps: 0.00345,
      platform_charges_monthly: 15000,
      turnover_charge_bps: 0.002,
      custom_rules: 'Zero brokerage on high delivery holding > 30 days',
      effective_date: '2024-01-01'
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      equity_delivery_brokerage: 0.15,
      equity_intraday_brokerage: 0.04,
      futures_brokerage: 25,
      options_brokerage: 25,
      transaction_charges_bps: 0.00345,
      platform_charges_monthly: 10000,
      turnover_charge_bps: 0.0025,
      custom_rules: 'Standard retail downline split',
      effective_date: '2024-01-15'
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      equity_delivery_brokerage: 0.12,
      equity_intraday_brokerage: 0.035,
      futures_brokerage: 20,
      options_brokerage: 20,
      transaction_charges_bps: 0.00345,
      platform_charges_monthly: 12000,
      turnover_charge_bps: 0.0022,
      custom_rules: 'Sub-broker 60/40 sharing model',
      effective_date: '2024-02-01'
    }
  ];

  private masterApiPermissions: MasterApiPermission[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      api_enabled: true,
      read_access: true,
      trading_order_access: true,
      account_access: true,
      reporting_access: true,
      user_management_access: true,
      webhook_access: true,
      rate_limit_per_minute: 1200
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      api_enabled: true,
      read_access: true,
      trading_order_access: true,
      account_access: true,
      reporting_access: true,
      user_management_access: false,
      webhook_access: false,
      rate_limit_per_minute: 600
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      api_enabled: true,
      read_access: true,
      trading_order_access: false,
      account_access: true,
      reporting_access: true,
      user_management_access: false,
      webhook_access: true,
      rate_limit_per_minute: 400
    }
  ];

  private masterBranding: MasterBrandingConfig[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      brand_name: 'Alpha Mumbai Desk',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
      favicon_url: '/favicon.ico',
      primary_color: '#2563eb',
      secondary_color: '#0e1726',
      theme_mode: 'dark',
      login_page_branding: 'Alpha Prime Capital - Mumbai Regional Terminal',
      custom_domain: 'mumbai.alphaprime.com',
      sub_domain: 'mumbai-desk',
      footer_text: 'SEBI Reg: INZ000214831 • Alpha Prime Mumbai Master Desk',
      support_contact: '+91 22 6655 4400',
      support_email: 'mumbai.support@alphaprime.com'
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      brand_name: 'Alpha North Quant',
      logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80',
      favicon_url: '/favicon.ico',
      primary_color: '#06b6d4',
      secondary_color: '#091322',
      theme_mode: 'dark',
      login_page_branding: 'Delhi NCR Trading Hub - Alpha Prime',
      custom_domain: 'delhi.alphaprime.com',
      sub_domain: 'delhi-desk',
      footer_text: 'Alpha North Capital Partners • Regulated Desk',
      support_contact: '+91 11 4433 2211',
      support_email: 'delhi.support@alphaprime.com'
    }
  ];

  private masterSubscriptions: MasterSubscriptionConfig[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      plan_name: 'Institutional Enterprise',
      start_date: '2024-01-01',
      expiry_date: '2025-01-01',
      status: 'ACTIVE',
      auto_renew: true,
      user_limit: 1000,
      features: ['Algo Co-location', 'Dedicated Feed Gateway', 'Custom White Label CNAME', 'Tick-by-Tick Order Book API'],
      notes: 'Premier high-frequency master tier'
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      plan_name: 'Professional Regional',
      start_date: '2023-10-01',
      expiry_date: '2024-04-20',
      status: 'EXPIRING_SOON',
      auto_renew: false,
      user_limit: 500,
      features: ['Multi-broker Downlines', 'Standard FIX 4.4 Feed', 'White Label Domain'],
      notes: 'Renewal invoice dispatched'
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      plan_name: 'Regional Growth Plan',
      start_date: '2024-02-01',
      expiry_date: '2025-02-01',
      status: 'ACTIVE',
      auto_renew: true,
      user_limit: 600,
      features: ['Sub-Broker Split Engine', 'Automated STT Reports', 'REST Order API'],
      notes: 'Fast-growing southern retail downline'
    }
  ];

  private masterRevenue: MasterRevenueData[] = [
    {
      master_id: 'MST-001',
      master_name: 'Rohan Deshmukh',
      total_revenue: 2240000,
      brokerage_revenue: 1850000,
      platform_charges: 250000,
      other_charges: 140000,
      turnover: 42000000,
      monthly_growth_rate: 18.4,
      brokers_revenue: [
        { broker_id: 'BRK-001', broker_name: 'Vikas Shah', revenue: 750000, turnover: 18000000 },
        { broker_id: 'BRK-002', broker_name: 'Neha Roy', revenue: 510000, turnover: 12000000 }
      ]
    },
    {
      master_id: 'MST-002',
      master_name: 'Pooja Bhatia',
      total_revenue: 880000,
      brokerage_revenue: 720000,
      platform_charges: 110000,
      other_charges: 50000,
      turnover: 20000000,
      monthly_growth_rate: 11.2,
      brokers_revenue: [
        { broker_id: 'BRK-004', broker_name: 'Manoj Tiwari', revenue: 450000, turnover: 11000000 }
      ]
    },
    {
      master_id: 'MST-003',
      master_name: 'Suresh Nambiar',
      total_revenue: 960000,
      brokerage_revenue: 790000,
      platform_charges: 120000,
      other_charges: 50000,
      turnover: 19000000,
      monthly_growth_rate: 14.8,
      brokers_revenue: [
        { broker_id: 'BRK-003', broker_name: 'Kunal Joshi', revenue: 540000, turnover: 10500000 }
      ]
    }
  ];

  async getMasterLimits(masterId?: string): Promise<MasterLimits[]> {
    if (masterId) return this.masterLimits.filter(l => l.master_id === masterId);
    return this.masterLimits;
  }

  async updateMasterLimits(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits> {
    let item = this.masterLimits.find(l => l.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        max_total_users: 500,
        current_total_users: 0,
        max_active_users: 400,
        current_active_users: 0,
        max_brokers: 15,
        current_brokers: 0,
        max_sub_brokers: 50,
        current_sub_brokers: 0,
        max_clients: 450,
        current_clients: 0,
        max_trading_volume_daily: 50000000,
        current_trading_volume_daily: 0,
        max_api_requests_daily: 100000,
        current_api_requests_daily: 0,
        status: 'NORMAL',
        last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      this.masterLimits.push(item);
    }
    Object.assign(item, data, { last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19) });
    await this.recordConfigChange({
      config_module: 'LIMITS',
      setting_name: `Limits for Master: ${item.master_name}`,
      old_value: 'Previous Limits',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Administrative limit adjustment',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async updateMasterLimit(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits> {
    return this.updateMasterLimits(masterId, data, actor);
  }

  async getMasterPricing(masterId?: string): Promise<MasterPricingConfig[]> {
    if (masterId) return this.masterPricing.filter(p => p.master_id === masterId);
    return this.masterPricing;
  }

  async updateMasterPricing(masterId: string, data: Partial<MasterPricingConfig>, actor: string): Promise<MasterPricingConfig> {
    let item = this.masterPricing.find(p => p.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        plan: 'CUSTOM_PLAN',
        base_price_monthly: 50000,
        user_based_pricing: 100,
        active_user_pricing: 200,
        trading_volume_bps: 0.25,
        other_charges: 0,
        effective_date: new Date().toISOString().split('T')[0],
        expiry_date: '2025-12-31',
        status: 'ACTIVE'
      };
      this.masterPricing.push(item);
    }
    Object.assign(item, data);
    await this.recordConfigChange({
      config_module: 'PRICING',
      setting_name: `Pricing plan for ${item.master_name}`,
      old_value: 'Previous Pricing',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Pricing revision',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async getMasterBrokerage(masterId?: string): Promise<MasterBrokerageConfig[]> {
    if (masterId) return this.masterBrokerage.filter(b => b.master_id === masterId);
    return this.masterBrokerage;
  }

  async updateMasterBrokerage(masterId: string, data: Partial<MasterBrokerageConfig>, actor: string): Promise<MasterBrokerageConfig> {
    let item = this.masterBrokerage.find(b => b.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        equity_delivery_brokerage: 0.1,
        equity_intraday_brokerage: 0.03,
        futures_brokerage: 20,
        options_brokerage: 20,
        transaction_charges_bps: 0.00345,
        platform_charges_monthly: 10000,
        turnover_charge_bps: 0.002,
        effective_date: new Date().toISOString().split('T')[0]
      };
      this.masterBrokerage.push(item);
    }
    Object.assign(item, data);
    await this.recordConfigChange({
      config_module: 'BROKERAGE',
      setting_name: `Brokerage formula for ${item.master_name}`,
      old_value: 'Previous Brokerage',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Brokerage structure revision',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async getMasterApiPermissions(masterId?: string): Promise<MasterApiPermission[]> {
    if (masterId) return this.masterApiPermissions.filter(a => a.master_id === masterId);
    return this.masterApiPermissions;
  }

  async updateMasterApiPermissions(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission> {
    let item = this.masterApiPermissions.find(a => a.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        api_enabled: true,
        read_access: true,
        trading_order_access: true,
        account_access: true,
        reporting_access: true,
        user_management_access: false,
        webhook_access: false,
        rate_limit_per_minute: 600
      };
      this.masterApiPermissions.push(item);
    }
    Object.assign(item, data);
    await this.recordConfigChange({
      config_module: 'API_PERMISSIONS',
      setting_name: `API Access Rights for ${item.master_name}`,
      old_value: 'Previous Permissions',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'API permission update',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async updateMasterApiPermission(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission> {
    return this.updateMasterApiPermissions(masterId, data, actor);
  }

  async getMasterBranding(masterId?: string): Promise<MasterBrandingConfig[]> {
    if (masterId) return this.masterBranding.filter(b => b.master_id === masterId);
    return this.masterBranding;
  }

  async updateMasterBranding(masterId: string, data: Partial<MasterBrandingConfig>, actor: string): Promise<MasterBrandingConfig> {
    let item = this.masterBranding.find(b => b.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        brand_name: data.brand_name || 'Master Trading Portal',
        logo_url: data.logo_url || '',
        favicon_url: '/favicon.ico',
        primary_color: '#3b82f6',
        secondary_color: '#0f172a',
        theme_mode: 'dark',
        login_page_branding: 'Master Trading Hub',
        custom_domain: `${masterId.toLowerCase()}.tradepro.com`,
        sub_domain: masterId.toLowerCase(),
        footer_text: '© 2024 TradePro Master Desk',
        support_contact: '+91 22 1234 5678',
        support_email: 'support@tradepro.com'
      };
      this.masterBranding.push(item);
    }
    Object.assign(item, data);
    await this.recordConfigChange({
      config_module: 'BRANDING',
      setting_name: `Domain & Branding for ${item.master_name}`,
      old_value: 'Previous Branding',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Branding asset & domain update',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async getMasterSubscriptions(masterId?: string): Promise<MasterSubscriptionConfig[]> {
    if (masterId) return this.masterSubscriptions.filter(s => s.master_id === masterId);
    return this.masterSubscriptions;
  }

  async updateMasterSubscription(masterId: string, data: Partial<MasterSubscriptionConfig>, actor: string): Promise<MasterSubscriptionConfig> {
    let item = this.masterSubscriptions.find(s => s.master_id === masterId);
    if (!item) {
      item = {
        master_id: masterId,
        master_name: data.master_name || masterId,
        plan_name: data.plan_name || 'Standard Plan',
        start_date: new Date().toISOString().split('T')[0],
        expiry_date: '2025-12-31',
        status: 'ACTIVE',
        auto_renew: true,
        user_limit: 500,
        features: ['Standard Feed', 'Web Trading']
      };
      this.masterSubscriptions.push(item);
    }
    Object.assign(item, data);
    await this.recordConfigChange({
      config_module: 'SUBSCRIPTION',
      setting_name: `Subscription renewal/status for ${item.master_name}`,
      old_value: 'Previous Subscription',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Subscription adjustment',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return item;
  }

  async getMasterRevenueReports(masterId?: string): Promise<MasterRevenueData[]> {
    if (masterId) return this.masterRevenue.filter(r => r.master_id === masterId);
    return this.masterRevenue;
  }

  // ----------------------------------------------------
  // Monitoring Implementation
  // ----------------------------------------------------
  private loginHistory: LoginHistoryItem[] = [
    {
      id: 'log-hist-1',
      user_name: 'Admin User',
      user_email: 'admin@tradepro.io',
      user_role: 'SUPER_ADMIN',
      login_time: '2024-04-15 09:00:15',
      logout_time: undefined,
      ip_address: '103.21.58.14',
      device: 'MacBook Pro 16"',
      browser: 'Chrome 123.0',
      os: 'macOS 14.4',
      status: 'SUCCESS'
    },
    {
      id: 'log-hist-2',
      user_name: 'Vikram Singhania',
      user_email: 'vikram@alphaprime.com',
      user_role: 'ADMIN',
      login_time: '2024-04-15 09:15:22',
      logout_time: '2024-04-15 11:30:00',
      ip_address: '115.112.44.8',
      device: 'Dell XPS 15',
      browser: 'Firefox 124.0',
      os: 'Windows 11',
      status: 'SUCCESS'
    },
    {
      id: 'log-hist-3',
      user_name: 'Unknown Attacker',
      user_email: 'root@tradepro.io',
      user_role: 'CLIENT',
      login_time: '2024-04-15 03:42:10',
      ip_address: '185.220.101.5',
      device: 'Linux Server',
      browser: 'Python-requests/2.31',
      os: 'Debian Linux',
      status: 'FAILED',
      failure_reason: 'Invalid credentials & IP reputation blacklist'
    },
    {
      id: 'log-hist-4',
      user_name: 'Rohan Deshmukh',
      user_email: 'rohan.deshmukh@alphaprime.com',
      user_role: 'MASTER',
      login_time: '2024-04-15 09:28:44',
      ip_address: '14.139.122.90',
      device: 'iPad Pro',
      browser: 'Safari Mobile',
      os: 'iOS 17.4',
      status: 'SUCCESS'
    },
    {
      id: 'log-hist-5',
      user_name: 'Deepa Menon',
      user_email: 'deepa.m@gmail.com',
      user_role: 'CLIENT',
      login_time: '2024-04-15 09:33:02',
      ip_address: '49.36.18.204',
      device: 'Samsung Galaxy S24',
      browser: 'Chrome Mobile',
      os: 'Android 14',
      status: 'SUCCESS'
    }
  ];

  private activeSessions: SessionItem[] = [
    {
      id: 'sess-1',
      session_id: 'sess_99a8b7c6d5e4',
      user_name: 'Admin User',
      user_email: 'admin@tradepro.io',
      user_role: 'SUPER_ADMIN',
      ip_address: '103.21.58.14',
      device: 'MacBook Pro 16"',
      browser: 'Chrome 123.0',
      login_time: '2024-04-15 09:00:15',
      last_activity: 'Just now',
      status: 'ACTIVE'
    },
    {
      id: 'sess-2',
      session_id: 'sess_44d3e2f1a0b9',
      user_name: 'Vikram Singhania',
      user_email: 'vikram@alphaprime.com',
      user_role: 'ADMIN',
      ip_address: '115.112.44.8',
      device: 'Dell XPS 15',
      browser: 'Firefox 124.0',
      login_time: '2024-04-15 09:15:22',
      last_activity: '12 mins ago',
      status: 'ACTIVE'
    },
    {
      id: 'sess-3',
      session_id: 'sess_77e6d5c4b3a2',
      user_name: 'Rohan Deshmukh',
      user_email: 'rohan.deshmukh@alphaprime.com',
      user_role: 'MASTER',
      ip_address: '14.139.122.90',
      device: 'iPad Pro',
      browser: 'Safari Mobile',
      login_time: '2024-04-15 09:28:44',
      last_activity: '5 mins ago',
      status: 'ACTIVE'
    },
    {
      id: 'sess-4',
      session_id: 'sess_11b2c3d4e5f6',
      user_name: 'Vikas Shah',
      user_email: 'vikas.shah@broker.in',
      user_role: 'BROKER',
      ip_address: '103.44.120.18',
      device: 'Windows PC',
      browser: 'Edge 122.0',
      login_time: '2024-04-15 09:20:00',
      last_activity: '22 mins ago',
      status: 'ACTIVE'
    }
  ];

  private orderAuditTrail: OrderAuditTrailItem[] = [
    {
      id: 'ord-trail-1',
      order_id: 'ORD-89401',
      user_name: 'Arjun Patel',
      action: 'ORDER_CREATED',
      symbol: 'NIFTY 22500 CE',
      old_value: 'N/A',
      new_value: 'BUY 150 Qty @ Market Price (LTP 142.50)',
      timestamp: '2024-04-15 09:31:02',
      ip_address: '103.21.58.14',
      session_id: 'sess_99a8b7c6d5e4'
    },
    {
      id: 'ord-trail-2',
      order_id: 'ORD-89401',
      user_name: 'Exchange OMS',
      action: 'ORDER_EXECUTED',
      symbol: 'NIFTY 22500 CE',
      old_value: 'PENDING',
      new_value: 'FILLED 150 Qty @ 142.50 INR',
      timestamp: '2024-04-15 09:31:04',
      ip_address: '127.0.0.1',
      session_id: 'system_oms'
    },
    {
      id: 'ord-trail-3',
      order_id: 'ORD-89402',
      user_name: 'Priya Sharma',
      action: 'ORDER_MODIFIED',
      symbol: 'BANKNIFTY 48000 PE',
      old_value: 'LIMIT Price 210.00 (Qty 90)',
      new_value: 'LIMIT Price 218.50 (Qty 90)',
      timestamp: '2024-04-15 09:35:18',
      ip_address: '115.112.44.8',
      session_id: 'sess_44d3e2f1a0b9'
    },
    {
      id: 'ord-trail-4',
      order_id: 'ORD-89404',
      user_name: 'Deepa Menon',
      action: 'ORDER_CANCELLED',
      symbol: 'RELIANCE EQ',
      old_value: 'PENDING LIMIT 2940.00',
      new_value: 'CANCELLED by Client',
      timestamp: '2024-04-15 10:02:11',
      ip_address: '49.36.18.204',
      session_id: 'sess_55f6a7b8c9d0'
    }
  ];

  private apiActivity: ApiActivityItem[] = [
    {
      id: 'api-act-1',
      api_key_alias: 'APC-HFT-QUANT-PROD',
      user_name: 'Vikram Singhania',
      endpoint: '/api/v1/orders/place',
      method: 'POST',
      timestamp: '2024-04-15 09:31:02',
      status_code: 200,
      ip_address: '115.112.44.8',
      request_id: 'req_8f110a2bc',
      rate_limit_remaining: 1198,
      latency_ms: 12
    },
    {
      id: 'api-act-2',
      api_key_alias: 'ZQP-OMS-FEED',
      user_name: 'Gaurav Khanna',
      endpoint: '/api/v1/positions/live',
      method: 'GET',
      timestamp: '2024-04-15 09:31:03',
      status_code: 200,
      ip_address: '97.100.11.22',
      request_id: 'req_90ab31c4f',
      rate_limit_remaining: 2490,
      latency_ms: 8
    },
    {
      id: 'api-act-3',
      api_key_alias: 'APEX-WEBHOOK-TICK',
      user_name: 'Suresh Nambiar',
      endpoint: '/api/v1/clients/balance',
      method: 'GET',
      timestamp: '2024-04-15 09:31:05',
      status_code: 429,
      ip_address: '14.139.122.90',
      request_id: 'req_fa1048b99',
      rate_limit_remaining: 0,
      latency_ms: 2
    }
  ];

  private suspiciousAlerts: SuspiciousActivityAlert[] = [
    {
      id: 'alert-1',
      type: 'FAILED_LOGIN_REPEATED',
      title: 'Repeated Brute-Force Authentication Attempt',
      description: '14 consecutive failed password attempts detected against admin accounts.',
      user_identifier: 'root / superadmin',
      ip_address: '185.220.101.5',
      severity: 'HIGH',
      timestamp: '2024-04-15 03:42:10',
      status: 'UNRESOLVED'
    },
    {
      id: 'alert-2',
      type: 'MULTIPLE_IPS',
      title: 'Concurrent Session from Discrepant Geographies',
      description: 'Account logged in from Mumbai (103.21.58.14) and Singapore (128.199.200.41) within 3 minutes.',
      user_identifier: 'kunal.joshi@broker.in',
      ip_address: '128.199.200.41',
      severity: 'CRITICAL',
      timestamp: '2024-04-15 08:50:22',
      status: 'UNRESOLVED'
    },
    {
      id: 'alert-3',
      type: 'API_SPIKE',
      title: 'API Rate Limit Saturated',
      description: 'Key APEX-WEBHOOK-TICK exceeded 400 requests/min throttle threshold.',
      user_identifier: 'Suresh Nambiar (Master)',
      ip_address: '14.139.122.90',
      severity: 'MEDIUM',
      timestamp: '2024-04-15 09:31:05',
      status: 'RESOLVED'
    }
  ];

  private userCreationLogs: UserCreationLogItem[] = [
    {
      id: 'u-create-1',
      created_by_name: 'Admin User',
      created_by_role: 'SUPER_ADMIN',
      target_user_name: 'Rohan Deshmukh',
      target_user_email: 'rohan.deshmukh@alphaprime.com',
      assigned_role: 'MASTER',
      tenant_or_master: 'Alpha Prime Capital (TNT-001)',
      timestamp: '2023-11-20 14:15:00',
      source: 'Central Admin Portal'
    },
    {
      id: 'u-create-2',
      created_by_name: 'Rohan Deshmukh',
      created_by_role: 'MASTER',
      target_user_name: 'Vikas Shah',
      target_user_email: 'vikas.shah@broker.in',
      assigned_role: 'BROKER',
      tenant_or_master: 'Alpha Prime (MST-001)',
      timestamp: '2023-11-25 11:30:00',
      source: 'Master Desk Management'
    },
    {
      id: 'u-create-3',
      created_by_name: 'Aakash Verma',
      created_by_role: 'SUB_BROKER',
      target_user_name: 'Arjun Patel',
      target_user_email: 'arjun.patel@gmail.com',
      assigned_role: 'CLIENT',
      tenant_or_master: 'BRK-101 / SUB-201',
      timestamp: '2023-12-05 16:45:00',
      source: 'Self-Service KYC Onboarding'
    }
  ];

  private dataDeletionLogs: DataDeletionLogItem[] = [
    {
      id: 'del-log-1',
      performed_by_name: 'Admin User (SUPER_ADMIN)',
      entity_type: 'API_CREDENTIAL',
      target_id: 'KEY-LEGACY-TEST-09',
      target_name: 'Sandbox Staging Key',
      deletion_type: 'SOFT_DELETE',
      reason: 'Key compromised / deprecation cycle complete',
      timestamp: '2024-04-14 17:30:10',
      ip_address: '103.21.58.14'
    },
    {
      id: 'del-log-2',
      performed_by_name: 'Vikram Singhania (ADMIN)',
      entity_type: 'SUB_BROKER_DEALER',
      target_id: 'SUB-ARCHIVE-88',
      target_name: 'Apex Inactive Franchise #4',
      deletion_type: 'DEACTIVATED',
      reason: 'Partner contract voluntarily concluded without open trades',
      timestamp: '2024-04-12 12:00:00',
      ip_address: '115.112.44.8'
    }
  ];

  private configurationChangeLogs: ConfigurationChangeLogItem[] = [
    {
      id: 'cfg-log-1',
      config_module: 'EMERGENCY_CONTROLS',
      setting_name: 'Global Kill Switch Test',
      old_value: 'DEACTIVATED',
      new_value: 'STANDBY_READY',
      changed_by: 'Admin User (SUPER_ADMIN)',
      timestamp: '2024-04-15 08:00:00',
      reason: 'Pre-market routine verification check',
      ip_address: '103.21.58.14'
    },
    {
      id: 'cfg-log-2',
      config_module: 'BROKERAGE',
      setting_name: 'MST-001 Delivery Brokerage Rate',
      old_value: '0.12%',
      new_value: '0.10%',
      changed_by: 'Vikram Singhania',
      timestamp: '2024-04-14 15:20:00',
      reason: 'Approved volume discount for high delivery volumes',
      ip_address: '115.112.44.8'
    },
    {
      id: 'cfg-log-3',
      config_module: 'LIMITS',
      setting_name: 'MST-002 Max Active Traders Cap',
      old_value: '350',
      new_value: '400',
      changed_by: 'Admin User',
      timestamp: '2024-04-13 18:45:00',
      reason: 'Capacity upgrade requested by North Region',
      ip_address: '103.21.58.14'
    }
  ];

  async getLoginHistory(): Promise<LoginHistoryItem[]> {
    return this.loginHistory;
  }

  async getActiveSessions(): Promise<SessionItem[]> {
    return this.activeSessions;
  }

  async revokeSession(sessionId: string, actor: string): Promise<boolean> {
    const session = this.activeSessions.find(s => s.session_id === sessionId || s.id === sessionId);
    if (session) {
      session.status = 'REVOKED';
      await this.recordConfigChange({
        config_module: 'SYSTEM_SETTINGS',
        setting_name: `Revoke Session: ${session.session_id}`,
        old_value: 'ACTIVE',
        new_value: 'REVOKED',
        changed_by: actor,
        reason: 'Security termination by Administrator',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip_address: '103.21.58.14'
      });
      return true;
    }
    return false;
  }

  async getOrderAuditTrail(orderId?: string): Promise<OrderAuditTrailItem[]> {
    if (orderId) {
      return this.orderAuditTrail.filter(o => o.order_id === orderId);
    }
    return this.orderAuditTrail;
  }

  async getApiActivity(): Promise<ApiActivityItem[]> {
    return this.apiActivity;
  }

  async getApiActivityLogs(): Promise<ApiActivityItem[]> {
    return this.apiActivity;
  }

  async getSuspiciousAlerts(): Promise<SuspiciousActivityAlert[]> {
    return this.suspiciousAlerts;
  }

  async getSuspiciousActivityAlerts(): Promise<SuspiciousActivityAlert[]> {
    return this.suspiciousAlerts;
  }

  async resolveSuspiciousAlert(alertId: string, actor: string): Promise<boolean> {
    const alert = this.suspiciousAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'RESOLVED';
      await this.recordConfigChange({
        config_module: 'SYSTEM_SETTINGS',
        setting_name: `Resolve Alert: ${alertId}`,
        old_value: 'UNRESOLVED',
        new_value: 'RESOLVED',
        changed_by: actor,
        reason: 'Surveillance alert investigation closed',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ip_address: '103.21.58.14'
      });
      return true;
    }
    return false;
  }

  async getUserCreationLogs(): Promise<UserCreationLogItem[]> {
    return this.userCreationLogs;
  }

  async getDataDeletionLogs(): Promise<DataDeletionLogItem[]> {
    return this.dataDeletionLogs;
  }

  async getConfigurationChangeLogs(): Promise<ConfigurationChangeLogItem[]> {
    return this.configurationChangeLogs;
  }

  async recordOrderEvent(event: Partial<OrderAuditTrailItem>): Promise<void> {
    this.orderAuditTrail.unshift({
      id: `ord-trail-${Date.now()}`,
      order_id: event.order_id || `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      user_name: event.user_name || 'Client',
      action: event.action || 'ORDER_CREATED',
      symbol: event.symbol || 'NIFTY',
      old_value: event.old_value || 'PENDING',
      new_value: event.new_value || 'PLACED',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: event.ip_address || '103.21.58.14',
      session_id: event.session_id || 'active_session'
    });
  }

  async recordConfigChange(change: Partial<ConfigurationChangeLogItem>): Promise<void> {
    this.configurationChangeLogs.unshift({
      id: `cfg-log-${Date.now()}`,
      config_module: change.config_module || 'SYSTEM_SETTINGS',
      setting_name: change.setting_name || 'Configuration',
      old_value: change.old_value || '',
      new_value: change.new_value || '',
      changed_by: change.changed_by || 'Admin',
      timestamp: change.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason: change.reason || 'Admin modification',
      ip_address: change.ip_address || '103.21.58.14'
    });
  }

  // ----------------------------------------------------
  // Platform Management Implementation
  // ----------------------------------------------------
  private platformManagement: PlatformManagementConfig = {
    web_trading_enabled: true,
    web_version: 'v4.8.2-stable',
    web_maintenance_mode: false,
    mobile_android_enabled: true,
    mobile_android_min_version: '2.4.0',
    mobile_ios_enabled: true,
    mobile_ios_min_version: '2.4.0',
    mobile_maintenance_mode: false,
    broadcast_message: 'All trading services operational on BSE/NSE segment.',
    last_updated: '2024-04-15 09:00:00'
  };

  async getPlatformManagement(): Promise<PlatformManagementConfig> {
    return this.platformManagement;
  }

  async updatePlatformManagement(data: Partial<PlatformManagementConfig>, actor: string): Promise<PlatformManagementConfig> {
    Object.assign(this.platformManagement, data, {
      last_updated: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
    await this.recordConfigChange({
      config_module: 'SYSTEM_SETTINGS',
      setting_name: 'Web & Mobile Trading Platform Settings',
      old_value: 'Previous Platform Settings',
      new_value: JSON.stringify(data),
      changed_by: actor,
      reason: 'Platform parameter update',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ip_address: '103.21.58.14'
    });
    return this.platformManagement;
  }

  // ----------------------------------------------------
  // RBAC Implementation
  // ----------------------------------------------------
  private rbacRoles: RoleDefinition[] = [
    {
      id: 'role-superadmin',
      name: 'Super Administrator',
      code: 'SUPER_ADMIN',
      description: 'Unrestricted enterprise control across all tenants, global emergency controls, billing, and system infrastructure.',
      isSystemRole: true,
      userCount: 3,
      badgeColor: 'purple',
      permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN,
      createdAt: '2023-10-01 00:00:00',
      updatedAt: '2024-04-10 10:00:00'
    },
    {
      id: 'role-tenantadmin',
      name: 'Tenant Administrator',
      code: 'TENANT_ADMIN',
      description: 'Autonomous administration within tenant organization: brokers, clients, local risk parameters, and white-label branding.',
      isSystemRole: true,
      userCount: 8,
      badgeColor: 'blue',
      permissions: DEFAULT_ROLE_PERMISSIONS.TENANT_ADMIN,
      createdAt: '2023-10-15 00:00:00',
      updatedAt: '2024-04-12 11:30:00'
    },
    {
      id: 'role-master',
      name: 'Master Account Manager',
      code: 'MASTER',
      description: 'Oversees broker network, downline tree, capacity limits, trading volume, and tiered revenue splits.',
      isSystemRole: true,
      userCount: 14,
      badgeColor: 'amber',
      permissions: DEFAULT_ROLE_PERMISSIONS.MASTER,
      createdAt: '2023-11-01 00:00:00',
      updatedAt: '2024-04-05 09:15:00'
    },
    {
      id: 'role-broker',
      name: 'Registered Broker',
      code: 'BROKER',
      description: 'Manages sub-brokers, clients, execution book, customer deposits, KYC reviews, and commission payouts.',
      isSystemRole: true,
      userCount: 42,
      badgeColor: 'emerald',
      permissions: DEFAULT_ROLE_PERMISSIONS.BROKER,
      createdAt: '2023-11-10 00:00:00',
      updatedAt: '2024-04-14 14:20:00'
    },
    {
      id: 'role-subbroker',
      name: 'Sub-Broker Agent',
      code: 'SUB_BROKER',
      description: 'Client onboarding, trade book monitoring, and sub-tier commission tracking.',
      isSystemRole: true,
      userCount: 110,
      badgeColor: 'cyan',
      permissions: DEFAULT_ROLE_PERMISSIONS.SUB_BROKER,
      createdAt: '2023-12-01 00:00:00',
      updatedAt: '2024-04-01 16:45:00'
    },
    {
      id: 'role-compliance',
      name: 'Compliance Officer',
      code: 'COMPLIANCE_OFFICER',
      description: 'Identity verification, KYC document audits, suspicious trade activity surveillance, and regulatory reporting.',
      isSystemRole: true,
      userCount: 5,
      badgeColor: 'indigo',
      permissions: DEFAULT_ROLE_PERMISSIONS.COMPLIANCE_OFFICER,
      createdAt: '2024-01-10 00:00:00',
      updatedAt: '2024-04-15 08:30:00'
    },
    {
      id: 'role-risk',
      name: 'Risk & Surveillance Manager',
      code: 'RISK_MANAGER',
      description: 'Real-time margin surveillance, auto-square off parameters, leverage restrictions, and trade halts.',
      isSystemRole: true,
      userCount: 6,
      badgeColor: 'rose',
      permissions: DEFAULT_ROLE_PERMISSIONS.RISK_MANAGER,
      createdAt: '2024-01-15 00:00:00',
      updatedAt: '2024-04-15 09:00:00'
    },
    {
      id: 'role-support',
      name: 'Support Operations Specialist',
      code: 'SUPPORT_AGENT',
      description: 'Triage, investigation, and resolution of user tickets, query management, and broadcast alerts.',
      isSystemRole: true,
      userCount: 12,
      badgeColor: 'teal',
      permissions: DEFAULT_ROLE_PERMISSIONS.SUPPORT_AGENT,
      createdAt: '2024-02-01 00:00:00',
      updatedAt: '2024-04-14 18:00:00'
    },
    {
      id: 'role-client',
      name: 'Retail Trader / Client',
      code: 'CLIENT',
      description: 'Self-directed retail investor: placing orders, reviewing executions, fund management, and personal tickets.',
      isSystemRole: true,
      userCount: 840,
      badgeColor: 'slate',
      permissions: DEFAULT_ROLE_PERMISSIONS.CLIENT,
      createdAt: '2023-10-01 00:00:00',
      updatedAt: '2024-04-15 10:10:00'
    }
  ];

  private rbacUsers: RbacUser[] = [
    {
      id: 'usr_superadmin_01',
      name: 'Admin John',
      email: 'admin@platform.com',
      role: 'SUPER_ADMIN',
      roleName: 'Super Administrator',
      tenantId: 'GLOBAL',
      tenantName: 'All Tenants (Global Scope)',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 09:30:12',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr_tenant_01',
      name: 'Vikram Malhotra',
      email: 'vikram.m@alphaprime.com',
      role: 'TENANT_ADMIN',
      roleName: 'Tenant Administrator',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 08:45:33',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr_master_01',
      name: 'Suresh Nambiar',
      email: 'master@alphaprime.com',
      role: 'MASTER',
      roleName: 'Master Account Manager',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 09:12:05',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: 'usr_broker_01',
      name: 'Rajesh Mehta',
      email: 'broker@alphaprime.com',
      role: 'BROKER',
      roleName: 'Registered Broker',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 09:20:44'
    },
    {
      id: 'usr_subbroker_01',
      name: 'Vikram Singhania',
      email: 'subbroker@alphaprime.com',
      role: 'SUB_BROKER',
      roleName: 'Sub-Broker Agent',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: false,
      lastLogin: '2024-04-14 17:10:00'
    },
    {
      id: 'usr_compliance_01',
      name: 'Ananya Sharma',
      email: 'compliance@alphaprime.com',
      role: 'COMPLIANCE_OFFICER',
      roleName: 'Compliance Officer',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 07:45:10'
    },
    {
      id: 'usr_risk_01',
      name: 'Devendra Rao',
      email: 'risk@alphaprime.com',
      role: 'RISK_MANAGER',
      roleName: 'Risk & Surveillance Manager',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 09:25:30'
    },
    {
      id: 'usr_support_01',
      name: 'Neha Gupta',
      email: 'support@alphaprime.com',
      role: 'SUPPORT_AGENT',
      roleName: 'Support Operations Specialist',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: false,
      lastLogin: '2024-04-15 09:28:18'
    },
    {
      id: 'usr_client_01',
      name: 'Arjun Patel',
      email: 'client@alphaprime.com',
      role: 'CLIENT',
      roleName: 'Retail Trader / Client',
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: true,
      lastLogin: '2024-04-15 09:15:00'
    }
  ];

  private rbacAuditLogs: RbacAuditLogItem[] = [
    {
      id: 'rbac-log-01',
      actorName: 'Admin John',
      actorRole: 'SUPER_ADMIN',
      action: 'PERMISSIONS_MODIFIED',
      targetRoleOrUser: 'COMPLIANCE_OFFICER',
      details: 'Granted AUDIT_LOGS EXECUTE and KYC APPROVE permissions',
      timestamp: '2024-04-15 08:30:00',
      ipAddress: '103.21.58.14'
    },
    {
      id: 'rbac-log-02',
      actorName: 'Admin John',
      actorRole: 'SUPER_ADMIN',
      action: 'USER_ASSIGNED',
      targetRoleOrUser: 'Ananya Sharma (usr_compliance_01)',
      details: 'Assigned role COMPLIANCE_OFFICER for Alpha Prime Capital',
      timestamp: '2024-04-14 14:15:22',
      ipAddress: '103.21.58.14'
    },
    {
      id: 'rbac-log-03',
      actorName: 'Vikram Malhotra',
      actorRole: 'TENANT_ADMIN',
      action: 'USER_ASSIGNED',
      targetRoleOrUser: 'Devendra Rao (usr_risk_01)',
      details: 'Assigned role RISK_MANAGER with 2FA enforcement',
      timestamp: '2024-04-12 11:10:05',
      ipAddress: '49.36.120.45'
    }
  ];

  async getRbacRoles(): Promise<RoleDefinition[]> {
    return this.rbacRoles;
  }

  async createRbacRole(role: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition> {
    const newRole: RoleDefinition = {
      id: `role-${Date.now()}`,
      name: role.name || 'Custom Role',
      code: role.code || `CUSTOM_${Date.now()}`,
      description: role.description || 'Custom role with defined permissions.',
      isSystemRole: false,
      userCount: 0,
      badgeColor: role.badgeColor || 'blue',
      permissions: role.permissions || ({} as any),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    this.rbacRoles.push(newRole);
    this.rbacAuditLogs.unshift({
      id: `rbac-log-${Date.now()}`,
      actorName: actor,
      actorRole: 'SUPER_ADMIN',
      action: 'ROLE_CREATED',
      targetRoleOrUser: newRole.name,
      details: `Created custom role '${newRole.name}' with ${Object.keys(newRole.permissions).length} modules`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '103.21.58.14'
    });
    return newRole;
  }

  async updateRbacRole(roleId: string, updates: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition> {
    const role = this.rbacRoles.find(r => r.id === roleId || r.code === roleId);
    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }
    Object.assign(role, updates, {
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });
    this.rbacAuditLogs.unshift({
      id: `rbac-log-${Date.now()}`,
      actorName: actor,
      actorRole: 'SUPER_ADMIN',
      action: 'PERMISSIONS_MODIFIED',
      targetRoleOrUser: role.name,
      details: `Updated permissions for role '${role.name}'`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '103.21.58.14'
    });
    return role;
  }

  async deleteRbacRole(roleId: string, actor: string): Promise<boolean> {
    const idx = this.rbacRoles.findIndex(r => r.id === roleId);
    if (idx !== -1) {
      if (this.rbacRoles[idx].isSystemRole) {
        throw new Error('System roles cannot be deleted.');
      }
      const deleted = this.rbacRoles.splice(idx, 1)[0];
      this.rbacAuditLogs.unshift({
        id: `rbac-log-${Date.now()}`,
        actorName: actor,
        actorRole: 'SUPER_ADMIN',
        action: 'ROLE_DELETED',
        targetRoleOrUser: deleted.name,
        details: `Deleted custom role '${deleted.name}'`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        ipAddress: '103.21.58.14'
      });
      return true;
    }
    return false;
  }

  async getRbacUsers(): Promise<RbacUser[]> {
    return this.rbacUsers;
  }

  async assignUserRole(userId: string, roleCode: string, actor: string, customPermissions?: any): Promise<RbacUser> {
    let user = this.rbacUsers.find(u => u.id === userId || u.email === userId);
    const role = this.rbacRoles.find(r => r.code === roleCode || r.id === roleCode);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    const oldRole = user.role;
    user.role = roleCode as any;
    user.roleName = role ? role.name : roleCode;
    if (customPermissions) {
      user.customPermissions = customPermissions;
    }
    this.rbacAuditLogs.unshift({
      id: `rbac-log-${Date.now()}`,
      actorName: actor,
      actorRole: 'SUPER_ADMIN',
      action: 'USER_ASSIGNED',
      targetRoleOrUser: `${user.name} (${user.email})`,
      details: `Reassigned role from '${oldRole}' to '${user.roleName}'`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '103.21.58.14'
    });
    return user;
  }

  async createRbacUser(userData: Partial<RbacUser>, actor: string): Promise<RbacUser> {
    const role = this.rbacRoles.find(r => r.code === userData.role);
    const newUser: RbacUser = {
      id: `usr_${Date.now()}`,
      name: userData.name || 'New Staff User',
      email: userData.email || 'staff@tradepro.io',
      role: userData.role || 'BROKER',
      roleName: role ? role.name : (userData.role || 'Staff'),
      tenantId: userData.tenantId || 'TNT-001',
      tenantName: userData.tenantName || 'Alpha Prime Capital',
      status: 'ACTIVE',
      twoFactorEnabled: userData.twoFactorEnabled || false,
      lastLogin: 'Never',
      customPermissions: userData.customPermissions
    };
    this.rbacUsers.unshift(newUser);
    this.rbacAuditLogs.unshift({
      id: `rbac-log-${Date.now()}`,
      actorName: actor,
      actorRole: 'SUPER_ADMIN',
      action: 'USER_ASSIGNED',
      targetRoleOrUser: `${newUser.name} (${newUser.email})`,
      details: `Created staff user and assigned role '${newUser.roleName}'`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '103.21.58.14'
    });
    return newUser;
  }

  async updateRbacUser(userId: string, updates: Partial<RbacUser>, actor: string): Promise<RbacUser> {
    const user = this.rbacUsers.find(u => u.id === userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    Object.assign(user, updates);
    if (updates.role) {
      const role = this.rbacRoles.find(r => r.code === updates.role);
      if (role) user.roleName = role.name;
    }
    this.rbacAuditLogs.unshift({
      id: `rbac-log-${Date.now()}`,
      actorName: actor,
      actorRole: 'SUPER_ADMIN',
      action: 'USER_ASSIGNED',
      targetRoleOrUser: `${user.name}`,
      details: `Updated staff user profile and permissions`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ipAddress: '103.21.58.14'
    });
    return user;
  }

  async getRbacAuditLogs(): Promise<RbacAuditLogItem[]> {
    return this.rbacAuditLogs;
  }

  // ----------------------------------------------------
  // Compliance, Funds, Ledger, Positions & Risk (Mock Fallback)
  // ----------------------------------------------------
  async getFundDeposits(_tenantId?: string, status?: string): Promise<FundDepositItem[]> {
    const list: FundDepositItem[] = [
      { txnId: 'DEP-001', client: 'Alexander Hunt', amount: '₹10,000', method: 'Bank Transfer', reference: 'TXN-8821-A', status: 'COMPLETED', date: '2026-03-20', rawAmount: 10000 },
      { txnId: 'DEP-002', client: 'Maya Patel', amount: '₹25,000', method: 'Wire Transfer', reference: 'TXN-8845-B', status: 'COMPLETED', date: '2026-03-22', rawAmount: 25000 },
      { txnId: 'DEP-003', client: 'Nathan Brooks', amount: '₹5,000', method: 'Credit Card', reference: 'TXN-8902-C', status: 'PENDING', date: '2026-03-25', rawAmount: 5000 }
    ];
    if (status && status !== 'All Status') return list.filter(d => d.status === status);
    return list;
  }

  async approveFundDeposit(id: string, _actor: string): Promise<any> {
    return { success: true, txnId: id, status: 'COMPLETED' };
  }

  async rejectFundDeposit(id: string, _actor: string): Promise<any> {
    return { success: true, txnId: id, status: 'FAILED' };
  }

  async createFundDeposit(data: any): Promise<any> {
    return { id: `DEP-${Date.now()}`, ...data, status: 'PENDING' };
  }

  async getFundWithdrawals(_tenantId?: string, status?: string): Promise<FundWithdrawalItem[]> {
    const list: FundWithdrawalItem[] = [
      { txnId: 'WDR-001', client: 'Alexander Hunt', amount: '₹5,000', method: 'Bank Transfer', reference: 'WDR-001', status: 'COMPLETED', date: '2026-03-21', rawAmount: 5000 },
      { txnId: 'WDR-002', client: 'Maya Patel', amount: '₹12,000', method: 'Wire Transfer', reference: 'WDR-002', status: 'PENDING', date: '2026-03-26', rawAmount: 12000 }
    ];
    if (status && status !== 'All Status') return list.filter(w => w.status === status);
    return list;
  }

  async approveFundWithdrawal(id: string, _actor: string): Promise<any> {
    return { success: true, txnId: id, status: 'COMPLETED' };
  }

  async rejectFundWithdrawal(id: string, _actor: string): Promise<any> {
    return { success: true, txnId: id, status: 'FAILED' };
  }

  async createFundWithdrawal(data: any): Promise<any> {
    return { id: `WDR-${Date.now()}`, ...data, status: 'PENDING' };
  }

  async getLedgerEntries(_tenantId?: string, type?: string): Promise<LedgerRowItem[]> {
    const list: LedgerRowItem[] = [
      { date: '2026-03-26', txnId: 'TXN-9045-E', account: 'Isabella Torres', type: 'DEPOSIT', credit: '+₹15,000', debit: '—', balance: '₹31,500', reference: 'Bank Transfer', status: 'COMPLETED' },
      { date: '2026-03-25', txnId: 'WDR-002', account: 'Maya Patel', type: 'WITHDRAWAL', credit: '—', debit: '-₹12,000', balance: '₹48,200', reference: 'Wire Transfer', status: 'PENDING' },
      { date: '2026-03-24', txnId: 'PNL-0618', account: 'Isabella Torres', type: 'P&L', credit: '+₹5,680', debit: '—', balance: '₹16,500', reference: 'Trade Settlement', status: 'COMPLETED' }
    ];
    if (type && type !== 'All Types') return list.filter(l => l.type === type);
    return list;
  }

  async createLedgerEntry(data: any): Promise<any> {
    return { id: `LDG-${Date.now()}`, ...data, created_at: new Date().toISOString() };
  }

  async getPositions(_tenantId?: string): Promise<any[]> {
    return [
      { id: 'pos_1', client: 'Alexander Hunt', symbol: 'EUR/INR', qty: '100,000', avgPrice: '1.088', currentPrice: '1.089', unrealizedPL: '+₹160', realizedPL: '+₹3,660', margin: '₹1,087.6', unrealizedPLPositive: true, realizedPLPositive: true },
      { id: 'pos_2', client: 'Maya Patel', symbol: 'ETH/INR', qty: '2', avgPrice: '1,980', currentPrice: '2,010', unrealizedPL: '+₹60', realizedPL: '+₹9,450', margin: '₹396', unrealizedPLPositive: true, realizedPLPositive: true }
    ];
  }

  async squareOffPosition(id: string, _actor: string): Promise<any> {
    return { success: true, id, message: 'Position squared off at market' };
  }

  async getCommissionPlans(_tenantId?: string): Promise<any[]> {
    return [
      { id: 'plan-1', name: 'Standard FX Tier', description: 'Standard spread and per-lot markup', is_active: true }
    ];
  }

  async getCommissionRules(_tenantId?: string, _planId?: string): Promise<any[]> {
    return [
      { id: 'rule-1', plan_id: 'plan-1', asset_class: 'FX', instrument_type: 'CURRENCY', rate_type: 'PER_LOT', rate_value: '2.50' }
    ];
  }

  async getCommissionTransactions(_tenantId?: string): Promise<any[]> {
    return [];
  }

  async getRiskProfiles(_tenantId?: string): Promise<any[]> {
    return [
      { id: 'rp-1', name: 'Conservative Default', max_leverage: '1:100', margin_call_level: '80%', stop_out_level: '50%' }
    ];
  }

  async getRiskEvents(_tenantId?: string): Promise<any[]> {
    return [
      { id: 're-1', severity: 'WARNING', message: 'Client margin utilization exceeded 75%', created_at: new Date().toISOString() }
    ];
  }

  async getNotifications(_tenantId?: string): Promise<any[]> {
    return [
      { id: 'notif-1', title: 'System Healthy', message: 'All risk parameters normal', is_read: false, created_at: new Date().toISOString() }
    ];
  }

  async markNotificationRead(id: string): Promise<any> {
    return { success: true, id, is_read: true };
  }
}

import { PostgresTradingDataProvider } from './PostgresTradingDataProvider.ts';

// Internal PostgreSQL Provider (Direct PostgreSQL implementation)
export class InternalTradingDataProvider extends PostgresTradingDataProvider {}

// External Trading Platform Remote API Provider
export class ExternalTradingDataProvider extends MockTradingDataProvider {
  constructor(private remoteBaseUrl?: string, private apiKey?: string) {
    super();
  }
}

export function createActiveTradingDataProvider(): ITradingDataProvider {
  if (process.env.USE_MOCK_DATA === 'true') {
    console.log('[DataProvider] Using MockTradingDataProvider (USE_MOCK_DATA=true)');
    return new MockTradingDataProvider();
  }

  // Use PostgreSQL provider for true database persistence
  // In both remote PostgreSQL and embedded PostgreSQL modes, real SQL queries are executed.
  // If PostgreSQL is unavailable or an error occurs, it throws a clear database error rather than silently faking data.
  return new PostgresTradingDataProvider();
}

// Singleton active data provider instance powered by PostgreSQL
export const activeTradingDataProvider: ITradingDataProvider = createActiveTradingDataProvider();

