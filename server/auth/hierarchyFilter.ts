import { AuthenticatedUser } from './types.ts';
import { query } from '../db/connection.ts';

export interface HierarchyFilterResult {
  role: string;
  isGlobal: boolean;
  tenantId?: string | null;
  masterId?: string | null;
  brokerId?: string | null;
  subBrokerId?: string | null;
  clientId?: string | null;
  allowedBrokerIds: Set<string> | null;
  allowedSubBrokerIds: Set<string> | null;
  allowedClientIds: Set<string> | null;
  allowedClientCodes: Set<string> | null;
  allowedClientNames: Set<string> | null;
}

const GLOBAL_UNRESTRICTED_ROLES = new Set([
  'SUPER_ADMIN',
  'PLATFORM_OWNER',
  'ADMIN',
  'TENANT_ADMIN',
  'COMPLIANCE_OFFICER',
  'FINANCE_ADMIN',
  'RISK_MANAGER'
]);

const GLOBAL_TENANT_TOKENS = new Set([
  '',
  'all',
  'all tenants',
  'all_tenants',
  'global',
  'null',
  'undefined'
]);

export function normalizeTenantFilter(tenantId?: string | null): string | undefined {
  if (tenantId === undefined || tenantId === null) return undefined;
  const trimmed = String(tenantId).trim();
  if (GLOBAL_TENANT_TOKENS.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function isGlobalHierarchyRole(role?: string | null): boolean {
  if (!role) return true;
  return GLOBAL_UNRESTRICTED_ROLES.has(String(role).trim().toUpperCase());
}

/**
 * Resolves downline entity identifiers for the authenticated user based on the 4-tier hierarchy:
 * SUPER_ADMIN -> MASTER -> BROKER -> SUB_BROKER -> CLIENT
 */
export async function getHierarchyFilter(
  user?: AuthenticatedUser | null,
  tenantIdParam?: string | null
): Promise<HierarchyFilterResult> {
  const roleUpper = (user?.role || '').toString().trim().toUpperCase();
  const explicitTenant = normalizeTenantFilter(tenantIdParam);
  const normalizedTenant = explicitTenant ?? normalizeTenantFilter(user?.tenant_id) ?? null;

  // SUPER_ADMIN / global roles or missing session: explicitly ignore tenantId constraints and return unrestricted access
  if (
    !user ||
    !roleUpper ||
    isGlobalHierarchyRole(roleUpper) ||
    (arguments.length >= 2 && explicitTenant === undefined && !['MASTER', 'BROKER', 'SUB_BROKER', 'CLIENT'].includes(roleUpper))
  ) {
    return {
      role: roleUpper || 'SUPER_ADMIN',
      isGlobal: true,
      tenantId: null,
      masterId: null,
      brokerId: null,
      subBrokerId: null,
      clientId: null,
      allowedBrokerIds: null,
      allowedSubBrokerIds: null,
      allowedClientIds: null,
      allowedClientCodes: null,
      allowedClientNames: null
    };
  }

  const allowedBrokerIds = new Set<string>();
  const allowedSubBrokerIds = new Set<string>();
  const allowedClientIds = new Set<string>();
  const allowedClientCodes = new Set<string>();
  const allowedClientNames = new Set<string>();

  const result: HierarchyFilterResult = {
    role: roleUpper,
    isGlobal: false,
    tenantId: normalizedTenant,
    masterId: null,
    brokerId: null,
    subBrokerId: null,
    clientId: null,
    allowedBrokerIds,
    allowedSubBrokerIds,
    allowedClientIds,
    allowedClientCodes,
    allowedClientNames
  };

  try {
    if (roleUpper === 'MASTER') {
      let masterId = user.hierarchy_id;
      if (!masterId && user.email) {
        try {
          const m = await query<{ id: string }>('SELECT id FROM masters WHERE LOWER(email) = LOWER($1) OR name = $2 LIMIT 1', [user.email, user.name]);
          masterId = m.rows[0]?.id;
        } catch {}
      }
      result.masterId = masterId || 'MST-001';

      // 1. Brokers under Master
      try {
        const { rows: bRows } = await query<{ id: string; code: string }>('SELECT id, code FROM brokers WHERE master_id = $1', [result.masterId]);
        for (const b of bRows) {
          if (b.id) allowedBrokerIds.add(b.id);
        }
      } catch {}

      // 2. Sub-Brokers under those Brokers
      if (allowedBrokerIds.size > 0) {
        try {
          const bIdArray = Array.from(allowedBrokerIds);
          const { rows: sbRows } = await query<{ id: string }>('SELECT id FROM sub_brokers WHERE broker_id = ANY($1)', [bIdArray]);
          for (const sb of sbRows) {
            if (sb.id) allowedSubBrokerIds.add(sb.id);
          }
        } catch {}
      }

      // 3. Clients under those Sub-Brokers or Brokers
      try {
        const { rows: cRows } = await query<{ id: string; client_code: string; name: string }>(
          `SELECT c.id, c.client_code, c.name FROM clients c
           LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
           LEFT JOIN brokers b ON sb.broker_id = b.id
           WHERE b.master_id = $1`,
          [result.masterId]
        );
        for (const c of cRows) {
          if (c.id) allowedClientIds.add(c.id.toLowerCase());
          if (c.client_code) allowedClientCodes.add(c.client_code.toLowerCase());
          if (c.name) allowedClientNames.add(c.name.toLowerCase());
        }
      } catch {}
    } else if (roleUpper === 'BROKER') {
      let brokerId = user.hierarchy_id;
      if (!brokerId && user.email) {
        try {
          const b = await query<{ id: string }>('SELECT id FROM brokers WHERE LOWER(email) = LOWER($1) OR name = $2 LIMIT 1', [user.email, user.name]);
          brokerId = b.rows[0]?.id;
        } catch {}
      }
      result.brokerId = brokerId || 'BRK-001';
      allowedBrokerIds.add(result.brokerId);

      // Sub-Brokers under this Broker
      try {
        const { rows: sbRows } = await query<{ id: string }>('SELECT id FROM sub_brokers WHERE broker_id = $1', [result.brokerId]);
        for (const sb of sbRows) {
          if (sb.id) allowedSubBrokerIds.add(sb.id);
        }
      } catch {}

      // Clients under this Broker or its Sub-Brokers
      try {
        const { rows: cRows } = await query<{ id: string; client_code: string; name: string }>(
          `SELECT c.id, c.client_code, c.name FROM clients c
           LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
           WHERE sb.broker_id = $1`,
          [result.brokerId]
        );
        for (const c of cRows) {
          if (c.id) allowedClientIds.add(c.id.toLowerCase());
          if (c.client_code) allowedClientCodes.add(c.client_code.toLowerCase());
          if (c.name) allowedClientNames.add(c.name.toLowerCase());
        }
      } catch {}
    } else if (roleUpper === 'SUB_BROKER') {
      let subBrokerId = user.hierarchy_id;
      if (!subBrokerId && user.email) {
        try {
          const sb = await query<{ id: string }>('SELECT id FROM sub_brokers WHERE LOWER(email) = LOWER($1) OR name = $2 LIMIT 1', [user.email, user.name]);
          subBrokerId = sb.rows[0]?.id;
        } catch {}
      }
      result.subBrokerId = subBrokerId || 'SBRK-001';
      allowedSubBrokerIds.add(result.subBrokerId);

      // Clients strictly assigned to this Sub-Broker
      try {
        const { rows: cRows } = await query<{ id: string; client_code: string; name: string }>(
          'SELECT id, client_code, name FROM clients WHERE sub_broker_id = $1',
          [result.subBrokerId]
        );
        for (const c of cRows) {
          if (c.id) allowedClientIds.add(c.id.toLowerCase());
          if (c.client_code) allowedClientCodes.add(c.client_code.toLowerCase());
          if (c.name) allowedClientNames.add(c.name.toLowerCase());
        }
      } catch {}
    } else if (roleUpper === 'CLIENT') {
      let clientId = user.hierarchy_id;
      if (!clientId && user.email) {
        try {
          const c = await query<{ id: string; client_code: string }>('SELECT id, client_code FROM clients WHERE LOWER(email) = LOWER($1) OR name = $2 LIMIT 1', [user.email, user.name]);
          clientId = c.rows[0]?.id || c.rows[0]?.client_code;
        } catch {}
      }
      result.clientId = clientId || 'CLT-001';
      allowedClientIds.add(result.clientId.toLowerCase());
      if (user.hierarchy_id) allowedClientCodes.add(user.hierarchy_id.toLowerCase());
      if (user.name) allowedClientNames.add(user.name.toLowerCase());
    }
  } catch (err) {
    console.error('[getHierarchyFilter] Error computing hierarchy downline filter:', err);
  }

  return result;
}

export async function filterMastersForUser<T extends { id: string }>(masters: T[], user?: AuthenticatedUser | null): Promise<T[]> {
  if (!user || isGlobalHierarchyRole(user.role)) {
    return masters;
  }
  const filter = await getHierarchyFilter(user);
  if (filter.isGlobal) return masters;
  if (filter.role === 'MASTER' && filter.masterId) {
    return masters.filter(m => m.id === filter.masterId);
  }
  return [];
}

export async function filterBrokersForUser<T extends { id: string; master_id?: string }>(brokers: T[], user?: AuthenticatedUser | null): Promise<T[]> {
  if (!user || isGlobalHierarchyRole(user.role)) {
    return brokers;
  }
  const filter = await getHierarchyFilter(user);
  if (filter.isGlobal || !filter.allowedBrokerIds) return brokers;
  if (filter.role === 'MASTER' && filter.masterId) {
    return brokers.filter(b => b.master_id === filter.masterId || filter.allowedBrokerIds!.has(b.id));
  }
  if (filter.role === 'BROKER' && filter.brokerId) {
    return brokers.filter(b => b.id === filter.brokerId);
  }
  return [];
}

export async function filterSubBrokersForUser<T extends { id: string; broker_id?: string }>(subBrokers: T[], user?: AuthenticatedUser | null): Promise<T[]> {
  if (!user || isGlobalHierarchyRole(user.role)) {
    return subBrokers;
  }
  const filter = await getHierarchyFilter(user);
  if (filter.isGlobal || !filter.allowedSubBrokerIds || !filter.allowedBrokerIds) return subBrokers;
  if (filter.role === 'MASTER') {
    return subBrokers.filter(sb => sb.broker_id && filter.allowedBrokerIds!.has(sb.broker_id));
  }
  if (filter.role === 'BROKER' && filter.brokerId) {
    return subBrokers.filter(sb => sb.broker_id === filter.brokerId || filter.allowedSubBrokerIds!.has(sb.id));
  }
  if (filter.role === 'SUB_BROKER' && filter.subBrokerId) {
    return subBrokers.filter(sb => sb.id === filter.subBrokerId);
  }
  return [];
}

export async function filterClientsForUser<T extends { id: string; sub_broker_id?: string; broker_id?: string; broker_code?: string; client_code?: string }>(clients: T[], user?: AuthenticatedUser | null): Promise<T[]> {
  if (!user || isGlobalHierarchyRole(user.role)) {
    return clients;
  }
  const filter = await getHierarchyFilter(user);
  if (filter.isGlobal || !filter.allowedClientIds || !filter.allowedClientCodes || !filter.allowedSubBrokerIds) return clients;
  if (filter.role === 'MASTER' || filter.role === 'BROKER') {
    return clients.filter(c =>
      (c.sub_broker_id && filter.allowedSubBrokerIds!.has(c.sub_broker_id)) ||
      (c.id && filter.allowedClientIds!.has(c.id.toLowerCase())) ||
      (c.client_code && filter.allowedClientCodes!.has(c.client_code.toLowerCase()))
    );
  }
  if (filter.role === 'SUB_BROKER' && filter.subBrokerId) {
    return clients.filter(c =>
      c.sub_broker_id === filter.subBrokerId ||
      (c.id && filter.allowedClientIds!.has(c.id.toLowerCase())) ||
      (c.client_code && filter.allowedClientCodes!.has(c.client_code.toLowerCase()))
    );
  }
  if (filter.role === 'CLIENT' && filter.clientId) {
    return clients.filter(c =>
      c.id === filter.clientId ||
      (c.client_code && c.client_code.toLowerCase() === filter.clientId?.toLowerCase())
    );
  }
  return [];
}

export async function filterClientScopedItems<T extends Record<string, any>>(items: T[], user?: AuthenticatedUser | null): Promise<T[]> {
  if (!Array.isArray(items)) return [];
  if (!user || isGlobalHierarchyRole(user.role)) {
    return items;
  }
  const filter = await getHierarchyFilter(user);
  if (filter.isGlobal || !filter.allowedClientIds || !filter.allowedClientCodes || !filter.allowedClientNames || !filter.allowedSubBrokerIds) {
    return items;
  }

  // For SUB_BROKER, also support commission transaction scoping
  const subBrokerTarget = (filter.subBrokerId || user.hierarchy_id || '').toLowerCase();

  return items.filter(i => {
    // 1. Direct sub-broker matching for commission transactions & statements
    if (filter.role === 'SUB_BROKER' && subBrokerTarget) {
      const iSubBroker = (i.sub_broker_id || i.subBrokerId || i.agent_id || i.recipient_id || '').toString().toLowerCase();
      if (iSubBroker === subBrokerTarget) return true;
      if (user.name && (i.agent_name || '').toString().toLowerCase() === user.name.toLowerCase()) return true;
    }

    // 2. Direct client identifiers
    const cId = (i.client_id || i.clientId || i.user_id || i.userId || i.id || '').toString().toLowerCase();
    const cCode = (i.client_code || i.clientCode || '').toString().toLowerCase();
    const cName = (i.client_name || i.clientName || '').toString().toLowerCase();
    const clientStr = (i.client || i.account || '').toString().toLowerCase();

    if (cId && filter.allowedClientIds!.has(cId)) return true;
    if (cCode && filter.allowedClientCodes!.has(cCode)) return true;
    if (cName && filter.allowedClientNames!.has(cName)) return true;

    for (const code of filter.allowedClientCodes!) {
      if (code && clientStr.includes(code)) return true;
    }
    for (const id of filter.allowedClientIds!) {
      if (id && clientStr.includes(id)) return true;
    }
    for (const name of filter.allowedClientNames!) {
      if (name.length > 2 && clientStr.includes(name)) return true;
    }

    // If item has a sub_broker_id that matches allowed sub-brokers
    const itemSubBroker = (i.sub_broker_id || i.subBrokerId || '').toString();
    if (itemSubBroker && filter.allowedSubBrokerIds!.has(itemSubBroker)) return true;

    return false;
  });
}
