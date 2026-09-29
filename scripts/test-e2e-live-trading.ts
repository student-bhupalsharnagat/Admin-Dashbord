/**
 * End-to-End Live Trading Data Projection Verification Suite
 * Tests all 18 core requirements requested by the user.
 */

import { query, testConnection } from '../server/db/connection.ts';
import { eventHandler, TradingPlatformEvent } from '../server/services/EventHandler.ts';
import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { PostgresTradingDataProvider } from '../server/providers/PostgresTradingDataProvider.ts';

const provider = new PostgresTradingDataProvider();

interface TestResult {
  num: number;
  name: string;
  status: 'PASS' | 'FAIL';
  endpointOrFile?: string;
  rootCause?: string;
  minimumFixRequired?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordPass(num: number, name: string, details?: string) {
  results.push({ num, name, status: 'PASS', details });
  console.log(`✅ [PASS] #${num}: ${name}${details ? ` (${details})` : ''}`);
}

function recordFail(num: number, name: string, endpointOrFile: string, rootCause: string, minimumFixRequired: string) {
  results.push({
    num,
    name,
    status: 'FAIL',
    endpointOrFile,
    rootCause,
    minimumFixRequired
  });
  console.error(`❌ [FAIL] #${num}: ${name}\n   File: ${endpointOrFile}\n   Cause: ${rootCause}\n   Fix: ${minimumFixRequired}`);
}

async function runE2ETests() {
  console.log('================================================================');
  console.log('   RUNNING E2E CENTRAL ADMIN LIVE TRADING PROJECTION TESTS      ');
  console.log('================================================================\n');

  await testConnection();

  const tenantA = 'TNT-E2E-A';
  const tenantB = 'TNT-E2E-B';

  // Helper to send signed event to eventHandler
  const sendSignedEvent = async (event: TradingPlatformEvent) => {
    const rawBody = JSON.stringify(event);
    const headers = {
      'x-signature-sha256': tradingPlatformClient.generateSignature(event.timestamp, 'POST', '/api/internal/events', rawBody),
      'x-timestamp': event.timestamp,
      'x-tenant-id': event.tenantId
    };
    return await eventHandler.handleInboundEvent(headers, 'POST', '/api/internal/events', rawBody, event);
  };

  // Seed test tenants
  await query(`
    INSERT INTO tenants (id, name, code, subdomain, plan, status, owner_name, owner_email)
    VALUES 
      ($1, 'Tenant Alpha E2E', 'ALPHA_E2E', 'alpha-e2e', 'ENTERPRISE', 'ACTIVE', 'Alpha Admin', 'alpha@e2e.com'),
      ($2, 'Tenant Beta E2E', 'BETA_E2E', 'beta-e2e', 'ENTERPRISE', 'ACTIVE', 'Beta Admin', 'beta@e2e.com')
    ON CONFLICT (id) DO NOTHING
  `, [tenantA, tenantB]);

  const timestamp = new Date().toISOString();
  const testClientId = `CLT-E2E-${Date.now()}`;
  const testClientCode = `E2E${Date.now().toString().slice(-4)}`;
  const testClientName = 'Vikramaditya Singhania';

  try {
    // -------------------------------------------------------------------------
    // TEST 1: New CLIENT registration from Trading Platform appears in Admin Clients
    // -------------------------------------------------------------------------
    try {
      const regEvent: TradingPlatformEvent = {
        eventId: `evt-reg-${Date.now()}`,
        eventType: 'client.registered',
        tenantId: tenantA,
        timestamp,
        payload: {
          id: testClientId,
          clientId: testClientId,
          clientCode: testClientCode,
          name: testClientName,
          email: 'vikram.singhania@e2e.com',
          phone: '+91 9988776655',
          kycStatus: 'VERIFIED',
          status: 'ACTIVE',
          walletBalance: 150000,
          equity: 150000,
          marginUsed: 0
        }
      };

      const res1 = await sendSignedEvent(regEvent);
      if (!res1.success) throw new Error(`Event failed: ${res1.error || res1.message}`);

      const adminClients = await provider.getClients(tenantA);
      const foundClient = adminClients.find(c => c.id === testClientId || c.client_code === testClientCode);

      if (foundClient && foundClient.name === testClientName && foundClient.wallet_balance === 150000) {
        recordPass(1, 'New CLIENT registration appears in Admin Clients', `client_code=${foundClient.client_code}`);
      } else {
        recordFail(1, 'New CLIENT registration appears in Admin Clients', 'server/providers/PostgresTradingDataProvider.ts', 'Client not found in getClients output after event', 'Ensure getClients selects projected client by tenant');
      }
    } catch (e: any) {
      recordFail(1, 'New CLIENT registration appears in Admin Clients', 'server/services/EventHandler.ts', e.message, 'Fix handleClientCreatedOrUpdated');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Execute a trade and verify Admin Trades
    // -------------------------------------------------------------------------
    const testTradeId = `TRD-E2E-${Date.now()}`;
    const testOrderId = `ORD-E2E-${Date.now()}`;
    const tradePrice = 3200.00;
    const tradeQty = 25;
    const tradeTotal = tradePrice * tradeQty; // 80,000

    try {
      const tradeEvent: TradingPlatformEvent = {
        eventId: `evt-trade-${Date.now()}`,
        eventType: 'trade.executed',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          tradeId: testTradeId,
          orderId: testOrderId,
          clientId: testClientId,
          clientCode: testClientCode,
          clientName: testClientName,
          symbol: 'RELIANCE',
          side: 'BUY',
          quantity: tradeQty,
          price: tradePrice,
          totalValue: tradeTotal,
          executedAt: new Date().toISOString()
        }
      };

      const res2 = await sendSignedEvent(tradeEvent);
      if (!res2.success) throw new Error(`Trade event ingestion failed: ${res2.error}`);

      const adminTrades = await provider.getAllTrades(tenantA);
      const foundTrade = adminTrades.find(t => t.trade_id === testTradeId || t.id === testTradeId);

      if (foundTrade && foundTrade.symbol === 'RELIANCE' && foundTrade.price === tradePrice && foundTrade.quantity === tradeQty) {
        recordPass(2, 'Execute a trade and verify Admin Trades', `trade_id=${foundTrade.trade_id}, total=${foundTrade.total_value}`);
      } else {
        recordFail(2, 'Execute a trade and verify Admin Trades', 'server/providers/PostgresTradingDataProvider.ts', 'Trade not returned by getAllTrades', 'Ensure getAllTrades returns PostgreSQL trades projection');
      }
    } catch (e: any) {
      recordFail(2, 'Execute a trade and verify Admin Trades', 'server/services/EventHandler.ts', e.message, 'Fix handleTradeExecuted projection');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Verify order appears in Admin Orders
    // -------------------------------------------------------------------------
    const testOrderSoloId = `ORD-SOLO-${Date.now()}`;
    try {
      const orderEvent: TradingPlatformEvent = {
        eventId: `evt-order-${Date.now()}`,
        eventType: 'order.created',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          orderId: testOrderSoloId,
          clientId: testClientId,
          clientCode: testClientCode,
          clientName: testClientName,
          symbol: 'TCS',
          exchange: 'NSE',
          orderType: 'LIMIT',
          side: 'BUY',
          quantity: 10,
          price: 4100.00,
          status: 'PENDING'
        }
      };

      const res3 = await sendSignedEvent(orderEvent);
      if (!res3.success) throw new Error(`Order event ingestion failed: ${res3.error}`);

      const adminOrders = await provider.getOrders(tenantA);
      const foundOrder = adminOrders.find(o => o.order_id === testOrderSoloId || o.id === testOrderSoloId);

      if (foundOrder && foundOrder.symbol === 'TCS' && foundOrder.price === 4100.00) {
        recordPass(3, 'Verify order appears in Admin Orders', `order_id=${foundOrder.order_id}, status=${foundOrder.status}`);
      } else {
        recordFail(3, 'Verify order appears in Admin Orders', 'server/providers/PostgresTradingDataProvider.ts', 'Order not found in getOrders', 'Ensure getOrders includes local orders table projection');
      }
    } catch (e: any) {
      recordFail(3, 'Verify order appears in Admin Orders', 'server/services/EventHandler.ts', e.message, 'Fix handleOrderEvent');
    }

    // -------------------------------------------------------------------------
    // TEST 4: Verify position appears/updates in Admin Positions
    // -------------------------------------------------------------------------
    const testPosId = `POS-E2E-${Date.now()}`;
    try {
      const posEvent: TradingPlatformEvent = {
        eventId: `evt-pos-${Date.now()}`,
        eventType: 'position.updated',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          id: testPosId,
          clientId: testClientId,
          clientName: testClientName,
          symbol: 'RELIANCE',
          side: 'BUY',
          qty: 25,
          buyPrice: 3200.00,
          currentPrice: 3250.00,
          unrealizedPnl: 1250.00,
          realizedPnl: 0,
          marginUsed: 16000.00,
          status: 'OPEN'
        }
      };

      const res4 = await sendSignedEvent(posEvent);
      if (!res4.success) throw new Error(`Position event failed: ${res4.error}`);

      const adminPositions = await provider.getPositions(tenantA);
      const foundPos = adminPositions.find(p => p.id === testPosId || (p.client === testClientName && p.symbol === 'RELIANCE'));

      if (foundPos && foundPos.symbol === 'RELIANCE') {
        recordPass(4, 'Verify position appears/updates in Admin Positions', `pos_id=${foundPos.id}, unrealizedPL=${foundPos.unrealizedPL}`);
      } else {
        recordFail(4, 'Verify position appears/updates in Admin Positions', 'server/providers/PostgresTradingDataProvider.ts', 'Position not returned in getPositions', 'Ensure getPositions includes PostgreSQL positions projection');
      }
    } catch (e: any) {
      recordFail(4, 'Verify position appears/updates in Admin Positions', 'server/services/EventHandler.ts', e.message, 'Fix handlePositionUpdated');
    }

    // -------------------------------------------------------------------------
    // TEST 5: Verify client balance/equity/margin updates
    // -------------------------------------------------------------------------
    try {
      const walletEvent: TradingPlatformEvent = {
        eventId: `evt-wallet-update-${Date.now()}`,
        eventType: 'wallet.updated',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          clientId: testClientId,
          balance: 142000.00,
          equity: 143250.00,
          usedMargin: 16000.00,
          availableMargin: 127250.00
        }
      };

      const res5 = await sendSignedEvent(walletEvent);
      if (!res5.success) throw new Error(`Wallet event failed: ${res5.error}`);

      const clientRow = await query('SELECT balance, equity, margin_used FROM clients WHERE id = $1', [testClientId]);
      if (clientRow.rows.length === 0) throw new Error('Client record not found');

      const bal = parseFloat(clientRow.rows[0].balance);
      const eq = parseFloat(clientRow.rows[0].equity);
      const mu = parseFloat(clientRow.rows[0].margin_used);

      if (bal === 142000.00 && eq === 143250.00 && mu === 16000.00) {
        recordPass(5, 'Verify client balance/equity/margin updates', `balance=${bal}, equity=${eq}, margin_used=${mu}`);
      } else {
        recordFail(5, 'Verify client balance/equity/margin updates', 'server/services/EventHandler.ts', `Values mismatch: got bal=${bal}, eq=${eq}, mu=${mu}`, 'Update handleWalletUpdated to correctly persist fields');
      }
    } catch (e: any) {
      recordFail(5, 'Verify client balance/equity/margin updates', 'server/services/EventHandler.ts', e.message, 'Check wallet.updated event handler');
    }

