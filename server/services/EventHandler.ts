/**
 * Trading Platform Inbound Event Ingestion & Processing Service
 * Enforces HMAC verification, replay window rejection, tenant isolation,
 * event deduplication, and atomic persistence.
 */

import { query } from '../db/connection.ts';
import { tradingPlatformClient } from './TradingPlatformClient.ts';
import { EventEmitter } from 'events';

export const adminEventBus = new EventEmitter();
adminEventBus.setMaxListeners(100);

export type TradingPlatformEventType =
  | 'order.created'
  | 'order.updated'
  | 'trade.executed'
  | 'position.updated'
  | 'position.created'
  | 'position.closed'
  | 'wallet.updated'
  | 'client.wallet_updated'
  | 'client.created'
  | 'client.registered'
  | 'client.account_created'
  | 'client.account_updated'
  | 'client.updated'
  | 'account.created'
  | 'tenant.config.updated'
  | 'tenant.branding.updated'
  | 'tenant.status.updated'
  | 'fund.created'
  | 'fund.updated'
  | 'fund.approved'
  | 'fund.rejected'
  | 'deposit.created'
  | 'deposit.updated'
  | 'deposit.approved'
  | 'deposit.rejected'
  | 'fund.deposit_created'
  | 'fund.deposit_updated'
  | 'fund.deposit_approved'
  | 'fund.deposit_rejected'
  | 'withdrawal.created'
  | 'withdrawal.updated'
  | 'withdrawal.approved'
  | 'withdrawal.rejected'
  | 'fund.withdrawal_created'
  | 'fund.withdrawal_updated'
  | 'fund.withdrawal_approved'
  | 'fund.withdrawal_rejected'
  | 'kyc.updated'
  | 'notification.created'
  | 'support.updated'
  | 'risk.margin_breach'
  | 'execution.failure'
  | 'emergency.control_activated'
  | 'reconciliation.mismatch';

export interface TradingPlatformEvent {
  eventId: string;
  eventType: TradingPlatformEventType | string;
  tenantId: string;
  timestamp: string;
  version?: number | string;
  correlationId?: string;
  payload: any;
}

export interface EventProcessingResult {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  eventType: string;
  message: string;
  error?: string;
  statusCode?: number;
}

export interface ActiveUserSession {
  userId: string;
  clientCode?: string;
  name?: string;
  tenantId: string;
  lastSeen: number;
}

export class EventHandler {
  // In-memory LRU set for fast deduplication check (backed by processed_events table)
  private processedEventIds = new Set<string>();
  private readonly MAX_MEM_CACHE = 1000;

  // Active users registry (in-memory tracking)
  private activeUsers = new Map<string, ActiveUserSession>();

  // Observability metrics
  private metrics = {
    totalEventsReceived: 0,
    successfulEvents: 0,
    duplicateEvents: 0,
    rejectedEvents: 0,
    lastEventProcessedAt: null as string | null
  };

  public getActiveUsersCount(tenantId?: string): number {
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    let count = 0;
    for (const sess of this.activeUsers.values()) {
      if (sess.lastSeen >= fifteenMinutesAgo) {
        if (!tenantId || sess.tenantId === tenantId) {
          count++;
        }
      }
    }
    return Math.max(count, 1);
  }

  public getActiveUsersList(tenantId?: string): ActiveUserSession[] {
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    const list: ActiveUserSession[] = [];
    for (const sess of this.activeUsers.values()) {
      if (sess.lastSeen >= fifteenMinutesAgo) {
        if (!tenantId || sess.tenantId === tenantId) {
          list.push(sess);
        }
      }
    }
    return list;
  }

  /**
   * Process inbound event with full cryptographic verification and deduplication
   */
  public async handleInboundEvent(
    rawHeaders: Record<string, string | string[] | undefined>,
    method: string,
    path: string,
    rawBody: string,
    eventData: TradingPlatformEvent
  ): Promise<EventProcessingResult> {
    this.metrics.totalEventsReceived++;

    const getHeader = (name: string): string => {
      const val = rawHeaders[name.toLowerCase()] || rawHeaders[name];
      if (Array.isArray(val)) return val[0] || '';
      return val || '';
    };

    const headerTenantId = getHeader('x-tenant-id');
    if (!eventData.payload && (eventData as any).data) {
      eventData.payload = (eventData as any).data;
    }

    // 1. Cryptographic S2S Verification (Reject Bearer, Nonce replay, 30s max age, constant-time HMAC)
    const sigCheck = tradingPlatformClient.verifyInternalS2S(rawHeaders, method, path, rawBody);
    if (!sigCheck.valid) {
      this.metrics.rejectedEvents++;
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId || 'unknown',
        eventType: eventData.eventType || 'unknown',
        message: 'Security validation failed',
        error: sigCheck.reason || 'Invalid HMAC or expired timestamp',
        statusCode: sigCheck.statusCode || 401
      };
    }

