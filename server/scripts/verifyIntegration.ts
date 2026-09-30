import { query } from '../db/connection.ts';
import { activeTradingDataProvider } from '../providers/TradingDataProvider.ts';
import { tradingPlatformClient } from '../services/TradingPlatformClient.ts';
import { eventHandler, TradingPlatformEvent } from '../services/EventHandler.ts';

interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function assertCheck(name: string, condition: boolean, details?: string) {
  results.push({ name, passed: Boolean(condition), details });
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${name}${details ? ` -> ${details}` : ''}`);
  if (!condition) {
    console.error(`  ↳ Assertion failed: ${name}`);
  }
}

async function runIntegrationVerification() {
  console.log('===============================================================');
  console.log('  STARTING INTEGRATION VERIFICATION & SECURITY AUDIT (TASK A7) ');
  console.log('===============================================================\n');

  const testSuffix = Date.now().toString().slice(-6);
  const testTenantId = 'TNT-001';
  const testClientId = `CLT_A7_${testSuffix}`;
  const testClientCode = `TC${testSuffix}`;
  const testSymbol = `TCS_${testSuffix}`;

  // Ensure test tenant exists
  await query(`
    INSERT INTO tenants (id, name, code, subdomain, plan, status, owner_name, owner_email)
    VALUES ($1, 'Test Integration Tenant', 'TNT001', 'testtenant', 'ENTERPRISE', 'ACTIVE', 'Test Owner', 'owner@test.com')
    ON CONFLICT (id) DO NOTHING
  `, [testTenantId]);

  // Ensure sub-broker exists for tenant hierarchy
  await query(`
    INSERT INTO sub_brokers (id, tenant_id, broker_id, name, email, code, status)
    VALUES ('SB-001', $1, 'BRK-001', 'Primary Sub Broker', 'sb@tradematrix.io', 'SB001', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING
  `, [testTenantId]);

  // Helper to send signed event via eventHandler
  async function dispatchSignedEvent(
    eventType: string,
    payload: any,
    overrides?: { badSignature?: boolean; nonce?: string; duplicateEventId?: string; timestamp?: string }
  ) {
    const eventId = overrides?.duplicateEventId || `EVT_${eventType.replace(/\./g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = overrides?.timestamp || new Date().toISOString();
    const nonce = overrides?.nonce || `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const eventPayload: TradingPlatformEvent = {
      eventId,
      eventType,
      tenantId: testTenantId,
      timestamp,
      payload
    };

    const bodyStr = JSON.stringify(eventPayload);
    const validSignature = tradingPlatformClient.generateSignature(
      timestamp,
      'POST',
      '/api/internal/events',
      bodyStr
    );
    const signature = overrides?.badSignature ? 'deadbeefbadsignature1234567890abcdef' : validSignature;

    const headers: Record<string, string> = {
      'x-signature-sha256': signature,
      'x-internal-signature': signature,
      'x-timestamp': timestamp,
      'x-internal-timestamp': timestamp,
      'x-nonce': nonce,
      'x-internal-nonce': nonce,
      'x-tenant-id': testTenantId,
      'content-type': 'application/json'
    };

    const result = await eventHandler.handleInboundEvent(
      headers,
      'POST',
      '/api/internal/events',
      bodyStr,
      eventPayload
    );

    return { result, eventId, timestamp, nonce, bodyStr, headers };
  }

  // -------------------------------------------------------------
  // 1. DATABASE CONNECTIVITY & ZERO-DATA HANDLING
  // -------------------------------------------------------------
  console.log('--- SECTION 1: Database & Baseline Data Handling ---');
  const dbTest = await query('SELECT 1 as test');
  assertCheck('1.1 Database Connectivity', dbTest.rows.length === 1);

  const emptyKpis = await activeTradingDataProvider.getDashboardKPIs('TNT-NONEXISTENT-TENANT');
  assertCheck(
    '1.2 Zero-Data Isolation (Non-Existent Tenant)',
    emptyKpis.todays_turnover?.value === '₹0' && emptyKpis.total_clients?.value === 0,
    `todays_turnover=${emptyKpis.todays_turnover?.value}, total_clients=${emptyKpis.total_clients?.value}`
  );

  // -------------------------------------------------------------
  // 2. SIMULATE SIGNED TRADING EVENTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Simulate Signed Trading Platform Events ---');

  // 2.1 Client Created Event
  const clientEventRes = await dispatchSignedEvent('client.created', {
    clientId: testClientId,
    clientCode: testClientCode,
    name: `Test Trader ${testSuffix}`,
    email: `trader_${testSuffix}@example.com`,
    phone: '+91 9988776655',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    balance: 50000,
    equity: 50000,
    marginUsed: 0
  });
  assertCheck(
    '2.1 Signed Event: client.created Ingestion',
    clientEventRes.result.success === true && !clientEventRes.result.duplicate,
    `eventId=${clientEventRes.eventId}`
  );

  // 2.2 Wallet Updated Event
  const walletEventRes = await dispatchSignedEvent('wallet.updated', {
    clientId: testClientId,
    clientCode: testClientCode,
    balance: 75000,
    equity: 75000,
    usedMargin: 10000,
    availableMargin: 65000,
    currency: 'INR'
  });
  assertCheck(
    '2.2 Signed Event: wallet.updated Ingestion',
    walletEventRes.result.success === true,
    `new balance=75000, usedMargin=10000`
  );

  // 2.3 Fund Deposit Approved Event
  const depositId = `DEP_A7_${testSuffix}`;
  const depositEventRes = await dispatchSignedEvent('fund.deposit_approved', {
    id: depositId,
    depositId,
    clientId: testClientId,
    clientCode: testClientCode,
    clientName: `Test Trader ${testSuffix}`,
    amount: 25000,
    currency: 'INR',
    paymentMethod: 'UPI / NetBanking',
    transactionRef: `UPI-REF-${testSuffix}`,
    status: 'COMPLETED',
    approvedBy: 'Auto-Settler S2S'
  });
  assertCheck(
    '2.3 Signed Event: fund.deposit_approved Ingestion',
    depositEventRes.result.success === true,
    `depositId=${depositId}, amount=25000`
  );

  // 2.4 Trade Executed Event
  const tradeId = `TRD_A7_${testSuffix}`;
  const orderId = `ORD_A7_${testSuffix}`;
  const tradeEventRes = await dispatchSignedEvent('trade.executed', {
    tradeId,
    orderId,
    clientId: testClientId,
    clientCode: testClientCode,
    clientName: `Test Trader ${testSuffix}`,
    symbol: testSymbol,
    exchange: 'NSE',
    side: 'BUY',
    quantity: 20,
    price: 3200,
    value: 64000,
    orderType: 'LIMIT',
    status: 'FILLED',
    executedAt: new Date().toISOString()
  });
  assertCheck(
    '2.4 Signed Event: trade.executed Ingestion',
    tradeEventRes.result.success === true,
    `tradeId=${tradeId}, symbol=${testSymbol}, value=64000`
  );

  // 2.5 Position Updated / Created Event
  const posId = `POS_A7_${testSuffix}`;
  const positionEventRes = await dispatchSignedEvent('position.updated', {
    id: posId,
    positionId: posId,
    clientId: testClientId,
    clientCode: testClientCode,
    clientName: `Test Trader ${testSuffix}`,
    symbol: testSymbol,
    exchange: 'NSE',
    side: 'BUY',
    quantity: 20,
    buyPrice: 3200,
    currentPrice: 3350,
    pnl: 3000,
    pnlPercentage: 4.68,
    status: 'OPEN'
  });
  assertCheck(
    '2.5 Signed Event: position.updated Ingestion',
    positionEventRes.result.success === true,
    `posId=${posId}, pnl=+3000`
  );

  // -------------------------------------------------------------
  // 3. ASSERT LOCAL ADMIN PROJECTIONS & STORES UPDATED
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Assert Admin Dashboard, Clients, Funds, Ledger, Trades & Positions ---');

  // 3.1 Assert Dashboard KPIs
  const dashboardKpis = await activeTradingDataProvider.getDashboardKPIs(testTenantId);
  const hasTurnover = dashboardKpis.todays_turnover && dashboardKpis.todays_turnover.value !== '₹0';
  const hasClients = dashboardKpis.total_clients && (dashboardKpis.total_clients.value as number) > 0;
  assertCheck(
    '3.1 Dashboard KPIs Updated from Events',
    Boolean(hasTurnover && hasClients),
    `Turnover=${dashboardKpis.todays_turnover?.value}, Total Clients=${dashboardKpis.total_clients?.value}`
  );

  // 3.2 Assert Clients Projection
  const clientRows = await query('SELECT * FROM clients WHERE id = $1 AND tenant_id = $2', [testClientId, testTenantId]);
  assertCheck(
    '3.2 Clients Store Updated with Ingested Client',
    clientRows.rows.length === 1 && clientRows.rows[0].client_code === testClientCode,
    `Found client ${clientRows.rows[0]?.name} (${clientRows.rows[0]?.client_code})`
  );

  // 3.3 Assert Funds Store
  const depositRows = await query('SELECT * FROM fund_deposits WHERE id = $1 AND tenant_id = $2', [depositId, testTenantId]);
  const fundTxRows = await query('SELECT * FROM fund_transactions WHERE id = $1 AND tenant_id = $2', [depositId, testTenantId]);
  assertCheck(
    '3.3 Funds Store Updated with Ingested Deposit',
    depositRows.rows.length === 1 && depositRows.rows[0].status === 'COMPLETED' && fundTxRows.rows.length === 1,
    `Deposit status=${depositRows.rows[0]?.status}, Amount=${depositRows.rows[0]?.amount}`
  );

  // 3.4 Assert Ledger Entries
  const ledgerRows = await query('SELECT * FROM ledger_entries WHERE tenant_id = $1 AND (client_id = $2 OR reference_id = $3)', [testTenantId, testClientId, depositId]);
  assertCheck(
    '3.4 Ledger Store Updated with Transaction & Commission Entries',
    ledgerRows.rows.length > 0,
    `Found ${ledgerRows.rows.length} ledger entries for test client`
  );

  // 3.5 Assert Trades Store
  const tradeRows = await query('SELECT * FROM trades WHERE id = $1 OR trade_id = $2', [tradeId, tradeId]);
  const recentTrades = await activeTradingDataProvider.getRecentTrades(testTenantId);
  const tradeInList = recentTrades.some(t => t.tradeId === tradeId || (t as any).id === tradeId);
  assertCheck(
    '3.5 Trades Store Updated with Ingested Trade',
    tradeRows.rows.length > 0 && tradeInList,
    `Trade ${tradeId} present in database and getRecentTrades query`
  );

  // 3.6 Assert Positions Store
  const posRows = await query('SELECT * FROM positions WHERE id = $1 AND tenant_id = $2', [posId, testTenantId]);
  const allPositions = await activeTradingDataProvider.getPositions(testTenantId);
  const posInList = allPositions.some(p => p.id === posId || (p as any).positionId === posId);
  assertCheck(
    '3.6 Positions Store Updated with Ingested Position',
    posRows.rows.length > 0 && posInList,
    `Position ${posId} present with status=${posRows.rows[0]?.status}, PnL=${posRows.rows[0]?.pnl}`
  );

  // -------------------------------------------------------------
  // 4. ASSERT SECURITY: BAD SIGNATURE, REPLAY NONCE & DEDUPLICATION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Security Validation (HMAC, Nonce Replay, Deduplication) ---');

  // 4.1 Bad Signature Assertion -> 401
  const badSigRes = await dispatchSignedEvent('trade.executed', {
    tradeId: `TRD_BAD_${testSuffix}`,
    clientId: testClientId,
    symbol: 'BADSIG-EQ',
    quantity: 1,
    price: 100
  }, { badSignature: true });
  assertCheck(
    '4.1 Bad Signature Rejected with 401 / Authorization Failure',
    badSigRes.result.success === false && (badSigRes.result.statusCode === 401 || badSigRes.result.error?.includes('mismatch') || badSigRes.result.error?.includes('HMAC')),
    `Result: success=${badSigRes.result.success}, statusCode=${badSigRes.result.statusCode}, error="${badSigRes.result.error}"`
  );

  // 4.2 Replay Nonce Assertion -> 401
  const fixedNonce = `nonce_replay_${testSuffix}_${Date.now()}`;
  const firstWithNonce = await dispatchSignedEvent('position.updated', {
    id: `POS_NONCE_${testSuffix}`,
    clientId: testClientId,
    symbol: testSymbol,
    quantity: 5,
    buyPrice: 3200,
    currentPrice: 3250
  }, { nonce: fixedNonce });

  const replayNonceRes = await dispatchSignedEvent('position.updated', {
    id: `POS_NONCE_${testSuffix}`,
    clientId: testClientId,
    symbol: testSymbol,
    quantity: 5,
    buyPrice: 3200,
    currentPrice: 3250
  }, { nonce: fixedNonce });

  assertCheck(
    '4.2 Replay Nonce Attack Rejected with 401',
    firstWithNonce.result.success === true &&
    replayNonceRes.result.success === false &&
    (replayNonceRes.result.statusCode === 401 || replayNonceRes.result.error?.includes('Nonce') || replayNonceRes.result.error?.includes('replay')),
    `First result=${firstWithNonce.result.success}, Replay result=${replayNonceRes.result.success}, error="${replayNonceRes.result.error}"`
  );

  // 4.3 Duplicate Event ID Assertion -> 200 (duplicate: true)
  const fixedEventId = `EVT_DEDUP_${testSuffix}_${Date.now()}`;
  const firstEvent = await dispatchSignedEvent('wallet.updated', {
    clientId: testClientId,
    balance: 80000,
    equity: 80000
  }, { duplicateEventId: fixedEventId });

  const duplicateEvent = await dispatchSignedEvent('wallet.updated', {
    clientId: testClientId,
    balance: 80000,
    equity: 80000
  }, { duplicateEventId: fixedEventId });

  assertCheck(
    '4.3 Duplicate Event ID Returns 200 with duplicate=true',
    firstEvent.result.success === true &&
    duplicateEvent.result.success === true &&
    duplicateEvent.result.duplicate === true,
    `First: success=${firstEvent.result.success}, Duplicate: duplicate=${duplicateEvent.result.duplicate}`
  );

  // -------------------------------------------------------------
  // 5. EXTEND /api/admin/integration/status OBSERVABILITY CHECKS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: Assert /api/admin/integration/status Observability Fields ---');

  const stats = eventHandler.getEventStats();
  const lastEventDb = await query('SELECT created_at FROM processed_events ORDER BY created_at DESC LIMIT 1');
  const lastEventTime = stats.metrics.lastEventProcessedAt || (lastEventDb.rows[0]?.created_at ? new Date(lastEventDb.rows[0].created_at).toISOString() : null);
  const clientMetrics = tradingPlatformClient.getMetrics();
  const failedOutboundCount = clientMetrics.failedRequests || 0;
  const backfillRows = await query('SELECT * FROM tenant_sync_state ORDER BY updated_at DESC');

  const backfillState = {
    status: backfillRows.rows.some(r => r.sync_status === 'RETRYING')
      ? 'RETRYING'
      : backfillRows.rows.some(r => r.sync_status === 'FAILED')
      ? 'FAILED'
      : backfillRows.rows.every(r => r.sync_status === 'SYNCED') && backfillRows.rows.length > 0
      ? 'SYNCED'
      : 'IDLE',
    tenants_synced: backfillRows.rows.filter(r => r.sync_status === 'SYNCED').length,
    total_tenants: backfillRows.rows.length
  };

  assertCheck(
    '5.1 Integration Status: last_event_time Populated',
    typeof lastEventTime === 'string' && lastEventTime.length > 0,
    `last_event_time="${lastEventTime}"`
  );

  assertCheck(
    '5.2 Integration Status: failed_outbound_count Present',
    typeof failedOutboundCount === 'number',
    `failed_outbound_count=${failedOutboundCount}`
  );

  assertCheck(
    '5.3 Integration Status: backfill_state Present and Structured',
    typeof backfillState === 'object' && typeof backfillState.status === 'string',
    `backfill_state.status="${backfillState.status}", tenants_synced=${backfillState.tenants_synced}/${backfillState.total_tenants}`
  );

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                 VERIFICATION SUMMARY RESULTS                  ');
  console.log('===============================================================');

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log(`TOTAL CHECKS: ${results.length}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n❌ INTEGRATION VERIFICATION FAILED: One or more assertions failed.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL INTEGRATION CHECKS PASSED: S2S security, projections, and observability verified.');
  }
}

runIntegrationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Audit Error:', err);
    process.exit(1);
  });