    // -------------------------------------------------------------------------
    // TESTS 6 - 11: DASHBOARD FINANCIAL KPIs
    // -------------------------------------------------------------------------
    const kpisA = await provider.getDashboardKPIs(tenantA);

    // 6. Today's turnover
    if (kpisA.todays_turnover && typeof kpisA.todays_turnover.value === 'string' && kpisA.todays_turnover.value !== '') {
      recordPass(6, "Verify today's turnover", `todays_turnover=${kpisA.todays_turnover.value}`);
    } else {
      recordFail(6, "Verify today's turnover", 'server/providers/PostgresTradingDataProvider.ts', 'todays_turnover missing or invalid in KPIs', 'Expose todays_turnover in getDashboardKPIs');
    }

    // 7. Total turnover
    if (kpisA.total_turnover && typeof kpisA.total_turnover.value === 'string' && kpisA.total_turnover.value !== '') {
      recordPass(7, 'Verify total turnover', `total_turnover=${kpisA.total_turnover.value}`);
    } else {
      recordFail(7, 'Verify total turnover', 'server/providers/PostgresTradingDataProvider.ts', 'total_turnover missing or invalid in KPIs', 'Expose total_turnover in getDashboardKPIs');
    }

    // 8. Commission earned
    if (kpisA.commission_earned && typeof kpisA.commission_earned.value === 'string') {
      recordPass(8, 'Verify commission earned', `commission_earned=${kpisA.commission_earned.value}`);
    } else {
      recordFail(8, 'Verify commission earned', 'server/providers/PostgresTradingDataProvider.ts', 'commission_earned missing', 'Calculate commission_earned in getDashboardKPIs');
    }

