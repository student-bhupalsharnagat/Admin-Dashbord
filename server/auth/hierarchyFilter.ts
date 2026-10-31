import { AuthenticatedUser } from './types.ts';
import { query } from '../db/connection.ts';

export async function filterMastersForUser<T extends { id: string }>(masters: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return masters;
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    return masters.filter(m => m.id === user.hierarchy_id);
  }
  // Brokers, sub-brokers, and clients cannot see master records
  return [];
}

export async function filterBrokersForUser<T extends { id: string; master_id?: string }>(brokers: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return brokers;
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    return brokers.filter(b => b.master_id === user.hierarchy_id);
  }
  if (user.role === 'BROKER' && user.hierarchy_id) {
    return brokers.filter(b => b.id === user.hierarchy_id);
  }
  return [];
}

export async function filterSubBrokersForUser<T extends { id: string; broker_id?: string }>(subBrokers: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return subBrokers;
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    // Find all broker IDs belonging to this master
    const { rows } = await query<{ id: string }>('SELECT id FROM brokers WHERE master_id = $1', [user.hierarchy_id]);
    const brokerIds = new Set(rows.map(r => r.id));
    return subBrokers.filter(sb => sb.broker_id && brokerIds.has(sb.broker_id));
  }
  if (user.role === 'BROKER' && user.hierarchy_id) {
    return subBrokers.filter(sb => sb.broker_id === user.hierarchy_id);
  }
  if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
    return subBrokers.filter(sb => sb.id === user.hierarchy_id);
  }
  return [];
}

export async function filterClientsForUser<T extends { id: string; sub_broker_id?: string; broker_id?: string; broker_code?: string; client_code?: string }>(clients: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return clients;
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    let subBrokerIds = new Set<string>();
    let brokerCodes = new Set<string>();
    try {
      const { rows } = await query<{ id: string }>(
        `SELECT sb.id FROM sub_brokers sb
         JOIN brokers b ON sb.broker_id = b.id
         WHERE b.master_id = $1`,
        [user.hierarchy_id]
      );
      subBrokerIds = new Set(rows.map(r => r.id));
      const { rows: bRows } = await query<{ code: string }>('SELECT code FROM brokers WHERE master_id = $1', [user.hierarchy_id]);
      brokerCodes = new Set(bRows.map(r => r.code));
    } catch {}
    return clients.filter(c => (c.sub_broker_id && subBrokerIds.has(c.sub_broker_id)) || (c.broker_code && brokerCodes.has(c.broker_code)));
  }
  if (user.role === 'BROKER' && user.hierarchy_id) {
    let subBrokerIds = new Set<string>();
    let brokerCode: string | undefined;
    try {
      const { rows: bRows } = await query<{ id: string; code?: string }>('SELECT id, code FROM brokers WHERE id = $1', [user.hierarchy_id]);
      brokerCode = bRows[0]?.code;
      const { rows } = await query<{ id: string }>('SELECT id FROM sub_brokers WHERE broker_id = $1', [user.hierarchy_id]);
      subBrokerIds = new Set(rows.map(r => r.id));
    } catch {}
    return clients.filter(c => (c.sub_broker_id && subBrokerIds.has(c.sub_broker_id)) || c.broker_id === user.hierarchy_id || (brokerCode && c.broker_code === brokerCode));
  }
  if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
    return clients.filter(c => c.sub_broker_id === user.hierarchy_id);
  }
  if (user.role === 'CLIENT' && user.hierarchy_id) {
    return clients.filter(c => c.id === user.hierarchy_id || c.client_code === user.hierarchy_id);
  }
  return [];
}

export async function filterClientScopedItems<T extends Record<string, any>>(items: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return items;
  }
  if (user.role === 'CLIENT' && user.hierarchy_id) {
    const target = user.hierarchy_id.toLowerCase();
    const targetName = user.name ? user.name.toLowerCase() : '';
    return items.filter(i => {
      const cId = (i.client_id || i.clientId || i.id || '').toString().toLowerCase();
      const cCode = (i.client_code || i.clientCode || '').toString().toLowerCase();
      const cName = (i.client_name || i.clientName || '').toString().toLowerCase();
      const clientStr = (i.client || i.account || '').toString().toLowerCase();
      return (
        cId === target ||
        cCode === target ||
        (targetName && cName === targetName) ||
        clientStr.includes(target) ||
        (targetName && clientStr.includes(targetName))
      );
    });
  }

  const allowedClientCodes = new Set<string>();
  const allowedClientIds = new Set<string>();
  const allowedClientNames = new Set<string>();

  try {
    let clientRows: { id: string; client_code: string; name: string }[] = [];
    if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
      const { rows } = await query<{ id: string; client_code: string; name: string }>(
        'SELECT id, client_code, name FROM clients WHERE sub_broker_id = $1',
        [user.hierarchy_id]
      );
      clientRows = rows;
    } else if (user.role === 'BROKER' && user.hierarchy_id) {
      const { rows: bRows } = await query<{ id: string; code?: string }>('SELECT id, code FROM brokers WHERE id = $1', [user.hierarchy_id]);
      const brokerCode = bRows[0]?.code;
      const { rows } = await query<{ id: string; client_code: string; name: string }>(
        `SELECT c.id, c.client_code, c.name FROM clients c
         LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
         WHERE sb.broker_id = $1 OR c.broker_code = $2`,
        [user.hierarchy_id, brokerCode || '']
      );
      clientRows = rows;
    } else if (user.role === 'MASTER' && user.hierarchy_id) {
      const { rows } = await query<{ id: string; client_code: string; name: string }>(
        `SELECT c.id, c.client_code, c.name FROM clients c
         LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
         JOIN brokers b ON (sb.broker_id = b.id OR c.broker_code = b.code)
         WHERE b.master_id = $1`,
        [user.hierarchy_id]
      );
      clientRows = rows;
    }

    for (const r of clientRows) {
      if (r.id) allowedClientIds.add(r.id.toLowerCase());
      if (r.client_code) allowedClientCodes.add(r.client_code.toLowerCase());
      if (r.name) allowedClientNames.add(r.name.toLowerCase());
    }
  } catch (err) {
    console.error('[filterClientScopedItems] DB error:', err);
  }

  return items.filter(i => {
    const cId = (i.client_id || i.clientId || '').toString().toLowerCase();
    const cCode = (i.client_code || i.clientCode || '').toString().toLowerCase();
    const cName = (i.client_name || i.clientName || '').toString().toLowerCase();
    const clientStr = (i.client || i.account || '').toString().toLowerCase();

    if (cId && allowedClientIds.has(cId)) return true;
    if (cCode && allowedClientCodes.has(cCode)) return true;
    if (cName && allowedClientNames.has(cName)) return true;

    for (const code of allowedClientCodes) {
      if (clientStr.includes(code)) return true;
    }
    for (const id of allowedClientIds) {
      if (clientStr.includes(id)) return true;
    }
    for (const name of allowedClientNames) {
      if (name.length > 2 && clientStr.includes(name)) return true;
    }
    return false;
  });
}
