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

export async function filterClientsForUser<T extends { id: string; sub_broker_id?: string }>(clients: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return clients;
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    const { rows } = await query<{ id: string }>(
      `SELECT sb.id FROM sub_brokers sb
       JOIN brokers b ON sb.broker_id = b.id
       WHERE b.master_id = $1`,
      [user.hierarchy_id]
    );
    const subBrokerIds = new Set(rows.map(r => r.id));
    return clients.filter(c => c.sub_broker_id && subBrokerIds.has(c.sub_broker_id));
  }
  if (user.role === 'BROKER' && user.hierarchy_id) {
    const { rows } = await query<{ id: string }>('SELECT id FROM sub_brokers WHERE broker_id = $1', [user.hierarchy_id]);
    const subBrokerIds = new Set(rows.map(r => r.id));
    return clients.filter(c => c.sub_broker_id && subBrokerIds.has(c.sub_broker_id));
  }
  if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
    return clients.filter(c => c.sub_broker_id === user.hierarchy_id);
  }
  if (user.role === 'CLIENT' && user.hierarchy_id) {
    return clients.filter(c => c.id === user.hierarchy_id);
  }
  return [];
}

export async function filterClientScopedItems<T extends { client_id?: string; client_name?: string }>(items: T[], user: AuthenticatedUser): Promise<T[]> {
  if (['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'COMPLIANCE_OFFICER'].includes(user.role)) {
    return items;
  }
  if (user.role === 'CLIENT' && user.hierarchy_id) {
    return items.filter(i => i.client_id === user.hierarchy_id || (user.name && i.client_name === user.name));
  }
  if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
    const { rows } = await query<{ id: string }>('SELECT id FROM clients WHERE sub_broker_id = $1', [user.hierarchy_id]);
    const clientIds = new Set(rows.map(r => r.id));
    return items.filter(i => i.client_id && clientIds.has(i.client_id));
  }
  if (user.role === 'BROKER' && user.hierarchy_id) {
    const { rows } = await query<{ id: string }>(
      `SELECT c.id FROM clients c
       JOIN sub_brokers sb ON c.sub_broker_id = sb.id
       WHERE sb.broker_id = $1`,
      [user.hierarchy_id]
    );
    const clientIds = new Set(rows.map(r => r.id));
    return items.filter(i => i.client_id && clientIds.has(i.client_id));
  }
  if (user.role === 'MASTER' && user.hierarchy_id) {
    const { rows } = await query<{ id: string }>(
      `SELECT c.id FROM clients c
       JOIN sub_brokers sb ON c.sub_broker_id = sb.id
       JOIN brokers b ON sb.broker_id = b.id
       WHERE b.master_id = $1`,
      [user.hierarchy_id]
    );
    const clientIds = new Set(rows.map(r => r.id));
    return items.filter(i => i.client_id && clientIds.has(i.client_id));
  }
  return items;
}
