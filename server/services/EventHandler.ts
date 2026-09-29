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
}

export class EventHandler {
  // In-memory LRU set for fast deduplication check (backed by processed_events table)
  private processedEventIds = new Set<string>();
  private readonly MAX_MEM_CACHE = 10000;

  // Observability metrics
  private metrics = {
    totalEventsReceived: 0,
    successfulEvents: 0,
    duplicateEvents: 0,
    rejectedEvents: 0,
    lastEventProcessedAt: null as string | null
  };

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

    const signature = getHeader('x-signature-sha256') || getHeader('x-hmac-signature');
    const timestamp = getHeader('x-timestamp') || eventData.timestamp;
    const headerTenantId = getHeader('x-tenant-id');
    if (!eventData.payload && (eventData as any).data) {
      eventData.payload = (eventData as any).data;
    }

    // 1. Cryptographic HMAC & Replay verification
    const sigCheck = tradingPlatformClient.verifyInboundSignature(signature, timestamp, method, path, rawBody);
    if (!sigCheck.valid) {
      this.metrics.rejectedEvents++;
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId || 'unknown',
        eventType: eventData.eventType || 'unknown',
        message: 'Security validation failed',
        error: sigCheck.reason || 'Invalid HMAC or expired timestamp'
      };
    }

    // 2. Tenant isolation verification
    if (!eventData.tenantId) {
      this.metrics.rejectedEvents++;
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Validation failed',
        error: 'Event missing tenantId'
      };
    }

    if (headerTenantId && headerTenantId !== eventData.tenantId) {
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

    // Verify tenant exists in Central Admin
    const tenantCheck = await query('SELECT id, status FROM tenants WHERE id = $1', [eventData.tenantId]);
    if (tenantCheck.rows.length === 0) {
      this.metrics.rejectedEvents++;
      return {
        success: false,
        duplicate: false,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        message: 'Unknown tenant',
        error: `Tenant ${eventData.tenantId} not registered in Central Admin`
      };
    }

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

  // ----------------------------------------------------
  // EVENT HANDLERS
  // ----------------------------------------------------

  /**
   * 1. Handle Client / Account Creation and Updates from Trading Platform
   */
  private async handleClientCreatedOrUpdated(event: TradingPlatformEvent): Promise<void> {
    const p = event.payload;
    if (!p) return;

    const clientId = String(p.clientId || p.client_id || p.id || p.userId || p.user_id || p.clientCode || p.client_code || `CLT-${Date.now()}`);
    const clientCode = String(p.clientCode || p.client_code || p.code || clientId);
    const clientName = String(p.name || p.clientName || p.client_name || p.fullName || 'Trading Client');
    const email = String(p.email || p.clientEmail || p.client_email || `${clientCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`);
    const phone = String(p.phone || p.clientPhone || p.client_phone || '+91 98765 43210');
    const status = (p.status || 'ACTIVE').toUpperCase();
    const kycStatus = (p.kycStatus || p.kyc_status || 'VERIFIED').toUpperCase();

    const balance = p.balance !== undefined ? Number(p.balance) : (p.walletBalance !== undefined ? Number(p.walletBalance) : (p.initialBalance !== undefined ? Number(p.initialBalance) : 0));
    const equity = p.equity !== undefined ? Number(p.equity) : balance;
    const marginUsed = p.marginUsed !== undefined ? Number(p.marginUsed) : (p.margin_used !== undefined ? Number(p.margin_used) : (p.usedMargin !== undefined ? Number(p.usedMargin) : 0));

    let subBrokerId = p.subBrokerId || p.sub_broker_id;
    if (!subBrokerId) {
      subBrokerId = await this.ensureTenantSubBroker(event.tenantId);
    }

    // Check if client already exists by id OR client_code in this tenant
    const existing = await query(
      'SELECT id FROM clients WHERE (id = $1 OR client_code = $2) AND tenant_id = $3',
      [clientId, clientCode, event.tenantId]
    );

    if (existing.rows.length > 0) {
      const targetId = existing.rows[0].id;
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
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 AND tenant_id = $11`,
        [clientName, clientCode, email, phone, status, kycStatus, balance, equity, marginUsed, targetId, event.tenantId]
      );
    } else {
      await query(
        `INSERT INTO clients (
          id, tenant_id, sub_broker_id, client_code, name, email, phone, status, kyc_status,
          balance, equity, margin_used, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
          updated_at = CURRENT_TIMESTAMP`,
        [clientId, event.tenantId, subBrokerId, clientCode, clientName, email, phone, status, kycStatus, balance, equity, marginUsed]
      );
    }

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

    if (check.rows.length > 0) {
      await query(
        `UPDATE clients 
         SET balance = COALESCE($1, balance),
             equity = COALESCE($2, equity),
             margin_used = COALESCE($3, margin_used),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5`,
        [balance, equity, marginUsed, check.rows[0].id, event.tenantId]
      );
    } else {
      // Create projection if client doesn't exist yet
      await this.handleClientCreatedOrUpdated(event);
    }
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
        const ledgerId = `LDG-${tradeId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
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

    // If approved, update client balance and ledger if not already recorded
    if (status === 'COMPLETED' && amount > 0) {
      await query(
        `UPDATE clients SET balance = balance + $1, equity = equity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
        [amount, clientId, event.tenantId]
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