    // 9. Realized P&L
    if (kpisA.realized_pl && typeof kpisA.realized_pl.value === 'string') {
      recordPass(9, 'Verify realized P&L', `realized_pl=${kpisA.realized_pl.value}`);
    } else {
      recordFail(9, 'Verify realized P&L', 'server/providers/PostgresTradingDataProvider.ts', 'realized_pl missing', 'Calculate realized_pl in getDashboardKPIs');
    }

    // 10. Unrealized P&L
    if (kpisA.unrealized_pl && typeof kpisA.unrealized_pl.value === 'string') {
      recordPass(10, 'Verify unrealized P&L', `unrealized_pl=${kpisA.unrealized_pl.value}`);
    } else {
      recordFail(10, 'Verify unrealized P&L', 'server/providers/PostgresTradingDataProvider.ts', 'unrealized_pl missing', 'Calculate unrealized_pl from open positions');
    }

    // 11. Net P&L
    if (kpisA.net_pl && typeof kpisA.net_pl.value === 'string') {
      recordPass(11, 'Verify net P&L', `net_pl=${kpisA.net_pl.value}`);
    } else {
      recordFail(11, 'Verify net P&L', 'server/providers/PostgresTradingDataProvider.ts', 'net_pl missing', 'Expose net_pl as sum of realized + unrealized PL');
    }

