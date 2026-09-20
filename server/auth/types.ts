import { UserRole } from '../../src/types.ts';

export type Permission =
  | 'dashboard.view'
  | 'tenants.view'
  | 'tenants.create'
  | 'tenants.update'
  | 'masters.view'
  | 'masters.create'
  | 'masters.update'
  | 'brokers.view'
  | 'brokers.create'
  | 'brokers.update'
  | 'sub_brokers.view'
  | 'sub_brokers.create'
  | 'sub_brokers.update'
  | 'clients.view'
  | 'clients.create'
  | 'clients.update'
  | 'kyc.view'
  | 'kyc.review'
  | 'funds.view'
  | 'funds.deposit'
  | 'funds.withdraw'
  | 'funds.approve'
  | 'funds.reject'
  | 'ledger.view'
  | 'orders.view'
  | 'trades.view'
  | 'positions.view'
  | 'commission.view'
  | 'commission.manage'
  | 'risk.view'
  | 'risk.manage'
  | 'reports.view'
  | 'notifications.view'
  | 'support.view'
  | 'subscriptions.view'
  | 'subscriptions.manage'
  | 'white_label.view'
  | 'white_label.manage'
  | 'emergency.view'
  | 'emergency.execute'
  | 'monitoring.view'
  | 'audit_logs.view'
  | 'platform.manage';

export type HierarchyLevel = 'PLATFORM' | 'TENANT' | 'MASTER' | 'BROKER' | 'SUB_BROKER' | 'CLIENT';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string | null;
  tenant_name?: string;
  hierarchy_level: HierarchyLevel;
  hierarchy_id?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  permissions: Permission[];
  session_id: string;
  simulated_tenant_id?: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  hierarchyLevel: HierarchyLevel;
  hierarchyId?: string | null;
  sessionId: string;
  iat?: number;
  exp?: number;
}
