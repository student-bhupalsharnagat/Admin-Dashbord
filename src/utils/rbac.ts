import {
  UserRole,
  ResourceModule,
  PermissionAction,
  RoleDefinition,
  RbacUser
} from '../types';
import { NavigationTab } from '../components/layout/AdminSidebar';

export const ALL_MODULES: ResourceModule[] = [
  'DASHBOARD',
  'TENANTS',
  'MASTERS',
  'BROKERS',
  'SUB_BROKERS',
  'CLIENTS',
  'DOWNLINE_TREE',
  'TRADING_ORDERS',
  'TRADES',
  'POSITIONS',
  'FUNDS',
  'LEDGER',
  'COMMISSIONS',
  'RISK_LIMITS',
  'KYC',
  'REPORTS',
  'NOTIFICATIONS',
  'SUPPORT',
  'SUBSCRIPTIONS',
  'WHITE_LABEL',
  'AUDIT_LOGS',
  'SETTINGS_CONTROLS',
  'ROLES_PERMISSIONS'
];

export const ALL_ACTIONS: PermissionAction[] = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'APPROVE',
  'EXECUTE'
];

export const MODULE_METADATA: Record<ResourceModule, { label: string; description: string; icon: string }> = {
  DASHBOARD: { label: 'Dashboard & Analytics', description: 'System overview, KPIs, and turnover charts', icon: 'LayoutDashboard' },
  TENANTS: { label: 'Tenant Management', description: 'Multi-tenant white-label tenant organizations', icon: 'Building' },
  MASTERS: { label: 'Masters Management', description: 'Master brokerage license accounts and capacity limits', icon: 'Crown' },
  BROKERS: { label: 'Brokers Management', description: 'Broker accounts, brokerage sharing, and credentials', icon: 'Building2' },
  SUB_BROKERS: { label: 'Sub-Brokers', description: 'Sub-broker branches and commission structures', icon: 'Users2' },
  CLIENTS: { label: 'Clients / Traders', description: 'Client profiles, wallet balances, and margins', icon: 'Users' },
  DOWNLINE_TREE: { label: 'Downline Tree', description: 'Visual multi-level hierarchy relationship mapping', icon: 'Network' },
  TRADING_ORDERS: { label: 'Trading Orders', description: 'Order book, order statuses, and cancellation controls', icon: 'ShoppingCart' },
  TRADES: { label: 'Executed Trades', description: 'Executed trade transactions and settlement history', icon: 'Activity' },
  POSITIONS: { label: 'Open Positions', description: 'Real-time client positions and emergency square-off', icon: 'CandlestickChart' },
  FUNDS: { label: 'Funds & Banking', description: 'Deposits, withdrawals, and balance approvals', icon: 'Wallet' },
  LEDGER: { label: 'Financial Ledger', description: 'Credit/debit journal records and balance sheets', icon: 'BookOpen' },
  COMMISSIONS: { label: 'Commissions', description: 'Revenue share, commission calculations, and payouts', icon: 'DollarSign' },
  RISK_LIMITS: { label: 'Risk & Margins', description: 'Max leverage, loss limits, margin calls, and auto-square off', icon: 'AlertTriangle' },
  KYC: { label: 'KYC Compliance', description: 'Identity verification, document audits, and approvals', icon: 'CreditCard' },
  REPORTS: { label: 'Reporting Engine', description: 'Financial statements, P&L, and turnover audits', icon: 'FileText' },
  NOTIFICATIONS: { label: 'Notifications', description: 'System alerts, broadcast announcements, and logs', icon: 'Bell' },
  SUPPORT: { label: 'Support Desk', description: 'Help tickets, client communications, and dispute resolution', icon: 'Headphones' },
  SUBSCRIPTIONS: { label: 'Subscriptions & Billing', description: 'SaaS licensing plans, billing invoices, and tiers', icon: 'CreditCard' },
  WHITE_LABEL: { label: 'White-Label Branding', description: 'Custom domains, logos, colors, and portal theming', icon: 'Globe' },
  AUDIT_LOGS: { label: 'Audit & Surveillance', description: 'User sessions, suspicious activity, and login history', icon: 'Shield' },
  SETTINGS_CONTROLS: { label: 'Emergency & Controls', description: 'Global kill switch, API access, and circuit breakers', icon: 'Settings' },
  ROLES_PERMISSIONS: { label: 'Roles & RBAC', description: 'Role definitions, granular permissions, and staff assignments', icon: 'ShieldCheck' }
};

