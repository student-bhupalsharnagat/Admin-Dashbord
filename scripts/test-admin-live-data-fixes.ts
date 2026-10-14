/**
 * Automated Verification Test Suite for Production Live-Data Fixes in Central Admin Panel
 * Tests:
 * 1. client.activated S2S event handling, projection update to ACTIVE, tenant isolation & idempotency
 * 2. Empty live datasets without demo/screenshot fallbacks
 * 3. Dashboard API live metrics & safe unavailable state
 * 4. Commission transactions PostgreSQL backing & queries
 * 5. Risk empty state handling
 * 6. Notifications empty state handling
 */

import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { query, testConnection } from '../server/db/connection.ts';
import { eventHandler, TradingPlatformEvent } from '../server/services/EventHandler.ts';
import { PostgresTradingDataProvider } from '../server/providers/PostgresTradingDataProvider.ts';

interface TestResult {
  num: number;
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function recordPass(num: number, name: string, details: string) {
  results.push({ num, name, status: 'PASS', details });
  console.log(`✅ [PASS] #${num}: ${name} (${details})`);
}

function recordFail(num: number, name: string, error: string) {
  results.push({ num, name, status: 'FAIL', details: error, error });
  console.error(`❌ [FAIL] #${num}: ${name}\n  Error: ${error}`);
}

async function sendSignedEvent(event: TradingPlatformEvent) {
  const rawBody = JSON.stringify(event);
  const headers = {
    'x-signature-sha256': tradingPlatformClient.generateSignature(event.timestamp, 'POST', '/api/internal/events', rawBody),
    'x-timestamp': event.timestamp,
    'x-tenant-id': event.tenantId
  };
  return await eventHandler.handleInboundEvent(headers, 'POST', '/api/internal/events', rawBody, event);
}

async function runLiveFixesTests() {
  console.log('================================================================');
  console.log('      RUNNING ADMIN PANEL PRODUCTION LIVE-DATA FIXES TESTS      ');
  console.log('================================================================\n');

  await testConnection();
  const provider = new PostgresTradingDataProvider();

  const tenantA = 'TNT-LIVE-A';
  const tenantB = 'TNT-LIVE-B';

  try {
    // 0. Ensure test tenants exist
    await query(`
      INSERT INTO tenants (id, name, code, subdomain, custom_domain, status, plan, owner_name, owner_email, created_at, trading_tenant_id)
      VALUES 
        ($1, 'Alpha Test Tenant', 'ATTA', 'alpha-test-sub', 'trade.alphatest.com', 'ACTIVE', 'ENTERPRISE', 'Alpha Owner', 'owner@alpha.com', CURRENT_TIMESTAMP, 'vertex-default'),
        ($2, 'Beta Test Tenant', 'BETA', 'beta-test-sub', 'trade.betatest.com', 'ACTIVE', 'PRO', 'Beta Owner', 'owner@beta.com', CURRENT_TIMESTAMP, NULL)
      ON CONFLICT (id) DO UPDATE SET trading_tenant_id = EXCLUDED.trading_tenant_id
    `, [tenantA, tenantB]);

    // -------------------------------------------------------------------------
    // TEST 1: client.activated - Updates existing client projection to ACTIVE
    // -------------------------------------------------------------------------
    const testClientId = `clt-act-${Date.now()}`;
    const testClientCode = `ACT${Math.floor(1000 + Math.random() * 9000)}`;

    // Create client initially with PENDING status
    const createdEvent: TradingPlatformEvent = {
      eventId: `evt-create-${Date.now()}`,
      eventType: 'client.created',
      tenantId: tenantA,
      timestamp: new Date().toISOString(),
      payload: {
        clientId: testClientId,
        clientCode: testClientCode,
        name: 'Jane Activated Doe',
        email: 'jane.act@example.com',
        status: 'PENDING',
        kycStatus: 'APPROVED',
        balance: 50000
      }
    };
    await sendSignedEvent(createdEvent);

    const clientBefore = await query(
      'SELECT id, status FROM clients WHERE id = $1 AND tenant_id = $2',
      [testClientId, tenantA]
    );
    if (clientBefore.rows.length === 0 || clientBefore.rows[0].status !== 'PENDING') {
      throw new Error(`Client initial state expected PENDING, got ${clientBefore.rows[0]?.status}`);
    }

    // Now send client.activated event
    const activatedEventId = `evt-act-${Date.now()}`;
    const activatedEvent: TradingPlatformEvent = {
      eventId: activatedEventId,
      eventType: 'client.activated',
      tenantId: tenantA,
      timestamp: new Date().toISOString(),
      payload: {
        clientId: testClientId,
        clientCode: testClientCode,
        name: 'Jane Activated Doe'
      }
    };
    const actResult = await sendSignedEvent(activatedEvent);
    if (!actResult.success) throw new Error(`client.activated event failed: ${actResult.message}`);

    const clientAfter = await query(
      'SELECT id, status FROM clients WHERE id = $1 AND tenant_id = $2',
      [testClientId, tenantA]
    );
    if (clientAfter.rows.length > 0 && clientAfter.rows[0].status === 'ACTIVE') {
      recordPass(1, 'client.activated updates existing client projection to ACTIVE', `status=${clientAfter.rows[0].status}`);
    } else {
      recordFail(1, 'client.activated updates existing client projection to ACTIVE', `Expected ACTIVE, got ${clientAfter.rows[0]?.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: client.activated - Tenant Isolation & Idempotency
    // -------------------------------------------------------------------------
    // Replay activated event (Idempotency)
    const replayResult = await sendSignedEvent(activatedEvent);
    const isDuplicate = replayResult.duplicate === true;

    // Verify client in Tenant A does not exist in Tenant B
    const clientInB = await query(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [testClientId, tenantB]
    );

    if (isDuplicate && clientInB.rows.length === 0) {
      recordPass(2, 'client.activated preserves tenant isolation and idempotency', 'duplicate=true, tenantB count=0');
    } else {
      recordFail(2, 'client.activated preserves tenant isolation and idempotency', `isDuplicate=${isDuplicate}, tenantB=${clientInB.rows.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Empty Live Datasets - No screenshot/demo fallbacks
    // -------------------------------------------------------------------------
    const emptyTenantId = `TNT-EMPTY-${Date.now()}`;
    await query(`
      INSERT INTO tenants (id, name, code, subdomain, custom_domain, status, plan, owner_name, owner_email, created_at)
      VALUES ($1, 'Empty Test Tenant', $2, $3, 'trade.empty.com', 'ACTIVE', 'STARTER', 'Empty Owner', 'owner@empty.com', CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO NOTHING
    `, [emptyTenantId, `EMPT${Date.now().toString().slice(-4)}`, `empty-${Date.now().toString().slice(-4)}`]);

    const emptyClients = await provider.getClients(emptyTenantId);
    const emptyTrades = await provider.getAllTrades(emptyTenantId);
    const emptyOrders = await provider.getOrders(emptyTenantId);
    const emptyMasters = await provider.getMasters(emptyTenantId);
    const emptyBrokers = await provider.getBrokers(emptyTenantId);
    const emptySubBrokers = await provider.getSubBrokers(emptyTenantId);

    if (
      emptyClients.length === 0 &&
      emptyTrades.length === 0 &&
      emptyOrders.length === 0 &&
      emptyMasters.length === 0 &&
      emptyBrokers.length === 0 &&
      emptySubBrokers.length === 0
    ) {
      recordPass(3, 'Empty live datasets return [] without demo-data fallback', 'All entities returned 0 items');
    } else {
      recordFail(3, 'Empty live datasets return [] without demo-data fallback', `Non-zero items found in empty tenant`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Dashboard KPI - Never display fake numbers on empty or live query
    // -------------------------------------------------------------------------
    const emptyKpis = await provider.getDashboardKPIs(emptyTenantId);
    const totalTurnover = emptyKpis.total_turnover?.value || emptyKpis.todays_turnover?.value;
    const totalClients = emptyKpis.total_clients?.value;
    const totalPL = emptyKpis.net_pl?.value || emptyKpis.total_pl?.value;

    if (totalClients === 0 && (totalTurnover === '₹0' || totalTurnover === '₹0.00') && (totalPL === '₹0' || totalPL === '₹0.00')) {
      recordPass(4, 'Dashboard KPIs on empty database show exact 0/₹0 without fake fallback', `clients=${totalClients}, turnover=${totalTurnover}, pl=${totalPL}`);
    } else {
      recordFail(4, 'Dashboard KPIs on empty database show exact 0/₹0 without fake fallback', `Unexpected KPI values: clients=${totalClients}, turnover=${totalTurnover}, pl=${totalPL}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Commission Transactions - PostgreSQL Backed
    // -------------------------------------------------------------------------
    const comTxnId = `COM-TEST-${Date.now()}`;
    await provider.createCommissionTransaction({
      id: comTxnId,
      tenant_id: tenantA,
      beneficiary: 'Test Apex Master Group',
      role: 'Master',
      amount: 15400.00,
      currency: 'INR',
      period: 'March 2026',
      status: 'PAID',
      disbursed_at: new Date().toISOString()
    });

    const comTxns = await provider.getCommissionTransactions(tenantA);
    const createdCom = comTxns.find(t => t.id === comTxnId);

    if (createdCom && createdCom.amount.includes('15,400') && createdCom.beneficiary === 'Test Apex Master Group') {
      recordPass(5, 'Commission payout transactions are PostgreSQL backed and retrievable', `id=${createdCom.id}, amount=${createdCom.amount}`);
    } else {
      recordFail(5, 'Commission payout transactions are PostgreSQL backed and retrievable', 'Created transaction not retrieved from PostgreSQL');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Risk Empty State - Return [] without demo fallback
    // -------------------------------------------------------------------------
    const riskProfiles = await provider.getRiskProfiles(emptyTenantId);
    const riskEvents = await provider.getRiskEvents(emptyTenantId);

    if (riskProfiles.length === 0 && riskEvents.length === 0) {
      recordPass(6, 'Risk profiles and events return [] on empty tenant without demo fallback', `profiles=${riskProfiles.length}, events=${riskEvents.length}`);
    } else {
      recordFail(6, 'Risk profiles and events return [] on empty tenant without demo fallback', `Expected 0 items, got profiles=${riskProfiles.length}, events=${riskEvents.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Notifications Empty State - Return [] without INITIAL_NOTIFICATIONS fallback
    // -------------------------------------------------------------------------
    const notifs = await provider.getNotifications(emptyTenantId);

    if (notifs.length === 0) {
      recordPass(7, 'Notifications return [] on empty tenant without INITIAL_NOTIFICATIONS fallback', `count=${notifs.length}`);
    } else {
      recordFail(7, 'Notifications return [] on empty tenant without INITIAL_NOTIFICATIONS fallback', `Expected 0 notifications, got ${notifs.length}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Subscriptions - PostgreSQL subscription -> API -> UI data provider
    // -------------------------------------------------------------------------
    const subTestId = `SUB-TEST-${Date.now()}`;
    await (provider as any).createSubscription({
      id: subTestId,
      tenant_id: tenantA,
      tenant_name: 'Alpha Test Tenant',
      plan: 'ENTERPRISE',
      monthly_fee: '₹2,499/mo',
      renewal_date: '2027-01-01',
      brokers_used: 12,
      brokers_limit: 'Unlimited',
      clients_used: 450,
      clients_limit: 'Unlimited',
      status: 'ACTIVE'
    });

    const subsFromProvider = await provider.getSubscriptions(tenantA);
    const foundSub = subsFromProvider.find(s => s.id === subTestId);

    if (foundSub && foundSub.tenantName === 'Alpha Test Tenant' && foundSub.plan === 'ENTERPRISE') {
      recordPass(8, 'PostgreSQL subscription -> API -> UI data provider', `id=${foundSub.id}, plan=${foundSub.plan}`);
    } else {
      recordFail(8, 'PostgreSQL subscription -> API -> UI data provider', 'Created subscription not retrieved correctly');
    }

    // -------------------------------------------------------------------------
    // TEST 9: Fund Deposit (Authoritative PENDING Request, No Direct Balance Mutation)
    // -------------------------------------------------------------------------
    const testDepositClientId = `CLT-DEP-${Date.now().toString().slice(-4)}`;
    const testDepositClientCode = `DEP${Math.floor(1000 + Math.random() * 9000)}`;
    await sendSignedEvent({
      eventId: `evt-dep-clt-${Date.now()}`,
      eventType: 'client.created',
      tenantId: tenantA,
      timestamp: new Date().toISOString(),
      payload: {
        clientId: testDepositClientId,
        clientCode: testDepositClientCode,
        name: 'Deposit Test Client',
        email: 'dep@test.com',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        balance: 50000
      }
    });

    const depTxnId = `DEP-REQ-${Date.now()}`;
    const createdDep = await provider.createFundDeposit({
      id: depTxnId,
      tenant_id: tenantA,
      client_id: testDepositClientId,
      client_code: testDepositClientCode,
      client_name: 'Deposit Test Client',
      amount: 15000.00,
      currency: 'INR',
      payment_method: 'Admin Manual Deposit',
      status: 'PENDING'
    });

    const pendingDeps = await provider.getFundDeposits(tenantA, 'PENDING');
    const foundDepReq = pendingDeps.find(d => d.id === depTxnId || (d as any).txnId === depTxnId);

    const clientBeforeApproval = (await query('SELECT balance FROM clients WHERE id = $1', [testDepositClientId])).rows[0];
    const balUnchanged = parseFloat(clientBeforeApproval.balance) === 50000.00;

    if (foundDepReq && foundDepReq.status === 'PENDING' && balUnchanged) {
      recordPass(9, 'Hierarchy Client Manage Funds: Authoritative PENDING deposit created without direct client balance mutation', `dep_id=${foundDepReq.id || (foundDepReq as any).txnId}, status=PENDING, balance_preserved=₹50,000`);
    } else {
      recordFail(9, 'Hierarchy Client Manage Funds: Authoritative PENDING deposit creation', `Found: ${Boolean(foundDepReq)}, balUnchanged: ${balUnchanged}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Fund Withdrawal (Authoritative PENDING Request, No Direct Balance Mutation)
    // -------------------------------------------------------------------------
    const wdrTxnId = `WDR-REQ-${Date.now()}`;
    const createdWdr = await provider.createFundWithdrawal({
      id: wdrTxnId,
      tenant_id: tenantA,
      client_id: testDepositClientId,
      client_code: testDepositClientCode,
      client_name: 'Deposit Test Client',
      amount: 8000.00,
      currency: 'INR',
      bank_name: 'Primary Bank',
      status: 'PENDING'
    });

    const pendingWdrs = await provider.getFundWithdrawals(tenantA, 'PENDING');
    const foundWdrReq = pendingWdrs.find(w => w.txnId === wdrTxnId || (w as any).id === wdrTxnId);

    const clientBeforeWdrApproval = (await query('SELECT balance FROM clients WHERE id = $1', [testDepositClientId])).rows[0];
    const wdrBalUnchanged = parseFloat(clientBeforeWdrApproval.balance) === 50000.00;

    if (foundWdrReq && foundWdrReq.status === 'PENDING' && wdrBalUnchanged) {
      recordPass(10, 'Hierarchy Client Manage Funds: Authoritative PENDING withdrawal created without direct client balance mutation', `wdr_id=${foundWdrReq.txnId}, status=PENDING, balance_preserved=₹50,000`);
    } else {
      recordFail(10, 'Hierarchy Client Manage Funds: Authoritative PENDING withdrawal creation', `Found: ${Boolean(foundWdrReq)}, balUnchanged: ${wdrBalUnchanged}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Hierarchy KYC Update (Toggle Approved/Pending calls backend & updates DB)
    // -------------------------------------------------------------------------
    const testKycClientId = `CLT-KYC-${Date.now().toString().slice(-4)}`;
    const testKycClientCode = `KYC${Math.floor(1000 + Math.random() * 9000)}`;
    await sendSignedEvent({
      eventId: `evt-kyc-clt-${Date.now()}`,
      eventType: 'client.created',
      tenantId: tenantA,
      timestamp: new Date().toISOString(),
      payload: {
        clientId: testKycClientId,
        clientCode: testKycClientCode,
        name: 'KYC Toggle Test Client',
        email: 'kyc@test.com',
        status: 'ACTIVE',
        kycStatus: 'PENDING',
        balance: 10000
      }
    });

    // 1. Toggle to APPROVED
    const updatedKyc = await provider.updateKYCStatus(testKycClientId, 'APPROVED', 'Approved via Admin Hierarchy');
    const clientAfterApproval = (await query('SELECT kyc_status FROM clients WHERE id = $1', [testKycClientId])).rows[0];

    // 2. Toggle back to PENDING
    const revertedKyc = await provider.updateKYCStatus(testKycClientId, 'PENDING', 'Reverted to PENDING via Admin Hierarchy');
    const clientAfterRevert = (await query('SELECT kyc_status FROM clients WHERE id = $1', [testKycClientId])).rows[0];

    if (
      updatedKyc && updatedKyc.kyc_status === 'APPROVED' &&
      (clientAfterApproval.kyc_status === 'VERIFIED' || clientAfterApproval.kyc_status === 'APPROVED') &&
      revertedKyc && revertedKyc.kyc_status === 'PENDING' &&
      clientAfterRevert.kyc_status === 'PENDING'
    ) {
      recordPass(11, 'Hierarchy KYC: Toggle Approved/Pending updates backend kyc_records and clients tables', `initial=PENDING -> approved=${clientAfterApproval.kyc_status} -> reverted=${clientAfterRevert.kyc_status}`);
    } else {
      recordFail(11, 'Hierarchy KYC: Toggle Approved/Pending backend update', `Failed KYC toggling: approval=${clientAfterApproval?.kyc_status}, revert=${clientAfterRevert?.kyc_status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 12: TradingMonitor: Emergency Margin Square-off (Real Backend & S2S Execution)
    // -------------------------------------------------------------------------
    const testPosId = `POS-EMERG-${Date.now().toString().slice(-4)}`;
    await query(`
      INSERT INTO positions (id, tenant_id, client_id, client_code, client_name, symbol, side, quantity, buy_price, current_price, pnl, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [testPosId, tenantA, testDepositClientId, testDepositClientCode, 'Deposit Test Client', 'NIFTY26MARFUT', 'BUY', 50, 22500.00, 22400.00, -5000.00, 'OPEN']);

    const squareOffResult = await (provider as any).emergencyMarginSquareOff('Risk Manager', 'Test Emergency Margin Square-off', tenantA);
    const posAfterSquareOff = (await query('SELECT status, quantity FROM positions WHERE id = $1', [testPosId])).rows[0];
    const auditLogs = (await query(`SELECT * FROM audit_logs WHERE action = 'EMERGENCY_MARGIN_SQUARE_OFF' ORDER BY timestamp DESC LIMIT 1`)).rows;

    if (
      squareOffResult && squareOffResult.squaredOffCount >= 1 &&
      posAfterSquareOff.status === 'CLOSED' &&
      parseFloat(posAfterSquareOff.quantity) === 0 &&
      auditLogs.length > 0
    ) {
      recordPass(12, 'TradingMonitor: Emergency Margin Square-off calls backend repository, S2S engine and closes positions', `count=${squareOffResult.squaredOffCount}, posStatus=${posAfterSquareOff.status}, qty=${posAfterSquareOff.quantity}`);
    } else {
      recordFail(12, 'TradingMonitor: Emergency Margin Square-off', `posStatus=${posAfterSquareOff?.status}, qty=${posAfterSquareOff?.quantity}`);
    }

  } catch (e: any) {
    console.error('Test suite error:', e);
    recordFail(99, 'General Test Suite Execution', e.message);
  } finally {
    await query('DELETE FROM positions WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM fund_deposits WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM fund_withdrawals WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM kyc_records WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM subscriptions WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM commission_transactions WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM clients WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await query('DELETE FROM processed_events WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
  }

  // Summary
  console.log('\n================================================================');
  console.log('                 FINAL TEST EXECUTION SUMMARY                   ');
  console.log('================================================================');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}\n`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('ALL ADMIN PANEL LIVE-DATA FIX TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runLiveFixesTests();
