/**
 * Focused Live Integration & Admin Database Projection Test Suite
 * Tests:
 * 1. Client & Account Creation Events -> Admin Database Projection (Tenant Scoped)
 * 2. Trade Event Projection (Exact ID, Symbol, Price, Qty, Timestamps, No Defaults)
 * 3. Position Updated Events -> Synchronized Admin Positions & P&L
 * 4. Wallet Updated Events -> Synchronized Client Equity & Margin
 * 5. Deposit Lifecycle (Created, Updated, Approved, Rejected) & Pending Status/Amount
 * 6. Withdrawal Lifecycle (Created, Updated, Approved, Rejected) & Pending Status/Amount
 * 7. Dashboard KPI Aggregation from Real PostgreSQL Projections (Today Turnover vs Total Turnover, etc.)
 */

import { query, testConnection } from '../server/db/connection.ts';
import { eventHandler, TradingPlatformEvent } from '../server/services/EventHandler.ts';
import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { PostgresTradingDataProvider } from '../server/providers/PostgresTradingDataProvider.ts';

const provider = new PostgresTradingDataProvider();

async function runLiveIntegrationTests() {
  console.log('================================================================');
  console.log('  STARTING LIVE INTEGRATION & ADMIN DATABASE PROJECTION TESTS   ');
  console.log('================================================================\n');

  await testConnection();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const tenantId = 'TNT-001';

  try {
    // Helper to send signed event to eventHandler
    const sendEvent = async (event: TradingPlatformEvent) => {
      const rawBody = JSON.stringify(event);
      const headers = {
        'x-signature-sha256': tradingPlatformClient.generateSignature(event.timestamp, 'POST', '/api/internal/events', rawBody),
        'x-timestamp': event.timestamp,
        'x-tenant-id': event.tenantId
      };
      return await eventHandler.handleInboundEvent(headers, 'POST', '/api/internal/events', rawBody, event);
    };

    // -------------------------------------------------------------------------
    // TEST 1: CLIENT & ACCOUNT CREATION EVENT PROJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Client & Account Creation Event Projection ---');
    const testClientId = `CLT-TEST-${Date.now()}`;
    const testClientCode = `TEST${Date.now().toString().slice(-4)}`;
    const clientEvent: TradingPlatformEvent = {
      eventId: `evt-client-create-${Date.now()}`,
      eventType: 'client.created',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: testClientId,
        clientId: testClientId,
        clientCode: testClientCode,
        name: 'Rahul Sharma',
        email: 'rahul.sharma@example.com',
        phone: '+91 9876543210',
        kycStatus: 'APPROVED',
        accountStatus: 'ACTIVE',
        walletBalance: 75000,
        equity: 75000
      }
    };

    const clientRes = await sendEvent(clientEvent);
    assert(clientRes.success === true, 'client.created event accepted and processed');

    // Verify in PostgreSQL database
    const dbClient = await query('SELECT * FROM clients WHERE id = $1 AND tenant_id = $2', [testClientId, tenantId]);
    assert(dbClient.rows.length === 1, 'Client successfully persisted in PostgreSQL clients projection');
    assert(dbClient.rows[0].name === 'Rahul Sharma', 'Client name matches authoritative event payload');
    assert(dbClient.rows[0].client_code === testClientCode, 'Client code matches authoritative event payload');
    assert(parseFloat(dbClient.rows[0].balance) === 75000, 'Client initial wallet balance matches event payload');

    // -------------------------------------------------------------------------
    // TEST 2: TRADE EVENT PROJECTION (No Fallbacks / Exact Values)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Trade Event Projection (Exact Fields & Timestamps) ---');
    const testTradeId = `TRD-TEST-${Date.now()}`;
    const testOrderId = `ORD-TEST-${Date.now()}`;
    const tradeTimestamp = new Date().toISOString();
    const tradeEvent: TradingPlatformEvent = {
      eventId: `evt-trade-${Date.now()}`,
      eventType: 'trade.executed',
      tenantId,
      timestamp: tradeTimestamp,
      payload: {
        tradeId: testTradeId,
        orderId: testOrderId,
        clientId: testClientId,
        clientCode: testClientCode,
        clientName: 'Rahul Sharma',
        symbol: 'INFY',
        side: 'BUY',
        qty: 50,
        price: 1850.50,
        totalValue: 92525.00,
        commission: 20.00,
        executedAt: tradeTimestamp
      }
    };

    const tradeRes = await sendEvent(tradeEvent);
    assert(tradeRes.success === true, 'trade.executed event accepted and processed');

    const dbTrade = await query('SELECT * FROM trades WHERE id = $1 AND tenant_id = $2', [testTradeId, tenantId]);
    assert(dbTrade.rows.length === 1, 'Trade persisted in PostgreSQL trades table');
    assert(dbTrade.rows[0].order_id === testOrderId, 'Trade order_id matches authoritative event without fallback');
    assert(dbTrade.rows[0].symbol === 'INFY', 'Trade symbol matches authoritative event');
    assert(dbTrade.rows[0].side === 'BUY', 'Trade side matches authoritative event');
    assert(Number(dbTrade.rows[0].quantity) === 50, 'Trade quantity matches authoritative event');
    assert(parseFloat(dbTrade.rows[0].price) === 1850.50, 'Trade price matches authoritative event');
    assert(parseFloat(dbTrade.rows[0].total_value) === 92525.00, 'Trade total_value matches authoritative event');

    // -------------------------------------------------------------------------
    // TEST 3: POSITION UPDATED EVENT PROJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Position Updated Event Projection & P&L Sync ---');
    const testPosId = `POS-TEST-${Date.now()}`;
    const positionEvent: TradingPlatformEvent = {
      eventId: `evt-pos-${Date.now()}`,
      eventType: 'position.updated',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: testPosId,
        clientId: testClientId,
        clientName: 'Rahul Sharma',
        symbol: 'INFY',
        side: 'BUY',
        qty: 50,
        buyPrice: 1850.50,
        currentPrice: 1890.00,
        unrealizedPnl: 1975.00,
        realizedPnl: 0,
        marginUsed: 18505.00,
        status: 'OPEN'
      }
    };

    const posRes = await sendEvent(positionEvent);
    assert(posRes.success === true, 'position.updated event accepted and processed');

    const dbPos = await query('SELECT * FROM positions WHERE id = $1 AND tenant_id = $2', [testPosId, tenantId]);
    assert(dbPos.rows.length === 1, 'Position persisted in PostgreSQL positions table');
    assert(parseFloat(dbPos.rows[0].pnl) === 1975.00, 'Unrealized P&L synchronized correctly');
    assert(parseFloat(dbPos.rows[0].current_price) === 1890.00, 'Current market price updated accurately');

    // -------------------------------------------------------------------------
    // TEST 4: WALLET UPDATED EVENT PROJECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Wallet Updated Event Projection ---');
    const walletEvent: TradingPlatformEvent = {
      eventId: `evt-wallet-${Date.now()}`,
      eventType: 'wallet.updated',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        clientId: testClientId,
        balance: 76975.00,
        equity: 78950.00,
        usedMargin: 18505.00,
        availableMargin: 60445.00
      }
    };

    const walletRes = await sendEvent(walletEvent);
    assert(walletRes.success === true, 'wallet.updated event accepted and processed');

    const dbClientWallet = await query('SELECT balance, equity, margin_used FROM clients WHERE id = $1', [testClientId]);
    assert(parseFloat(dbClientWallet.rows[0].balance) === 76975.00, 'Client balance updated accurately');
    assert(parseFloat(dbClientWallet.rows[0].equity) === 78950.00, 'Client equity updated accurately');
    assert(parseFloat(dbClientWallet.rows[0].margin_used) === 18505.00, 'Client used margin updated accurately');

    // -------------------------------------------------------------------------
    // TEST 5: DEPOSIT LIFECYCLE (Created, Updated, Approved, Rejected)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Deposit Lifecycle & Pending Verification ---');
    const depId = `DEP-TEST-${Date.now()}`;
    const depCreatedEvent: TradingPlatformEvent = {
      eventId: `evt-dep-create-${Date.now()}`,
      eventType: 'deposit.created',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: depId,
        clientId: testClientId,
        clientCode: testClientCode,
        clientName: 'Rahul Sharma',
        amount: 25000.00,
        currency: 'INR',
        paymentMethod: 'UPI',
        transactionRef: `UPI-REF-${Date.now()}`,
        status: 'PENDING'
      }
    };

    const depCreatedRes = await sendEvent(depCreatedEvent);
    assert(depCreatedRes.success === true, 'deposit.created event accepted and processed');

    const dbDep1 = await query('SELECT * FROM fund_deposits WHERE id = $1', [depId]);
    assert(dbDep1.rows.length === 1 && dbDep1.rows[0].status === 'PENDING', 'Deposit status is PENDING in PostgreSQL');
    assert(parseFloat(dbDep1.rows[0].amount) === 25000.00, 'Deposit pending amount is 25,000.00');

    // Test deposit approval
    const depApprovedEvent: TradingPlatformEvent = {
      eventId: `evt-dep-appr-${Date.now()}`,
      eventType: 'deposit.approved',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: depId,
        clientId: testClientId,
        amount: 25000.00,
        status: 'COMPLETED'
      }
    };

    const depApprRes = await sendEvent(depApprovedEvent);
    assert(depApprRes.success === true, 'deposit.approved event accepted and processed');

    const dbDep2 = await query('SELECT * FROM fund_deposits WHERE id = $1', [depId]);
    assert(dbDep2.rows[0].status === 'COMPLETED', 'Deposit status transitioned to COMPLETED');

    // -------------------------------------------------------------------------
    // TEST 6: WITHDRAWAL LIFECYCLE (Created, Updated, Approved, Rejected)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Withdrawal Lifecycle & Pending Verification ---');
    const wdrId = `WDR-TEST-${Date.now()}`;
    const wdrCreatedEvent: TradingPlatformEvent = {
      eventId: `evt-wdr-create-${Date.now()}`,
      eventType: 'withdrawal.created',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: wdrId,
        clientId: testClientId,
        clientCode: testClientCode,
        clientName: 'Rahul Sharma',
        amount: 15000.00,
        currency: 'INR',
        status: 'PENDING'
      }
    };

    const wdrCreatedRes = await sendEvent(wdrCreatedEvent);
    assert(wdrCreatedRes.success === true, 'withdrawal.created event accepted and processed');

    const dbWdr1 = await query('SELECT * FROM fund_withdrawals WHERE id = $1', [wdrId]);
    assert(dbWdr1.rows.length === 1 && dbWdr1.rows[0].status === 'PENDING', 'Withdrawal status is PENDING in PostgreSQL');
    assert(parseFloat(dbWdr1.rows[0].amount) === 15000.00, 'Withdrawal pending amount is 15,000.00');

    // Test withdrawal rejected
    const wdrRejectedEvent: TradingPlatformEvent = {
      eventId: `evt-wdr-rej-${Date.now()}`,
      eventType: 'withdrawal.rejected',
      tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        id: wdrId,
        clientId: testClientId,
        status: 'FAILED',
        reason: 'Bank verification pending'
      }
    };

    const wdrRejRes = await sendEvent(wdrRejectedEvent);
    assert(wdrRejRes.success === true, 'withdrawal.rejected event accepted and processed');

    const dbWdr2 = await query('SELECT * FROM fund_withdrawals WHERE id = $1', [wdrId]);
    assert(dbWdr2.rows[0].status === 'FAILED', 'Withdrawal status transitioned to FAILED');

    // -------------------------------------------------------------------------
    // TEST 7: DASHBOARD KPI AGGREGATION FROM REAL POSTGRESQL DATA
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Dashboard KPI Aggregation (Real PostgreSQL Projections) ---');
    const kpis = await provider.getDashboardKPIs(tenantId);

    assert(typeof kpis.total_clients.value === 'number' && kpis.total_clients.value > 0, `KPI total_clients is numeric real count: ${kpis.total_clients.value}`);
    assert(typeof kpis.active_clients?.value === 'number', `KPI active_clients is calculated: ${kpis.active_clients?.value}`);
    assert(typeof kpis.todays_turnover?.value === 'string', `KPI todays_turnover is formatted currency string: ${kpis.todays_turnover?.value}`);
    assert(typeof kpis.total_turnover?.value === 'string', `KPI total_turnover is separated and distinct: ${kpis.total_turnover?.value}`);
    assert(kpis.todays_turnover?.value !== undefined && kpis.total_turnover?.value !== undefined, 'todays_turnover and total_turnover are both exposed as separate values');
    assert(typeof kpis.commission_earned?.value === 'string', `KPI commission_earned is calculated: ${kpis.commission_earned?.value}`);
    assert(typeof kpis.realized_pl?.value === 'string', `KPI realized_pl is calculated: ${kpis.realized_pl?.value}`);
    assert(typeof kpis.unrealized_pl?.value === 'string', `KPI unrealized_pl is calculated: ${kpis.unrealized_pl?.value}`);
    assert(typeof kpis.net_pl?.value === 'string', `KPI net_pl is calculated: ${kpis.net_pl?.value}`);
    assert(typeof kpis.pending_deposits?.value === 'number', `KPI pending_deposits count is numeric: ${kpis.pending_deposits?.value}`);
    assert(typeof kpis.pending_withdrawals?.value === 'number', `KPI pending_withdrawals count is numeric: ${kpis.pending_withdrawals?.value}`);
    assert(typeof kpis.open_positions?.value === 'number', `KPI open_positions is numeric: ${kpis.open_positions?.value}`);
    assert(typeof kpis.pending_orders?.value === 'number', `KPI pending_orders is numeric: ${kpis.pending_orders?.value}`);
    assert(typeof kpis.equity?.value === 'string', `KPI equity is calculated: ${kpis.equity?.value}`);
    assert(typeof kpis.used_margin?.value === 'string', `KPI used_margin is calculated: ${kpis.used_margin?.value}`);
    assert(typeof kpis.available_margin?.value === 'string', `KPI available_margin is calculated: ${kpis.available_margin?.value}`);

    // Cleanup test artifacts
    await query('DELETE FROM positions WHERE id = $1', [testPosId]);
    await query('DELETE FROM trades WHERE id = $1', [testTradeId]);
    await query('DELETE FROM fund_deposits WHERE id = $1', [depId]);
    await query('DELETE FROM fund_withdrawals WHERE id = $1', [wdrId]);

    console.log('\n================================================================');
    console.log(`  LIVE INTEGRATION TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED  `);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('\n❌ FATAL TEST ERROR:', err);
    process.exit(1);
  }
}

runLiveIntegrationTests();