export const ACTION_METADATA: Record<PermissionAction, { label: string; badgeColor: string }> = {
  VIEW: { label: 'View / Read', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  CREATE: { label: 'Create / Add', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  EDIT: { label: 'Edit / Update', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  DELETE: { label: 'Delete / Remove', badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20' },
  EXPORT: { label: 'Export Data', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  APPROVE: { label: 'Approve / Reject', badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  EXECUTE: { label: 'Execute / Action', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
};

// Map each NavigationTab to its corresponding ResourceModule
export const TAB_TO_MODULE_MAP: Record<NavigationTab, ResourceModule> = {
  'dashboard': 'DASHBOARD',
  'tenants': 'TENANTS',
  'masters': 'MASTERS',
  'brokers': 'BROKERS',
  'sub-brokers': 'SUB_BROKERS',
  'clients': 'CLIENTS',
  'tree': 'DOWNLINE_TREE',
  'orders': 'TRADING_ORDERS',
  'trades': 'TRADES',
  'positions': 'POSITIONS',
  'orders-trades': 'TRADES',
  'funds': 'FUNDS',
  'ledger': 'LEDGER',
  'commission': 'COMMISSIONS',
  'risk': 'RISK_LIMITS',
  'kyc': 'KYC',
  'reports': 'REPORTS',
  'notifications': 'NOTIFICATIONS',
  'support': 'SUPPORT',
  'subscriptions': 'SUBSCRIPTIONS',
  'whitelabel': 'WHITE_LABEL',
  'white-label': 'WHITE_LABEL',
  'audit-logs': 'AUDIT_LOGS',
  'settings': 'SETTINGS_CONTROLS',
  'rbac': 'ROLES_PERMISSIONS'
};

const fullActions: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE', 'EXECUTE'];
const standardCrud: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'EXPORT'];
const readOnly: PermissionAction[] = ['VIEW', 'EXPORT'];

// Default permissions for each built-in role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<ResourceModule, PermissionAction[]>> = {
  SUPER_ADMIN: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = [...fullActions];
    return acc;
  }, {} as Record<ResourceModule, PermissionAction[]>),

  PLATFORM_OWNER: ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = [...fullActions];
    return acc;
  }, {} as Record<ResourceModule, PermissionAction[]>),

  ADMIN: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: ['VIEW', 'EDIT'],
    MASTERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    SUB_BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    CLIENTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    DOWNLINE_TREE: ['VIEW', 'EXPORT'],
    TRADING_ORDERS: ['VIEW', 'EDIT', 'DELETE', 'EXPORT', 'EXECUTE'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT', 'EXECUTE'],
    FUNDS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    RISK_LIMITS: ['VIEW', 'EDIT', 'EXECUTE'],
    KYC: ['VIEW', 'APPROVE', 'EXPORT'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW', 'CREATE', 'EXPORT'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
    SUBSCRIPTIONS: ['VIEW', 'EDIT'],
    WHITE_LABEL: ['VIEW', 'EDIT'],
    AUDIT_LOGS: ['VIEW', 'EXPORT'],
    SETTINGS_CONTROLS: ['VIEW', 'EDIT'],
    ROLES_PERMISSIONS: ['VIEW', 'EDIT']
  },

  TENANT_ADMIN: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: ['VIEW'],
    MASTERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    SUB_BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    CLIENTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    DOWNLINE_TREE: ['VIEW', 'EXPORT'],
    TRADING_ORDERS: ['VIEW', 'EXPORT'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT'],
    FUNDS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'APPROVE'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW', 'EXPORT'],
    RISK_LIMITS: ['VIEW', 'EDIT'],
    KYC: ['VIEW', 'APPROVE', 'EXPORT'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW', 'CREATE'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
    SUBSCRIPTIONS: ['VIEW'],
    WHITE_LABEL: ['VIEW', 'EDIT'],
    AUDIT_LOGS: ['VIEW'],
    SETTINGS_CONTROLS: ['VIEW'],
    ROLES_PERMISSIONS: ['VIEW']
  },

  MASTER: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: [],
    MASTERS: ['VIEW'],
    BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    SUB_BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    CLIENTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    DOWNLINE_TREE: ['VIEW', 'EXPORT'],
    TRADING_ORDERS: ['VIEW', 'EXPORT', 'EXECUTE'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT', 'EXECUTE'],
    FUNDS: ['VIEW', 'CREATE', 'EXPORT', 'APPROVE'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW', 'EXPORT'],
    RISK_LIMITS: ['VIEW', 'EDIT'],
    KYC: ['VIEW', 'APPROVE'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: ['VIEW'],
    SETTINGS_CONTROLS: [],
    ROLES_PERMISSIONS: []
  },

  BROKER: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: [],
    MASTERS: [],
    BROKERS: ['VIEW'],
    SUB_BROKERS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    CLIENTS: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
    DOWNLINE_TREE: ['VIEW', 'EXPORT'],
    TRADING_ORDERS: ['VIEW', 'EXPORT'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT'],
    FUNDS: ['VIEW', 'CREATE', 'EXPORT'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW', 'EXPORT'],
    RISK_LIMITS: ['VIEW'],
    KYC: ['VIEW', 'APPROVE'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: [],
    SETTINGS_CONTROLS: [],
    ROLES_PERMISSIONS: []
  },

  SUB_BROKER: {
    DASHBOARD: ['VIEW'],
    TENANTS: [],
    MASTERS: [],
    BROKERS: [],
    SUB_BROKERS: ['VIEW'],
    CLIENTS: ['VIEW', 'CREATE', 'EDIT'],
    DOWNLINE_TREE: ['VIEW'],
    TRADING_ORDERS: ['VIEW'],
    TRADES: ['VIEW'],
    POSITIONS: ['VIEW'],
    FUNDS: ['VIEW', 'CREATE'],
    LEDGER: ['VIEW'],
    COMMISSIONS: ['VIEW'],
    RISK_LIMITS: ['VIEW'],
    KYC: ['VIEW'],
    REPORTS: ['VIEW'],
    NOTIFICATIONS: ['VIEW'],
    SUPPORT: ['VIEW', 'CREATE'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: [],
    SETTINGS_CONTROLS: [],
    ROLES_PERMISSIONS: []
  },

  COMPLIANCE_OFFICER: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: ['VIEW'],
    MASTERS: ['VIEW', 'EXPORT'],
    BROKERS: ['VIEW', 'EXPORT'],
    SUB_BROKERS: ['VIEW', 'EXPORT'],
    CLIENTS: ['VIEW', 'EXPORT'],
    DOWNLINE_TREE: ['VIEW'],
    TRADING_ORDERS: ['VIEW', 'EXPORT'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT'],
    FUNDS: ['VIEW', 'EXPORT'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW'],
    RISK_LIMITS: ['VIEW', 'EXPORT'],
    KYC: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW', 'CREATE'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: ['VIEW', 'EXPORT', 'EXECUTE'],
    SETTINGS_CONTROLS: ['VIEW'],
    ROLES_PERMISSIONS: ['VIEW']
  },

  RISK_MANAGER: {
    DASHBOARD: ['VIEW', 'EXPORT'],
    TENANTS: ['VIEW'],
    MASTERS: ['VIEW'],
    BROKERS: ['VIEW'],
    SUB_BROKERS: ['VIEW'],
    CLIENTS: ['VIEW', 'EDIT', 'EXPORT'],
    DOWNLINE_TREE: ['VIEW'],
    TRADING_ORDERS: ['VIEW', 'EDIT', 'DELETE', 'EXPORT', 'EXECUTE'],
    TRADES: ['VIEW', 'EXPORT'],
    POSITIONS: ['VIEW', 'EXPORT', 'EXECUTE'],
    FUNDS: ['VIEW', 'EXPORT'],
    LEDGER: ['VIEW', 'EXPORT'],
    COMMISSIONS: ['VIEW'],
    RISK_LIMITS: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'EXECUTE'],
    KYC: ['VIEW'],
    REPORTS: ['VIEW', 'EXPORT'],
    NOTIFICATIONS: ['VIEW', 'CREATE'],
    SUPPORT: ['VIEW'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: ['VIEW', 'EXPORT'],
    SETTINGS_CONTROLS: ['VIEW', 'EDIT', 'EXECUTE'],
    ROLES_PERMISSIONS: ['VIEW']
  },

  SUPPORT_AGENT: {
    DASHBOARD: ['VIEW'],
    TENANTS: ['VIEW'],
    MASTERS: ['VIEW'],
    BROKERS: ['VIEW'],
    SUB_BROKERS: ['VIEW'],
    CLIENTS: ['VIEW'],
    DOWNLINE_TREE: [],
    TRADING_ORDERS: ['VIEW'],
    TRADES: ['VIEW'],
    POSITIONS: ['VIEW'],
    FUNDS: ['VIEW'],
    LEDGER: ['VIEW'],
    COMMISSIONS: [],
    RISK_LIMITS: ['VIEW'],
    KYC: ['VIEW'],
    REPORTS: [],
    NOTIFICATIONS: ['VIEW', 'CREATE'],
    SUPPORT: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: [],
    SETTINGS_CONTROLS: [],
    ROLES_PERMISSIONS: []
  },

  CLIENT: {
    DASHBOARD: ['VIEW'],
    TENANTS: [],
    MASTERS: [],
    BROKERS: [],
    SUB_BROKERS: [],
    CLIENTS: [],
    DOWNLINE_TREE: [],
    TRADING_ORDERS: ['VIEW', 'CREATE', 'DELETE'],
    TRADES: ['VIEW'],
    POSITIONS: ['VIEW'],
    FUNDS: ['VIEW', 'CREATE'],
    LEDGER: ['VIEW'],
    COMMISSIONS: [],
    RISK_LIMITS: ['VIEW'],
    KYC: ['VIEW', 'CREATE'],
    REPORTS: ['VIEW'],
    NOTIFICATIONS: ['VIEW'],
    SUPPORT: ['VIEW', 'CREATE'],
    SUBSCRIPTIONS: [],
    WHITE_LABEL: [],
    AUDIT_LOGS: [],
    SETTINGS_CONTROLS: [],
    ROLES_PERMISSIONS: []
  }
};

/**
 * Checks if a given role has a specific action permission on a resource module
 */
export function hasPermission(
  userRole: UserRole | string | undefined,
  module: ResourceModule,
  action: PermissionAction,
  customOverrides?: Partial<Record<ResourceModule, PermissionAction[]>>
): boolean {
  if (!userRole) return false;

  // Super Admin and Platform Owner have unrestricted permissions
  if (userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_OWNER') {
    return true;
  }

  // Check custom user override if provided
  if (customOverrides && customOverrides[module]) {
    if (customOverrides[module]!.includes(action)) {
      return true;
    }
  }

  // Check default role permissions
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[userRole as UserRole];
  if (!rolePermissions) return false;

  const modulePerms = rolePermissions[module] || [];
  return modulePerms.includes(action);
}

/**
 * Checks if a given role is permitted to see and navigate to a sidebar tab
 */
export function canAccessTab(
  userRole: UserRole | string | undefined,
  tab: NavigationTab,
  customOverrides?: Partial<Record<ResourceModule, PermissionAction[]>>
): boolean {
  if (!userRole) return false;
  if (userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_OWNER') return true;

  const module = TAB_TO_MODULE_MAP[tab];
  if (!module) return true;

  return hasPermission(userRole, module, 'VIEW', customOverrides);
}

/**
 * Role badge styling
 */
export function getRoleBadgeStyle(role: string): { bg: string; text: string; border: string; label: string } {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'PLATFORM_OWNER':
      return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Super Admin' };
    case 'ADMIN':
    case 'TENANT_ADMIN':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Tenant Admin' };
    case 'MASTER':
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Master' };
    case 'BROKER':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Broker' };
    case 'SUB_BROKER':
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', label: 'Sub-Broker' };
    case 'COMPLIANCE_OFFICER':
      return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', label: 'Compliance' };
    case 'RISK_MANAGER':
      return { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Risk Manager' };
    case 'SUPPORT_AGENT':
      return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', label: 'Support Agent' };
    case 'CLIENT':
      return { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30', label: 'Client / Trader' };
    default:
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: role.replace(/_/g, ' ') };
  }
}