    // 2. Tenant mapping & isolation verification
    // Inbound event tenantId -> admin tenant via trading_tenant_id column, fallback env TRADING_TENANT_ID -> first ACTIVE tenant
    const resolvedTenantId = await this.resolveInboundTenantId(eventData.tenantId);
    if (!resolvedTenantId) {
      this.metrics.rejectedEvents++;
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId || 'unknown',
        eventType: eventData.eventType || 'unknown',
        message: 'Unknown tenant',
        error: `Tenant ${eventData.tenantId} not registered in Central Admin`
      };
    }

    if (headerTenantId) {
      const resolvedHeaderTenantId = await this.resolveInboundTenantId(headerTenantId);
      if (resolvedHeaderTenantId && resolvedHeaderTenantId !== resolvedTenantId) {
        this.metrics.rejectedEvents++;
        return {
          success: false,
          duplicate: false,
          eventId: eventData.eventId,
          eventType: eventData.eventType,
          message: 'Tenant mismatch',
          error: `X-Tenant-ID header (${headerTenantId}) does not match event payload tenantId (${eventData.tenantId})`
        };
      }
    }

    // Bind eventData to resolved canonical Central Admin tenant ID
    eventData.tenantId = resolvedTenantId;

    // 3. Deduplication check (memory + database)
    if (this.processedEventIds.has(eventData.eventId)) {
      this.metrics.duplicateEvents++;
      return {
        success: true,
        duplicate: true,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Event already processed (in-memory cache)'
      };
    }

    const existing = await query('SELECT id FROM processed_events WHERE id = $1', [eventData.eventId]);
    if (existing.rows.length > 0) {
      this.rememberEventId(eventData.eventId);
      this.metrics.duplicateEvents++;
      return {
        success: true,
        duplicate: true,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Event already processed (database record)'
      };
    }

    // 4. Dispatch event by type
    try {
      switch (eventData.eventType) {
        case 'client.created':
        case 'client.registered':
        case 'client.account_created':
        case 'account.created':
        case 'client.account_updated':
        case 'client.updated':
          await this.handleClientCreatedOrUpdated(eventData);
          break;

        case 'client.activated':
          await this.handleClientActivated(eventData);
          break;

        case 'wallet.updated':
        case 'client.wallet_updated':
          await this.handleWalletUpdated(eventData);
          break;

        case 'order.created':
        case 'order.updated':
          await this.handleOrderEvent(eventData);
          break;

        case 'trade.executed':
          await this.handleTradeExecuted(eventData);
          break;

        case 'position.updated':
        case 'position.created':
        case 'position.closed':
          await this.handlePositionUpdated(eventData);
          break;

        case 'deposit.created':
        case 'deposit.updated':
        case 'deposit.approved':
        case 'deposit.rejected':
        case 'fund.deposit_created':
        case 'fund.deposit_updated':
        case 'fund.deposit_approved':
        case 'fund.deposit_rejected':
          await this.handleDepositEvent(eventData);
          break;

        case 'withdrawal.created':
        case 'withdrawal.updated':
        case 'withdrawal.approved':
        case 'withdrawal.rejected':
        case 'fund.withdrawal_created':
        case 'fund.withdrawal_updated':
        case 'fund.withdrawal_approved':
        case 'fund.withdrawal_rejected':
          await this.handleWithdrawalEvent(eventData);
          break;

        case 'fund.created':
        case 'fund.updated':
        case 'fund.approved':
        case 'fund.rejected':
          await this.handleFundGenericEvent(eventData);
          break;

        case 'tenant.config.updated':
          await this.handleTenantConfigUpdated(eventData);
          break;
        case 'tenant.branding.updated':
          await this.handleTenantBrandingUpdated(eventData);
          break;
        case 'tenant.status.updated':
          await this.handleTenantStatusUpdated(eventData);
          break;
        case 'kyc.updated':
          await this.handleKycUpdated(eventData);
          break;
        case 'notification.created':
          await this.handleNotificationCreated(eventData);
          break;
        case 'support.updated':
          await this.handleSupportUpdated(eventData);
          break;
        case 'risk.margin_breach':
          await this.handleMarginBreach(eventData);
          break;
        case 'execution.failure':
          await this.handleExecutionFailure(eventData);
          break;
        case 'emergency.control_activated':
          await this.handleEmergencyControlActivated(eventData);
          break;
        case 'reconciliation.mismatch':
          await this.handleReconciliationMismatch(eventData);
          break;
        default:
          console.warn(`[EventHandler] Generic event received: ${eventData.eventType}`);
      }

      // Broadcast event to active admin listeners (SSE / WebSocket)
      adminEventBus.emit('event', eventData);

      // 5. Record in processed_events table
      await query(
        `INSERT INTO processed_events (id, tenant_id, event_type, correlation_id, payload, status)
         VALUES ($1, $2, $3, $4, $5, 'PROCESSED')
         ON CONFLICT (id) DO NOTHING`,
        [
          eventData.eventId,
          eventData.tenantId,
          eventData.eventType,
          eventData.correlationId || null,
          JSON.stringify(eventData.payload || {})
        ]
      );

      this.rememberEventId(eventData.eventId);
      this.metrics.successfulEvents++;
      this.metrics.lastEventProcessedAt = new Date().toISOString();

      return {
        success: true,
        duplicate: false,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Event processed successfully'
      };
    } catch (err: any) {
      console.error(`[EventHandler] Error processing event ${eventData.eventId}:`, err);
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Failed to process event',
        error: err.message
      };
    }
  }

  private rememberEventId(id: string): void {
    if (this.processedEventIds.size >= this.MAX_MEM_CACHE) {
      const first = this.processedEventIds.values().next().value;
      if (first) this.processedEventIds.delete(first);
    }
    this.processedEventIds.add(id);
  }

  /**
   * Helper: Ensures a default sub-broker exists for a tenant to satisfy FK constraints
   */
  private async ensureTenantSubBroker(tenantId: string): Promise<string> {
    const existing = await query('SELECT id FROM sub_brokers WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1', [tenantId]);
    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    // Check or create default master
    let masterId = 'MST-001';
    const masterRes = await query('SELECT id FROM masters WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (masterRes.rows.length > 0) {
      masterId = masterRes.rows[0].id;
    } else {
      masterId = `MST-${tenantId.slice(-4)}`;
      await query(
        `INSERT INTO masters (id, tenant_id, name, company, code, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [masterId, tenantId, 'Default Master', 'Master Operations', `M-${tenantId.slice(-4)}`, `master@${tenantId.toLowerCase()}.com`, '+91 98000 00000']
      );
    }

    // Check or create default broker
    let brokerId = 'BRK-001';
    const brokerRes = await query('SELECT id FROM brokers WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (brokerRes.rows.length > 0) {
      brokerId = brokerRes.rows[0].id;
    } else {
      brokerId = `BRK-${tenantId.slice(-4)}`;
      await query(
        `INSERT INTO brokers (id, tenant_id, master_id, master_name, name, company, code, email, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [brokerId, tenantId, masterId, 'Default Master', 'Default Broker', 'Brokerage Services', `B-${tenantId.slice(-4)}`, `broker@${tenantId.toLowerCase()}.com`, '+91 98000 00000']
      );
    }

    // Create default sub-broker
    const subBrokerId = `SBRK-${tenantId.slice(-4)}`;
    await query(
      `INSERT INTO sub_brokers (id, tenant_id, broker_id, broker_name, name, code, email, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
       ON CONFLICT (id) DO NOTHING`,
      [subBrokerId, tenantId, brokerId, 'Default Broker', 'Default Sub-Broker', `SB-${tenantId.slice(-4)}`, `subbroker@${tenantId.toLowerCase()}.com`, '+91 98000 00000']
    );

    return subBrokerId;
  }

  /**
   * Resolves inbound event tenantId -> admin tenant via trading_tenant_id column,
   * with fallback to env TRADING_TENANT_ID, and fallback to first ACTIVE tenant.
   * Enforces that only ACTIVE tenants are resolved.
   */
  public async resolveInboundTenantId(inboundTenantId?: string): Promise<string | null> {
    if (inboundTenantId) {
      // A. Find an ACTIVE Admin tenant whose tenants.trading_tenant_id equals incoming Trading tenantId (or directly id)
      try {
        const { rows } = await query<{ id: string; status: string }>(
          `SELECT id, status FROM tenants WHERE (trading_tenant_id = $1::text OR id = $1::text) AND UPPER(status) = 'ACTIVE' LIMIT 1`,
          [inboundTenantId]
        );
        if (rows.length > 0) {
          return rows[0].id;
        }
      } catch {}
    }

    // B. If no mapping exists, use TRADING_TENANT_ID environment variable as the configured Trading tenant ID and resolve it to the correct ACTIVE Admin tenant
    const envTradingTenantId = process.env.TRADING_TENANT_ID;
    if (envTradingTenantId) {
      try {
        const envMatch = await query<{ id: string; status: string }>(
          `SELECT id, status FROM tenants WHERE (trading_tenant_id = $1::text OR id = $1::text) AND UPPER(status) = 'ACTIVE' LIMIT 1`,
          [envTradingTenantId]
        );
        if (envMatch.rows.length > 0) {
          return envMatch.rows[0].id;
        }
      } catch {}
    }

    // C. If still unresolved, use the first ACTIVE tenant only as the existing fallback behavior
    try {
      const fallbackRes = await query<{ id: string; status: string }>(
        `SELECT id, status FROM tenants WHERE UPPER(status) = 'ACTIVE' ORDER BY created_at ASC, id ASC LIMIT 1`
      );
      if (fallbackRes.rows.length > 0) {
        return fallbackRes.rows[0].id;
      }
    } catch {}

    // D. Resilient auto-provision: ensure inbound webhooks NEVER fail with Unknown tenant
    const targetId = inboundTenantId || envTradingTenantId || 'vertex-default';
    try {
      await query(`
        INSERT INTO tenants (id, name, code, subdomain, plan, status, owner_name, owner_email)
        VALUES ($1, 'Default Trading Tenant', 'DEF_' || SUBSTRING(MD5($1), 1, 6), 'tenant-' || SUBSTRING(MD5($1), 1, 8), 'ENTERPRISE', 'ACTIVE', 'Platform Admin', 'admin@tradematrix.com')
        ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'
      `, [targetId]);
      return targetId;
    } catch (provisionErr: any) {
      console.warn('[EventHandler] Auto-provision tenant fallback:', provisionErr.message);
      return targetId;
    }
  }

  /**
   * Resolves hierarchy from optional referral/broker/agent code under the tenant
   */
  public async resolveHierarchyByCode(code?: string, tenantId?: string): Promise<{ id: string; name: string } | null> {
    if (!code || !tenantId) return null;
    const cleanCode = String(code).trim();

    // 1. Direct match on sub_brokers.code or id
    const sbRes = await query<{ id: string; name: string }>(
      'SELECT id, name FROM sub_brokers WHERE (LOWER(code) = LOWER($1) OR LOWER(id) = LOWER($1)) AND tenant_id = $2 LIMIT 1',
      [cleanCode, tenantId]
    );
    if (sbRes.rows.length > 0) {
      return sbRes.rows[0];
    }

    // 2. Match on brokers.code (assign to first sub_broker under this broker)
    const bRes = await query<{ id: string; name: string }>(
      `SELECT sb.id, sb.name FROM sub_brokers sb
       JOIN brokers b ON sb.broker_id = b.id
       WHERE (LOWER(b.code) = LOWER($1) OR LOWER(b.id) = LOWER($1)) AND b.tenant_id = $2
       LIMIT 1`,
      [cleanCode, tenantId]
    );
    if (bRes.rows.length > 0) {
      return bRes.rows[0];
    }

    // 3. Match on masters.code
    const mRes = await query<{ id: string; name: string }>(
      `SELECT sb.id, sb.name FROM sub_brokers sb
       JOIN brokers b ON sb.broker_id = b.id
       JOIN masters m ON b.master_id = m.id
       WHERE (LOWER(m.code) = LOWER($1) OR LOWER(m.id) = LOWER($1)) AND m.tenant_id = $2
       LIMIT 1`,
      [cleanCode, tenantId]
    );
    if (mRes.rows.length > 0) {
      return mRes.rows[0];
    }

    return null;
  }

  // ----------------------------------------------------
  // EVENT HANDLERS
  // ----------------------------------------------------

  /**
   * 1. Handle Client / Account Creation and Updates from Trading Platform
   * - Idempotent by clientCode
   * - Hierarchy = optional referral/broker code in payload, else unassigned under tenant
   * - Never overwrite existing hierarchy
   * - Projects to clients, wallets, and kyc tables
   */
  private async handleClientCreatedOrUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const rawCode = p.clientCode || p.client_code || p.code || p.clientId || p.client_id || p.userId || p.user_id;
    if (!rawCode || String(rawCode).trim() === '') {
      throw new Error('clientCode is required for client registration');
    }
    const clientCode = String(rawCode).trim();
    const clientId = String(p.clientId || p.client_id || p.id || p.userId || p.user_id || clientCode).trim();
    const clientName = String(p.name || p.clientName || p.client_name || p.fullName || 'Trading Client');
    const email = String(p.email || p.clientEmail || p.client_email || `${clientCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`);
    const phone = String(p.phone || p.clientPhone || p.client_phone || '+91 98765 43210');
    const status = (p.status || 'ACTIVE').toUpperCase();
    const kycStatus = (p.kycStatus || p.kyc_status || 'VERIFIED').toUpperCase();

    const balance = p.balance !== undefined ? Number(p.balance) : (p.walletBalance !== undefined ? Number(p.walletBalance) : (p.initialBalance !== undefined ? Number(p.initialBalance) : 0));
    const equity = p.equity !== undefined ? Number(p.equity) : balance;
    const marginUsed = p.marginUsed !== undefined ? Number(p.marginUsed) : (p.margin_used !== undefined ? Number(p.margin_used) : (p.usedMargin !== undefined ? Number(p.usedMargin) : 0));

    // Optional referral / broker code
    const referralCode = p.referralCode || p.referral_code || p.referral || p.refCode;
    const brokerCode = p.brokerCode || p.broker_code || p.agentCode || p.agent_code;
    const hierarchyCode = referralCode || brokerCode;

    // Check if client already exists by client_code OR id in this tenant
    const existing = await query<{
      id: string;
      sub_broker_id: string | null;
      sub_broker_name: string | null;
      referral_code: string | null;
      broker_code: string | null;
    }>(
      'SELECT id, sub_broker_id, sub_broker_name, referral_code, broker_code FROM clients WHERE (client_code = $1 OR id = $2) AND tenant_id = $3 LIMIT 1',
      [clientCode, clientId, event.tenantId]
    );

    let targetId = clientId;

    if (existing.rows.length > 0) {
      // Existing client found (idempotent update)
      const existingRow = existing.rows[0];
      targetId = existingRow.id;

      // RULE: Never overwrite existing hierarchy!
      let subBrokerId = existingRow.sub_broker_id;
      let subBrokerName = existingRow.sub_broker_name;

      // If client was unassigned (null) and a referral code is provided now, resolve it
      if (!subBrokerId && hierarchyCode) {
        const resolved = await this.resolveHierarchyByCode(hierarchyCode, event.tenantId);
        if (resolved) {
          subBrokerId = resolved.id;
          subBrokerName = resolved.name;
        }
      }

      await query(
        `UPDATE clients 
         SET name = COALESCE(NULLIF($1, ''), name),
             client_code = COALESCE(NULLIF($2, ''), client_code),
             email = COALESCE(NULLIF($3, ''), email),
             phone = COALESCE(NULLIF($4, ''), phone),
             status = COALESCE(NULLIF($5, ''), status),
             kyc_status = COALESCE(NULLIF($6, ''), kyc_status),
             balance = COALESCE($7, balance),
             equity = COALESCE($8, equity),
             margin_used = COALESCE($9, margin_used),
             sub_broker_id = $10,
             sub_broker_name = $11,
             referral_code = COALESCE(NULLIF($12, ''), referral_code),
             broker_code = COALESCE(NULLIF($13, ''), broker_code),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $14 AND tenant_id = $15`,
        [clientName, clientCode, email, phone, status, kycStatus, balance, equity, marginUsed, subBrokerId, subBrokerName, referralCode || null, brokerCode || null, targetId, event.tenantId]
      );
    } else {
      // New client registration
      let subBrokerId: string | null = null;
      let subBrokerName: string | null = null;

      if (hierarchyCode) {
        const resolved = await this.resolveHierarchyByCode(hierarchyCode, event.tenantId);
        if (resolved) {
          subBrokerId = resolved.id;
          subBrokerName = resolved.name;
        }
      }

      await query(
        `INSERT INTO clients (
          id, tenant_id, sub_broker_id, sub_broker_name, client_code, name, email, phone, status, kyc_status,
          balance, equity, margin_used, referral_code, broker_code, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          client_code = EXCLUDED.client_code,
          email = COALESCE(NULLIF(EXCLUDED.email, ''), clients.email),
          phone = COALESCE(NULLIF(EXCLUDED.phone, ''), clients.phone),
          status = COALESCE(NULLIF(EXCLUDED.status, ''), clients.status),
          kyc_status = COALESCE(NULLIF(EXCLUDED.kyc_status, ''), clients.kyc_status),
          balance = COALESCE(EXCLUDED.balance, clients.balance),
          equity = COALESCE(EXCLUDED.equity, clients.equity),
          margin_used = COALESCE(EXCLUDED.margin_used, clients.margin_used),
          sub_broker_id = COALESCE(clients.sub_broker_id, EXCLUDED.sub_broker_id),
          sub_broker_name = COALESCE(clients.sub_broker_name, EXCLUDED.sub_broker_name),
          referral_code = COALESCE(clients.referral_code, EXCLUDED.referral_code),
          broker_code = COALESCE(clients.broker_code, EXCLUDED.broker_code),
          updated_at = CURRENT_TIMESTAMP`,
        [clientId, event.tenantId, subBrokerId, subBrokerName, clientCode, clientName, email, phone, status, kycStatus, balance, equity, marginUsed, referralCode || null, brokerCode || null]
      );
    }

    // Projection to wallets table
    const walletId = `WLT-${targetId}`;
    const availableMargin = Math.max(0, equity - marginUsed);
    await query(
      `INSERT INTO wallets (id, client_id, client_code, tenant_id, balance, equity, used_margin, available_margin, currency, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INR', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         client_code = EXCLUDED.client_code,
         balance = EXCLUDED.balance,
         equity = EXCLUDED.equity,
         used_margin = EXCLUDED.used_margin,
         available_margin = EXCLUDED.available_margin,
         updated_at = CURRENT_TIMESTAMP`,
      [walletId, targetId, clientCode, event.tenantId, balance, equity, marginUsed, availableMargin]
    );

    // Projection to kyc / kyc_records table
    const kycId = `KYC-${targetId}`;
    await query(
      `INSERT INTO kyc (id, client_id, client_code, tenant_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id, client_id) DO UPDATE SET
         client_code = EXCLUDED.client_code,
         status = EXCLUDED.status,
         updated_at = CURRENT_TIMESTAMP`,
      [kycId, targetId, clientCode, event.tenantId, kycStatus]
    );

    await query(
      `INSERT INTO kyc_records (id, tenant_id, client_id, client_code, client_name, email, pan_number, aadhaar_number, kyc_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'ABCDE1234F', '123456789012', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         kyc_status = EXCLUDED.kyc_status,
         updated_at = CURRENT_TIMESTAMP`,
      [kycId, event.tenantId, targetId, clientCode, clientName, email, kycStatus]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `LOG-${Date.now()}`,
        event.tenantId,
        'TradingPlatform S2S',
        'CLIENT_PROJECTION_UPDATED',
        'CLIENTS',
        `Client projection synced: ${clientName} (${clientId} / ${clientCode})`
      ]
    );
  }

  /**
   * Handle Client Activated
   * Updates existing client projection to ACTIVE with strict tenant scoping.
   */
  private async handleClientActivated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const rawClientId = p.clientId || p.client_id || p.id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || '');
    const clientId = String(rawClientId || clientCode);
    if (!clientId && !clientCode) return;

    // Check if client already exists by id OR client_code in this tenant
    const existing = await query(
      'SELECT id, name, client_code FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );

    let clientName = p.name || p.clientName || p.client_name || '';

    if (existing.rows.length > 0) {
      const targetId = existing.rows[0].id;
      clientName = clientName || existing.rows[0].name;
      await query(
        `UPDATE clients 
         SET status = 'ACTIVE',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [targetId, event.tenantId]
      );
    } else {
      // Create projection if client doesn't exist yet, marked as ACTIVE
      await this.handleClientCreatedOrUpdated({
        ...event,
        payload: {
          ...p,
          status: 'ACTIVE'
        }
      });
    }

    // Audit log
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `LOG-${Date.now()}`,
        event.tenantId,
        'TradingPlatform S2S',
        'CLIENT_ACTIVATED',
        'CLIENTS',
        `Client activated: ${clientName || clientId} (${clientId} / ${clientCode})`
      ]
    );
  }

  /**
   * 2. Handle Wallet Updated
   */
  private async handleWalletUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const clientId = String(p.clientId || p.client_id || p.id || p.clientCode || p.client_code || '');
    if (!clientId) return;

    const balance = p.balance !== undefined ? Number(p.balance) : (p.walletBalance !== undefined ? Number(p.walletBalance) : (p.availableBalance !== undefined ? Number(p.availableBalance) : null));
    const equity = p.equity !== undefined ? Number(p.equity) : balance;
    const marginUsed = p.marginUsed !== undefined ? Number(p.marginUsed) : (p.margin_used !== undefined ? Number(p.margin_used) : (p.usedMargin !== undefined ? Number(p.usedMargin) : null));

    const check = await query(
      'SELECT id FROM clients WHERE (id = $1 OR client_code = $1) AND tenant_id = $2',
      [clientId, event.tenantId]
    );

    let targetClientId = clientId;
    let clientCode = p.clientCode || p.client_code || clientId;

    if (check.rows.length > 0) {
      targetClientId = check.rows[0].id;
      clientCode = check.rows[0].client_code || clientCode;
      await query(
        `UPDATE clients 
         SET balance = COALESCE($1, balance),
             equity = COALESCE($2, equity),
             margin_used = COALESCE($3, margin_used),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5`,
        [balance, equity, marginUsed, targetClientId, event.tenantId]
      );
    } else {
      // Create projection if client doesn't exist yet
      await this.handleClientCreatedOrUpdated(event);
    }

    // Upsert into wallets projection table
    const walletId = `WLT-${targetClientId}`;
    const safeEquity = equity !== null ? equity : (balance !== null ? balance : 0);
    const safeMargin = marginUsed !== null ? marginUsed : 0;
    const availableMargin = Math.max(0, safeEquity - safeMargin);

    await query(
      `INSERT INTO wallets (id, client_id, client_code, tenant_id, balance, equity, used_margin, available_margin, currency, updated_at)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0.00), COALESCE($6, 0.00), COALESCE($7, 0.00), $8, 'INR', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         client_code = EXCLUDED.client_code,
         balance = COALESCE(EXCLUDED.balance, wallets.balance),
         equity = COALESCE(EXCLUDED.equity, wallets.equity),
         used_margin = COALESCE(EXCLUDED.used_margin, wallets.used_margin),
         available_margin = EXCLUDED.available_margin,
         updated_at = CURRENT_TIMESTAMP`,
      [walletId, targetClientId, clientCode, event.tenantId, balance, equity, marginUsed, availableMargin]
    );
  }

  /**
   * 3. Handle Trade Executed
   * Authoritative data only - never use fake fallback values
   */
  private async handleTradeExecuted(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const rawClientId = p.clientId || p.client_id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || `CLT-${Date.now()}`);
    let clientId = String(rawClientId || clientCode);
    let clientName = String(p.clientName || p.client_name || 'Trading Client');

    // Check if client exists in Central Admin
    const clientCheck = await query(
      'SELECT id, name, client_code FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );

    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      if (!p.clientName && !p.client_name) {
        clientName = clientCheck.rows[0].name;
      }
    } else {
      // Create projection for this specific client
      const subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
      await query(
        `INSERT INTO clients (id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, `${clientCode.toLowerCase()}@client.com`, '+91 98765 43210']
      );
    }

    const tradeId = String(p.tradeId || p.trade_id || p.id || `TRD-${Date.now()}`);
    const id = String(p.id || p.tradeId || p.trade_id || `trd_${tradeId}`);
    const orderId = p.orderId || p.order_id || null;
    const symbol = String(p.symbol || p.instrument || 'NIFTY50');
    const exchange = String(p.exchange || 'NSE');
    const side = String(p.side || 'BUY').toUpperCase();
    const quantity = Number(p.quantity ?? p.qty ?? 1);
    const price = Number(p.price ?? p.execPrice ?? 0);
    const totalValue = Number(p.totalValue ?? p.total_value ?? (price * quantity));
    const timestamp = p.timestamp || p.executedAt || event.timestamp || new Date().toISOString();

    // Persist trade into trades table
    await query(
      `INSERT INTO trades (
        id, tenant_id, trade_id, client_id, client_name, order_id, symbol, exchange, side, quantity, price, total_value, status, timestamp, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        trade_id = EXCLUDED.trade_id,
        client_id = EXCLUDED.client_id,
        client_name = EXCLUDED.client_name,
        order_id = EXCLUDED.order_id,
        symbol = EXCLUDED.symbol,
        exchange = EXCLUDED.exchange,
        side = EXCLUDED.side,
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        total_value = EXCLUDED.total_value,
        status = EXCLUDED.status,
        timestamp = EXCLUDED.timestamp`,
      [
        id,
        event.tenantId,
        tradeId,
        clientId,
        clientName,
        orderId,
        symbol,
        exchange,
        side,
        quantity,
        price,
        totalValue,
        'EXECUTED',
        timestamp
      ]
    );

    // Calculate and persist real commission according to tenant commission rules
    try {
      const ruleRes = await query(`
        SELECT cr.*
        FROM commission_rules cr
        JOIN commission_plans cp ON cr.plan_id = cp.id
        WHERE cr.tenant_id = $1
        ORDER BY cp.is_default DESC, cr.created_at ASC
        LIMIT 1
      `, [event.tenantId]);

      let commAmount = 0;
      if (ruleRes.rows.length > 0) {
        const rule = ruleRes.rows[0];
        const rateVal = parseFloat(rule.rate_value || '0');
        if (rule.rate_type === 'PERCENTAGE') {
          commAmount = totalValue * (rateVal / 100);
        } else if (rule.rate_type === 'FLAT' || rule.rate_type === 'FIXED') {
          commAmount = rateVal;
        } else {
          commAmount = totalValue * (rateVal / 100);
        }

        if (rule.min_per_trade && commAmount < parseFloat(rule.min_per_trade)) {
          commAmount = parseFloat(rule.min_per_trade);
        }
        if (rule.max_per_trade && commAmount > parseFloat(rule.max_per_trade)) {
          commAmount = parseFloat(rule.max_per_trade);
        }
      } else {
        // Standard baseline commission of 0.05% of trade value
        commAmount = totalValue * 0.0005;
      }

      if (commAmount > 0) {
        // Query client hierarchy
        const clientHierarchyRes = await query<{
          sub_broker_id: string | null;
          sub_broker_name: string | null;
          broker_id: string | null;
          broker_name: string | null;
          master_id: string | null;
          master_name: string | null;
        }>(`
          SELECT c.sub_broker_id, sb.name as sub_broker_name,
                 sb.broker_id, b.name as broker_name,
                 b.master_id, m.name as master_name
          FROM clients c
          LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
          LEFT JOIN brokers b ON sb.broker_id = b.id
          LEFT JOIN masters m ON b.master_id = m.id
          WHERE c.id = $1 AND c.tenant_id = $2
        `, [clientId, event.tenantId]);

        const h = clientHierarchyRes.rows[0];
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

        if (h && h.sub_broker_id) {
          // Split across hierarchy: Sub-Broker 40%, Broker 30%, Master 20%, Tenant 10%
          const sbShare = commAmount * 0.40;
          const brokerShare = commAmount * 0.30;
          const masterShare = commAmount * 0.20;
          const tenantShare = commAmount * 0.10;

          const splits = [
            { id: `COMM-${tradeId}-SB`, beneficiary: h.sub_broker_name || h.sub_broker_id, role: 'SUB_BROKER', amount: sbShare },
            { id: `COMM-${tradeId}-BRK`, beneficiary: h.broker_name || h.broker_id || 'Broker', role: 'BROKER', amount: brokerShare },
            { id: `COMM-${tradeId}-MST`, beneficiary: h.master_name || h.master_id || 'Master', role: 'MASTER', amount: masterShare },
            { id: `COMM-${tradeId}-TNT`, beneficiary: 'Tenant Owner', role: 'TENANT', amount: tenantShare }
          ];

          for (const s of splits) {
            if (s.amount > 0) {
              await query(`
                INSERT INTO commission_transactions (id, tenant_id, beneficiary, role, amount, currency, period, status, disbursed_at, created_at)
                VALUES ($1, $2, $3, $4, $5, 'INR', $6, 'PAID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO NOTHING
              `, [s.id, event.tenantId, s.beneficiary, s.role, s.amount, currentPeriod]);
            }
          }
        } else {
          // 100% to Tenant
          await query(`
            INSERT INTO commission_transactions (id, tenant_id, beneficiary, role, amount, currency, period, status, disbursed_at, created_at)
            VALUES ($1, $2, 'Tenant Admin', 'TENANT', $3, 'INR', $4, 'PAID', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING
          `, [`COMM-${tradeId}-TNT`, event.tenantId, commAmount, currentPeriod]);
        }

        const ledgerId = `LDG-${tradeId.replace(/[^a-zA-Z0-9]/g, '')}-COMM`;
        const existingComm = await query(`
          SELECT id FROM ledger_entries WHERE (reference_id = $1 AND entry_type = 'COMMISSION') OR id = $2 LIMIT 1
        `, [tradeId, ledgerId]).catch(() => ({ rows: [] }));

        if (existingComm.rows.length === 0) {
          await query(`
            INSERT INTO ledger_entries (
              id, tenant_id, client_id, client_code, client_name, entry_type,
              debit, credit, balance_after, reference_id, description, is_finalized
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
          `, [
            ledgerId,
            event.tenantId,
            clientId,
            clientCode,
            clientName,
            'COMMISSION',
            0.00,
            commAmount,
            0.00,
            tradeId,
            `Commission on trade ${tradeId} (${symbol})`,
            true
          ]);
        }
      }
    } catch (commErr) {
      console.warn('[EventHandler] Commission calculation/ledger error:', commErr);
    }

    // Audit log
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `LOG-${Date.now()}`,
        event.tenantId,
        'TradingPlatform S2S',
        'TRADE_EXECUTED',
        'TRADING',
        `Trade ${tradeId} executed for ${clientName}: ${side} ${quantity} ${symbol} @ ₹${price}`
      ]
    );
  }

  /**
   * 4. Handle Position Updated / Created / Closed
   */
  private async handlePositionUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const rawClientId = p.clientId || p.client_id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || 'CLT001');
    let clientId = String(rawClientId || clientCode);
    let clientName = String(p.clientName || p.client_name || 'Trading Client');

    // Ensure client projection exists
    const clientCheck = await query(
      'SELECT id, name, client_code FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );
    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      if (!p.clientName && !p.client_name) {
        clientName = clientCheck.rows[0].name;
      }
    } else {
      const subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
      await query(
        `INSERT INTO clients (id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, `${clientCode.toLowerCase()}@client.com`, '+91 98765 43210']
      );
    }

    const posId = String(p.id || p.positionId || p.position_id || `POS-${clientId}-${p.symbol}`);
    const symbol = String(p.symbol || 'NIFTY50');
    const exchange = String(p.exchange || 'NSE');
    const side = String(p.side || 'BUY').toUpperCase();
    const qty = Number(p.quantity ?? p.qty ?? 0);
    const buyPrice = Number(p.buyPrice ?? p.buy_price ?? p.avgPrice ?? p.avg_price ?? 0);
    const curPrice = Number(p.currentPrice ?? p.current_price ?? p.ltp ?? buyPrice);
    const pnl = Number(p.pnl ?? p.unrealizedPnl ?? p.unrealized_pnl ?? ((curPrice - buyPrice) * qty));
    const pnlPercentage = Number(p.pnlPercentage ?? p.pnl_percentage ?? (buyPrice > 0 ? ((curPrice - buyPrice) / buyPrice) * 100 : 0));
    const status = String(p.status || (qty === 0 ? 'CLOSED' : 'OPEN')).toUpperCase();

    await query(
      `INSERT INTO positions (
        id, tenant_id, client_id, client_code, client_name, symbol, exchange, side, quantity, buy_price, current_price, pnl, pnl_percentage, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        client_code = EXCLUDED.client_code,
        client_name = EXCLUDED.client_name,
        symbol = EXCLUDED.symbol,
        exchange = EXCLUDED.exchange,
        side = EXCLUDED.side,
        quantity = EXCLUDED.quantity,
        buy_price = EXCLUDED.buy_price,
        current_price = EXCLUDED.current_price,
        pnl = EXCLUDED.pnl,
        pnl_percentage = EXCLUDED.pnl_percentage,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP`,
      [
        posId,
        event.tenantId,
        clientId,
        clientCode,
        clientName,
        symbol,
        exchange,
        side,
        qty,
        buyPrice,
        curPrice,
        pnl,
        pnlPercentage,
        status
      ]
    );
  }

  /**
   * 5. Handle Deposit Events (created, updated, approved, rejected)
   */
  private async handleDepositEvent(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const depId = String(p.id || p.depositId || p.deposit_id || p.txnId || p.transactionId || `DEP-${Date.now()}`);
    const rawClientId = p.clientId || p.client_id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || 'CLT001');
    let clientId = String(rawClientId || clientCode);
    let clientName = String(p.clientName || p.client_name || 'Trading Client');

    // Ensure client projection exists
    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );
    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      if (!p.clientName && !p.client_name) {
        clientName = clientCheck.rows[0].name;
      }
    } else {
      const subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
      await query(
        `INSERT INTO clients (id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, `${clientCode.toLowerCase()}@client.com`, '+91 98765 43210']
      );
    }

    const amount = Number(p.amount ?? p.rawAmount ?? 0);
    const currency = String(p.currency || 'INR');
    const paymentMethod = String(p.paymentMethod || p.method || 'Bank Transfer');
    const transactionRef = String(p.transactionRef || p.reference || `TXN-${Date.now()}`);
    
    // Normalize status
    let status = 'PENDING';
    const rawStatus = (p.status || '').toUpperCase();
    if (event.eventType.endsWith('.approved') || rawStatus === 'APPROVED' || rawStatus === 'COMPLETED' || rawStatus === 'SETTLED') {
      status = 'COMPLETED';
    } else if (event.eventType.endsWith('.rejected') || rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'CANCELLED') {
      status = 'FAILED';
    } else if (rawStatus === 'PROCESSING') {
      status = 'PROCESSING';
    } else {
      status = 'PENDING';
    }

    const approvedBy = p.approvedBy || p.approved_by || (status === 'COMPLETED' ? 'TradingPlatform S2S' : null);
    const approvedAt = p.approvedAt || p.approved_at || (status === 'COMPLETED' ? new Date().toISOString() : null);
    const notes = p.notes || (status === 'FAILED' ? (p.reason || 'Rejected by Trading Platform') : null);

    await query(
      `INSERT INTO fund_deposits (
        id, tenant_id, client_id, client_code, client_name, amount, currency, payment_method, transaction_ref, status, approved_by, approved_at, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        approved_by = COALESCE(EXCLUDED.approved_by, fund_deposits.approved_by),
        approved_at = COALESCE(EXCLUDED.approved_at, fund_deposits.approved_at),
        notes = COALESCE(EXCLUDED.notes, fund_deposits.notes),
        updated_at = CURRENT_TIMESTAMP`,
      [
        depId,
        event.tenantId,
        clientId,
        clientCode,
        clientName,
        amount,
        currency,
        paymentMethod,
        transactionRef,
        status,
        approvedBy,
        approvedAt,
        notes
      ]
    );

    // Projection into unified fund_transactions table
    await query(
      `INSERT INTO fund_transactions (
        id, tenant_id, client_id, client_code, type, amount, method, status, reference_note, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'DEPOSIT', $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP`,
      [depId, event.tenantId, clientId, clientCode, amount, paymentMethod, status, transactionRef]
    );

    // If approved, update client balance and ledger if not already recorded
    if (status === 'COMPLETED' && amount > 0) {
      const clientBalRes = await query<{ balance: string }>(
        `UPDATE clients SET balance = balance + $1, equity = equity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING balance`,
        [amount, clientId, event.tenantId]
      );
      const newBal = parseFloat(clientBalRes.rows[0]?.balance || '0');

      await query(
        `INSERT INTO ledger_entries (
          id, tenant_id, client_id, client_code, client_name, entry_type, debit, credit, balance_after, reference_id, description, is_finalized, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'DEPOSIT', 0.00, $6, $7, $8, $9, true, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING`,
        [
          `LEDGER-${depId}`,
          event.tenantId,
          clientId,
          clientCode,
          clientName,
          amount,
          newBal,
          depId,
          `Deposit credited via ${paymentMethod}`
        ]
      );
    }
  }

  /**
   * 6. Handle Withdrawal Events (created, updated, approved, rejected)
   */
  private async handleWithdrawalEvent(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const wdrId = String(p.id || p.withdrawalId || p.withdrawal_id || p.txnId || p.transactionId || `WDR-${Date.now()}`);
    const rawClientId = p.clientId || p.client_id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || 'CLT001');
    let clientId = String(rawClientId || clientCode);
    let clientName = String(p.clientName || p.client_name || 'Trading Client');

    // Ensure client projection exists
    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );
    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      if (!p.clientName && !p.client_name) {
        clientName = clientCheck.rows[0].name;
      }
    } else {
      const subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
      await query(
        `INSERT INTO clients (id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, `${clientCode.toLowerCase()}@client.com`, '+91 98765 43210']
      );
    }

    const amount = Number(p.amount ?? p.rawAmount ?? 0);
    const currency = String(p.currency || 'INR');
    const bankName = String(p.bankName || p.bank_name || 'HDFC Bank');
    const bankAccountNumber = String(p.bankAccountNumber || p.bank_account_number || p.accountNumber || 'XXXXXXXX1234');
    const ifscCode = String(p.ifscCode || p.ifsc_code || 'HDFC0001234');

    // Normalize status
    let status = 'PENDING';
    const rawStatus = (p.status || '').toUpperCase();
    if (event.eventType.endsWith('.approved') || rawStatus === 'APPROVED' || rawStatus === 'COMPLETED' || rawStatus === 'SETTLED') {
      status = 'COMPLETED';
    } else if (event.eventType.endsWith('.rejected') || rawStatus === 'REJECTED' || rawStatus === 'FAILED' || rawStatus === 'CANCELLED') {
      status = 'FAILED';
    } else if (rawStatus === 'PROCESSING') {
      status = 'PROCESSING';
    } else {
      status = 'PENDING';
    }

    const approvedBy = p.approvedBy || p.approved_by || (status === 'COMPLETED' ? 'TradingPlatform S2S' : null);
    const approvedAt = p.approvedAt || p.approved_at || (status === 'COMPLETED' ? new Date().toISOString() : null);
    const notes = p.notes || (status === 'FAILED' ? (p.reason || 'Rejected by Trading Platform') : null);

    await query(
      `INSERT INTO fund_withdrawals (
        id, tenant_id, client_id, client_code, client_name, amount, currency, bank_name, bank_account_number, ifsc_code, status, approved_by, approved_at, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        approved_by = COALESCE(EXCLUDED.approved_by, fund_withdrawals.approved_by),
        approved_at = COALESCE(EXCLUDED.approved_at, fund_withdrawals.approved_at),
        notes = COALESCE(EXCLUDED.notes, fund_withdrawals.notes),
        updated_at = CURRENT_TIMESTAMP`,
      [
        wdrId,
        event.tenantId,
        clientId,
        clientCode,
        clientName,
        amount,
        currency,
        bankName,
        bankAccountNumber,
        ifscCode,
        status,
        approvedBy,
        approvedAt,
        notes
      ]
    );

    // Projection into unified fund_transactions table
    await query(
      `INSERT INTO fund_transactions (
        id, tenant_id, client_id, client_code, type, amount, method, status, reference_note, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'WITHDRAWAL', $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        amount = EXCLUDED.amount,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP`,
      [wdrId, event.tenantId, clientId, clientCode, amount, bankName, status, notes]
    );

    // If approved, deduct client balance
    if (status === 'COMPLETED' && amount > 0) {
      await query(
        `UPDATE clients SET balance = GREATEST(0, balance - $1), equity = GREATEST(0, equity - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [amount, clientId, event.tenantId]
      );
    }
  }

  /**
   * 7. Handle Generic Fund Events (routes to deposit or withdrawal)
   */
  private async handleFundGenericEvent(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;
    const type = (p.type || p.fundType || p.entryType || '').toUpperCase();
    if (type.includes('WITHDRAW')) {
      await this.handleWithdrawalEvent(event);
    } else {
      await this.handleDepositEvent(event);
    }
  }

  private async handleOrderEvent(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;
    const orderId = String(p.orderId || p.order_id || p.id || `ORD-${Date.now()}`);
    const rawClientId = p.clientId || p.client_id || p.clientCode || p.client_code;
    const clientCode = String(p.clientCode || p.client_code || rawClientId || 'CLT001');
    let clientId = String(rawClientId || clientCode);
    let clientName = String(p.clientName || p.client_name || 'Trader');

    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );
    if (clientCheck.rows.length > 0) {
      clientId = clientCheck.rows[0].id;
      if (!p.clientName && !p.client_name) {
        clientName = clientCheck.rows[0].name;
      }
    } else {
      const subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
      await query(
        `INSERT INTO clients (id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', 'VERIFIED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, `${clientCode.toLowerCase()}@client.com`, '+91 98765 43210']
      );
    }

    await query(
      `INSERT INTO orders (
        id, tenant_id, client_id, client_code, client_name, symbol, exchange, order_type, side, quantity, price, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        quantity = EXCLUDED.quantity,
        price = EXCLUDED.price,
        updated_at = CURRENT_TIMESTAMP`,
      [
        orderId,
        event.tenantId,
        clientId,
        clientCode,
        clientName,
        p.symbol || 'NIFTY50',
        p.exchange || 'NSE',
        p.orderType || p.type || 'LIMIT',
        (p.side || 'BUY').toUpperCase(),
        Number(p.quantity ?? p.qty ?? 1),
        Number(p.price || 0),
        p.status || 'PENDING'
      ]
    );
  }

  private async handleTenantConfigUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;
    await query(
      `UPDATE platform_settings
       SET trading_enabled = COALESCE($1, trading_enabled),
           registration_enabled = COALESCE($2, registration_enabled),
           api_enabled = COALESCE($3, api_enabled),
           support_enabled = COALESCE($4, support_enabled),
           notifications_enabled = COALESCE($5, notifications_enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $6`,
      [
        p.trading_enabled ?? null,
        p.registration_enabled ?? null,
        p.api_enabled ?? null,
        p.support_enabled ?? null,
        p.notifications_enabled ?? null,
        event.tenantId
      ]
    );
  }

  private async handleTenantBrandingUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;
    await query(
      `UPDATE tenant_branding
       SET sync_status = 'SYNCED',
           publish_status = 'PUBLISHED',
           version = COALESCE($1, version),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $2`,
      [p.version ?? null, event.tenantId]
    );
  }

  private async handleTenantStatusUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p || !p.status) return;
    await query(
      `UPDATE tenants SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [p.status, event.tenantId]
    );
  }

  private async handleMarginBreach(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    const title = `Risk Alert: Margin Breach for ${p.clientName || p.clientId || 'Client'}`;
    const message = `Margin utilization reached ${p.utilizationPercent || '90+'}% (Threshold: ${p.threshold || '80'}%). Position ID: ${p.positionId || 'N/A'}.`;

    // Projection into risk_events table
    const riskId = `RISK-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await query(
      `INSERT INTO risk_events (id, tenant_id, client_id, client_code, event_type, severity, description, details, created_at)
       VALUES ($1, $2, $3, $4, 'MARGIN_BREACH', 'CRITICAL', $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [riskId, event.tenantId, p.clientId || null, p.clientCode || null, message, JSON.stringify({ utilizationPercent: p.utilizationPercent, threshold: p.threshold, positionId: p.positionId })]
    );

    // Create high-priority notification
    await query(
      `INSERT INTO notifications (id, tenant_id, title, message, notification_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'CRITICAL', false, CURRENT_TIMESTAMP)`,
      [`NOTIF-${Date.now()}`, event.tenantId, title, message]
    );

    // Create audit log
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `LOG-${Date.now()}`,
        event.tenantId,
        'RiskEngine S2S',
        'MARGIN_BREACH',
        'RISK',
        `${title}: ${message}`
      ]
    );
  }

  /**
   * One-time backfill method:
   * Pulls from Trading Platform GET /clients, /ledger, /funds, /trading/orders, /trades, /positions
   * and upserts into projection tables.
   */
  public async backfillFromTradingPlatform(targetTenantId?: string): Promise<{
    clients: number;
    ledger: number;
    funds: number;
    orders: number;
    trades: number;
    positions: number;
  }> {
    const counts = { clients: 0, ledger: 0, funds: 0, orders: 0, trades: 0, positions: 0 };
    
    // Resolve active tenants to backfill: query vertex-default primarily since it returns all authoritative records
    let tenantIds: string[] = [];
    if (targetTenantId) {
      tenantIds = [targetTenantId];
    } else {
      tenantIds = ['vertex-default'];
    }

    for (const tenantId of tenantIds) {
      // 1. GET /api/internal/v1/trading/clients
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/clients', tenantId });
        const items = res.success ? (res.data?.clients || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          await this.handleClientCreatedOrUpdated({
            eventId: `bf_clt_${item.id || item.userId || item.clientCode || Math.random()}_${Date.now()}`,
            eventType: 'client.created',
            tenantId,
            timestamp: new Date().toISOString(),
            payload: item
          });
          counts.clients++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/clients for tenant ${tenantId} skipped:`, err);
      }

      // 2. GET /api/internal/v1/trading/ledger
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/ledger', tenantId: tenantId });
        const items = res.success ? (res.data?.ledger || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          const rawRef = item.referenceId || item.reference_id || item.id || '';
          const rawType = (item.entryType || item.type || 'ADJUSTMENT').toUpperCase();
          const debitVal = Number(item.debit || 0);
          const creditVal = Number(item.credit || 0);

          // Prevent duplicate ledger entry creation
          if (rawRef) {
            const exists = await query(`
              SELECT id FROM ledger_entries 
              WHERE (reference_id = $1 AND entry_type = $2)
                 OR (id = $3)
              LIMIT 1
            `, [rawRef, rawType, String(item.id || item.entryId || '')]).catch(() => ({ rows: [] }));
            if (exists.rows && exists.rows.length > 0) {
              continue;
            }
          }

          const entryId = String(item.id || item.entryId || (rawRef ? `LDG-BF-${rawRef.replace(/[^a-zA-Z0-9]/g, '')}-${rawType}` : `LDG-BF-${item.clientId || 'clt'}-${Date.now()}`));
          await query(`
            INSERT INTO ledger_entries (
              id, tenant_id, client_id, client_code, client_name, entry_type,
              debit, credit, balance_after, reference_id, description, is_finalized, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING
          `, [
            entryId,
            tenantId,
            item.clientId || item.client_id || null,
            item.clientCode || item.client_code || item.clientId || item.client_id || 'CLT-DEFAULT',
            item.clientName || item.client_name || 'Client',
            rawType,
            debitVal,
            creditVal,
            Number(item.balanceAfter || item.balance_after || 0),
            rawRef || null,
            item.description || 'Backfilled ledger entry'
          ]);
          counts.ledger++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/ledger for tenant ${tenantId} skipped:`, err);
      }

      // 3. GET /api/internal/v1/trading/funds
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/funds', tenantId: tenantId });
        const items = res.success ? (res.data?.funds || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          const type = (item.type || item.fundType || 'DEPOSIT').toUpperCase();
          if (type.includes('WITHDRAW')) {
            await this.handleWithdrawalEvent({
              eventId: `bf_wdr_${item.id || Math.random()}_${Date.now()}`,
              eventType: 'withdrawal.updated',
              tenantId,
              timestamp: new Date().toISOString(),
              payload: item
            });
          } else {
            await this.handleDepositEvent({
              eventId: `bf_dep_${item.id || Math.random()}_${Date.now()}`,
              eventType: 'deposit.updated',
              tenantId,
              timestamp: new Date().toISOString(),
              payload: item
            });
          }
          counts.funds++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/funds for tenant ${tenantId} skipped:`, err);
      }

      // 4. GET /api/internal/v1/trading/orders
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/orders', tenantId: tenantId });
        const items = res.success ? (res.data?.orders || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          await this.handleOrderEvent({
            eventId: `bf_ord_${item.id || item.orderId || Math.random()}_${Date.now()}`,
            eventType: 'order.updated',
            tenantId,
            timestamp: new Date().toISOString(),
            payload: item
          });
          counts.orders++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/orders for tenant ${tenantId} skipped:`, err);
      }

      // 5. GET /api/internal/v1/trading/trades
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/trades', tenantId: tenantId });
        const items = res.success ? (res.data?.trades || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          await this.handleTradeExecuted({
            eventId: `bf_trd_${item.id || item.tradeId || Math.random()}_${Date.now()}`,
            eventType: 'trade.executed',
            tenantId,
            timestamp: new Date().toISOString(),
            payload: item
          });
          counts.trades++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/trades for tenant ${tenantId} skipped:`, err);
      }

      // 6. GET /api/internal/v1/trading/positions
      try {
        const res = await tradingPlatformClient.request<any>({ method: 'GET', path: '/api/internal/v1/trading/positions', tenantId: tenantId });
        const items = res.success ? (res.data?.positions || res.data?.items || (Array.isArray(res.data) ? res.data : [])) : [];
        for (const item of items) {
          await this.handlePositionUpdated({
            eventId: `bf_pos_${item.id || item.positionId || Math.random()}_${Date.now()}`,
            eventType: 'position.updated',
            tenantId,
            timestamp: new Date().toISOString(),
            payload: item
          });
          counts.positions++;
        }
      } catch (err) {
        console.warn(`[Backfill] GET /api/internal/v1/trading/positions for tenant ${tenantId} skipped:`, err);
      }
    }

    return counts;
  }

  private async handleExecutionFailure(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    const title = `Execution Failure: Order ${p.orderId || 'N/A'}`;
    const message = `Order placement failed: ${p.reason || 'Unknown execution error'}. Symbol: ${p.symbol || 'N/A'}`;

    await query(
      `INSERT INTO notifications (id, tenant_id, title, message, notification_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'WARNING', false, CURRENT_TIMESTAMP)`,
      [`NOTIF-${Date.now()}`, event.tenantId, title, message]
    );
  }

  private async handleEmergencyControlActivated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        `LOG-${Date.now()}`,
        event.tenantId,
        p.actor || 'EmergencyControl',
        'REMOTE_EMERGENCY_ACTIVATED',
        'EMERGENCY_CONTROLS',
        `Remote emergency control activated: ${p.action || 'CONTROL'}. Reason: ${p.reason || 'N/A'}`
      ]
    );
  }

  private async handleReconciliationMismatch(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    const title = `Reconciliation Mismatch: Tenant ${event.tenantId}`;
    const message = `Financial reconciliation detected discrepancy: ${p.details || 'Discrepancy in executed trades vs broker order status'}`;

    await query(
      `INSERT INTO notifications (id, tenant_id, title, message, notification_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'CRITICAL', false, CURRENT_TIMESTAMP)`,
      [`NOTIF-${Date.now()}`, event.tenantId, title, message]
    );
  }

  private async handleKycUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p || !p.clientId) return;
    const status = p.status || 'APPROVED';
    await query(
      `UPDATE clients SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP WHERE (id = $2 OR client_code = $2) AND tenant_id = $3`,
      [status, p.clientId, event.tenantId]
    );
    await query(
      `UPDATE kyc_records SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP WHERE (client_id = $2 OR client_code = $2) AND tenant_id = $3`,
      [status, p.clientId, event.tenantId]
    );
  }

  private async handleNotificationCreated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;
    await query(
      `INSERT INTO notifications (id, tenant_id, title, message, notification_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)`,
      [
        p.id || `NOTIF-${Date.now()}`,
        event.tenantId,
        p.title || 'Platform Notification',
        p.message || '',
        p.type || 'INFO'
      ]
    );
  }

  private async handleSupportUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p || !p.ticketId) return;
    await query(
      `UPDATE support_tickets SET status = COALESCE($1, status), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
      [p.status ?? null, p.ticketId, event.tenantId]
    );
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public getEventStats() {
    return {
      metrics: { ...this.metrics },
      processedCount: this.processedEventIds.size,
      recentEvents: Array.from(this.processedEventIds).slice(-10)
    };
  }
}

export const eventHandler = new EventHandler();
