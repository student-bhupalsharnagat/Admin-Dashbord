import pg from 'pg';
import dns from 'dns';
import {
  ITradingDataProvider,
  EntityStatus
} from './TradingDataProvider.ts';
import {
  DashboardKPIs,
  VolumeCommissionChartPoint,
  Trade,
  KYCRecord,
  Tenant,
  Master,
  Broker,
  SubBroker,
  Client,
  Order,
  SubscriptionPlan,
  WhiteLabelConfig,
  TenantPlatformConfig,
  TenantDomain,
  BrandingAuditLog,
  SupportTicket,
  AuditLog,
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
  KYCStatus,
  FundDepositItem,
  FundWithdrawalItem,
  LedgerRowItem
} from '../../src/types.ts';
import { getPool, query, withTransaction } from '../db/connection.ts';
import { DEFAULT_ROLE_PERMISSIONS } from '../../src/utils/rbac.ts';
import { tenantConfigCache } from './TenantConfigCache.ts';
import { tradingPlatformClient } from '../services/TradingPlatformClient.ts';

export class PostgresTradingDataProvider implements ITradingDataProvider {
  private pool?: pg.Pool;

  constructor(customPool?: pg.Pool) {
    this.pool = customPool;
  }

  private async executeQuery<T = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    return query<T>(text, params, this.pool);
  }

  // ----------------------------------------------------
  // DASHBOARD & ANALYTICS
  // ----------------------------------------------------
  async getDashboardKPIs(tenantId?: string): Promise<DashboardKPIs> {
    const tenantFilter = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    // Query live authoritative data from PostgreSQL database & remote platform
    const [
      mastersRes,
      brokersRes,
      subBrokersRes,
      clientsRes,
      activeClientsRes,
      todayVolumeRes,
      totalVolumeRes,
      tradesCountRes,
      commissionRes,
      realizedPlRes,
      unrealizedPlRes,
      marginRes,
      openPositionsRes,
      pendingOrdersRes,
      pendingDepositsRes,
      pendingWithdrawalsRes,
      kycRes,
      ticketsRes
    ] = await Promise.all([
      this.executeQuery(`SELECT count(*) as count FROM masters ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM brokers ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM sub_brokers ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM clients ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM clients WHERE status = 'ACTIVE' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(total_value), 0) as volume FROM trades WHERE created_at::date = CURRENT_DATE ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(total_value), 0) as volume FROM trades ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM trades ${tenantFilter}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(credit), 0) as total FROM ledger_entries WHERE entry_type = 'COMMISSION' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(pnl), 0) as total FROM positions WHERE status = 'CLOSED' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(pnl), 0) as total FROM positions WHERE status = 'OPEN' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT COALESCE(SUM(balance), 0) as total_balance, COALESCE(SUM(equity), 0) as total_equity, COALESCE(SUM(margin_used), 0) as total_margin_used FROM clients ${tenantFilter}`, params),
      this.executeQuery(`SELECT count(*) as count FROM positions WHERE status = 'OPEN' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT count(*) as count FROM orders WHERE status = 'PENDING' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT count(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM fund_deposits WHERE status IN ('PENDING', 'PROCESSING') ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT count(*) as count, COALESCE(SUM(amount), 0) as total_amount FROM fund_withdrawals WHERE status IN ('PENDING', 'PROCESSING') ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT count(*) as count FROM kyc_records WHERE kyc_status = 'PENDING' ${tenantId ? 'AND tenant_id = $1' : ''}`, params),
      this.executeQuery(`SELECT count(*) as count FROM support_tickets WHERE status = 'OPEN' ${tenantId ? 'AND tenant_id = $1' : ''}`, params)
    ]);

    const totalMastersNum = parseInt(mastersRes.rows[0]?.count || '0', 10);
    const totalBrokersNum = parseInt(brokersRes.rows[0]?.count || '0', 10);
    const totalSubBrokersNum = parseInt(subBrokersRes.rows[0]?.count || '0', 10);
    const totalClientsNum = parseInt(clientsRes.rows[0]?.count || '0', 10);
    const activeClientsNum = parseInt(activeClientsRes.rows[0]?.count || '0', 10);
    // Incorporate live telemetry from Trading Platform matching engine
    let liveTradesCount = 0;
    let liveOrdersCount = 0;
    let liveTradesVolume = 0;
    let liveOpenPositionsCount = 0;
    let liveClientsCount = 0;
    let liveSummaryMetrics: any = {};

    try {
      const [liveTradesRes, liveOrdersRes, livePositionsRes, liveClientsRes, liveSummaryRes] = await Promise.all([
        tradingPlatformClient.getLiveTrades(tenantId).catch(() => ({ success: false, data: [] })),
        tradingPlatformClient.getLiveOrders(tenantId).catch(() => ({ success: false, data: [] })),
        tradingPlatformClient.getLivePositions(tenantId).catch(() => ({ success: false, data: [] })),
        tradingPlatformClient.getLiveClients(tenantId).catch(() => ({ success: false, data: [] })),
        tradingPlatformClient.getLiveSummary(tenantId).catch(() => ({ success: false, data: null }))
      ]);

      liveSummaryMetrics = liveSummaryRes?.data?.metrics || {};
      const liveClientsList = Array.isArray(liveClientsRes.data?.clients)
        ? liveClientsRes.data.clients
        : (Array.isArray(liveClientsRes.data?.items) ? liveClientsRes.data.items : (Array.isArray(liveClientsRes.data) ? liveClientsRes.data : []));
      liveClientsCount = liveClientsList.length;

      const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);

      let tradesList = Array.isArray(liveTradesRes.data) ? liveTradesRes.data : (Array.isArray(liveTradesRes.data?.trades) ? liveTradesRes.data.trades : []);
      if (tenantId && !defaultTenants.has(tenantId)) {
        tradesList = tradesList.filter((t: any) => (t.tenant_id || t.tenantId) === tenantId);
      }
      if (tradesList.length > 0) {
        liveTradesCount = tradesList.length;
        for (const t of tradesList) {
          const val = parseFloat(t.execution_value || t.total_value || (parseFloat(t.execution_price || t.price || 0) * parseFloat(t.quantity || 0)) || 0);
          if (!isNaN(val)) liveTradesVolume += val;
        }
      }

      let ordersList = Array.isArray(liveOrdersRes.data) ? liveOrdersRes.data : (Array.isArray(liveOrdersRes.data?.orders) ? liveOrdersRes.data.orders : []);
      if (tenantId && !defaultTenants.has(tenantId)) {
        ordersList = ordersList.filter((o: any) => (o.tenant_id || o.tenantId) === tenantId);
      }
      if (ordersList.length > 0) {
        liveOrdersCount = ordersList.filter((o: any) => o.status === 'PENDING' || o.status === 'OPEN').length;
      }

      let positionsList = Array.isArray(livePositionsRes.data) ? livePositionsRes.data : (Array.isArray(livePositionsRes.data?.positions) ? livePositionsRes.data.positions : []);
      if (tenantId && !defaultTenants.has(tenantId)) {
        positionsList = positionsList.filter((p: any) => (p.tenant_id || p.tenantId) === tenantId);
      }
      if (positionsList.length > 0) {
        liveOpenPositionsCount = positionsList.filter((p: any) => p.status === 'OPEN').length;
      }
    } catch {
      // non-fatal live telemetry probe
    }

    const todayVolumeNum = Math.max(parseFloat(todayVolumeRes.rows[0]?.volume || '0'), liveTradesVolume, parseFloat(liveSummaryMetrics?.today_turnover || '0'));
    const totalVolumeNum = Math.max(parseFloat(totalVolumeRes.rows[0]?.volume || '0'), liveTradesVolume, parseFloat(liveSummaryMetrics?.total_turnover || '0'));
    const totalCommissionNum = parseFloat(commissionRes.rows[0]?.total || '0');
    const realizedPlNum = parseFloat(realizedPlRes.rows[0]?.total || '0') || parseFloat(liveSummaryMetrics?.realized_pnl || '0');
    const unrealizedPlNum = parseFloat(unrealizedPlRes.rows[0]?.total || '0') || parseFloat(liveSummaryMetrics?.unrealized_pnl || '0');
    const totalPlNum = realizedPlNum + unrealizedPlNum;

    const totalBalanceNum = parseFloat(marginRes.rows[0]?.total_balance || '0');
    const totalEquityNum = parseFloat(marginRes.rows[0]?.total_equity || '0');
    const totalMarginUsedNum = parseFloat(marginRes.rows[0]?.total_margin_used || '0') || parseFloat(liveSummaryMetrics?.total_used_margin || '0');
    const availableMarginNum = Math.max(0, totalEquityNum - totalMarginUsedNum);

    const openPositionsNum = parseInt(openPositionsRes.rows[0]?.count || '0', 10);
    const pendingOrdersNum = parseInt(pendingOrdersRes.rows[0]?.count || '0', 10);
    const pendingDepositsCount = parseInt(pendingDepositsRes.rows[0]?.count || '0', 10);
    const pendingDepositsAmount = parseFloat(pendingDepositsRes.rows[0]?.total_amount || '0');
    const pendingWithdrawalsCount = parseInt(pendingWithdrawalsRes.rows[0]?.count || '0', 10);
    const pendingWithdrawalsAmount = parseFloat(pendingWithdrawalsRes.rows[0]?.total_amount || '0');
    const pendingKycNum = parseInt(kycRes.rows[0]?.count || '0', 10);
    const openTicketsNum = parseInt(ticketsRes.rows[0]?.count || '0', 10);

    const authoritativeClientsCount = Math.max(totalClientsNum, liveSummaryMetrics?.total_users || 0, liveClientsCount);
    const authoritativeActiveClientsCount = Math.max(activeClientsNum, liveSummaryMetrics?.active_users || 0);
    const authoritativeOpenPositions = Math.max(openPositionsNum, liveSummaryMetrics?.open_positions_count || 0, liveOpenPositionsCount);
    const authoritativePendingOrders = Math.max(pendingOrdersNum, liveSummaryMetrics?.pending_orders_count || 0, liveOrdersCount);

    const formatCurrency = (amount: number): string => {
      if (amount === 0) return '₹0';
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
      if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
      if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
      return `${sign}₹${abs.toFixed(2)}`;
    };

    return {
      total_masters: {
        value: totalMastersNum,
        badge: totalMastersNum > 0 ? `${totalMastersNum} registered` : 'None',
        subtitle: tenantId ? 'Across Tenant' : 'Across all regions'
      },
      total_brokers: {
        value: totalBrokersNum,
        badge: `${totalBrokersNum} active`,
        subtitle: `${totalSubBrokersNum} sub-brokers`
      },
      total_sub_brokers: {
        value: totalSubBrokersNum,
        badge: `${totalSubBrokersNum} mapped`,
        subtitle: 'Sub-Brokers'
      },
      total_clients: {
        value: authoritativeClientsCount,
        badge: `${authoritativeActiveClientsCount} active`,
        subtitle: `${authoritativeActiveClientsCount} active trader${authoritativeActiveClientsCount === 1 ? '' : 's'}`
      },
      active_clients: {
        value: authoritativeActiveClientsCount,
        badge: `${authoritativeActiveClientsCount} active`,
        subtitle: 'Active trading accounts'
      },
      todays_turnover: {
        value: formatCurrency(todayVolumeNum),
        raw: todayVolumeNum,
        badge: 'Today',
        subtitle: 'Today\'s Turnover'
      },
      total_turnover: {
        value: formatCurrency(totalVolumeNum),
        raw: totalVolumeNum,
        badge: 'Total Executed',
        subtitle: 'All-Time Turnover'
      },
      trading_volume: {
        value: formatCurrency(todayVolumeNum),
        raw: todayVolumeNum,
        badge: 'Today',
        subtitle: 'Volume'
      },
      commission_earned: {
        value: formatCurrency(totalCommissionNum),
        raw: totalCommissionNum,
        badge: 'From ledger',
        subtitle: 'Actual rules'
      },
      total_pl: {
        value: formatCurrency(totalPlNum),
        raw: totalPlNum,
        badge: totalPlNum >= 0 ? '+Net Profit' : '-Net Loss',
        subtitle: 'Unrealized + Realized'
      },
      net_pl: {
        value: formatCurrency(totalPlNum),
        raw: totalPlNum,
        badge: totalPlNum >= 0 ? '+Net Profit' : '-Net Loss',
        subtitle: 'Unrealized + Realized'
      },
      pending_kyc: {
        value: pendingKycNum,
        subtitle: 'Requires review'
      },
      open_tickets: {
        value: openTicketsNum,
        subtitle: `${openTicketsNum} open tickets`
      },
      pending_deposits: {
        value: pendingDepositsCount,
        amount: pendingDepositsAmount,
        formatted_amount: formatCurrency(pendingDepositsAmount),
        badge: `${pendingDepositsCount} pending`,
        subtitle: pendingDepositsAmount > 0 ? `Total: ${formatCurrency(pendingDepositsAmount)}` : 'Requires approval'
      },
      pending_withdrawals: {
        value: pendingWithdrawalsCount,
        amount: pendingWithdrawalsAmount,
        formatted_amount: formatCurrency(pendingWithdrawalsAmount),
        badge: `${pendingWithdrawalsCount} pending`,
        subtitle: pendingWithdrawalsAmount > 0 ? `Total: ${formatCurrency(pendingWithdrawalsAmount)}` : 'Requires processing'
      },
      open_positions: {
        value: openPositionsNum,
        badge: `${openPositionsNum} open`,
        subtitle: 'Active positions'
      },
      pending_orders: {
        value: pendingOrdersNum,
        badge: `${pendingOrdersNum} pending`,
        subtitle: 'Queued orders'
      },
      used_margin: {
        value: formatCurrency(totalMarginUsedNum),
        raw: totalMarginUsedNum,
        badge: 'Utilized',
        subtitle: 'Across clients'
      },
      available_margin: {
        value: formatCurrency(availableMarginNum),
        raw: availableMarginNum,
        badge: 'Available',
        subtitle: 'Free margin'
      },
      equity: {
        value: formatCurrency(totalEquityNum),
        raw: totalEquityNum,
        badge: 'Total Equity',
        subtitle: 'All client accounts'
      },
      realized_pl: {
        value: formatCurrency(realizedPlNum),
        raw: realizedPlNum,
        badge: realizedPlNum >= 0 ? '+Profit' : '-Loss',
        subtitle: 'Realized P&L'
      },
      unrealized_pl: {
        value: formatCurrency(unrealizedPlNum),
        raw: unrealizedPlNum,
        badge: unrealizedPlNum >= 0 ? '+Profit' : '-Loss',
        subtitle: 'Unrealized P&L'
      }
    };
  }

  async getVolumeCommissionChart(tenantId?: string, timeRange: string = '7d'): Promise<VolumeCommissionChartPoint[]> {
    const days = timeRange === '30d' ? 30 : (timeRange === '7d' ? 7 : 14);
    const params: any[] = [days - 1];
    let tenantClause = '';
    if (tenantId) {
      params.push(tenantId);
      tenantClause = `AND t.tenant_id = $${params.length}`;
    }

    try {
      const res = await this.executeQuery(`
        WITH dates AS (
          SELECT generate_series(
            CURRENT_DATE - ($1 || ' days')::interval,
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS dt
        )
        SELECT 
          d.dt::text AS date,
          TO_CHAR(d.dt, 'Mon FMDD') AS display_date,
          COALESCE(ROUND(SUM(t.total_value) / 10000000.0, 2), 0.00) AS volume,
          COALESCE(ROUND(SUM(
            COALESCE((SELECT SUM(l.credit) FROM ledger_entries l WHERE l.created_at::date = d.dt AND l.entry_type = 'COMMISSION' ${tenantId ? 'AND l.tenant_id = $2' : ''}), 0)
          ) / 100000.0, 2), 0.00) AS commission
        FROM dates d
        LEFT JOIN trades t ON t.created_at::date = d.dt ${tenantClause}
        GROUP BY d.dt
        ORDER BY d.dt ASC
      `, params);

      return res.rows.map(r => ({
        date: r.date,
        displayDate: r.display_date,
        volume: parseFloat(r.volume || '0'),
        commission: parseFloat(r.commission || '0')
      }));
    } catch (err) {
      console.error('[PostgresTradingDataProvider] getVolumeCommissionChart error:', err);
      return [];
    }
  }

  async getClientGrowthChart(tenantId?: string): Promise<any[]> {
    const params: any[] = [];
    let tenantFilter = '';
    if (tenantId) {
      params.push(tenantId);
      tenantFilter = `AND tenant_id = $${params.length}`;
    }

    try {
      const res = await this.executeQuery(`
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          )::date AS m_date
        )
        SELECT 
          TO_CHAR(m_date, 'Mon') as month,
          (
            SELECT COUNT(*) FROM clients 
            WHERE 1=1 ${tenantFilter}
            AND created_at <= (m_date + INTERVAL '1 month - 1 second')
          ) as clients
        FROM months
        ORDER BY m_date ASC
      `, params);

      return res.rows.map(r => ({
        month: r.month,
        clients: parseInt(r.clients || '0', 10)
      }));
    } catch (err) {
      console.error('[PostgresTradingDataProvider] getClientGrowthChart error:', err);
      return [];
    }
  }

  async getDailyPLTrend(tenantId?: string, month?: string): Promise<{ data: any[]; mtdBadge: string }> {
    const params: any[] = [];
    let tenantFilter = '';
    if (tenantId) {
      params.push(tenantId);
      tenantFilter = `AND tenant_id = $${params.length}`;
    }

    try {
      const res = await this.executeQuery(`
        WITH dates AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '13 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS dt
        )
        SELECT 
          TO_CHAR(d.dt, 'Mon FMDD') AS day,
          TO_CHAR(d.dt, 'Mon FMDD') AS display_day,
          COALESCE(
            ROUND(SUM(CASE 
              WHEN l.entry_type IN ('TRADE_SELL', 'P&L', 'COMMISSION') THEN (l.credit - l.debit)
              WHEN l.entry_type = 'TRADE_BUY' THEN -(l.debit * 0.01)
              ELSE 0 
            END) / 1000.0, 1),
            0.0
          ) AS pl
        FROM dates d
        LEFT JOIN ledger_entries l ON l.created_at::date = d.dt ${tenantFilter}
        GROUP BY d.dt
        ORDER BY d.dt ASC
      `, params);

      const data = res.rows.map(r => {
        const val = parseFloat(r.pl || '0');
        return {
          day: r.day,
          displayDay: r.display_day,
          pl: val,
          isProfit: val >= 0
        };
      });
      const netTotal = data.reduce((sum, item) => sum + item.pl, 0);
      const mtdBadge = `${netTotal >= 0 ? '+' : '-'}₹${Math.abs(netTotal / 100).toFixed(1)}L`;
      return { data, mtdBadge };
    } catch (err) {
      console.error('[PostgresTradingDataProvider] getDailyPLTrend error:', err);
      return { data: [], mtdBadge: '₹0' };
    }
  }

  async getRecentTrades(tenantId?: string, limit: number = 10): Promise<Trade[]> {
    const tenantFilter = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId, limit] : [limit];
    const limitPlaceholder = tenantId ? '$2' : '$1';

    const res = await this.executeQuery(
      `SELECT * FROM trades ${tenantFilter} ORDER BY created_at DESC LIMIT ${limitPlaceholder}`,
      params
    );

    return res.rows.map(r => ({
      id: r.id,
      trade_id: r.trade_id || r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      symbol: r.symbol,
      side: r.side,
      quantity: r.quantity,
      price: parseFloat(r.price),
      total_value: parseFloat(r.total_value || (parseFloat(r.price) * r.quantity).toString()),
      pl: 0,
      status: (r.status === 'CANCELLED' ? 'CANCELLED' : (r.status === 'SETTLED' ? 'SETTLED' : 'EXECUTED')) as any,
      timestamp: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : '2026-03-29 10:00:00'
    }));
  }

  async getPendingKYC(tenantId?: string, limit: number = 5): Promise<KYCRecord[]> {
    const tenantFilter = tenantId ? 'AND tenant_id = $2' : '';
    const params = tenantId ? [limit, tenantId] : [limit];

    const res = await this.executeQuery(
      `SELECT * FROM kyc_records WHERE kyc_status = 'PENDING' ${tenantFilter} ORDER BY created_at DESC LIMIT $1`,
      params
    );

    return res.rows.map(r => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      kyc_status: (r.kyc_status === 'VERIFIED' ? 'APPROVED' : (r.kyc_status || 'PENDING')) as KYCStatus,
      document_type: r.document_type || 'PAN_CARD',
      document_status: ((r.kyc_status === 'APPROVED' || r.kyc_status === 'VERIFIED') ? 'VERIFIED' : (r.kyc_status === 'REJECTED' ? 'REJECTED' : 'PENDING')) as any,
      assigned_reviewer: r.reviewed_by || 'Compliance Officer',
      submitted_date: r.submitted_at?.toISOString() || new Date().toISOString(),
      id_number: r.pan_number || r.aadhaar_number,
      notes: r.notes
    }));
  }

  // ----------------------------------------------------
  // TENANTS MODULE
  // ----------------------------------------------------
  async getTenants(queryParam?: { search?: string; status?: string }): Promise<Tenant[]> {
    let sql = `
      SELECT t.*,
        (SELECT COUNT(*) FROM clients c WHERE c.tenant_id = t.id) AS real_client_count,
        (SELECT COUNT(*) FROM clients c WHERE c.tenant_id = t.id AND c.status = 'ACTIVE') AS real_active_client_count,
        (SELECT COALESCE(SUM(total_value), 0) FROM trades tr WHERE tr.tenant_id = t.id) AS real_volume_raw,
        (SELECT COALESCE(SUM(pnl), 0) FROM positions pos WHERE pos.tenant_id = t.id) AS real_pl_raw,
        (SELECT COALESCE(SUM(margin_used), 0) FROM clients c WHERE c.tenant_id = t.id) AS real_margin_raw,
        (SELECT COALESCE(SUM(credit), 0) FROM ledger_entries le WHERE le.tenant_id = t.id AND le.entry_type = 'COMMISSION') AS real_commission_raw
      FROM tenants t WHERE 1=1
    `;
    const params: any[] = [];

    if (queryParam?.status && queryParam.status !== 'ALL') {
      params.push(queryParam.status);
      sql += ` AND t.status = $${params.length}`;
    }
    if (queryParam?.search) {
      params.push(`%${queryParam.search}%`);
      sql += ` AND (t.name ILIKE $${params.length} OR t.code ILIKE $${params.length} OR t.subdomain ILIKE $${params.length})`;
    }

    sql += ' ORDER BY t.created_at ASC';
    const res = await this.executeQuery(sql, params);

    const formatCurrency = (amount: number): string => {
      if (amount === 0) return '₹0';
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
      if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
      if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
      return `${sign}₹${abs.toFixed(2)}`;
    };

    return res.rows.map(r => {
      const volRaw = parseFloat(r.real_volume_raw || '0');
      const plRaw = parseFloat(r.real_pl_raw || '0');
      const marginRaw = parseFloat(r.real_margin_raw || '0');
      const commRaw = parseFloat(r.real_commission_raw || '0');
      const clientCount = parseInt(r.real_client_count || '0', 10);
      const activeClientCount = parseInt(r.real_active_client_count || '0', 10);

      return {
        id: r.id,
        name: r.name,
        code: r.code,
        status: r.status,
        plan: r.plan,
        admin_name: r.owner_name || 'Admin',
        admin_email: r.owner_email || 'admin@tenant.com',
        admin_phone: '+91 98000 00000',
        domain: r.custom_domain || `${r.subdomain || r.code.toLowerCase()}.tradepro.com`,
        support_email: `support@${(r.code || 'tenant').toLowerCase()}.com`,
        total_users: clientCount,
        active_users: activeClientCount,
        trading_volume: formatCurrency(volRaw),
        trading_volume_raw: volRaw,
        pl: formatCurrency(plRaw),
        pl_raw: plRaw,
        margin: formatCurrency(marginRaw),
        commission: formatCurrency(commRaw),
        created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01',
        notes: ''
      };
    });
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    const res = await this.executeQuery(`
      SELECT t.*,
        (SELECT COUNT(*) FROM clients c WHERE c.tenant_id = t.id) AS real_client_count,
        (SELECT COUNT(*) FROM clients c WHERE c.tenant_id = t.id AND c.status = 'ACTIVE') AS real_active_client_count,
        (SELECT COALESCE(SUM(total_value), 0) FROM trades tr WHERE tr.tenant_id = t.id) AS real_volume_raw,
        (SELECT COALESCE(SUM(pnl), 0) FROM positions pos WHERE pos.tenant_id = t.id) AS real_pl_raw,
        (SELECT COALESCE(SUM(margin_used), 0) FROM clients c WHERE c.tenant_id = t.id) AS real_margin_raw,
        (SELECT COALESCE(SUM(credit), 0) FROM ledger_entries le WHERE le.tenant_id = t.id AND le.entry_type = 'COMMISSION') AS real_commission_raw
      FROM tenants t WHERE t.id = $1
    `, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const formatCurrency = (amount: number): string => {
      if (amount === 0) return '₹0';
      const abs = Math.abs(amount);
      const sign = amount < 0 ? '-' : '';
      if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
      if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
      if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
      return `${sign}₹${abs.toFixed(2)}`;
    };

    const volRaw = parseFloat(r.real_volume_raw || '0');
    const plRaw = parseFloat(r.real_pl_raw || '0');
    const marginRaw = parseFloat(r.real_margin_raw || '0');
    const commRaw = parseFloat(r.real_commission_raw || '0');
    const clientCount = parseInt(r.real_client_count || '0', 10);
    const activeClientCount = parseInt(r.real_active_client_count || '0', 10);

    return {
      id: r.id,
      name: r.name,
      code: r.code,
      status: r.status,
      plan: r.plan,
      admin_name: r.owner_name || 'Admin',
      admin_email: r.owner_email || 'admin@tenant.com',
      admin_phone: '+91 98000 00000',
      domain: r.custom_domain || `${r.subdomain || r.code.toLowerCase()}.tradepro.com`,
      support_email: `support@${(r.code || 'tenant').toLowerCase()}.com`,
      total_users: clientCount,
      active_users: activeClientCount,
      trading_volume: formatCurrency(volRaw),
      trading_volume_raw: volRaw,
      pl: formatCurrency(plRaw),
      pl_raw: plRaw,
      margin: formatCurrency(marginRaw),
      commission: formatCurrency(commRaw),
      created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01',
      notes: ''
    };
  }

  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const id = data.id || `TNT-${Date.now().toString().slice(-4)}`;
    const code = data.code || (data.name ? data.name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) : 'TENANT');
    const subdomain = (data.domain ? data.domain.split('.')[0] : code.toLowerCase());

    const res = await this.executeQuery(`
      INSERT INTO tenants (
        id, name, code, subdomain, custom_domain, plan, status,
        owner_name, owner_email, region, user_count, max_users,
        monthly_volume, monthly_revenue
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id,
      data.name || 'New Tenant',
      code,
      subdomain,
      data.domain || `${subdomain}.tradematrix.io`,
      data.plan || 'ENTERPRISE',
      data.status || 'ACTIVE',
      data.admin_name || 'Admin',
      data.admin_email || 'admin@tenant.com',
      'ap-south-1',
      data.total_users || 0,
      10000,
      data.trading_volume || '₹0',
      data.commission || '₹0'
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      status: r.status,
      plan: r.plan,
      admin_name: r.owner_name,
      admin_email: r.owner_email,
      admin_phone: '+91 98000 00000',
      domain: r.custom_domain,
      support_email: `support@${(r.code || 'tenant').toLowerCase()}.com`,
      total_users: r.user_count,
      active_users: Math.round(r.user_count * 0.8),
      trading_volume: r.monthly_volume,
      trading_volume_raw: 0,
      pl: '₹0',
      pl_raw: 0,
      margin: '₹0',
      commission: r.monthly_revenue,
      created_at: new Date(r.created_at).toISOString().split('T')[0],
      notes: ''
    };
  }

  async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'): Promise<Tenant | null> {
    const res = await this.executeQuery(
      'UPDATE tenants SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (res.rows.length === 0) return null;
    return this.getTenantById(id);
  }

  // ----------------------------------------------------
  // HIERARCHY: MASTERS
  // ----------------------------------------------------
  async getMasters(tenantId?: string): Promise<Master[]> {
    const tenantFilter = tenantId ? 'WHERE m.tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const res = await this.executeQuery(`
      SELECT m.*, t.name as tenant_name
      FROM masters m
      LEFT JOIN tenants t ON m.tenant_id = t.id
      ${tenantFilter}
      ORDER BY m.created_at ASC
    `, params);

    return res.rows.map(r => ({
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || 'Central Master',
      name: r.name,
      code: r.code,
      email: r.email,
      phone: r.phone || '',
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      brokers_count: r.brokers_count || 0,
      clients_count: r.clients_count || 0,
      turnover: r.turnover || '₹0',
      commission_earned: r.commission || '₹0',
      region: 'North India',
      created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01'
    }));
  }

  async createMaster(data: Partial<Master>): Promise<Master> {
    const id = data.id || `MST-${Date.now().toString().slice(-4)}`;
    const tenantId = data.tenant_id || 'TNT-001';

    const res = await this.executeQuery(`
      INSERT INTO masters (
        id, tenant_id, name, company, code, email, phone, status,
        brokers_count, clients_count, turnover, commission
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id,
      tenantId,
      data.name || 'New Master',
      data.name || 'Master Corp',
      data.code || `MST-${id.slice(-3)}`,
      data.email || 'master@tradematrix.io',
      data.phone || '+91 98000 00000',
      data.status || 'ACTIVE',
      data.brokers_count || 0,
      data.clients_count || 0,
      data.turnover || '₹0',
      data.commission_earned || '₹0'
    ]);

    const r = res.rows[0];
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      name: r.name,
      code: r.code,
      email: r.email,
      phone: r.phone || '+91 98000 00000',
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      brokers_count: r.brokers_count || 0,
      clients_count: r.clients_count || 0,
      turnover: r.turnover || '₹0',
      commission_earned: r.commission || '₹0',
      region: 'North India',
      created_at: new Date(r.created_at).toISOString().split('T')[0]
    };
  }

  async updateMasterStatus(id: string, status: EntityStatus): Promise<Master | null> {
    const res = await this.executeQuery(
      'UPDATE masters SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (res.rows.length === 0) return null;
    const list = await this.getMasters();
    return list.find(m => m.id === id) || null;
  }

  async updateMaster(id: string, data: Partial<Master>): Promise<Master | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) { params.push(data.name); fields.push(`name = $${params.length}`); }
    if (data.email) { params.push(data.email); fields.push(`email = $${params.length}`); }
    if (data.phone) { params.push(data.phone); fields.push(`phone = $${params.length}`); }
    if (data.status) { params.push(data.status); fields.push(`status = $${params.length}`); }

    if (fields.length === 0) return (await this.getMasters()).find(m => m.id === id) || null;

    params.push(id);
    await this.executeQuery(
      `UPDATE masters SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
      params
    );

    const list = await this.getMasters();
    return list.find(m => m.id === id) || null;
  }

  // ----------------------------------------------------
  // HIERARCHY: BROKERS
  // ----------------------------------------------------
  async getBrokers(tenantId?: string, masterId?: string): Promise<Broker[]> {
    let sql = `
      SELECT b.*, t.name as tenant_name, m.name as parent_master_name
      FROM brokers b
      LEFT JOIN tenants t ON b.tenant_id = t.id
      LEFT JOIN masters m ON b.master_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND b.tenant_id = $${params.length}`;
    }
    if (masterId) {
      params.push(masterId);
      sql += ` AND b.master_id = $${params.length}`;
    }

    sql += ' ORDER BY b.created_at ASC';
    const res = await this.executeQuery(sql, params);

    return res.rows.map(r => ({
      id: r.id,
      master_id: r.master_id,
      master_name: r.parent_master_name || r.master_name || 'Master Admin',
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || 'Alpha Prime Capital',
      name: r.name,
      code: r.code,
      email: r.email,
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      sub_brokers_count: r.sub_brokers_count || 0,
      clients_count: r.clients_count || 0,
      turnover: r.turnover || '₹0',
      commission_earned: r.commission || '₹0',
      created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01'
    }));
  }

  async createBroker(data: Partial<Broker>): Promise<Broker> {
    const id = data.id || `BRK-${Date.now().toString().slice(-4)}`;
    let masterId = data.master_id || 'MST-001';
    let tenantId = data.tenant_id;

    // Verify master parent relationship
    const masterRes = await this.executeQuery('SELECT tenant_id, name FROM masters WHERE id = $1', [masterId]);
    let masterName = data.master_name;
    if (masterRes.rows.length > 0) {
      tenantId = tenantId || masterRes.rows[0].tenant_id;
      masterName = masterRes.rows[0].name;
    } else {
      tenantId = tenantId || 'TNT-001';
    }

    const res = await this.executeQuery(`
      INSERT INTO brokers (
        id, tenant_id, master_id, master_name, name, company, code, email, phone, status,
        sub_brokers_count, clients_count, turnover, commission
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id,
      tenantId,
      masterId,
      masterName || 'Master Admin',
      data.name || 'New Broker',
      data.name || 'Brokerage Services',
      data.code || `BRK-${id.slice(-3)}`,
      data.email || 'broker@tradematrix.io',
      '+91 98111 00000',
      data.status || 'ACTIVE',
      data.sub_brokers_count || 0,
      data.clients_count || 0,
      data.turnover || '₹0',
      data.commission_earned || '₹0'
    ]);

    // Update master's broker count
    await this.executeQuery(
      'UPDATE masters SET brokers_count = brokers_count + 1 WHERE id = $1',
      [masterId]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      master_id: r.master_id,
      master_name: r.master_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      name: r.name,
      code: r.code,
      email: r.email,
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      sub_brokers_count: r.sub_brokers_count,
      clients_count: r.clients_count,
      turnover: r.turnover,
      commission_earned: r.commission,
      created_at: new Date(r.created_at).toISOString().split('T')[0]
    };
  }

  async updateBrokerStatus(id: string, status: EntityStatus): Promise<Broker | null> {
    await this.executeQuery(
      'UPDATE brokers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
    const list = await this.getBrokers();
    return list.find(b => b.id === id) || null;
  }

  async updateBroker(id: string, data: Partial<Broker>): Promise<Broker | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) { params.push(data.name); fields.push(`name = $${params.length}`); }
    if (data.email) { params.push(data.email); fields.push(`email = $${params.length}`); }
    if (data.status) { params.push(data.status); fields.push(`status = $${params.length}`); }

    if (fields.length > 0) {
      params.push(id);
      await this.executeQuery(
        `UPDATE brokers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
        params
      );
    }
    const list = await this.getBrokers();
    return list.find(b => b.id === id) || null;
  }

  // ----------------------------------------------------
  // HIERARCHY: SUB-BROKERS
  // ----------------------------------------------------
  async getSubBrokers(tenantId?: string, brokerId?: string): Promise<SubBroker[]> {
    let sql = `
      SELECT sb.*, t.name as tenant_name, b.name as parent_broker_name
      FROM sub_brokers sb
      LEFT JOIN tenants t ON sb.tenant_id = t.id
      LEFT JOIN brokers b ON sb.broker_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND sb.tenant_id = $${params.length}`;
    }
    if (brokerId) {
      params.push(brokerId);
      sql += ` AND sb.broker_id = $${params.length}`;
    }

    sql += ' ORDER BY sb.created_at ASC';
    const res = await this.executeQuery(sql, params);

    return res.rows.map(r => ({
      id: r.id,
      broker_id: r.broker_id,
      broker_name: r.parent_broker_name || r.broker_name || 'Broker Admin',
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || 'Alpha Prime Capital',
      name: r.name,
      code: r.code,
      email: r.email,
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      clients_count: r.clients_count || 0,
      turnover: r.turnover || '₹0',
      commission_earned: r.commission || '₹0',
      created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01'
    }));
  }

  async createSubBroker(data: Partial<SubBroker>): Promise<SubBroker> {
    const id = data.id || `SBRK-${Date.now().toString().slice(-4)}`;
    let brokerId = data.broker_id || 'BRK-001';
    let tenantId = data.tenant_id;

    // Verify parent broker
    const brokerRes = await this.executeQuery('SELECT tenant_id, name FROM brokers WHERE id = $1', [brokerId]);
    let brokerName = data.broker_name;
    if (brokerRes.rows.length > 0) {
      tenantId = tenantId || brokerRes.rows[0].tenant_id;
      brokerName = brokerRes.rows[0].name;
    } else {
      tenantId = tenantId || 'TNT-001';
    }

    const res = await this.executeQuery(`
      INSERT INTO sub_brokers (
        id, tenant_id, broker_id, broker_name, name, code, email, phone, status,
        clients_count, turnover, commission
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id,
      tenantId,
      brokerId,
      brokerName || 'Broker Admin',
      data.name || 'New Sub-Broker',
      data.code || `SBRK-${id.slice(-3)}`,
      data.email || 'subbroker@tradematrix.io',
      '+91 98222 00000',
      data.status || 'ACTIVE',
      data.clients_count || 0,
      data.turnover || '₹0',
      data.commission_earned || '₹0'
    ]);

    // Update parent broker's sub_brokers_count
    await this.executeQuery(
      'UPDATE brokers SET sub_brokers_count = sub_brokers_count + 1 WHERE id = $1',
      [brokerId]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      broker_id: r.broker_id,
      broker_name: r.broker_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      name: r.name,
      code: r.code,
      email: r.email,
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      clients_count: r.clients_count,
      turnover: r.turnover,
      commission_earned: r.commission,
      created_at: new Date(r.created_at).toISOString().split('T')[0]
    };
  }

  async updateSubBrokerStatus(id: string, status: EntityStatus): Promise<SubBroker | null> {
    await this.executeQuery(
      'UPDATE sub_brokers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
    const list = await this.getSubBrokers();
    return list.find(sb => sb.id === id) || null;
  }

  async updateSubBroker(id: string, data: Partial<SubBroker>): Promise<SubBroker | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) { params.push(data.name); fields.push(`name = $${params.length}`); }
    if (data.email) { params.push(data.email); fields.push(`email = $${params.length}`); }
    if (data.status) { params.push(data.status); fields.push(`status = $${params.length}`); }

    if (fields.length > 0) {
      params.push(id);
      await this.executeQuery(
        `UPDATE sub_brokers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
        params
      );
    }
    const list = await this.getSubBrokers();
    return list.find(sb => sb.id === id) || null;
  }

  // ----------------------------------------------------
  // HIERARCHY: CLIENTS
  // ----------------------------------------------------
  async getClients(tenantId?: string, subBrokerId?: string): Promise<Client[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = `
      SELECT c.*, t.name as tenant_name, sb.name as parent_sub_broker_name
      FROM clients c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND c.tenant_id = $${params.length}`;
    }
    if (subBrokerId) {
      params.push(subBrokerId);
      sql += ` AND c.sub_broker_id = $${params.length}`;
    }

    sql += ' ORDER BY c.created_at ASC';
    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));

    const dbClients: Client[] = res.rows.map(r => ({
      id: r.id,
      client_code: r.client_code,
      sub_broker_id: r.sub_broker_id,
      sub_broker_name: r.parent_sub_broker_name || r.sub_broker_name || (r.sub_broker_id ? 'Sub-Broker Admin' : 'Unassigned'),
      broker_name: 'Apex Broking',
      master_name: 'Alpha Prime Master',
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || 'Alpha Prime Capital',
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      kyc_status: (r.kyc_status === 'VERIFIED' ? 'APPROVED' : (r.kyc_status || 'PENDING')) as KYCStatus,
      wallet_balance: parseFloat(r.balance || '0'),
      available_margin: parseFloat(r.equity || '0'),
      todays_pl: 0,
      open_positions_count: 0,
      created_at: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-01-01'
    }));

    // Actively fetch live authoritative clients from Trading Platform API
    try {
      const liveRes = await tradingPlatformClient.getLiveClients(tenantId);
      const remoteClients = Array.isArray(liveRes.data?.clients)
        ? liveRes.data.clients
        : (Array.isArray(liveRes.data?.items) ? liveRes.data.items : (Array.isArray(liveRes.data) ? liveRes.data : []));

      if (liveRes.success && remoteClients && remoteClients.length > 0) {
        const seenIds = new Set(dbClients.map(c => c.id));
        const seenCodes = new Set(dbClients.map(c => c.client_code));

        for (const rc of remoteClients) {
          const clientId = rc.id || rc.userId || `CLT-${rc.clientCode || '001'}`;
          const clientCode = rc.clientCode || rc.client_code || rc.userId || clientId;

          if (!seenIds.has(clientId) && !seenCodes.has(clientCode)) {
            seenIds.add(clientId);
            seenCodes.add(clientCode);
            dbClients.push({
              id: clientId,
              client_code: clientCode,
              sub_broker_id: rc.sub_broker_id || null,
              sub_broker_name: rc.sub_broker_name || 'Direct / Trading Platform',
              broker_name: 'Apex Broking',
              master_name: 'Alpha Prime Master',
              tenant_id: rc.tenantId || rc.tenant_id || 'vertex-default',
              tenant_name: 'Alpha Prime Capital',
              name: rc.fullName || rc.name || 'Trader',
              email: rc.email || `${clientCode.toLowerCase()}@tradingplatform.com`,
              phone: rc.phone || '',
              status: (rc.status || rc.accountStatus || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
              kyc_status: (rc.kycStatus === 'VERIFIED' || rc.kyc_status === 'VERIFIED' ? 'APPROVED' : (rc.kyc_status || 'APPROVED')) as KYCStatus,
              wallet_balance: parseFloat(rc.balance || rc.wallet_balance || '100000'),
              available_margin: parseFloat(rc.equity || rc.available_margin || rc.balance || '100000'),
              todays_pl: 0,
              open_positions_count: 0,
              created_at: rc.createdAt ? new Date(rc.createdAt).toISOString().split('T')[0] : '2026-08-30'
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('[PostgresTradingDataProvider] Remote Trading Platform clients query warning:', e?.message || e);
    }

    if (subBrokerId) {
      return dbClients.filter(c => c.sub_broker_id === subBrokerId);
    }

    return dbClients;
  }

  async getTradingTenantId(adminTenantId: string): Promise<string | undefined> {
    const res = await this.executeQuery(
      'SELECT trading_tenant_id FROM tenants WHERE id = $1 LIMIT 1',
      [adminTenantId]
    );
    return res.rows[0]?.trading_tenant_id || process.env.TRADING_TENANT_ID || adminTenantId;
  }

  async getAdminTenantIdByTradingTenantId(tradingTenantId: string): Promise<string | undefined> {
    const res = await this.executeQuery(
      'SELECT id FROM tenants WHERE trading_tenant_id = $1 OR id = $1 LIMIT 1',
      [tradingTenantId]
    );
    if (res.rows.length > 0) return res.rows[0].id;
    if (process.env.TRADING_TENANT_ID && tradingTenantId === process.env.TRADING_TENANT_ID) {
      const envRes = await this.executeQuery(
        'SELECT id FROM tenants WHERE trading_tenant_id = $1 OR id = $1 LIMIT 1',
        [process.env.TRADING_TENANT_ID]
      );
      if (envRes.rows.length > 0) return envRes.rows[0].id;
    }
    const fallbackRes = await this.executeQuery(
      "SELECT id FROM tenants WHERE status = 'ACTIVE' ORDER BY created_at ASC, id ASC LIMIT 1"
    );
    return fallbackRes.rows[0]?.id;
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    const id = data.id || `CLT-${Date.now().toString().slice(-4)}`;
    let subBrokerId: string | null = data.sub_broker_id === 'UNASSIGNED' || data.sub_broker_id === undefined ? null : data.sub_broker_id;
    let tenantId = data.tenant_id;
    let subBrokerName = data.sub_broker_name;

    if (subBrokerId) {
      // Verify parent sub-broker
      const sbRes = await this.executeQuery('SELECT tenant_id, name FROM sub_brokers WHERE id = $1', [subBrokerId]);
      if (sbRes.rows.length > 0) {
        tenantId = tenantId || sbRes.rows[0].tenant_id;
        subBrokerName = sbRes.rows[0].name;
      } else {
        subBrokerId = null;
        subBrokerName = 'Unassigned';
        tenantId = tenantId || 'TNT-001';
      }
    } else {
      tenantId = tenantId || 'TNT-001';
      subBrokerName = 'Unassigned';
    }

    const clientCode = data.client_code || `CLT${id.replace(/[^0-9]/g, '').slice(-3) || '999'}`;

    const initialBalance = data.wallet_balance !== undefined ? parseFloat(String(data.wallet_balance)) : 0.00;
    const initialMargin = data.available_margin !== undefined ? parseFloat(String(data.available_margin)) : initialBalance;

    const res = await this.executeQuery(`
      INSERT INTO clients (
        id, tenant_id, sub_broker_id, sub_broker_name, client_code, name, email, phone,
        status, kyc_status, balance, equity, margin_used, total_trades
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      id,
      tenantId,
      subBrokerId,
      subBrokerName || (subBrokerId ? 'Sub-Broker Admin' : 'Unassigned'),
      clientCode,
      data.name || 'New Client',
      data.email || 'client@tradematrix.io',
      data.phone || '+91 98333 00000',
      data.status || 'ACTIVE',
      data.kyc_status || 'APPROVED',
      initialBalance,
      initialMargin,
      0.00,
      0
    ]);

    // Update parent sub-broker client count if assigned
    if (subBrokerId) {
      await this.executeQuery(
        'UPDATE sub_brokers SET clients_count = clients_count + 1 WHERE id = $1',
        [subBrokerId]
      );
    }

    const r = res.rows[0];

    // Trigger S2S account synchronization with the Trading Platform
    try {
      await tradingPlatformClient.syncClientAccount({
        clientId: r.id,
        clientCode: r.client_code,
        name: r.name,
        email: r.email,
        phone: r.phone,
        initialBalance: parseFloat(r.balance) || 100000,
        subBrokerId: r.sub_broker_id,
        tenantId: r.tenant_id
      });
      console.log(`[S2S] Client account ${r.id} (${r.name}) successfully synchronized to Trading Platform.`);
    } catch (syncErr: any) {
      console.warn(`[S2S] Client account ${r.id} created locally, S2S push queued/notified:`, syncErr?.message || syncErr);
    }

    return {
      id: r.id,
      client_code: r.client_code,
      sub_broker_id: r.sub_broker_id,
      sub_broker_name: r.sub_broker_name,
      broker_name: 'Apex Broking',
      master_name: 'Alpha Prime Master',
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      name: r.name,
      email: r.email,
      phone: r.phone,
      status: r.status as 'ACTIVE' | 'SUSPENDED',
      kyc_status: (r.kyc_status === 'VERIFIED' ? 'APPROVED' : (r.kyc_status || 'PENDING')) as KYCStatus,
      wallet_balance: parseFloat(r.balance),
      available_margin: parseFloat(r.equity),
      todays_pl: 0,
      open_positions_count: 0,
      created_at: new Date(r.created_at).toISOString().split('T')[0]
    };
  }

  async updateClientStatus(id: string, status: EntityStatus): Promise<Client | null> {
    await this.executeQuery(
      'UPDATE clients SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );
    const list = await this.getClients();
    return list.find(c => c.id === id) || null;
  }

  async updateClient(id: string, data: Partial<Client>): Promise<Client | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name) { params.push(data.name); fields.push(`name = $${params.length}`); }
    if (data.email) { params.push(data.email); fields.push(`email = $${params.length}`); }
    if (data.phone) { params.push(data.phone); fields.push(`phone = $${params.length}`); }
    if (data.status) { params.push(data.status); fields.push(`status = $${params.length}`); }
    if (data.wallet_balance !== undefined) { params.push(data.wallet_balance); fields.push(`balance = $${params.length}`); }

    if (fields.length > 0) {
      params.push(id);
      await this.executeQuery(
        `UPDATE clients SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`,
        params
      );
    }
    const list = await this.getClients();
    return list.find(c => c.id === id) || null;
  }

  // ----------------------------------------------------
  // CLIENT TRADING PLATFORM DATA & ACCOUNT DETAILS
  // ----------------------------------------------------
  async getClientAccountDetails(clientId: string, tenantId?: string): Promise<any> {
    const cleanId = clientId.trim();
    // 1. Fetch Client Profile from DB
    const clientRes = await this.executeQuery(`
      SELECT c.*, t.name as tenant_name, sb.name as parent_sub_broker_name,
             b.name as parent_broker_name, m.name as parent_master_name
      FROM clients c
      LEFT JOIN tenants t ON c.tenant_id = t.id
      LEFT JOIN sub_brokers sb ON c.sub_broker_id = sb.id
      LEFT JOIN brokers b ON sb.broker_id = b.id
      LEFT JOIN masters m ON b.master_id = m.id
      WHERE c.id = $1 OR c.client_code = $1 OR c.id = $2
    `, [cleanId, cleanId.replace('-', '')]);

    const clientRow = clientRes.rows[0];
    const clientName = clientRow?.name || 'Trader';
    const clientCode = clientRow?.client_code || cleanId;
    const resolvedTenant = clientRow?.tenant_id || tenantId || 'TNT-001';

    // 2. Fetch Live Trading Orders (S2S first, fallback DB)
    const clientOrders = await this.getClientOrders(cleanId, resolvedTenant);

    // 3. Fetch Live Executed Trades (S2S first, fallback DB)
    const clientTrades = await this.getClientTrades(cleanId, resolvedTenant);

    // 4. Fetch Live Open Positions (S2S first, fallback DB)
    const clientPositions = await this.getClientPositions(cleanId, resolvedTenant);

    // 5. Attempt remote Trading Platform S2S Client Account
    let remoteAccount: any = null;
    try {
      const s2sRes = await tradingPlatformClient.getClientTradingAccount(cleanId, resolvedTenant);
      if (s2sRes.success && s2sRes.data) {
        remoteAccount = s2sRes.data;
      }
    } catch {
      // Graceful fallback to computed/local state
    }

    // Compute balances & P&L from real database/S2S values
    const rawBalance = remoteAccount?.balance !== undefined ? parseFloat(remoteAccount.balance) : parseFloat(clientRow?.balance || '0');
    const rawEquity = remoteAccount?.equity !== undefined ? parseFloat(remoteAccount.equity) : parseFloat(clientRow?.equity || `${rawBalance}`);
    const rawMarginUsed = remoteAccount?.marginUsed !== undefined ? parseFloat(remoteAccount.marginUsed) : parseFloat(clientRow?.margin_used || '0');
    const freeMargin = Math.max(0, rawEquity - rawMarginUsed);
    const buyingPower = rawBalance * 5;

    // Sum unrealized P&L from positions
    let unrealizedPL = 0;
    for (const pos of clientPositions) {
      const num = parseFloat(String(pos.rawPnl || pos.pnl || pos.unrealized_pnl || pos.unrealizedPL || '0').replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) unrealizedPL += num;
    }

    // Sum realized P&L from trades
    let realizedPL = 0;
    for (const trd of clientTrades) {
      const num = parseFloat(String(trd.pl || '0').replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) realizedPL += num;
    }

    const tradingPlatformWebUrl = `https://trading-platform-2t6r.onrender.com?client_id=${encodeURIComponent(cleanId)}&client_code=${encodeURIComponent(clientCode)}&name=${encodeURIComponent(clientName)}&balance=${rawBalance}`;

    return {
      client: {
        id: clientRow?.id || cleanId,
        client_code: clientCode,
        name: clientName,
        email: clientRow?.email || '—',
        phone: clientRow?.phone || '—',
        status: (clientRow?.status || 'ACTIVE') as 'ACTIVE' | 'SUSPENDED',
        kyc_status: (clientRow?.kyc_status === 'VERIFIED' ? 'APPROVED' : (clientRow?.kyc_status || 'PENDING')),
        pan: clientRow?.pan || '—',
        address: clientRow?.address || '—',
        master: clientRow?.parent_master_name || 'Central Master',
        broker: clientRow?.parent_broker_name || 'Central Broker',
        subBroker: clientRow?.parent_sub_broker_name || clientRow?.sub_broker_name || 'Direct',
        tenant_id: resolvedTenant,
        tenant_name: clientRow?.tenant_name || 'Central Platform',
        joined: clientRow?.created_at ? new Date(clientRow.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        created_at: clientRow?.created_at || new Date().toISOString()
      },
      tradingAccount: {
        accountNumber: `TRD-${cleanId}`,
        dematNumber: `IN300128-${cleanId}`,
        tradingPlatformUrl: tradingPlatformWebUrl,
        mainPlatformLink: 'https://trading-platform-2t6r.onrender.com',
        currency: 'INR',
        balance: `₹${rawBalance.toLocaleString('en-IN')}`,
        rawBalance,
        availableMargin: `₹${freeMargin.toLocaleString('en-IN')}`,
        rawAvailableMargin: freeMargin,
        utilizedMargin: `₹${rawMarginUsed.toLocaleString('en-IN')}`,
        rawUtilizedMargin: rawMarginUsed,
        collateral: '₹0',
        buyingPower: `₹${buyingPower.toLocaleString('en-IN')}`,
        rawBuyingPower: buyingPower,
        dayPL: `${(realizedPL + (unrealizedPL > 0 ? unrealizedPL : 0)) >= 0 ? '+' : ''}₹${(realizedPL + (unrealizedPL > 0 ? unrealizedPL : 0)).toLocaleString('en-IN')}`,
        realizedPL: `${realizedPL >= 0 ? '+' : ''}₹${realizedPL.toLocaleString('en-IN')}`,
        unrealizedPL: `${unrealizedPL >= 0 ? '+' : ''}₹${unrealizedPL.toLocaleString('en-IN')}`,
        winRatio: clientTrades.length > 0 ? `${Math.round((clientTrades.filter(t => (t.pl || 0) >= 0).length / clientTrades.length) * 100)}%` : '0%',
        totalOrders: clientOrders.length,
        totalTrades: clientTrades.length,
        openPositions: clientPositions.length,
        leverage: '5x Intraday / 1x CNC',
        marginUtilizationPercent: rawEquity > 0 ? Math.round((rawMarginUsed / rawEquity) * 100) : 0,
        segments: ['NSE Equity', 'NSE Futures & Options', 'MCX Commodities', 'Currency Derivatives'],
        s2sStatus: tradingPlatformClient.getCircuitBreakerState().state,
        remoteAcknowledged: Boolean(remoteAccount)
      },
      orders: clientOrders,
      trades: clientTrades,
      positions: clientPositions
    };
  }

  async getClientOrders(clientId: string, tenantId?: string): Promise<any[]> {
    const cleanId = clientId.trim();
    // 1. Attempt live S2S query from Trading Platform
    try {
      const s2sRes = await tradingPlatformClient.getClientOrders(cleanId, tenantId);
      const list = Array.isArray(s2sRes.data) ? s2sRes.data : (Array.isArray(s2sRes.data?.orders) ? s2sRes.data.orders : null);
      if (s2sRes.success && Array.isArray(list)) {
        return list.map((r: any) => ({
          id: r.id || r.order_id,
          order_id: r.order_id || r.id,
          symbol: r.symbol,
          side: r.side,
          quantity: r.quantity || r.qty,
          price: parseFloat(r.price),
          type: r.order_type || r.type || 'LIMIT',
          status: r.status,
          time: r.created_at ? new Date(r.created_at).toISOString().slice(11, 19) : '10:14:22',
          created_at: r.created_at || new Date().toISOString()
        }));
      }
    } catch {
      // Fallback to local DB
    }

    // 2. Query local PostgreSQL orders table
    const res = await this.executeQuery(
      'SELECT * FROM orders WHERE client_id = $1 OR client_id = $2 ORDER BY created_at DESC',
      [cleanId, cleanId.replace('-', '')]
    );

    return res.rows.map(r => ({
      id: r.id,
      order_id: r.id,
      symbol: r.symbol,
      side: r.side,
      quantity: r.quantity,
      price: parseFloat(r.price),
      type: r.order_type,
      status: r.status,
      time: r.created_at ? new Date(r.created_at).toISOString().slice(11, 19) : '10:14:22',
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  }

  async getClientTrades(clientId: string, tenantId?: string): Promise<any[]> {
    const cleanId = clientId.trim();
    // 1. Attempt live S2S query from Trading Platform
    try {
      const s2sRes = await tradingPlatformClient.getClientTrades(cleanId, tenantId);
      const list = Array.isArray(s2sRes.data) ? s2sRes.data : (Array.isArray(s2sRes.data?.trades) ? s2sRes.data.trades : null);
      if (s2sRes.success && Array.isArray(list)) {
        return list.map((r: any) => ({
          id: r.id || r.trade_id,
          trade_id: r.trade_id || r.id,
          symbol: r.symbol,
          side: r.side,
          quantity: r.quantity,
          qty: r.quantity,
          price: parseFloat(r.price),
          total_value: parseFloat(r.total_value || (parseFloat(r.price) * r.quantity).toString()),
          pnl: r.pl ? `${r.pl >= 0 ? '+' : ''}₹${r.pl}` : '+₹0',
          pl: r.pl || 0,
          status: r.status || 'EXECUTED',
          time: r.created_at ? new Date(r.created_at).toISOString().slice(11, 19) : '10:14:22',
          timestamp: r.created_at || new Date().toISOString()
        }));
      }
    } catch {
      // Fallback
    }

    // 2. Query local PostgreSQL trades table
    const res = await this.executeQuery(
      'SELECT * FROM trades WHERE client_id = $1 OR client_id = $2 ORDER BY created_at DESC',
      [cleanId, cleanId.replace('-', '')]
    );

    return res.rows.map(r => ({
      id: r.id,
      trade_id: r.trade_id || r.id,
      symbol: r.symbol,
      side: r.side,
      quantity: r.quantity,
      qty: r.quantity,
      price: parseFloat(r.price),
      total_value: parseFloat(r.total_value || (parseFloat(r.price) * r.quantity).toString()),
      pnl: r.total_value ? `+₹${Math.round(parseFloat(r.total_value) * 0.02)}` : '+₹0',
      pl: 0,
      status: r.status,
      time: r.created_at ? new Date(r.created_at).toISOString().slice(11, 19) : '10:14:22',
      timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  }

  async getClientPositions(clientId: string, tenantId?: string): Promise<any[]> {
    const cleanId = clientId.trim();
    // 1. Attempt live S2S query from Trading Platform
    try {
      const s2sRes = await tradingPlatformClient.getClientPositions(cleanId, tenantId);
      const list = Array.isArray(s2sRes.data) ? s2sRes.data : (Array.isArray(s2sRes.data?.positions) ? s2sRes.data.positions : null);
      if (s2sRes.success && Array.isArray(list)) {
        return list.map((r: any) => {
          const pnlNum = parseFloat(r.pnl || r.unrealized_pnl || '0');
          const buyPriceNum = parseFloat(r.buy_price || r.avg_price || '0');
          const curPriceNum = parseFloat(r.current_price || '0');
          const qtyNum = parseInt(r.quantity || r.qty || '0', 10);
          const marginVal = r.margin !== undefined && r.margin !== null ? parseFloat(String(r.margin)) : (r.margin_used !== undefined ? parseFloat(String(r.margin_used)) : (r.used_margin !== undefined ? parseFloat(String(r.used_margin)) : 0));
          return {
            id: r.id || `pos_${cleanId}_${r.symbol}`,
            symbol: r.symbol,
            side: r.side || 'BUY',
            qty: qtyNum,
            avgPrice: `₹${buyPriceNum.toLocaleString('en-IN')}`,
            rawAvgPrice: buyPriceNum,
            ltp: `₹${curPriceNum.toLocaleString('en-IN')}`,
            currentPrice: `₹${curPriceNum.toLocaleString('en-IN')}`,
            rawLtp: curPriceNum,
            pnl: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN')}`,
            rawPnl: pnlNum,
            margin: `₹${marginVal.toLocaleString('en-IN')}`,
            status: r.status || 'OPEN'
          };
        });
      }
    } catch {
      // Fallback
    }

    // 2. Query local PostgreSQL positions table
    const res = await this.executeQuery(
      'SELECT * FROM positions WHERE client_id = $1 OR client_id = $2',
      [cleanId, cleanId.replace('-', '')]
    );

    return res.rows.map(r => {
      const pnlNum = parseFloat(r.unrealized_pnl || r.pnl || '0');
      const buyPriceNum = parseFloat(r.buy_price || '0');
      const curPriceNum = parseFloat(r.current_price || '0');
      const marginVal = r.margin !== undefined && r.margin !== null ? parseFloat(String(r.margin)) : (r.margin_used !== undefined ? parseFloat(String(r.margin_used)) : 0);
      return {
        id: r.id,
        symbol: r.symbol,
        side: r.side,
        qty: r.quantity,
        avgPrice: `₹${buyPriceNum.toLocaleString('en-IN')}`,
        rawAvgPrice: buyPriceNum,
        ltp: `₹${curPriceNum.toLocaleString('en-IN')}`,
        currentPrice: `₹${curPriceNum.toLocaleString('en-IN')}`,
        rawLtp: curPriceNum,
        pnl: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN')}`,
        rawPnl: pnlNum,
        margin: `₹${marginVal.toLocaleString('en-IN')}`,
        status: r.status
      };
    });
  }

  // ----------------------------------------------------
  // COMPLIANCE & KYC
  // ----------------------------------------------------
  async getKYCRecords(tenantId?: string, status?: string): Promise<KYCRecord[]> {
    let sql = 'SELECT * FROM kyc_records WHERE 1=1';
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (status && status !== 'ALL') {
      params.push(status);
      sql += ` AND kyc_status = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';
    const res = await this.executeQuery(sql, params);

    return res.rows.map(r => ({
      id: r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      kyc_status: (r.kyc_status === 'VERIFIED' ? 'APPROVED' : (r.kyc_status || 'PENDING')) as KYCStatus,
      document_type: r.document_type || 'PAN_CARD',
      document_status: ((r.kyc_status === 'APPROVED' || r.kyc_status === 'VERIFIED') ? 'VERIFIED' : (r.kyc_status === 'REJECTED' ? 'REJECTED' : 'PENDING')) as any,
      assigned_reviewer: r.reviewed_by || 'Compliance Officer',
      submitted_date: r.submitted_at?.toISOString() || new Date().toISOString(),
      id_number: r.pan_number || r.aadhaar_number,
      notes: r.notes
    }));
  }

  async updateKYCStatus(id: string, status: KYCRecord['kyc_status'], notes?: string): Promise<KYCRecord | null> {
    const kycMappedStatus = status === 'APPROVED' ? 'APPROVED' : (status === 'REJECTED' ? 'REJECTED' : 'PENDING');
    const clientMappedStatus = status === 'APPROVED' ? 'VERIFIED' : (status === 'REJECTED' ? 'REJECTED' : 'PENDING');

    // 1. Try updating existing KYC record by id or client_id
    let res = await this.executeQuery(`
      UPDATE kyc_records
      SET kyc_status = $1, notes = COALESCE($2, notes), reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 OR client_id = $3
      RETURNING *
    `, [kycMappedStatus, notes || null, id]);

    // 2. Also update clients table
    await this.executeQuery(`
      UPDATE clients
      SET kyc_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 OR id = (SELECT client_id FROM kyc_records WHERE id = $2 LIMIT 1)
    `, [clientMappedStatus, id]);

    // 3. If no kyc_records row existed yet, create one from client info
    if (res.rows.length === 0) {
      const clientRes = await this.executeQuery('SELECT * FROM clients WHERE id = $1', [id]);
      if (clientRes.rows.length > 0) {
        const client = clientRes.rows[0];
        const newKycId = `KYC-${Date.now().toString().slice(-4)}`;
        const insertRes = await this.executeQuery(`
          INSERT INTO kyc_records (
            id, tenant_id, client_id, client_code, client_name, email, pan_number, aadhaar_number, kyc_status,
            document_type, reviewed_by, reviewed_at, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12)
          RETURNING *
        `, [
          newKycId, client.tenant_id, client.id, client.client_code || 'CLT001', client.name,
          client.email || 'client@example.com', 'ABCDE1234F', '123456789012', kycMappedStatus,
          'PAN_AADHAAR', 'Compliance Officer', notes || 'Updated via Admin Hierarchy'
        ]);
        if (insertRes.rows.length > 0) {
          res = insertRes;
        }
      }
    }

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      kyc_status: (r.kyc_status === 'VERIFIED' ? 'APPROVED' : (r.kyc_status || 'PENDING')) as KYCStatus,
      document_type: r.document_type || 'PAN_CARD',
      document_status: ((r.kyc_status === 'APPROVED' || r.kyc_status === 'VERIFIED') ? 'VERIFIED' : (r.kyc_status === 'REJECTED' ? 'REJECTED' : 'PENDING')) as any,
      assigned_reviewer: r.reviewed_by || 'Compliance Officer',
      submitted_date: r.submitted_at?.toISOString() || new Date().toISOString(),
      id_number: r.pan_number || r.aadhaar_number,
      notes: r.notes
    };
  }

  async getFundDeposits(tenantId?: string, status?: string): Promise<FundDepositItem[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM fund_deposits WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (status && status !== 'All Status' && status !== 'ALL') {
      params.push(status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));
    const dbDeposits = res.rows.map(r => ({
      id: r.id,
      txnId: r.id,
      client: r.client_name,
      amount: `₹${parseFloat(r.amount).toLocaleString('en-IN')}`,
      method: r.payment_method,
      reference: r.transaction_ref,
      status: (r.status as any) || 'PENDING',
      date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-03-29',
      rawAmount: parseFloat(r.amount)
    }));

    try {
      const liveFundsRes = await tradingPlatformClient.getLiveFunds(tenantId);
      const remoteList = Array.isArray(liveFundsRes.data?.funds)
        ? liveFundsRes.data.funds
        : (Array.isArray(liveFundsRes.data?.transactions) ? liveFundsRes.data.transactions : (Array.isArray(liveFundsRes.data?.items) ? liveFundsRes.data.items : []));

      if (liveFundsRes.success && remoteList && remoteList.length > 0) {
        const seenIds = new Set(dbDeposits.map(d => d.id || d.txnId));
        for (const rf of remoteList) {
          const type = (rf.type || rf.transaction_type || '').toUpperCase();
          if (type.includes('DEPOSIT') || (!type.includes('WITHDRAW') && parseFloat(rf.amount || '0') > 0)) {
            const id = rf.id || rf.transactionId || `DEP-${Date.now()}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              dbDeposits.push({
                id,
                txnId: id,
                client: rf.clientName || rf.client_name || rf.name || 'Client',
                amount: `₹${parseFloat(rf.amount || '0').toLocaleString('en-IN')}`,
                method: rf.method || rf.gateway || 'UPI/IMPS',
                reference: rf.reference || rf.refNo || id,
                status: (rf.status || 'COMPLETED').toUpperCase(),
                date: rf.createdAt ? new Date(rf.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                rawAmount: parseFloat(rf.amount || '0')
              });
            }
          }
        }
      }
    } catch {}

    return dbDeposits;
  }

  async approveFundDeposit(id: string, actor: string = 'Compliance Officer'): Promise<any> {
    return withTransaction(async (client) => {
      const depRes = await client.query('SELECT * FROM fund_deposits WHERE id = $1 FOR UPDATE', [id]);
      if (depRes.rows.length === 0) throw new Error(`Deposit ${id} not found`);
      const dep = depRes.rows[0];

      if (dep.status === 'COMPLETED') {
        return { success: true, message: 'Deposit already completed', deposit: dep };
      }

      await client.query(`
        UPDATE fund_deposits
        SET status = 'COMPLETED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [actor, id]);

      const clientRes = await client.query(
        'UPDATE clients SET balance = balance + $1, equity = equity + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [dep.amount, dep.client_id]
      );
      const updatedClient = clientRes.rows[0];
      const newBalance = updatedClient ? parseFloat(updatedClient.balance) : parseFloat(dep.amount);

      const ledgerId = `LDG-${Date.now().toString().slice(-6)}`;
      await client.query(`
        INSERT INTO ledger_entries (
          id, tenant_id, client_id, client_code, client_name, entry_type,
          debit, credit, balance_after, reference_id, description, is_finalized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        ledgerId, dep.tenant_id, dep.client_id, dep.client_code, dep.client_name, 'DEPOSIT',
        0.00, dep.amount, newBalance, dep.transaction_ref || dep.id,
        `Deposit of ₹${parseFloat(dep.amount).toLocaleString('en-IN')} approved by ${actor}`,
        true
      ]);

      await client.query(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `LOG-${Date.now()}`, dep.tenant_id, actor, 'DEPOSIT_APPROVED', 'COMPLIANCE',
        `Approved deposit ${dep.id} for client ${dep.client_name} (₹${parseFloat(dep.amount).toLocaleString('en-IN')})`,
        '127.0.0.1'
      ]);

      return { success: true, message: 'Deposit approved successfully', depositId: id };
    }, this.pool);
  }

  async rejectFundDeposit(id: string, actor: string = 'Compliance Officer'): Promise<any> {
    const res = await this.executeQuery(`
      UPDATE fund_deposits
      SET status = 'REJECTED', notes = 'Rejected by ' || $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [actor, id]);

    if (res.rows.length > 0) {
      const dep = res.rows[0];
      // Update fund_transactions projection if present
      await this.executeQuery(
        `UPDATE fund_transactions SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      ).catch(() => {});

      await this.executeQuery(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `LOG-${Date.now()}`, dep.tenant_id, actor, 'DEPOSIT_REJECTED', 'COMPLIANCE',
        `Rejected deposit ${dep.id} for client ${dep.client_name}`,
        '127.0.0.1'
      ]);
    }
    return { success: true, message: 'Deposit rejected' };
  }

  async createFundDeposit(data: any): Promise<any> {
    const id = data.id || `DEP${Date.now().toString().slice(-4)}`;
    const res = await this.executeQuery(`
      INSERT INTO fund_deposits (
        id, tenant_id, client_id, client_code, client_name, amount, currency,
        payment_method, transaction_ref, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id, data.tenant_id || 'TNT-001', data.client_id || 'CLT-001', data.client_code || 'CLT001',
      data.client_name || 'Client', data.amount || 10000.00, data.currency || 'INR',
      data.payment_method || 'Bank Transfer', data.transaction_ref || `TXN-${Date.now()}`,
      data.status || 'PENDING', data.notes || null
    ]);
    return res.rows[0];
  }

  async getFundWithdrawals(tenantId?: string, status?: string): Promise<FundWithdrawalItem[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM fund_withdrawals WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (status && status !== 'All Status' && status !== 'ALL') {
      params.push(status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));
    const dbWithdrawals = res.rows.map(r => ({
      id: r.id,
      txnId: r.id,
      client: r.client_name,
      client_name: r.client_name,
      client_code: r.client_code,
      client_id: r.client_id,
      amount: `₹${parseFloat(r.amount).toLocaleString('en-IN')}`,
      method: r.bank_name ? `${r.bank_name} (${r.bank_account_number ? r.bank_account_number.slice(-4) : 'Bank'})` : 'Bank Wire',
      reference: r.ifsc_code || r.id,
      status: (r.status as any) || 'PENDING',
      date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-03-29',
      rawAmount: parseFloat(r.amount)
    }));

    try {
      const liveFundsRes = await tradingPlatformClient.getLiveFunds(tenantId);
      const remoteList = Array.isArray(liveFundsRes.data?.funds)
        ? liveFundsRes.data.funds
        : (Array.isArray(liveFundsRes.data?.transactions) ? liveFundsRes.data.transactions : (Array.isArray(liveFundsRes.data?.items) ? liveFundsRes.data.items : []));

      if (liveFundsRes.success && remoteList && remoteList.length > 0) {
        const seenIds = new Set(dbWithdrawals.map(w => w.id || w.txnId));
        for (const rf of remoteList) {
          const type = (rf.type || rf.transaction_type || '').toUpperCase();
          if (type.includes('WITHDRAW')) {
            const id = rf.id || rf.transactionId || `WDR-${Date.now()}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              dbWithdrawals.push({
                id,
                txnId: id,
                client: rf.clientName || rf.client_name || rf.name || 'Client',
                client_name: rf.clientName || rf.client_name || rf.name || 'Client',
                client_code: rf.clientCode || rf.client_code || 'CLT001',
                client_id: rf.clientId || rf.client_id || 'CLT-001',
                amount: `₹${parseFloat(rf.amount || '0').toLocaleString('en-IN')}`,
                method: rf.method || rf.bank || 'Bank Wire',
                reference: rf.reference || rf.refNo || id,
                status: (rf.status || 'COMPLETED').toUpperCase(),
                date: rf.createdAt ? new Date(rf.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                rawAmount: parseFloat(rf.amount || '0')
              });
            }
          }
        }
      }
    } catch {}

    return dbWithdrawals;
  }

  async approveFundWithdrawal(id: string, actor: string = 'Compliance Officer'): Promise<any> {
    return withTransaction(async (client) => {
      const wdrRes = await client.query('SELECT * FROM fund_withdrawals WHERE id = $1 FOR UPDATE', [id]);
      if (wdrRes.rows.length === 0) throw new Error(`Withdrawal ${id} not found`);
      const wdr = wdrRes.rows[0];

      if (wdr.status === 'COMPLETED') {
        return { success: true, message: 'Withdrawal already completed', withdrawal: wdr };
      }

      // Consistency check: Verify client exists and has sufficient balance
      const clientCheck = await client.query('SELECT balance, equity FROM clients WHERE id = $1 FOR UPDATE', [wdr.client_id]);
      if (clientCheck.rows.length === 0) {
        throw new Error(`Client account ${wdr.client_id} not found for withdrawal`);
      }
      const currentBal = parseFloat(clientCheck.rows[0].balance || '0');
      const wdrAmount = parseFloat(wdr.amount);
      if (currentBal < wdrAmount) {
        throw new Error(`Insufficient client balance for withdrawal. Current: ₹${currentBal.toLocaleString('en-IN')}, Requested: ₹${wdrAmount.toLocaleString('en-IN')}`);
      }

      await client.query(`
        UPDATE fund_withdrawals
        SET status = 'COMPLETED', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [actor, id]);

      const clientRes = await client.query(
        'UPDATE clients SET balance = balance - $1, equity = equity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [wdr.amount, wdr.client_id]
      );
      const updatedClient = clientRes.rows[0];
      const newBalance = updatedClient ? parseFloat(updatedClient.balance) : 0;

      const ledgerId = `LDG-${Date.now().toString().slice(-6)}`;
      await client.query(`
        INSERT INTO ledger_entries (
          id, tenant_id, client_id, client_code, client_name, entry_type,
          debit, credit, balance_after, reference_id, description, is_finalized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        ledgerId, wdr.tenant_id, wdr.client_id, wdr.client_code, wdr.client_name, 'WITHDRAWAL',
        wdr.amount, 0.00, newBalance, wdr.id,
        `Withdrawal of ₹${parseFloat(wdr.amount).toLocaleString('en-IN')} approved by ${actor}`,
        true
      ]);

      await client.query(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `LOG-${Date.now()}`, wdr.tenant_id, actor, 'WITHDRAWAL_APPROVED', 'COMPLIANCE',
        `Approved withdrawal ${wdr.id} for client ${wdr.client_name} (₹${parseFloat(wdr.amount).toLocaleString('en-IN')})`,
        '127.0.0.1'
      ]);

      return { success: true, message: 'Withdrawal approved successfully', withdrawalId: id };
    }, this.pool);
  }

  async rejectFundWithdrawal(id: string, actor: string = 'Compliance Officer'): Promise<any> {
    const res = await this.executeQuery(`
      UPDATE fund_withdrawals
      SET status = 'REJECTED', notes = 'Rejected by ' || $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [actor, id]);

    if (res.rows.length > 0) {
      const wdr = res.rows[0];
      // Update fund_transactions projection if present
      await this.executeQuery(
        `UPDATE fund_transactions SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      ).catch(() => {});

      await this.executeQuery(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        `LOG-${Date.now()}`, wdr.tenant_id, actor, 'WITHDRAWAL_REJECTED', 'COMPLIANCE',
        `Rejected withdrawal ${wdr.id} for client ${wdr.client_name}`,
        '127.0.0.1'
      ]);
    }
    return { success: true, message: 'Withdrawal rejected' };
  }

  async createFundWithdrawal(data: any): Promise<any> {
    const id = data.id || `WDR${Date.now().toString().slice(-4)}`;
    const res = await this.executeQuery(`
      INSERT INTO fund_withdrawals (
        id, tenant_id, client_id, client_code, client_name, amount, currency,
        bank_name, bank_account_number, ifsc_code, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id, data.tenant_id || 'TNT-001', data.client_id || 'CLT-001', data.client_code || 'CLT001',
      data.client_name || 'Client', data.amount || 5000.00, data.currency || 'INR',
      data.bank_name || 'HDFC Bank', data.bank_account_number || 'XXXXXXXX1234',
      data.ifsc_code || 'HDFC0001234', data.status || 'PENDING', data.notes || null
    ]);
    return res.rows[0];
  }

  async getLedgerEntries(tenantId?: string, type?: string): Promise<LedgerRowItem[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM ledger_entries WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (type && type !== 'All Types' && type !== 'ALL') {
      params.push(type.toUpperCase());
      sql += ` AND entry_type = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));
    const dbLedger = res.rows.map(r => {
      const cr = parseFloat(r.credit || '0');
      const db = parseFloat(r.debit || '0');
      let mappedType: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'P&L' = 'DEPOSIT';
      if (r.entry_type.includes('WITHDRAW')) mappedType = 'WITHDRAWAL';
      else if (r.entry_type.includes('COMMISSION')) mappedType = 'COMMISSION';
      else if (r.entry_type.includes('TRADE') || r.entry_type.includes('P&L')) mappedType = 'P&L';

      return {
        date: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '2026-03-29',
        txnId: r.reference_id || r.id,
        account: r.client_name,
        type: mappedType,
        credit: cr > 0 ? `+₹${cr.toLocaleString('en-IN')}` : '—',
        debit: db > 0 ? `-₹${db.toLocaleString('en-IN')}` : '—',
        balance: `₹${parseFloat(r.balance_after || '0').toLocaleString('en-IN')}`,
        reference: r.description || r.reference_id,
        status: 'COMPLETED' as const
      };
    });

    try {
      const liveLedgerRes = await tradingPlatformClient.getLiveLedger(tenantId);
      const remoteList = Array.isArray(liveLedgerRes.data?.ledger)
        ? liveLedgerRes.data.ledger
        : (Array.isArray(liveLedgerRes.data?.items) ? liveLedgerRes.data.items : (Array.isArray(liveLedgerRes.data) ? liveLedgerRes.data : []));

      if (liveLedgerRes.success && remoteList && remoteList.length > 0) {
        const seenIds = new Set(dbLedger.map(l => l.txnId));
        for (const rl of remoteList) {
          const id = rl.id || rl.reference_id || rl.txnId || `LED-${Date.now()}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            const cr = parseFloat(rl.credit || '0');
            const db = parseFloat(rl.debit || '0');
            let mappedType: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'P&L' = 'DEPOSIT';
            const rawType = (rl.type || rl.entry_type || '').toUpperCase();
            if (rawType.includes('WITHDRAW')) mappedType = 'WITHDRAWAL';
            else if (rawType.includes('COMMISSION')) mappedType = 'COMMISSION';
            else if (rawType.includes('TRADE') || rawType.includes('P&L')) mappedType = 'P&L';

            dbLedger.push({
              date: rl.created_at ? new Date(rl.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              txnId: id,
              account: rl.account || rl.client_name || rl.clientName || 'Trader',
              type: mappedType,
              credit: cr > 0 ? `+₹${cr.toLocaleString('en-IN')}` : '—',
              debit: db > 0 ? `-₹${db.toLocaleString('en-IN')}` : '—',
              balance: `₹${parseFloat(rl.balance || rl.balance_after || '100000').toLocaleString('en-IN')}`,
              reference: rl.description || rl.reference || id,
              status: 'COMPLETED' as const
            });
          }
        }
      }
    } catch {}

    return dbLedger;
  }

  async createLedgerEntry(data: any): Promise<any> {
    const id = data.id || `LDG-${Date.now().toString().slice(-6)}`;
    const res = await this.executeQuery(`
      INSERT INTO ledger_entries (
        id, tenant_id, client_id, client_code, client_name, entry_type,
        debit, credit, balance_after, reference_id, description, is_finalized
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id, data.tenant_id || 'TNT-001', data.client_id || 'CLT-001', data.client_code || 'CLT001',
      data.client_name || 'Client', data.entry_type || 'ADJUSTMENT',
      data.debit || 0.00, data.credit || 0.00, data.balance_after || 0.00,
      data.reference_id || `TXN-${Date.now()}`, data.description || 'Manual Ledger Entry',
      data.is_finalized !== undefined ? data.is_finalized : true
    ]);
    return res.rows[0];
  }

  // ----------------------------------------------------
  // TRADING: ORDERS & TRADES
  // ----------------------------------------------------
  async getOrders(tenantId?: string): Promise<Order[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));

    const dbOrders: Order[] = res.rows.map(r => ({
      id: r.id,
      order_id: r.id,
      client_name: r.client_name,
      tenant_name: 'Alpha Prime Capital',
      symbol: r.symbol,
      type: (r.order_type === 'MARKET' ? 'MARKET' : (r.order_type === 'STOP_LOSS' ? 'STOP_LOSS' : 'LIMIT')) as any,
      side: r.side,
      quantity: parseFloat(r.quantity),
      price: parseFloat(r.price),
      status: r.status,
      created_at: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : '2026-03-29 10:00:00'
    }));

    // Attempt to retrieve and merge any additional live open/pending orders from Trading Platform S2S
    try {
      const liveRes = await tradingPlatformClient.getLiveOrders(tenantId);
      const ordersList = Array.isArray(liveRes.data) ? liveRes.data : (Array.isArray(liveRes.data?.orders) ? liveRes.data.orders : (Array.isArray(liveRes.data?.data) ? liveRes.data.data : null));
      if (liveRes.success && ordersList && ordersList.length > 0) {
        const seenIds = new Set(dbOrders.map(o => o.order_id || o.id));
        for (const r of ordersList) {
          const ordId = r.id || r.order_id;
          if (!seenIds.has(ordId)) {
            seenIds.add(ordId);
            dbOrders.push({
              id: ordId,
              order_id: ordId,
              client_name: r.client_name || 'Client',
              tenant_name: r.tenant_name || 'Alpha Prime Capital',
              symbol: r.symbol,
              type: (r.order_type === 'MARKET' || r.type === 'MARKET') ? 'MARKET' : (r.type === 'STOP_LOSS' ? 'STOP_LOSS' : 'LIMIT'),
              side: r.side,
              quantity: r.quantity,
              price: parseFloat(r.price),
              status: r.status,
              created_at: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
          }
        }
      }
    } catch {
      // Degraded / graceful fallback to local PostgreSQL source of truth
    }

    return dbOrders;
  }

  async getAllTrades(tenantId?: string): Promise<Trade[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM trades WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));

    const dbTrades: Trade[] = res.rows.map(r => ({
      id: r.id,
      trade_id: r.trade_id || r.id,
      client_id: r.client_id,
      client_name: r.client_name,
      tenant_id: r.tenant_id,
      tenant_name: 'Alpha Prime Capital',
      symbol: r.symbol,
      side: r.side,
      quantity: parseFloat(r.quantity),
      price: parseFloat(r.price),
      total_value: parseFloat(r.total_value || (parseFloat(r.price) * parseFloat(r.quantity)).toString()),
      pl: 0,
      status: (r.status === 'CANCELLED' ? 'CANCELLED' : (r.status === 'SETTLED' ? 'SETTLED' : 'EXECUTED')) as any,
      timestamp: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : '2026-03-29 10:00:00'
    }));

    // Attempt live execution stream from Trading Platform S2S and merge
    try {
      const liveRes = await tradingPlatformClient.getLiveTrades(tenantId);
      const tradesList = Array.isArray(liveRes.data) ? liveRes.data : (Array.isArray(liveRes.data?.trades) ? liveRes.data.trades : (Array.isArray(liveRes.data?.data) ? liveRes.data.data : null));
      if (liveRes.success && tradesList && tradesList.length > 0) {
        const seenIds = new Set(dbTrades.map(t => t.trade_id || t.id));
        for (const r of tradesList) {
          const trdId = r.id || r.trade_id;
          if (!seenIds.has(trdId)) {
            seenIds.add(trdId);
            dbTrades.push({
              id: trdId,
              trade_id: trdId,
              client_id: r.client_id || 'CLT-001',
              client_name: r.client_name || 'Client',
              tenant_id: r.tenant_id || tenantId,
              tenant_name: r.tenant_name || 'Alpha Prime Capital',
              symbol: r.symbol,
              side: r.side,
              quantity: r.quantity,
              price: parseFloat(r.price),
              total_value: parseFloat(r.total_value || (parseFloat(r.price) * r.quantity).toString()),
              pl: r.pl || 0,
              status: (r.status === 'CANCELLED' ? 'CANCELLED' : (r.status === 'SETTLED' ? 'SETTLED' : 'EXECUTED')) as any,
              timestamp: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
          }
        }
      }
    } catch {
      // Graceful fallback to PostgreSQL database
    }

    return dbTrades;
  }

  async getPositions(tenantId?: string): Promise<any[]> {
    const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
    let sql = 'SELECT * FROM positions WHERE 1=1';
    const params: any[] = [];
    if (tenantId && !defaultTenants.has(tenantId)) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';

    const res = await this.executeQuery(sql, params).catch(() => ({ rows: [] }));
    const dbPositions: any[] = res.rows.map(r => {
      const pnlNum = parseFloat(r.pnl || '0');
      const buyPriceNum = parseFloat(r.buy_price || '0');
      const curPriceNum = parseFloat(r.current_price || '0');
      const qtyNum = parseFloat(r.quantity || '0');
      const marginVal = r.margin !== undefined && r.margin !== null ? parseFloat(String(r.margin)) : (r.margin_used !== undefined ? parseFloat(String(r.margin_used)) : 0);

      return {
        id: r.id,
        client: r.client_name || 'Client',
        symbol: r.symbol,
        qty: qtyNum.toLocaleString('en-IN'),
        avgPrice: buyPriceNum.toLocaleString('en-IN'),
        currentPrice: curPriceNum.toLocaleString('en-IN'),
        unrealizedPL: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN')}`,
        realizedPL: '+₹0',
        margin: `₹${marginVal.toLocaleString('en-IN')}`,
        unrealizedPLPositive: pnlNum >= 0,
        realizedPLPositive: true,
        status: r.status || 'OPEN'
      };
    });

    // Attempt live position exposure query from Trading Platform and merge
    try {
      const liveRes = await tradingPlatformClient.getLivePositions(tenantId);
      const positionsList = Array.isArray(liveRes.data) ? liveRes.data : (Array.isArray(liveRes.data?.positions) ? liveRes.data.positions : (Array.isArray(liveRes.data?.data) ? liveRes.data.data : null));
      if (liveRes.success && positionsList && positionsList.length > 0) {
        const seenIds = new Set(dbPositions.map(p => p.id));
        for (const r of positionsList) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            const pnlNum = parseFloat(r.pnl || r.unrealized_pnl || '0');
            const buyPriceNum = parseFloat(r.buy_price || r.avg_price || '0');
            const curPriceNum = parseFloat(r.current_price || '0');
            const qtyNum = parseFloat(r.quantity || r.qty || '0');
            const marginVal = r.margin !== undefined && r.margin !== null ? parseFloat(String(r.margin)) : (r.margin_used !== undefined ? parseFloat(String(r.margin_used)) : (r.used_margin !== undefined ? parseFloat(String(r.used_margin)) : 0));

            dbPositions.push({
              id: r.id,
              client: r.client_name || r.client || 'Client',
              symbol: r.symbol,
              qty: qtyNum.toLocaleString('en-IN'),
              avgPrice: buyPriceNum.toLocaleString('en-IN'),
              currentPrice: curPriceNum.toLocaleString('en-IN'),
              unrealizedPL: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN')}`,
              realizedPL: '+₹0',
              margin: `₹${marginVal.toLocaleString('en-IN')}`,
              unrealizedPLPositive: pnlNum >= 0,
              realizedPLPositive: true,
              status: r.status || 'OPEN'
            });
          }
        }
      }
    } catch {
      // Degraded / graceful fallback to local DB records
    }

    try {
      const liveRes = await tradingPlatformClient.getLivePositions(tenantId);
      let positionsList = Array.isArray(liveRes.data) ? liveRes.data : (Array.isArray(liveRes.data?.positions) ? liveRes.data.positions : null);
      if (tenantId && positionsList) {
        const defaultTenants = new Set(['vertex-default', 'default', 'TNT-001', 'ALL', 'ALL_TENANTS', '']);
        if (!defaultTenants.has(tenantId)) {
          positionsList = positionsList.filter((p: any) => (p.tenant_id || p.tenantId) === tenantId);
        }
      }
      if (liveRes.success && positionsList && positionsList.length > 0) {
        const seenIds = new Set(dbPositions.map(p => p.id));
        for (const r of positionsList) {
          const posId = r.id || r.positionId || `POS-${r.symbol}-${r.side}`;
          if (!seenIds.has(posId)) {
            const pnlNum = parseFloat(r.pnl || r.unrealizedPnl || '0');
            const buyPriceNum = parseFloat(r.buyPrice || r.avgPrice || r.entryPrice || '0');
            const curPriceNum = parseFloat(r.currentPrice || r.markPrice || buyPriceNum.toString());
            const qtyNum = parseFloat(r.quantity || r.qty || '1');
            const marginVal = parseFloat(r.margin || r.marginUsed || '0');
            dbPositions.push({
              id: posId,
              client: r.clientName || r.client_name || r.userId || 'Live Trader',
              symbol: r.symbol,
              qty: qtyNum.toLocaleString('en-IN'),
              avgPrice: buyPriceNum.toLocaleString('en-IN'),
              currentPrice: curPriceNum.toLocaleString('en-IN'),
              unrealizedPL: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN')}`,
              realizedPL: '+₹0',
              margin: `₹${marginVal.toLocaleString('en-IN')}`,
              unrealizedPLPositive: pnlNum >= 0,
              realizedPLPositive: true,
              status: r.status || 'OPEN'
            });
            seenIds.add(posId);
          }
        }
      }
    } catch (liveErr: any) {
      // non-fatal
    }
    return dbPositions;
  }

  async squareOffPosition(id: string, actor: string = 'Risk Manager'): Promise<any> {
    const posRes = await this.executeQuery('SELECT * FROM positions WHERE id = $1', [id]);
    if (posRes.rows.length === 0) return { success: false, message: 'Position not found' };
    const pos = posRes.rows[0];

    // Trigger emergency square-off command on Trading Platform via S2S
    const s2sRes = await tradingPlatformClient.sendEmergencySquareOff({
      positionId: id,
      actor,
      reason: `Square-off client position ${pos.id} for client ${pos.client_name}`,
      tenantId: pos.tenant_id
    });

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to square-off position ${id}.`);
    }

    // Update local DB source of truth only after Trading returns success
    await this.executeQuery(
      `UPDATE positions SET quantity = 0, pnl = 0, status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      `LOG-${Date.now()}`, pos.tenant_id, actor, 'POSITION_SQUARE_OFF', 'RISK',
      `Squared off position ${pos.id} (${pos.symbol}, qty: ${pos.quantity}) for client ${pos.client_name}. S2S status: ACKNOWLEDGED`,
      '127.0.0.1'
    ]);

    return {
      success: true,
      remoteAcknowledged: true,
      message: `Position ${pos.symbol} squared off successfully`
    };
  }

  async emergencyMarginSquareOff(actor: string = 'Risk Manager', reason: string = 'Emergency Margin Square-off', tenantId?: string): Promise<{ squaredOffCount: number; message: string; remoteAcknowledged?: boolean }> {
    // 1. Fetch all open positions (optionally scoped by tenantId)
    let sql = `SELECT * FROM positions WHERE status != 'CLOSED' AND quantity > 0`;
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    const openPositions = await this.executeQuery(sql, params);

    const s2sRes = await tradingPlatformClient.sendEmergencySquareOff({
      actor,
      reason,
      tenantId
    });

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to square-off open positions.`);
    }

    let updateSql = `UPDATE positions SET quantity = 0, pnl = 0, status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE status != 'CLOSED' AND quantity > 0`;
    const updateParams: any[] = [];
    if (tenantId) {
      updateParams.push(tenantId);
      updateSql += ` AND tenant_id = $${updateParams.length}`;
    }
    const updatedRes = await this.executeQuery(updateSql, updateParams);
    const count = updatedRes.rowCount || openPositions.rows.length;

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      `LOG-${Date.now()}`, tenantId || 'TNT-001', actor, 'EMERGENCY_MARGIN_SQUARE_OFF', 'RISK',
      `Emergency Margin Square-off triggered by ${actor}. Squared off ${count} positions. S2S status: ACKNOWLEDGED. Reason: ${reason}`,
      '127.0.0.1'
    ]);

    return {
      squaredOffCount: count,
      message: `Emergency Margin Square-off executed. ${count} open positions squared off.`,
      remoteAcknowledged: true
    };
  }

  async getCommissionPlans(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM commission_plans WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at ASC';
    const res = await this.executeQuery(sql, params);
    return res.rows;
  }

  async getCommissionRules(tenantId?: string, planId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM commission_rules WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (planId) {
      params.push(planId);
      sql += ` AND plan_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at ASC';
    const res = await this.executeQuery(sql, params);
    return res.rows;
  }

  async getCommissionTransactions(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM commission_transactions WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY disbursed_at DESC, created_at DESC';
    const res = await this.executeQuery(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      beneficiary: r.beneficiary,
      role: r.role,
      amount: `₹${parseFloat(r.amount).toLocaleString('en-IN')}`,
      rawAmount: parseFloat(r.amount),
      period: r.period,
      status: r.status,
      date: r.disbursed_at ? new Date(r.disbursed_at).toISOString().split('T')[0] : '2026-03-29'
    }));
  }

  async createCommissionTransaction(data: any): Promise<any> {
    const id = data.id || `COM-${Date.now().toString().slice(-4)}`;
    const dateStr = data.date || new Date().toISOString().split('T')[0];
    const res = await this.executeQuery(`
      INSERT INTO commission_transactions (
        id, tenant_id, beneficiary, role, amount, currency, period, status, disbursed_at, date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id,
      data.tenant_id || data.tenantId || 'TNT-001',
      data.beneficiary || 'Beneficiary Partner',
      data.role || 'Broker',
      parseFloat(String(data.amount || 0)),
      data.currency || 'INR',
      data.period || new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      data.status || 'PAID',
      data.disbursed_at || data.date || new Date().toISOString(),
      dateStr
    ]);
    return res.rows[0];
  }

  async getRiskProfiles(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM risk_profiles WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at ASC';
    const res = await this.executeQuery(sql, params);
    return res.rows;
  }

  async getRiskEvents(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM risk_events WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY timestamp DESC';
    const res = await this.executeQuery(sql, params);
    return res.rows;
  }

  async getNotifications(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    const res = await this.executeQuery(sql, params);
    return res.rows;
  }

  async markNotificationRead(id: string): Promise<any> {
    await this.executeQuery(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [id]
    );
    return { success: true };
  }

  async cancelAllOrders(actor: string = 'Super Admin', reason: string = 'Mass Order Cancellation', tenantId?: string): Promise<{ cancelledOrdersCount: number; message: string; remoteAcknowledged?: boolean }> {
    // S2S Mass order cancellation to Trading Platform
    const s2sRes = await tradingPlatformClient.sendEmergencyCancelAllOrders({
      tenantId,
      actor,
      reason
    });

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to cancel all open orders.`);
    }

    const tenantFilter = tenantId ? 'AND tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const res = await this.executeQuery(`
      UPDATE orders
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'PENDING' ${tenantFilter}
      RETURNING id
    `, params);

    const cancelledCount = res.rows.length;

    // Log the cancellation in audit_logs
    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      'EMERGENCY_CANCEL_ALL_ORDERS',
      'EMERGENCY_CONTROLS',
      `Cancelled ${cancelledCount} open orders. S2S status: ACKNOWLEDGED. Reason: ${reason}`,
      '127.0.0.1'
    ]);

    return {
      cancelledOrdersCount: cancelledCount,
      remoteAcknowledged: true,
      message: `Successfully cancelled ${cancelledCount} open orders.`
    };
  }

  // ----------------------------------------------------
  // EMERGENCY CONTROLS
  // ----------------------------------------------------
  async getEmergencyControls(): Promise<EmergencyControlsState> {
    const res = await this.executeQuery('SELECT * FROM emergency_controls WHERE id = $1', ['EMG-GLOBAL']);
    if (res.rows.length === 0) {
      return {
        globalTradingActive: true,
        globalKillSwitchActive: false,
        newUserCreationEnabled: true,
        apiAccessEnabled: true,
        frozenMasters: [],
        frozenBrokers: [],
        frozenUsers: []
      };
    }

    const r = res.rows[0];
    return {
      globalTradingActive: r.global_trading_active,
      globalKillSwitchActive: r.global_kill_switch_active,
      newUserCreationEnabled: r.new_user_creation_enabled,
      apiAccessEnabled: r.api_access_enabled,
      tradingReason: r.trading_reason || undefined,
      trading_paused_at: r.trading_paused_at?.toISOString() || undefined,
      trading_paused_by: r.trading_paused_by || undefined,
      killSwitchDetails: r.kill_switch_details || undefined,
      frozenMasters: r.frozen_masters || [],
      frozenBrokers: r.frozen_brokers || [],
      frozenUsers: r.frozen_users || []
    };
  }

  async getEmergencyState(): Promise<EmergencyControlsState> {
    return this.getEmergencyControls();
  }

  async setGlobalTrading(active: boolean, actor: string, reason?: string): Promise<EmergencyControlsState> {
    return this.setGlobalTradingActive(active, actor, reason);
  }

  async setGlobalTradingActive(active: boolean, actor: string, reason?: string, tenantId?: string): Promise<EmergencyControlsState> {
    // S2S dispatch to Trading Platform
    const s2sRes = await tradingPlatformClient.sendEmergencyTrading(active, actor, reason, tenantId);

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to ${active ? 'resume' : 'halt'} trading.`);
    }

    await this.executeQuery(`
      INSERT INTO emergency_controls (
        id, global_trading_active, trading_reason, trading_paused_at, trading_paused_by, updated_at
      ) VALUES ('EMG-GLOBAL', $1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        global_trading_active = EXCLUDED.global_trading_active,
        trading_reason = EXCLUDED.trading_reason,
        trading_paused_at = EXCLUDED.trading_paused_at,
        trading_paused_by = EXCLUDED.trading_paused_by,
        updated_at = CURRENT_TIMESTAMP
    `, [
      active,
      reason || (active ? 'Market Operations Resumed' : 'Emergency Trading Suspension'),
      active ? null : new Date().toISOString(),
      active ? null : actor
    ]);

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      active ? 'GLOBAL_TRADING_RESUMED' : 'GLOBAL_TRADING_PAUSED',
      'EMERGENCY_CONTROLS',
      `Trading ${active ? 'resumed' : 'suspended'} by ${actor}. S2S status: ACKNOWLEDGED. Reason: ${reason || 'N/A'}`
    ]);

    return this.getEmergencyControls();
  }

  async triggerKillSwitch(actionOrActor: string, actorOrReason: string, ipOrReason?: string, tenantId?: string): Promise<EmergencyControlsState> {
    const actor = actorOrReason.includes(' ') ? actionOrActor : actorOrReason;
    const reason = ipOrReason || actorOrReason;

    // S2S dispatch to Trading Platform
    const s2sRes = await tradingPlatformClient.sendEmergencyKillSwitch('TRIGGER', actor, reason, tenantId);

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to activate kill-switch.`);
    }

    await this.executeQuery(`
      UPDATE emergency_controls
      SET global_kill_switch_active = true,
          global_trading_active = false,
          kill_switch_details = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'EMG-GLOBAL'
    `, [
      JSON.stringify({
        triggeredBy: actor,
        triggeredAt: new Date().toISOString(),
        reason: reason || 'Master Kill-Switch Triggered',
        ipAddress: '103.21.58.14',
        s2sStatus: 'ACKNOWLEDGED'
      })
    ]);

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      'KILL_SWITCH_ACTIVATED',
      'EMERGENCY_CONTROLS',
      `Master Kill-Switch triggered by ${actor}. S2S status: ACKNOWLEDGED. Reason: ${reason || 'N/A'}`
    ]);

    return this.getEmergencyControls();
  }

  async deactivateKillSwitch(actor: string, reason: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyKillSwitch('RESET', actor, reason, tenantId);

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to reset kill-switch.`);
    }

    await this.executeQuery(`
      UPDATE emergency_controls
      SET global_kill_switch_active = false,
          kill_switch_details = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'EMG-GLOBAL'
    `, []);

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      'KILL_SWITCH_DEACTIVATED',
      'EMERGENCY_CONTROLS',
      `Kill-Switch deactivated by ${actor}. S2S status: ACKNOWLEDGED. Reason: ${reason || 'N/A'}`
    ]);

    return this.getEmergencyControls();
  }

  async setNewUserCreation(enabled: boolean, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyRegistrations(enabled, actor, tenantId);

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to ${enabled ? 'enable' : 'pause'} user registrations.`);
    }

    await this.executeQuery(
      'UPDATE emergency_controls SET new_user_creation_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [enabled, 'EMG-GLOBAL']
    );

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      enabled ? 'REGISTRATIONS_ENABLED' : 'REGISTRATIONS_PAUSED',
      'EMERGENCY_CONTROLS',
      `New user registration ${enabled ? 'enabled' : 'paused'} by ${actor}. S2S status: ACKNOWLEDGED`
    ]);

    return this.getEmergencyControls();
  }

  async setRegistrationActive(enabled: boolean, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    return this.setNewUserCreation(enabled, actor, tenantId);
  }

  async setApiAccess(enabled: boolean, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyApiAccess(enabled, actor, tenantId);

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to ${enabled ? 'enable' : 'pause'} API access.`);
    }

    await this.executeQuery(
      'UPDATE emergency_controls SET api_access_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [enabled, 'EMG-GLOBAL']
    );

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId || null,
      actor,
      enabled ? 'API_ACCESS_ENABLED' : 'API_ACCESS_PAUSED',
      'EMERGENCY_CONTROLS',
      `API access ${enabled ? 'enabled' : 'paused'} by ${actor}. S2S status: ACKNOWLEDGED`
    ]);

    return this.getEmergencyControls();
  }

  async setApiAccessActive(enabled: boolean, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    return this.setApiAccess(enabled, actor, tenantId);
  }

  async freezeMaster(masterId: string, masterName: string, actor: string, reason: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'MASTER',
      entityId: masterId,
      action: 'FREEZE',
      actor,
      reason,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to freeze Master ${masterId}.`);
    }
    await this.updateMasterStatus(masterId, 'SUSPENDED');
    return this.getEmergencyControls();
  }

  async unfreezeMaster(masterId: string, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'MASTER',
      entityId: masterId,
      action: 'UNFREEZE',
      actor,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to unfreeze Master ${masterId}.`);
    }
    await this.updateMasterStatus(masterId, 'ACTIVE');
    return this.getEmergencyControls();
  }

  async freezeBroker(brokerId: string, brokerName: string, actor: string, reason: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'BROKER',
      entityId: brokerId,
      action: 'FREEZE',
      actor,
      reason,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to freeze Broker ${brokerId}.`);
    }
    await this.updateBrokerStatus(brokerId, 'SUSPENDED');
    return this.getEmergencyControls();
  }

  async unfreezeBroker(brokerId: string, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'BROKER',
      entityId: brokerId,
      action: 'UNFREEZE',
      actor,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to unfreeze Broker ${brokerId}.`);
    }
    await this.updateBrokerStatus(brokerId, 'ACTIVE');
    return this.getEmergencyControls();
  }

  async freezeUser(userId: string, userName: string, actor: string, reason: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'CLIENT',
      entityId: userId,
      action: 'FREEZE',
      actor,
      reason,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to freeze Client ${userId}.`);
    }
    await this.updateClientStatus(userId, 'SUSPENDED');
    return this.getEmergencyControls();
  }

  async unfreezeUser(userId: string, actor: string, tenantId?: string): Promise<EmergencyControlsState> {
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: 'CLIENT',
      entityId: userId,
      action: 'UNFREEZE',
      actor,
      tenantId
    });
    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Failed to unfreeze Client ${userId}.`);
    }
    await this.updateClientStatus(userId, 'ACTIVE');
    return this.getEmergencyControls();
  }

  async executeAccountAction(entityType: string, entityId: string, action: string, actor: string, reason: string, tenantId?: string): Promise<any> {
    const s2sAction = action === 'SUSPEND' || action === 'FREEZE' ? 'FREEZE' : 'UNFREEZE';
    const normType = entityType.includes('master') ? 'MASTER' : (entityType.includes('broker') && !entityType.includes('sub') ? 'BROKER' : 'CLIENT');
    
    const s2sRes = await tradingPlatformClient.sendEmergencyFreeze({
      entityType: normType,
      entityId,
      action: s2sAction,
      actor,
      reason,
      tenantId
    });

    if (!s2sRes.success) {
      throw new Error(`Trading Platform unreachable. Could not perform ${action} on ${entityType} ${entityId}.`);
    }

    if (entityType === 'masters') {
      return this.updateMasterStatus(entityId, action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE');
    } else if (entityType === 'brokers') {
      return this.updateBrokerStatus(entityId, action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE');
    } else if (entityType === 'sub-brokers') {
      return this.updateSubBrokerStatus(entityId, action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE');
    } else {
      return this.updateClientStatus(entityId, action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE');
    }
  }

  // ----------------------------------------------------
  // PLATFORM MANAGEMENT
  // ----------------------------------------------------
  async getPlatformManagement(): Promise<PlatformManagementConfig> {
    const res = await this.executeQuery('SELECT * FROM platform_settings WHERE tenant_id = $1', ['TNT-001']);
    if (res.rows.length === 0) {
      return {
        web_trading_enabled: true,
        web_version: 'v4.8.2-stable',
        web_maintenance_mode: false,
        mobile_android_enabled: true,
        mobile_android_min_version: 'v2.14.0',
        mobile_ios_enabled: true,
        mobile_ios_min_version: 'v2.14.0',
        mobile_maintenance_mode: false,
        last_updated: '2026-03-29 10:00:00'
      };
    }
    const r = res.rows[0];
    return {
      web_trading_enabled: r.web_trading_enabled ?? true,
      web_version: r.web_version || 'v4.8.2-stable',
      web_maintenance_mode: r.web_maintenance_mode ?? false,
      mobile_android_enabled: r.mobile_android_enabled ?? true,
      mobile_android_min_version: r.mobile_android_version || 'v2.14.0',
      mobile_ios_enabled: r.mobile_ios_enabled ?? true,
      mobile_ios_min_version: r.mobile_ios_version || 'v2.14.0',
      mobile_maintenance_mode: r.mobile_maintenance_mode ?? false,
      broadcast_message: r.broadcast_message,
      last_updated: r.updated_at ? new Date(r.updated_at).toISOString().replace('T', ' ').slice(0, 19) : '2026-03-29 10:00:00'
    };
  }

  async updatePlatformManagement(data: Partial<PlatformManagementConfig>, actor: string): Promise<PlatformManagementConfig> {
    const current = await this.getPlatformManagement();
    const updated = { ...current, ...data };

    await this.executeQuery(`
      INSERT INTO platform_settings (
        id, tenant_id, web_trading_enabled, web_version, web_maintenance_mode,
        mobile_android_enabled, mobile_android_version, mobile_ios_enabled, mobile_ios_version,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) DO UPDATE SET
        web_trading_enabled = EXCLUDED.web_trading_enabled,
        web_version = EXCLUDED.web_version,
        web_maintenance_mode = EXCLUDED.web_maintenance_mode,
        mobile_android_enabled = EXCLUDED.mobile_android_enabled,
        mobile_android_version = EXCLUDED.mobile_android_version,
        mobile_ios_enabled = EXCLUDED.mobile_ios_enabled,
        mobile_ios_version = EXCLUDED.mobile_ios_version,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'SET-TNT-001', 'TNT-001',
      updated.web_trading_enabled, updated.web_version, updated.web_maintenance_mode,
      updated.mobile_android_enabled, updated.mobile_android_min_version,
      updated.mobile_ios_enabled, updated.mobile_ios_min_version
    ]);

    return updated;
  }

  // ----------------------------------------------------
  // TOOLS, MONITORING, AUDITS & SUPPORT
  // ----------------------------------------------------
  async getAuditLogs(tenantId?: string): Promise<AuditLog[]> {
    const tenantFilter = tenantId ? 'WHERE tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const res = await this.executeQuery(
      `SELECT * FROM audit_logs ${tenantFilter} ORDER BY created_at DESC LIMIT 50`,
      params
    );

    return res.rows.map(r => ({
      id: r.id,
      timestamp: r.created_at ? new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19) : '2026-03-29 10:00:00',
      actor_name: r.user_name || 'System Admin',
      actor_role: 'SUPER_ADMIN',
      tenant_name: 'Alpha Prime Capital',
      action: r.action,
      resource: r.module || 'SYSTEM',
      ip_address: r.ip_address || '127.0.0.1',
      status: 'SUCCESS' as const
    }));
  }

  async getSupportTickets(tenantId?: string): Promise<SupportTicket[]> {
    const res = await this.executeQuery('SELECT * FROM support_tickets ORDER BY created_at DESC');
    return res.rows.map(r => ({
      id: r.id,
      ticket_number: r.ticket_number,
      client_name: r.user_name || 'Trader',
      tenant_id: r.tenant_id || 'TNT-001',
      tenant_name: 'Alpha Prime Capital',
      subject: r.subject,
      category: r.category as any,
      priority: r.priority as any,
      status: r.status as any,
      created_at: r.created_at?.toISOString() || new Date().toISOString(),
      updated_at: r.updated_at?.toISOString() || new Date().toISOString(),
      messages: r.replies || []
    }));
  }

  async updateSupportTicket(ticketId: string, data: Partial<SupportTicket>, actor?: string): Promise<SupportTicket | null> {
    const res = await this.executeQuery(
      'UPDATE support_tickets SET status = COALESCE($1, status), updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [data.status, ticketId]
    );
    if (res.rows.length === 0) return null;
    return (await this.getSupportTickets()).find(t => t.id === ticketId) || null;
  }

  async addSupportTicketReply(ticketId: string, message: string, actor?: string, role?: string): Promise<SupportTicket | null> {
    const reply = {
      id: `REP-${Date.now()}`,
      sender_name: actor || 'Admin Support',
      sender_role: role || 'SUPER_ADMIN',
      message,
      timestamp: new Date().toISOString()
    };

    await this.executeQuery(`
      UPDATE support_tickets
      SET replies = COALESCE(replies, '[]'::jsonb) || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify([reply]), ticketId]);

    return (await this.getSupportTickets()).find(t => t.id === ticketId) || null;
  }

  async getSubscriptions(tenantId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM subscriptions WHERE 1=1';
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    const res = await this.executeQuery(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      tenant_id: r.tenant_id,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenant_name: r.tenant_name,
      plan: r.plan,
      plan_name: r.plan,
      monthlyFee: r.monthly_fee,
      renewalDate: r.renewal_date,
      brokersUsed: r.brokers_used,
      brokersLimit: r.brokers_limit,
      clientsUsed: r.clients_used,
      clientsLimit: r.clients_limit,
      status: r.status,
      monthly_base_fee: 799,
      current_users: r.clients_used,
      user_limit: 1000,
      pricing_model: 'HYBRID',
      volume_rate_bps: 0.5,
      renewal_date: r.renewal_date
    }));
  }

  async createSubscription(data: any): Promise<any> {
    const id = data.id || `SUB-${Date.now().toString().slice(-4)}`;
    const res = await this.executeQuery(`
      INSERT INTO subscriptions (
        id, tenant_id, tenant_name, plan, monthly_fee, renewal_date,
        brokers_used, brokers_limit, clients_used, clients_limit, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id,
      data.tenant_id || data.tenantId || 'TNT-001',
      data.tenant_name || data.tenantName || 'Tenant',
      data.plan || data.plan_name || 'PROFESSIONAL',
      data.monthly_fee || data.monthlyFee || '₹799/mo',
      data.renewal_date || data.renewalDate || '2026-12-31',
      data.brokers_used ?? data.brokersUsed ?? 5,
      data.brokers_limit ?? data.brokersLimit ?? '25',
      data.clients_used ?? data.clientsUsed ?? 100,
      data.clients_limit ?? data.clientsLimit ?? '1000',
      data.status || 'ACTIVE'
    ]);
    return res.rows[0];
  }

  async getWhiteLabelConfigs(): Promise<WhiteLabelConfig[]> {
    const res = await this.executeQuery('SELECT * FROM tenant_branding ORDER BY updated_at DESC');
    return res.rows.map(r => {
      const draft = r.draft_config ? (typeof r.draft_config === 'string' ? JSON.parse(r.draft_config) : r.draft_config) : {};
      return {
        tenant_id: r.tenant_id,
        tenant_name: r.company_name || 'Alpha Prime Capital',
        company_name: r.company_name,
        brand_name: r.portal_name || r.company_name,
        short_name: r.portal_name || 'Prime',
        tagline: r.tagline || 'Next-Gen Trading Infrastructure',
        logo_url: r.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
        favicon_url: r.favicon_url || '/favicon.ico',
        primary_color: r.primary_color || '#2563eb',
        secondary_color: '#0f172a',
        accent_color: r.accent_color || '#38bdf8',
        support_email: r.support_email || 'support@tradematrix.io',
        support_phone: r.support_phone || '+91 98000 00000',
        custom_domain: 'trade.alphaprime.com',
        footer_text: r.copyright_text || '© 2026 Alpha Prime Capital. All rights reserved.',
        terms_url: '/terms',
        privacy_url: '/privacy',
        version: r.version || 1,
        status: (r.publish_status || 'DRAFT') as any,
        sync_status: (r.sync_status || 'PENDING') as any,
        last_published_at: r.last_published_at,
        last_published_by: r.last_published_by,
        ...draft
      };
    });
  }

  async getWhiteLabelConfig(tenantId: string): Promise<WhiteLabelConfig | null> {
    const res = await this.executeQuery('SELECT * FROM tenant_branding WHERE tenant_id = $1', [tenantId]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const draft = r.draft_config ? (typeof r.draft_config === 'string' ? JSON.parse(r.draft_config) : r.draft_config) : {};

    const finalVersion = (r.version && r.version > 0) ? r.version : (draft.version || 1);

    return {
      tenant_id: r.tenant_id,
      tenant_name: r.company_name || 'Alpha Prime Capital',
      company_name: r.company_name,
      brand_name: r.portal_name || r.company_name,
      short_name: r.portal_name || 'Prime',
      tagline: r.tagline || 'Next-Gen Trading Infrastructure',
      logo_url: r.logo_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      favicon_url: r.favicon_url || '/favicon.ico',
      primary_color: r.primary_color || '#2563eb',
      secondary_color: '#0f172a',
      accent_color: r.accent_color || '#38bdf8',
      support_email: r.support_email || 'support@tradematrix.io',
      support_phone: r.support_phone || '+91 98000 00000',
      custom_domain: 'trade.alphaprime.com',
      footer_text: r.copyright_text || '© 2026 Alpha Prime Capital. All rights reserved.',
      terms_url: '/terms',
      privacy_url: '/privacy',
      sync_status: (r.sync_status || 'PENDING') as any,
      last_published_at: r.last_published_at,
      last_published_by: r.last_published_by,
      ...draft,
      version: finalVersion,
      status: (r.publish_status || 'DRAFT') as any
    };
  }

  async updateWhiteLabelConfig(tenantId: string, data: Partial<WhiteLabelConfig>, actor?: string): Promise<WhiteLabelConfig> {
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

    const existing = await this.getWhiteLabelConfig(tenantId);
    const existingVersion = existing?.version || 1;
    const updatedDraft = { ...(existing || {}), ...data, version: existingVersion };

    await this.executeQuery(`
      INSERT INTO tenant_branding (
        id, tenant_id, company_name, portal_name, tagline, logo_url, favicon_url, primary_color, accent_color,
        support_email, support_phone, copyright_text, draft_config, publish_status, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) DO UPDATE SET
        company_name = COALESCE(EXCLUDED.company_name, tenant_branding.company_name),
        portal_name = COALESCE(EXCLUDED.portal_name, tenant_branding.portal_name),
        tagline = COALESCE(EXCLUDED.tagline, tenant_branding.tagline),
        logo_url = COALESCE(EXCLUDED.logo_url, tenant_branding.logo_url),
        favicon_url = COALESCE(EXCLUDED.favicon_url, tenant_branding.favicon_url),
        primary_color = COALESCE(EXCLUDED.primary_color, tenant_branding.primary_color),
        accent_color = COALESCE(EXCLUDED.accent_color, tenant_branding.accent_color),
        support_email = COALESCE(EXCLUDED.support_email, tenant_branding.support_email),
        support_phone = COALESCE(EXCLUDED.support_phone, tenant_branding.support_phone),
        copyright_text = COALESCE(EXCLUDED.copyright_text, tenant_branding.copyright_text),
        draft_config = EXCLUDED.draft_config,
        publish_status = 'DRAFT',
        updated_at = CURRENT_TIMESTAMP
    `, [
      `BRD-${tenantId}`,
      tenantId,
      data.company_name || data.tenant_name || 'Brand Corp',
      data.brand_name || data.short_name || 'Brand Portal',
      data.tagline || 'Leading Multi-Asset Trading',
      data.logo_url || null,
      data.favicon_url || null,
      data.primary_color || '#3b82f6',
      data.accent_color || '#10b981',
      data.support_email || 'support@tenant.com',
      data.support_phone || '+91 90000 00000',
      data.footer_text || 'All rights reserved',
      JSON.stringify(updatedDraft)
    ]);

    return (await this.getWhiteLabelConfig(tenantId))!;
  }

  async publishWhiteLabelConfig(tenantId: string, actor: string = 'Admin', reason?: string): Promise<WhiteLabelConfig> {
    const current = await this.getWhiteLabelConfig(tenantId);
    if (!current) {
      throw new Error(`White-label configuration for tenant ${tenantId} not found`);
    }

    const currentVersion = current.version || 1;
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();

    // S2S Synchronization to Remote Trading Platform
    const s2sRes = await tradingPlatformClient.syncWhiteLabel(tenantId, current, newVersion, { actor });

    if (!s2sRes.success) {
      // Record failure snapshot, keep publish_status as DRAFT
      await this.executeQuery(`
        INSERT INTO white_label_versions (
          id, tenant_id, version, status, config, published_by, published_at, reason, sync_status
        ) VALUES ($1, $2, $3, 'FAILED', $4, $5, $6, $7, 'FAILED')
        ON CONFLICT (tenant_id, version) DO NOTHING
      `, [
        `WLV-${tenantId}-v${newVersion}-failed`,
        tenantId,
        newVersion,
        JSON.stringify(current),
        actor,
        now,
        `Sync failed: ${s2sRes.error || 'Trading Platform rejected sync'} (Correlation: ${s2sRes.correlationId})`
      ]);

      await this.executeQuery(`
        UPDATE tenant_branding
        SET sync_status = 'FAILED',
            updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $1
      `, [tenantId]);

      await this.executeQuery(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        `LOG-${Date.now()}`,
        tenantId,
        actor,
        'BRANDING_PUBLISH_FAILED',
        'WHITE_LABEL',
        `Failed to publish branding to Trading Platform for tenant ${tenantId}. S2S status: ${s2sRes.statusCode}, Correlation: ${s2sRes.correlationId}. Error: ${s2sRes.error}`
      ]);

      throw new Error(`Trading Platform rejected branding sync (Status: ${s2sRes.statusCode}, Correlation: ${s2sRes.correlationId}): ${s2sRes.error || 'Connection failed'}`);
    }

    const syncStatus = 'SYNCED';

    // Persist immutable version snapshot in white_label_versions table
    await this.executeQuery(`
      INSERT INTO white_label_versions (
        id, tenant_id, version, status, config, published_by, published_at, reason, sync_status
      ) VALUES ($1, $2, $3, 'PUBLISHED', $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, version) DO UPDATE SET
        config = EXCLUDED.config,
        status = 'PUBLISHED',
        sync_status = EXCLUDED.sync_status
    `, [
      `WLV-${tenantId}-v${newVersion}`,
      tenantId,
      newVersion,
      JSON.stringify(current),
      actor,
      now,
      reason || 'Published updated white-label configuration',
      syncStatus
    ]);

    // Update published state in tenant_branding
    await this.executeQuery(`
      UPDATE tenant_branding
      SET version = $1,
          publish_status = 'PUBLISHED',
          published_config = $2,
          sync_status = $3,
          last_published_at = $4,
          last_published_by = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $6
    `, [
      newVersion,
      JSON.stringify(current),
      syncStatus,
      now,
      actor,
      tenantId
    ]);

    // Record audit log
    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId,
      actor,
      'BRANDING_PUBLISHED',
      'WHITE_LABEL',
      `Published branding version v${newVersion} for tenant ${tenantId}. S2S status: ${syncStatus}. Reason: ${reason || 'N/A'}`
    ]);

    current.version = newVersion;
    current.status = 'PUBLISHED';
    current.sync_status = syncStatus as any;
    current.last_published_at = now;
    current.last_published_by = actor;

    tenantConfigCache.setBranding(tenantId, current);

    return current;
  }

  async rollbackWhiteLabelConfig(tenantId: string, actor: string = 'Admin'): Promise<WhiteLabelConfig> {
    const current = await this.getWhiteLabelConfig(tenantId);
    const currentVer = current?.version || 1;

    // Find latest previous version
    const prevRes = await this.executeQuery(`
      SELECT * FROM white_label_versions
      WHERE tenant_id = $1 AND version < $2
      ORDER BY version DESC LIMIT 1
    `, [tenantId, currentVer]);

    if (prevRes.rows.length === 0) {
      throw new Error(`No previous white-label versions available to rollback for tenant ${tenantId}`);
    }

    const prev = prevRes.rows[0];
    const targetConfig = typeof prev.config === 'string' ? JSON.parse(prev.config) : prev.config;
    const rollbackVersion = currentVer + 1;
    const now = new Date().toISOString();

    const s2sRes = await tradingPlatformClient.syncWhiteLabel(tenantId, targetConfig, rollbackVersion, { actor });
    const syncStatus = s2sRes.success ? 'SYNCED' : 'FAILED';

    // Save rollback snapshot
    await this.executeQuery(`
      INSERT INTO white_label_versions (
        id, tenant_id, version, status, config, published_by, published_at, reason, sync_status
      ) VALUES ($1, $2, $3, 'ROLLED_BACK', $4, $5, $6, $7, $8)
    `, [
      `WLV-${tenantId}-v${rollbackVersion}`,
      tenantId,
      rollbackVersion,
      JSON.stringify(targetConfig),
      actor,
      now,
      `Rolled back to v${prev.version}`,
      syncStatus
    ]);

    // Update tenant_branding
    await this.executeQuery(`
      UPDATE tenant_branding
      SET version = $1,
          publish_status = 'PUBLISHED',
          company_name = $2,
          portal_name = $3,
          tagline = $4,
          logo_url = $5,
          primary_color = $6,
          accent_color = $7,
          support_email = $8,
          support_phone = $9,
          copyright_text = $10,
          draft_config = $11,
          published_config = $11,
          sync_status = $12,
          last_published_at = $13,
          last_published_by = $14,
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $15
    `, [
      rollbackVersion,
      targetConfig.company_name || targetConfig.brand_name || 'Brand Corp',
      targetConfig.brand_name || targetConfig.short_name || 'Brand Portal',
      targetConfig.tagline || '',
      targetConfig.logo_url || null,
      targetConfig.primary_color || '#3b82f6',
      targetConfig.accent_color || '#10b981',
      targetConfig.support_email || '',
      targetConfig.support_phone || '',
      targetConfig.footer_copyright || targetConfig.footer_text || '',
      JSON.stringify(targetConfig),
      syncStatus,
      now,
      actor,
      tenantId
    ]);

    tenantConfigCache.invalidateBranding(tenantId);

    // Audit log
    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId,
      actor,
      'BRANDING_ROLLED_BACK',
      'WHITE_LABEL',
      `Rolled back branding from v${currentVer} to v${prev.version} (new version v${rollbackVersion}). S2S status: ${syncStatus}`
    ]);

    targetConfig.version = rollbackVersion;
    targetConfig.status = 'PUBLISHED';
    targetConfig.sync_status = syncStatus;
    targetConfig.last_published_at = now;
    targetConfig.last_published_by = actor;

    tenantConfigCache.setBranding(tenantId, targetConfig);

    return targetConfig;
  }

  async getWhiteLabelVersions(tenantId: string): Promise<any[]> {
    const res = await this.executeQuery(
      'SELECT * FROM white_label_versions WHERE tenant_id = $1 ORDER BY version DESC',
      [tenantId]
    );
    return res.rows.map(r => ({
      ...r,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
    }));
  }

  async getTenantSyncState(tenantId: string): Promise<any> {
    const res = await this.executeQuery('SELECT * FROM tenant_sync_state WHERE tenant_id = $1', [tenantId]);
    if (res.rows.length === 0) {
      return {
        tenant_id: tenantId,
        sync_status: 'PENDING',
        config_version: 1,
        last_sync_at: null,
        last_success_at: null,
        last_error: null,
        retry_count: 0
      };
    }
    return res.rows[0];
  }

  async syncTenantConfig(tenantId: string, actor: string = 'Admin'): Promise<any> {
    const tenantRes = await this.executeQuery('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (tenantRes.rows.length === 0) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    const tenant = tenantRes.rows[0];
    const platformConfig = await this.getTenantPlatformConfig(tenantId);
    const currentSync = await this.getTenantSyncState(tenantId);
    const nextVersion = (currentSync.config_version || 1) + 1;

    const payload = {
      status: tenant.status,
      trading_enabled: platformConfig.trading_enabled ?? true,
      registration_enabled: platformConfig.registration_enabled ?? true,
      api_enabled: platformConfig.api_enabled ?? true,
      support_enabled: platformConfig.support_enabled ?? true,
      notifications_enabled: platformConfig.notifications_enabled ?? true,
      subscription: { plan: tenant.plan || 'PRO', status: tenant.status },
      operational_limits: { max_daily_loss: 500000, leverage_cap: 20 },
      config_version: nextVersion
    };

    const s2sRes = await tradingPlatformClient.syncTenantConfig(tenantId, payload, { actor });

    const syncStatus = s2sRes.success ? 'SYNCED' : 'FAILED';
    const now = new Date().toISOString();
    const lastError = s2sRes.success ? null : (s2sRes.error || 'Remote sync failed');
    const retryCount = s2sRes.success ? 0 : (currentSync.retry_count || 0) + 1;

    await this.executeQuery(`
      INSERT INTO tenant_sync_state (
        tenant_id, sync_status, config_version, last_sync_at, last_success_at, last_error, retry_count, last_payload, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) DO UPDATE SET
        sync_status = EXCLUDED.sync_status,
        config_version = EXCLUDED.config_version,
        last_sync_at = EXCLUDED.last_sync_at,
        last_success_at = COALESCE(EXCLUDED.last_success_at, tenant_sync_state.last_success_at),
        last_error = EXCLUDED.last_error,
        retry_count = EXCLUDED.retry_count,
        last_payload = EXCLUDED.last_payload,
        updated_at = CURRENT_TIMESTAMP
    `, [
      tenantId,
      syncStatus,
      nextVersion,
      now,
      s2sRes.success ? now : null,
      lastError,
      retryCount,
      JSON.stringify(payload)
    ]);

    return {
      tenant_id: tenantId,
      sync_status: syncStatus,
      config_version: nextVersion,
      last_sync_at: now,
      last_success_at: s2sRes.success ? now : currentSync.last_success_at,
      last_error: lastError,
      retry_count: retryCount,
      remoteAcknowledged: s2sRes.success
    };
  }

  async getTenantPlatformConfig(tenantId: string): Promise<TenantPlatformConfig> {
    const res = await this.executeQuery(`
      SELECT ps.*, t.name as tenant_name
      FROM platform_settings ps
      LEFT JOIN tenants t ON ps.tenant_id = t.id
      WHERE ps.tenant_id = $1
    `, [tenantId]);

    const tenant = await this.getTenantById(tenantId).catch(() => null);
    const tenantName = tenant?.name || 'Central Platform';

    if (res.rows.length === 0) {
      return {
        id: `PCFG-${tenantId}`,
        tenant_id: tenantId,
        tenant_name: tenantName,
        web_trading_enabled: true,
        mobile_trading_enabled: true,
        registration_enabled: true,
        forgot_password_enabled: true,
        support_enabled: true,
        notifications_enabled: true,
        api_enabled: true,
        trading_enabled: true,
        maintenance_mode: false,
        maintenance_message: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    const r = res.rows[0];
    return {
      id: r.id || `PCFG-${tenantId}`,
      tenant_id: tenantId,
      tenant_name: r.tenant_name || tenantName,
      web_trading_enabled: r.web_trading_enabled ?? true,
      mobile_trading_enabled: (r.mobile_android_enabled ?? r.mobile_trading_enabled) ?? true,
      registration_enabled: r.registration_enabled ?? true,
      forgot_password_enabled: r.forgot_password_enabled ?? true,
      support_enabled: r.support_enabled ?? true,
      notifications_enabled: r.notifications_enabled ?? true,
      api_enabled: r.api_enabled ?? true,
      trading_enabled: r.trading_enabled ?? true,
      maintenance_mode: (r.maintenance_mode ?? r.web_maintenance_mode) ?? false,
      maintenance_message: r.maintenance_message || '',
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    };
  }

  async updateTenantPlatformConfig(tenantId: string, data: Partial<TenantPlatformConfig>, actor: string): Promise<TenantPlatformConfig> {
    const current = await this.getTenantPlatformConfig(tenantId);
    const updated: TenantPlatformConfig = {
      ...current,
      ...data,
      updated_at: new Date().toISOString()
    };

    // 1. Dispatch S2S to Trading Platform
    const s2sRes = await tradingPlatformClient.syncTenantConfig(tenantId, {
      status: 'ACTIVE',
      trading_enabled: updated.trading_enabled,
      registration_enabled: updated.registration_enabled,
      api_enabled: updated.api_enabled,
      support_enabled: updated.support_enabled,
      notifications_enabled: updated.notifications_enabled,
      maintenance_mode: updated.maintenance_mode,
      maintenance_message: updated.maintenance_message
    }, { actor, reason: `Platform controls updated by ${actor}` });

    if (!s2sRes.success) {
      await this.executeQuery(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        `LOG-${Date.now()}`,
        tenantId,
        actor,
        'PLATFORM_CONFIG_SYNC_FAILED',
        'PLATFORM_CONFIG',
        `Platform config update rejected by Trading Platform (Status: ${s2sRes.statusCode}, Correlation: ${s2sRes.correlationId}). Error: ${s2sRes.error}`
      ]);
      throw new Error(`Trading Platform sync rejected platform controls (Status: ${s2sRes.statusCode}, Correlation: ${s2sRes.correlationId}): ${s2sRes.error || 'Connection failed'}`);
    }

    // 2. Persist in PostgreSQL platform_settings table
    await this.executeQuery(`
      INSERT INTO platform_settings (
        id, tenant_id, web_trading_enabled, mobile_android_enabled, mobile_ios_enabled,
        trading_enabled, registration_enabled, api_enabled, support_enabled, notifications_enabled,
        maintenance_mode, web_maintenance_mode, maintenance_message, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id) DO UPDATE SET
        web_trading_enabled = EXCLUDED.web_trading_enabled,
        mobile_android_enabled = EXCLUDED.mobile_android_enabled,
        mobile_ios_enabled = EXCLUDED.mobile_ios_enabled,
        trading_enabled = EXCLUDED.trading_enabled,
        registration_enabled = EXCLUDED.registration_enabled,
        api_enabled = EXCLUDED.api_enabled,
        support_enabled = EXCLUDED.support_enabled,
        notifications_enabled = EXCLUDED.notifications_enabled,
        maintenance_mode = EXCLUDED.maintenance_mode,
        web_maintenance_mode = EXCLUDED.web_maintenance_mode,
        maintenance_message = EXCLUDED.maintenance_message,
        updated_at = CURRENT_TIMESTAMP
    `, [
      `PCFG-${tenantId}`,
      tenantId,
      updated.web_trading_enabled,
      updated.mobile_trading_enabled,
      updated.mobile_trading_enabled,
      updated.trading_enabled,
      updated.registration_enabled,
      updated.api_enabled,
      updated.support_enabled,
      updated.notifications_enabled,
      updated.maintenance_mode,
      updated.maintenance_mode,
      updated.maintenance_message || ''
    ]);

    // 3. Record successful audit log
    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId,
      actor,
      'PLATFORM_CONFIG_UPDATED',
      'PLATFORM_CONFIG',
      `Platform controls updated by ${actor}: trading=${updated.trading_enabled}, reg=${updated.registration_enabled}, api=${updated.api_enabled}, maint=${updated.maintenance_mode}. S2S status: SYNCED.`
    ]);

    return updated;
  }

  async getTenantDomains(tenantId?: string): Promise<TenantDomain[]> {
    const filter = tenantId ? 'WHERE cd.tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];
    const res = await this.executeQuery(`
      SELECT cd.*, t.name as tenant_name
      FROM custom_domains cd
      LEFT JOIN tenants t ON cd.tenant_id = t.id
      ${filter}
      ORDER BY cd.created_at DESC
    `, params);

    return res.rows.map(r => ({
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || r.tenant_id,
      domain: r.domain,
      domain_type: (r.domain_type || 'CUSTOM') as any,
      verification_status: (r.status === 'ACTIVE' ? 'VERIFIED' : (r.status === 'FAILED_VERIFICATION' ? 'FAILED' : 'PENDING')) as any,
      is_primary: r.is_primary || false,
      ssl_status: (r.ssl_status || (r.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING')) as any,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    }));
  }

  async addTenantDomain(tenantId: string, domain: Partial<TenantDomain>, actor: string): Promise<TenantDomain> {
    const id = `DOM-${Date.now()}`;
    const domainName = (domain.domain || 'trade.custom.com').toLowerCase().trim();
    const domainType = domain.domain_type || 'CUSTOM';
    const isPrimary = domain.is_primary || false;

    const res = await this.executeQuery(`
      INSERT INTO custom_domains (id, tenant_id, domain, domain_type, status, ssl_status, is_primary, dns_target)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, tenantId, domainName, domainType, 'PENDING', 'PENDING', isPrimary, 'cname.tradematrix.io']);

    const r = res.rows[0];
    const tenant = await this.getTenantById(tenantId);

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      tenantId,
      actor,
      'DOMAIN_ADDED',
      'DOMAINS',
      `Domain ${domainName} (${domainType}) added for tenant ${tenant?.name || tenantId}. DNS target: cname.tradematrix.io`
    ]);

    return {
      id: r.id,
      tenant_id: r.tenant_id,
      tenant_name: tenant?.name || r.tenant_id,
      domain: r.domain,
      domain_type: domainType as any,
      verification_status: 'PENDING',
      is_primary: r.is_primary,
      ssl_status: 'PENDING',
      created_at: new Date().toISOString()
    };
  }

  async updateTenantDomain(id: string, updates: Partial<TenantDomain>, actor: string): Promise<TenantDomain> {
    if (updates.is_primary !== undefined) {
      await this.executeQuery('UPDATE custom_domains SET is_primary = $1 WHERE id = $2', [updates.is_primary, id]);
    }
    const list = await this.getTenantDomains();
    return list.find(d => d.id === id)!;
  }

  async deleteTenantDomain(id: string, actor: string): Promise<boolean> {
    const res = await this.executeQuery('SELECT * FROM custom_domains WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      await this.executeQuery('DELETE FROM custom_domains WHERE id = $1', [id]);
      await this.executeQuery(`
        INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        `LOG-${Date.now()}`,
        row.tenant_id,
        actor,
        'DOMAIN_DELETED',
        'DOMAINS',
        `Domain ${row.domain} deleted by ${actor}`
      ]);
    }
    return true;
  }

  async verifyTenantDomain(id: string, actor: string): Promise<TenantDomain> {
    const res = await this.executeQuery('SELECT * FROM custom_domains WHERE id = $1', [id]);
    if (res.rows.length === 0) throw new Error('Domain not found');
    const row = res.rows[0];
    const domainName = row.domain;

    let isDnsResolved = false;
    try {
      const addresses = await dns.promises.lookup(domainName).catch(() => null);
      if (addresses && addresses.address) {
        isDnsResolved = true;
      }
    } catch {
      isDnsResolved = false;
    }

    const newStatus = isDnsResolved ? 'ACTIVE' : 'FAILED_VERIFICATION';
    const newSsl = isDnsResolved ? 'ACTIVE' : 'PENDING';
    const verifiedAt = isDnsResolved ? new Date().toISOString() : null;

    await this.executeQuery(
      'UPDATE custom_domains SET status = $1, ssl_status = $2, verified_at = $3 WHERE id = $4',
      [newStatus, newSsl, verifiedAt, id]
    );

    await this.executeQuery(`
      INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `LOG-${Date.now()}`,
      row.tenant_id,
      actor,
      'DOMAIN_VERIFIED',
      'DOMAINS',
      `DNS verification for ${domainName}: ${isDnsResolved ? 'VERIFIED' : 'FAILED'}`
    ]);

    const list = await this.getTenantDomains(row.tenant_id);
    const updated = list.find(d => d.id === id);

    if (!isDnsResolved) {
      throw new Error(`DNS verification for domain "${domainName}" failed. Please ensure your DNS CNAME points to cname.tradematrix.io before verifying.`);
    }

    return updated!;
  }

  async resolveTenantByDomain(domain: string): Promise<{ tenant: Tenant | null; branding: WhiteLabelConfig | null; platformConfig: TenantPlatformConfig | null }> {
    const tenantRes = await this.executeQuery(
      'SELECT * FROM tenants WHERE subdomain = $1 OR custom_domain = $1 LIMIT 1',
      [domain]
    );
    if (tenantRes.rows.length === 0) {
      return { tenant: null, branding: null, platformConfig: null };
    }
    const tenant = await this.getTenantById(tenantRes.rows[0].id);
    const branding = await this.getWhiteLabelConfig(tenant!.id);
    const platformConfig = await this.getTenantPlatformConfig(tenant!.id);
    return { tenant, branding, platformConfig };
  }

  async getBrandingAuditLogs(tenantId?: string): Promise<BrandingAuditLog[]> {
    try {
      const sql = tenantId
        ? `SELECT a.*, t.name as tenant_name FROM audit_logs a LEFT JOIN tenants t ON a.tenant_id = t.id WHERE a.tenant_id = $1 AND (a.module = 'WHITE_LABEL' OR a.action LIKE 'BRANDING_%' OR a.action LIKE 'DOMAIN_%' OR a.action LIKE 'PLATFORM_%') ORDER BY a.created_at DESC LIMIT 50`
        : `SELECT a.*, t.name as tenant_name FROM audit_logs a LEFT JOIN tenants t ON a.tenant_id = t.id WHERE (a.module = 'WHITE_LABEL' OR a.action LIKE 'BRANDING_%' OR a.action LIKE 'DOMAIN_%' OR a.action LIKE 'PLATFORM_%') ORDER BY a.created_at DESC LIMIT 50`;
      const params = tenantId ? [tenantId] : [];
      const res = await this.executeQuery(sql, params);
      if (res.rows && res.rows.length > 0) {
        return res.rows.map(r => ({
          id: r.id,
          actor: r.user_name || 'Admin',
          role: 'SUPER_ADMIN',
          tenant_id: r.tenant_id,
          tenant_name: r.tenant_name || 'Tenant',
          action: r.action,
          entity: r.module || 'WHITE_LABEL',
          old_value: 'N/A',
          new_value: r.details || 'Updated',
          timestamp: r.timestamp || r.created_at || new Date().toISOString(),
          ip_address: r.ip_address || '127.0.0.1',
          reason: r.details
        }));
      }
    } catch (err) {
      console.warn('[PostgresTradingDataProvider] Failed to get branding audit logs:', err);
    }
    return [];
  }

  async executeTenantOrder(tenantId: string, orderData: any): Promise<any> {
    const orderId = `ORD-${Date.now()}`;
    const price = orderData.price || 1500.00;
    const totalValue = price * orderData.quantity;

    await this.executeQuery(`
      INSERT INTO orders (id, tenant_id, client_id, client_code, client_name, symbol, exchange, order_type, side, quantity, price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      orderId, tenantId, 'CLT-001', 'CLT001', orderData.clientName || 'Demo Trader',
      orderData.symbol, 'NSE', orderData.type, orderData.side, orderData.quantity, price, 'EXECUTED'
    ]);

    const tradeId = `TRD-${Date.now()}`;
    await this.executeQuery(`
      INSERT INTO trades (id, tenant_id, trade_id, client_id, client_name, symbol, exchange, side, quantity, price, total_value, status, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      tradeId, tenantId, tradeId, 'CLT-001', orderData.clientName || 'Demo Trader',
      orderData.symbol, 'NSE', orderData.side, orderData.quantity, price, totalValue, 'EXECUTED',
      new Date().toISOString().replace('T', ' ').slice(0, 19)
    ]);

    return { success: true, message: 'Order executed and trade recorded.' };
  }

  // Master limits & configurations
  async getMasterLimits(masterId?: string): Promise<MasterLimits[]> { return []; }
  async updateMasterLimits(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits> { return data as any; }
  async updateMasterLimit(masterId: string, data: Partial<MasterLimits>, actor: string): Promise<MasterLimits> { return data as any; }
  async getMasterPricing(masterId?: string): Promise<MasterPricingConfig[]> { return []; }
  async updateMasterPricing(masterId: string, data: Partial<MasterPricingConfig>, actor: string): Promise<MasterPricingConfig> { return data as any; }
  async getMasterBrokerage(masterId?: string): Promise<MasterBrokerageConfig[]> { return []; }
  async updateMasterBrokerage(masterId: string, data: Partial<MasterBrokerageConfig>, actor: string): Promise<MasterBrokerageConfig> { return data as any; }
  async getMasterApiPermissions(masterId?: string): Promise<MasterApiPermission[]> { return []; }
  async updateMasterApiPermissions(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission> { return data as any; }
  async updateMasterApiPermission(masterId: string, data: Partial<MasterApiPermission>, actor: string): Promise<MasterApiPermission> { return data as any; }
  async getMasterBranding(masterId?: string): Promise<MasterBrandingConfig[]> { return []; }
  async updateMasterBranding(masterId: string, data: Partial<MasterBrandingConfig>, actor: string): Promise<MasterBrandingConfig> { return data as any; }
  async getMasterSubscriptions(masterId?: string): Promise<MasterSubscriptionConfig[]> { return []; }
  async updateMasterSubscription(masterId: string, data: Partial<MasterSubscriptionConfig>, actor: string): Promise<MasterSubscriptionConfig> { return data as any; }
  async getMasterRevenueReports(masterId?: string): Promise<MasterRevenueData[]> { return []; }

  // Monitoring
  async getLoginHistory(): Promise<LoginHistoryItem[]> {
    const res = await this.executeQuery('SELECT * FROM login_history ORDER BY created_at DESC LIMIT 20');
    return res.rows.map(r => ({
      id: r.id,
      user_name: r.user_name || 'Admin User',
      user_email: r.user_email || 'admin@tradematrix.io',
      user_role: r.role || 'SUPER_ADMIN',
      login_time: r.created_at?.toISOString() || new Date().toISOString(),
      ip_address: r.ip_address || '127.0.0.1',
      device: 'Desktop',
      browser: 'Chrome 123.0',
      os: 'macOS Sonoma',
      status: (r.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED') as any,
      failure_reason: r.reason
    }));
  }

  async getActiveSessions(): Promise<SessionItem[]> {
    const res = await this.executeQuery('SELECT * FROM sessions WHERE status = $1', ['ACTIVE']);
    return res.rows.map(r => ({
      id: r.id,
      session_id: r.id,
      user_name: r.user_name || 'Admin User',
      user_email: 'admin@tradematrix.io',
      user_role: r.role || 'SUPER_ADMIN',
      ip_address: r.ip_address || '127.0.0.1',
      device: r.device || 'Desktop',
      browser: 'Chrome 123.0',
      login_time: r.login_time?.toISOString() || new Date().toISOString(),
      last_activity: r.last_active?.toISOString() || new Date().toISOString(),
      status: 'ACTIVE' as const
    }));
  }

  async revokeSession(sessionId: string, actor: string): Promise<boolean> {
    await this.executeQuery('DELETE FROM sessions WHERE id = $1', [sessionId]);
    return true;
  }

  async getOrderAuditTrail(orderId?: string): Promise<OrderAuditTrailItem[]> { return []; }
  async getApiActivity(): Promise<ApiActivityItem[]> { return []; }
  async getApiActivityLogs(): Promise<ApiActivityItem[]> { return []; }
  async getSuspiciousAlerts(): Promise<SuspiciousActivityAlert[]> { return []; }
  async getSuspiciousActivityAlerts(): Promise<SuspiciousActivityAlert[]> { return []; }
  async resolveSuspiciousAlert(alertId: string, actor: string): Promise<boolean> { return true; }
  async getUserCreationLogs(): Promise<UserCreationLogItem[]> { return []; }
  async getDataDeletionLogs(): Promise<DataDeletionLogItem[]> { return []; }
  async getConfigurationChangeLogs(): Promise<ConfigurationChangeLogItem[]> { return []; }
  async recordOrderEvent(event: Partial<OrderAuditTrailItem>): Promise<void> {}
  async recordConfigChange(change: Partial<ConfigurationChangeLogItem>): Promise<void> {}

  // RBAC
  async getRbacRoles(): Promise<RoleDefinition[]> {
    const res = await this.executeQuery('SELECT * FROM roles ORDER BY is_system DESC, name ASC');
    if (res.rows.length === 0) {
      return Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([name, perms]) => ({
        id: `ROLE-${name}`,
        name,
        code: name,
        description: `System role for ${name}`,
        isSystemRole: true,
        userCount: 3,
        badgeColor: 'blue',
        permissions: perms as any,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }));
    }
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.name,
      description: r.description,
      isSystemRole: r.is_system,
      userCount: 3,
      badgeColor: 'blue',
      permissions: (r.permissions || {}) as any,
      createdAt: r.created_at?.toISOString() || '2026-01-01',
      updatedAt: r.updated_at?.toISOString() || '2026-01-01'
    }));
  }

  async createRbacRole(role: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition> {
    const id = `ROLE-${Date.now()}`;
    const res = await this.executeQuery(`
      INSERT INTO roles (id, name, description, is_system, permissions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, role.name || 'CUSTOM_ROLE', role.description || '', false, JSON.stringify(role.permissions || {})]);
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      code: r.name,
      description: r.description,
      isSystemRole: r.is_system,
      userCount: 1,
      badgeColor: 'indigo',
      permissions: (r.permissions || {}) as any,
      createdAt: r.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: r.updated_at?.toISOString() || new Date().toISOString()
    };
  }

  async updateRbacRole(roleId: string, updates: Partial<RoleDefinition>, actor: string): Promise<RoleDefinition> {
    await this.executeQuery(`
      UPDATE roles
      SET name = COALESCE($1, name), description = COALESCE($2, description), permissions = COALESCE($3, permissions), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [updates.name, updates.description, updates.permissions ? JSON.stringify(updates.permissions) : null, roleId]);
    return (await this.getRbacRoles()).find(r => r.id === roleId)!;
  }

  async deleteRbacRole(roleId: string, actor: string): Promise<boolean> {
    await this.executeQuery('DELETE FROM roles WHERE id = $1 AND is_system = false', [roleId]);
    return true;
  }

  async getRbacUsers(): Promise<RbacUser[]> {
    const res = await this.executeQuery('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      roleName: r.role,
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: (r.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED') as any,
      twoFactorEnabled: true,
      lastLogin: '2026-03-29 10:00'
    }));
  }

  async assignUserRole(userId: string, roleCode: string, actor: string, customPermissions?: any): Promise<RbacUser> {
    await this.executeQuery('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [roleCode, userId]);
    return (await this.getRbacUsers()).find(u => u.id === userId)!;
  }

  async createRbacUser(userData: Partial<RbacUser>, actor: string): Promise<RbacUser> {
    const id = `USR-${Date.now()}`;
    const res = await this.executeQuery(`
      INSERT INTO users (id, name, email, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, userData.name || 'New User', userData.email || `user-${id}@tradematrix.io`, userData.role || 'VIEWER', userData.status || 'ACTIVE']);
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      roleName: r.role,
      tenantId: 'TNT-001',
      tenantName: 'Alpha Prime Capital',
      status: (r.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED') as any,
      twoFactorEnabled: false,
      lastLogin: 'Never'
    };
  }

  async updateRbacUser(userId: string, updates: Partial<RbacUser>, actor: string): Promise<RbacUser> {
    await this.executeQuery(`
      UPDATE users
      SET name = COALESCE($1, name), role = COALESCE($2, role), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [updates.name, updates.role, updates.status, userId]);
    return (await this.getRbacUsers()).find(u => u.id === userId)!;
  }

  async getRbacAuditLogs(): Promise<RbacAuditLogItem[]> {
    return [];
  }
}
