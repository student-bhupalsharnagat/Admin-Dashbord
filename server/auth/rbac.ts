import { UserRole } from '../../src/types.ts';
import { Permission } from './types.ts';
import { query } from '../db/connection.ts';

export const ALL_SYSTEM_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'tenants.view',
  'tenants.create',
  'tenants.update',
  'masters.view',
  'masters.create',
  'masters.update',
  'brokers.view',
  'brokers.create',
  'brokers.update',
  'sub_brokers.view',
  'sub_brokers.create',
  'sub_brokers.update',
  'clients.view',
  'clients.create',
  'clients.update',
  'kyc.view',
  'kyc.review',
  'funds.view',
  'funds.deposit',
  'funds.withdraw',
  'funds.approve',
  'funds.reject',
  'ledger.view',
  'orders.view',
  'trades.view',
  'positions.view',
  'commission.view',
  'commission.manage',
  'risk.view',
  'risk.manage',
  'reports.view',
  'notifications.view',
  'support.view',
  'subscriptions.view',
  'subscriptions.manage',
  'white_label.view',
  'white_label.manage',
  'emergency.view',
  'emergency.execute',
  'monitoring.view',
  'audit_logs.view',
  'platform.manage'
];

export const DEFAULT_ROLE_PERMISSIONS_MAP: Record<UserRole, Permission[]> = {
  PLATFORM_OWNER: [...ALL_SYSTEM_PERMISSIONS],

  SUPER_ADMIN: [
    'dashboard.view',
    'tenants.view',
    'tenants.create',
    'tenants.update',
    'masters.view',
    'masters.create',
    'masters.update',
    'brokers.view',
    'brokers.create',
    'brokers.update',
    'sub_brokers.view',
    'sub_brokers.create',
    'sub_brokers.update',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'kyc.review',
    'funds.view',
    'funds.deposit',
    'funds.withdraw',
    'funds.approve',
    'funds.reject',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'commission.manage',
    'risk.view',
    'risk.manage',
    'reports.view',
    'notifications.view',
    'support.view',
    'subscriptions.view',
    'subscriptions.manage',
    'white_label.view',
    'white_label.manage',
    'emergency.view',
    'emergency.execute',
    'monitoring.view',
    'audit_logs.view',
    'platform.manage'
  ],

  ADMIN: [
    'dashboard.view',
    'tenants.view',
    'tenants.update',
    'masters.view',
    'masters.create',
    'masters.update',
    'brokers.view',
    'brokers.create',
    'brokers.update',
    'sub_brokers.view',
    'sub_brokers.create',
    'sub_brokers.update',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'kyc.review',
    'funds.view',
    'funds.approve',
    'funds.reject',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'risk.view',
    'reports.view',
    'notifications.view',
    'support.view',
    'subscriptions.view',
    'white_label.view',
    'monitoring.view',
    'audit_logs.view'
  ],

  TENANT_ADMIN: [
    'dashboard.view',
    'tenants.view',
    'tenants.update',
    'masters.view',
    'masters.create',
    'masters.update',
    'brokers.view',
    'brokers.create',
    'brokers.update',
    'sub_brokers.view',
    'sub_brokers.create',
    'sub_brokers.update',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'kyc.review',
    'funds.view',
    'funds.approve',
    'funds.reject',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'commission.manage',
    'risk.view',
    'risk.manage',
    'reports.view',
    'notifications.view',
    'support.view',
    'white_label.view',
    'white_label.manage',
    'audit_logs.view'
  ],

  MASTER: [
    'dashboard.view',
    'masters.view',
    'brokers.view',
    'brokers.create',
    'brokers.update',
    'sub_brokers.view',
    'sub_brokers.create',
    'sub_brokers.update',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'kyc.review',
    'funds.view',
    'funds.approve',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'risk.view',
    'reports.view',
    'notifications.view',
    'support.view'
  ],

  BROKER: [
    'dashboard.view',
    'brokers.view',
    'sub_brokers.view',
    'sub_brokers.create',
    'sub_brokers.update',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'funds.view',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'risk.view',
    'reports.view',
    'notifications.view',
    'support.view'
  ],

  SUB_BROKER: [
    'dashboard.view',
    'sub_brokers.view',
    'clients.view',
    'clients.create',
    'clients.update',
    'kyc.view',
    'funds.view',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'commission.view',
    'risk.view',
    'reports.view',
    'notifications.view',
    'support.view'
  ],

  COMPLIANCE_OFFICER: [
    'dashboard.view',
    'tenants.view',
    'masters.view',
    'brokers.view',
    'sub_brokers.view',
    'clients.view',
    'kyc.view',
    'kyc.review',
    'funds.view',
    'funds.approve',
    'funds.reject',
    'ledger.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'reports.view',
    'notifications.view',
    'audit_logs.view'
  ],

  RISK_MANAGER: [
    'dashboard.view',
    'clients.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'risk.view',
    'risk.manage',
    'reports.view',
    'notifications.view',
    'audit_logs.view',
    'emergency.view'
  ],

  SUPPORT_AGENT: [
    'dashboard.view',
    'clients.view',
    'orders.view',
    'trades.view',
    'support.view',
    'notifications.view'
  ],

  CLIENT: [
    'dashboard.view',
    'orders.view',
    'trades.view',
    'positions.view',
    'funds.view',
    'funds.deposit',
    'funds.withdraw',
    'ledger.view',
    'kyc.view',
    'notifications.view',
    'support.view'
  ]
};

// In-memory cache for dynamic DB-configured role permissions
const rolePermissionsCache: Map<string, { permissions: Permission[]; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

export async function getPermissionsForRole(role: UserRole, customPermissions?: string[]): Promise<Permission[]> {
  const cached = rolePermissionsCache.get(role);
  let basePermissions: Permission[] = DEFAULT_ROLE_PERMISSIONS_MAP[role] || [];

  if (cached && cached.expiresAt > Date.now()) {
    basePermissions = cached.permissions;
  } else {
    try {
      const { rows } = await query<{ permissions: any }>(
        'SELECT permissions FROM roles WHERE id = $1 OR name = $1 LIMIT 1',
        [role]
      );
      if (rows.length > 0 && Array.isArray(rows[0].permissions)) {
        basePermissions = rows[0].permissions as Permission[];
        rolePermissionsCache.set(role, { permissions: basePermissions, expiresAt: Date.now() + CACHE_TTL_MS });
      }
    } catch {
      // Fallback to default in case DB query fails or table not yet migrated
    }
  }

  if (customPermissions && customPermissions.length > 0) {
    const combined = new Set([...basePermissions, ...(customPermissions as Permission[])]);
    return Array.from(combined);
  }

  return basePermissions;
}

export async function checkHasPermission(
  role: UserRole,
  requiredPermission: Permission,
  customPermissions?: string[]
): Promise<boolean> {
  // Platform owner always has full access
  if (role === 'PLATFORM_OWNER') return true;

  const permissions = await getPermissionsForRole(role, customPermissions);
  return permissions.includes(requiredPermission);
}

export function clearRolePermissionsCache() {
  rolePermissionsCache.clear();
}