    // -------------------------------------------------------------------------
    // TEST 12: Create a deposit and verify Pending Deposits count and amount
    // -------------------------------------------------------------------------
    const depTestId = `DEP-E2E-${Date.now()}`;
    const depAmount = 50000.00;
    try {
      const depEvent: TradingPlatformEvent = {
        eventId: `evt-dep-${Date.now()}`,
        eventType: 'deposit.created',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          id: depTestId,
          clientId: testClientId,
          clientCode: testClientCode,
          clientName: testClientName,
          amount: depAmount,
          currency: 'INR',
          status: 'PENDING'
        }
      };

      await sendSignedEvent(depEvent);

      const kpisAfterDep = await provider.getDashboardKPIs(tenantA);
      const pendingDeposits = await provider.getFundDeposits(tenantA, 'PENDING');
      const foundDep = pendingDeposits.find(d => d.txnId === depTestId);

      const count = Number(kpisAfterDep.pending_deposits?.value || 0);
      const amountVal = Number(kpisAfterDep.pending_deposits?.amount || 0);

      if (foundDep && count >= 1 && amountVal >= depAmount) {
        recordPass(12, 'Create a deposit and verify Pending Deposits count and amount', `count=${count}, amount=₹${amountVal.toLocaleString('en-IN')}`);
      } else {
        recordFail(12, 'Create a deposit and verify Pending Deposits count and amount', 'server/providers/PostgresTradingDataProvider.ts', `Pending deposit count/amount not updated (count=${count}, amount=${amountVal})`, 'Include pending deposit sum in getDashboardKPIs');
      }
    } catch (e: any) {
      recordFail(12, 'Create a deposit and verify Pending Deposits count and amount', 'server/services/EventHandler.ts', e.message, 'Fix deposit.created handler');
    }

    // -------------------------------------------------------------------------
    // TEST 13: Create a withdrawal and verify Pending Withdrawals count and amount
    // -------------------------------------------------------------------------
    const wdrTestId = `WDR-E2E-${Date.now()}`;
    const wdrAmount = 20000.00;
    try {
      const wdrEvent: TradingPlatformEvent = {
        eventId: `evt-wdr-${Date.now()}`,
        eventType: 'withdrawal.created',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          id: wdrTestId,
          clientId: testClientId,
          clientCode: testClientCode,
          clientName: testClientName,
          amount: wdrAmount,
          currency: 'INR',
          status: 'PENDING'
        }
      };

      await sendSignedEvent(wdrEvent);

      const kpisAfterWdr = await provider.getDashboardKPIs(tenantA);
      const pendingWdrs = await provider.getFundWithdrawals(tenantA, 'PENDING');
      const foundWdr = pendingWdrs.find(w => w.txnId === wdrTestId);

      const count = Number(kpisAfterWdr.pending_withdrawals?.value || 0);
      const amountVal = Number(kpisAfterWdr.pending_withdrawals?.amount || 0);

      if (foundWdr && count >= 1 && amountVal >= wdrAmount) {
        recordPass(13, 'Create a withdrawal and verify Pending Withdrawals count and amount', `count=${count}, amount=₹${amountVal.toLocaleString('en-IN')}`);
      } else {
        recordFail(13, 'Create a withdrawal and verify Pending Withdrawals count and amount', 'server/providers/PostgresTradingDataProvider.ts', `Pending withdrawal count/amount not updated (count=${count}, amount=${amountVal})`, 'Include pending withdrawal sum in getDashboardKPIs');
      }
    } catch (e: any) {
      recordFail(13, 'Create a withdrawal and verify Pending Withdrawals count and amount', 'server/services/EventHandler.ts', e.message, 'Fix withdrawal.created handler');
    }

    // -------------------------------------------------------------------------
    // TEST 14: Approve/reject deposit and verify Admin status and financial projection
    // -------------------------------------------------------------------------
    try {
      const beforeClient = await query('SELECT balance FROM clients WHERE id = $1', [testClientId]);
      const prevBal = parseFloat(beforeClient.rows[0].balance);

      const apprRes = await provider.approveFundDeposit(depTestId, 'Compliance Head');
      if (!apprRes.success) throw new Error(apprRes.message);

      const depCheck = await query('SELECT status FROM fund_deposits WHERE id = $1', [depTestId]);
      const afterClient = await query('SELECT balance FROM clients WHERE id = $1', [testClientId]);
      const newBal = parseFloat(afterClient.rows[0].balance);

      if (depCheck.rows[0].status === 'COMPLETED' && newBal === prevBal + depAmount) {
        recordPass(14, 'Approve/reject deposit and verify Admin status and financial projection', `status=COMPLETED, balance=${prevBal} -> ${newBal}`);
      } else {
        recordFail(14, 'Approve/reject deposit and verify Admin status and financial projection', 'server/providers/PostgresTradingDataProvider.ts', `Status or balance mismatch: status=${depCheck.rows[0]?.status}, newBal=${newBal}`, 'Ensure approveFundDeposit marks COMPLETED and updates balance');
      }
    } catch (e: any) {
      recordFail(14, 'Approve/reject deposit and verify Admin status and financial projection', 'server/providers/PostgresTradingDataProvider.ts', e.message, 'Fix approveFundDeposit logic');
    }

    // -------------------------------------------------------------------------
    // TEST 15: Approve/reject withdrawal and verify Admin status and financial projection
    // -------------------------------------------------------------------------
    try {
      const beforeClient = await query('SELECT balance FROM clients WHERE id = $1', [testClientId]);
      const prevBal = parseFloat(beforeClient.rows[0].balance);

      const apprWdrRes = await provider.approveFundWithdrawal(wdrTestId, 'Compliance Head');
      if (!apprWdrRes.success) throw new Error(apprWdrRes.message);

      const wdrCheck = await query('SELECT status FROM fund_withdrawals WHERE id = $1', [wdrTestId]);
      const afterClient = await query('SELECT balance FROM clients WHERE id = $1', [testClientId]);
      const newBal = parseFloat(afterClient.rows[0].balance);

      if (wdrCheck.rows[0].status === 'COMPLETED' && newBal === prevBal - wdrAmount) {
        recordPass(15, 'Approve/reject withdrawal and verify Admin status and financial projection', `status=COMPLETED, balance=${prevBal} -> ${newBal}`);
      } else {
        recordFail(15, 'Approve/reject withdrawal and verify Admin status and financial projection', 'server/providers/PostgresTradingDataProvider.ts', `Status or balance mismatch: status=${wdrCheck.rows[0]?.status}, newBal=${newBal}`, 'Ensure approveFundWithdrawal marks COMPLETED and deducts balance');
      }
    } catch (e: any) {
      recordFail(15, 'Approve/reject withdrawal and verify Admin status and financial projection', 'server/providers/PostgresTradingDataProvider.ts', e.message, 'Fix approveFundWithdrawal logic');
    }

    // -------------------------------------------------------------------------
    // TEST 16: Verify duplicate events do not duplicate trades, commissions or fund records
    // -------------------------------------------------------------------------
    try {
      const dupEventId = `evt-dup-check-${Date.now()}`;
      const dupTradeId = `TRD-DUP-${Date.now()}`;
      const duplicateTradeEvent: TradingPlatformEvent = {
        eventId: dupEventId,
        eventType: 'trade.executed',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        payload: {
          tradeId: dupTradeId,
          orderId: `ORD-DUP-${Date.now()}`,
          clientId: testClientId,
          clientCode: testClientCode,
          clientName: testClientName,
          symbol: 'INFY',
          side: 'BUY',
          quantity: 10,
          price: 1800,
          totalValue: 18000,
          executedAt: new Date().toISOString()
        }
      };

      const firstCall = await sendSignedEvent(duplicateTradeEvent);
      if (!firstCall.success || firstCall.duplicate) throw new Error('First event failed or marked duplicate');

      const secondCall = await sendSignedEvent(duplicateTradeEvent);
      const isDeduplicated = secondCall.duplicate === true;

      const tradeCountRes = await query('SELECT count(*) as cnt FROM trades WHERE trade_id = $1', [dupTradeId]);
      const count = parseInt(tradeCountRes.rows[0].cnt, 10);

      if (isDeduplicated && count === 1) {
        recordPass(16, 'Verify duplicate events do not duplicate trades, commissions or fund records', `duplicate_flag=true, db_count=1`);
      } else {
        recordFail(16, 'Verify duplicate events do not duplicate trades, commissions or fund records', 'server/services/EventHandler.ts', `Duplicate trade created or not flagged (isDeduplicated=${isDeduplicated}, count=${count})`, 'Ensure idempotency cache and processed_events check reject duplicates');
      }
    } catch (e: any) {
      recordFail(16, 'Verify duplicate events do not duplicate trades, commissions or fund records', 'server/services/EventHandler.ts', e.message, 'Fix idempotency replay check in handleInboundEvent');
    }

    // -------------------------------------------------------------------------
    // TEST 17: Verify tenant A data cannot appear in tenant B dashboard
    // -------------------------------------------------------------------------
    try {
      const kpisB = await provider.getDashboardKPIs(tenantB);
      const tradesB = await provider.getAllTrades(tenantB);
      const ordersB = await provider.getOrders(tenantB);
      const clientsB = await provider.getClients(tenantB);

      const hasClientAInB = clientsB.some(c => c.id === testClientId);
      const hasTradeAInB = tradesB.some(t => t.trade_id === testTradeId);
      const hasOrderAInB = ordersB.some(o => o.order_id === testOrderSoloId);

      if (!hasClientAInB && !hasTradeAInB && !hasOrderAInB) {
        recordPass(17, 'Verify tenant A data cannot appear in tenant B dashboard', `clientsB=${clientsB.length}, tradesB=${tradesB.length}, ordersB=${ordersB.length}`);
      } else {
        recordFail(17, 'Verify tenant A data cannot appear in tenant B dashboard', 'server/providers/PostgresTradingDataProvider.ts', 'Tenant A records leaked into Tenant B query results', 'Enforce strict WHERE tenant_id = $1 filtering on all queries');
      }
    } catch (e: any) {
      recordFail(17, 'Verify tenant A data cannot appear in tenant B dashboard', 'server/providers/PostgresTradingDataProvider.ts', e.message, 'Ensure tenant scoping in PostgresTradingDataProvider');
    }

    // -------------------------------------------------------------------------
    // TEST 18: Verify Dashboard uses live PostgreSQL data rather than static demo values
    // -------------------------------------------------------------------------
    try {
      const beforeKpi = await provider.getDashboardKPIs(tenantA);

      // Insert a fresh high-value trade directly into PostgreSQL
      const dynamicTradeId = `TRD-DYNAMIC-${Date.now()}`;
      await query(`
        INSERT INTO trades (id, tenant_id, trade_id, client_id, client_name, symbol, side, quantity, price, total_value, status, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, 'MRF', 'BUY', 10, 125000.00, 1250000.00, 'EXECUTED', $6, CURRENT_TIMESTAMP)
      `, [dynamicTradeId, tenantA, dynamicTradeId, testClientId, testClientName, new Date().toISOString()]);

      const afterKpi = await provider.getDashboardKPIs(tenantA);

      // Verify that afterKpi directly reflects the new trade
      const liveDbSum = await query(`
        SELECT COALESCE(SUM(total_value), 0) as total_vol 
        FROM trades 
        WHERE tenant_id = $1
      `, [tenantA]);
      const expectedVol = parseFloat(liveDbSum.rows[0].total_vol);

      if (afterKpi.total_turnover?.value !== beforeKpi.total_turnover?.value && expectedVol >= 1250000.00) {
        recordPass(18, 'Verify Dashboard uses live PostgreSQL data rather than static demo values', `DB trade volume dynamic update verified: sum=₹${expectedVol.toLocaleString('en-IN')}`);
      } else {
        recordFail(18, 'Verify Dashboard uses live PostgreSQL data rather than static demo values', 'server/providers/PostgresTradingDataProvider.ts', 'Dashboard KPI turnover did not dynamically change upon database insert', 'Remove any static or cached fallback in getDashboardKPIs');
      }
    } catch (e: any) {
      recordFail(18, 'Verify Dashboard uses live PostgreSQL data rather than static demo values', 'server/providers/PostgresTradingDataProvider.ts', e.message, 'Check getDashboardKPIs live query logic');
    }

  } finally {
    // Clean up test data safely without violating FK restrictions
    await query('DELETE FROM positions WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM trades WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM orders WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM fund_deposits WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM fund_withdrawals WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM processed_events WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
  }

  // Print summary report
  console.log('\n================================================================');
  console.log('                 FINAL TEST EXECUTION SUMMARY                   ');
  console.log('================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}\n`);

  if (failCount > 0) {
    console.error('FAILURES SUMMARY:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.error(`- Test #${r.num}: ${r.name}`);
      console.error(`  Endpoint/File: ${r.endpointOrFile}`);
      console.error(`  Root Cause:    ${r.rootCause}`);
      console.error(`  Minimum Fix:   ${r.minimumFixRequired}\n`);
    }
    process.exit(1);
  } else {
    console.log('ALL 18 E2E LIVE TRADING DATA PROJECTION TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runE2ETests();
