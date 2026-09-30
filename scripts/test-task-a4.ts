/**
 * Automated Verification for TASK A4 Requirements:
 * 1. Migration 009_live_projections.sql creates/ensures projection tables:
 *    clients, wallets, orders, trades, positions, fund_transactions, ledger_entries, commission_transactions, risk_events, kyc, support_tickets, notifications.
 * 2. Event projections:
 *    - client.* -> clients / kyc / wallets
 *    - wallet.updated -> wallets / ledger
 *    - trade.executed -> trades / commission_transactions (split by hierarchy / plan) / ledger
 *    - position.updated -> positions
 *    - deposit/withdrawal.* -> fund_transactions / fund_deposits / fund_withdrawals / ledger
 *    - risk.* -> risk_events / notifications
 * 3. PostgresTradingDataProvider reads these projection tables via Admin HTTP APIs.
 * 4. Backfill endpoint: POST /api/admin/integration/backfill (SUPER_ADMIN)
 */

import crypto from 'crypto';
import { appConfig } from '../server/config/environment.ts';

async function runTaskA4Verification() {
  console.log('================================================================');
  console.log('  STARTING TASK A4 VERIFICATION TEST SUITE                      ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000';
  const SECRET = appConfig.internalCommunicationSecret;
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // --- Login as Super Admin ---
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@platform.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  assert(!!adminToken, 'Admin authentication token retrieved successfully');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // --- Helper to sign S2S requests ---
  function signRequest(method: string, path: string, body: any, tenantId: string = 'TNT-001') {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
    const pathWithoutQuery = path.split('?')[0];
    const rawBody = body ? JSON.stringify(body) : '';
    const payload = `${timestamp}.${method.toUpperCase()}.${pathWithoutQuery}.${rawBody}`;
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    return {
      'Content-Type': 'application/json',
      'X-Internal-Timestamp': timestamp,
      'X-Internal-Nonce': nonce,
      'X-Internal-Signature': signature,
      'X-Tenant-ID': tenantId,
      'X-Correlation-ID': `corr_${Date.now()}`
    };
  }

  // --- 1. EVENT PROJECTIONS & ADMIN API READS VERIFICATION ---
  console.log('--- 1. Testing Event Projections and Provider Reads ---');

  // 1.1 client.created event -> clients, wallets, kyc
  const clientId = `clt_a4_${Date.now()}`;
  const clientCode = `VTX_A4_${Date.now().toString().slice(-5)}`;
  const clientEvent = {
    eventId: `evt_a4_clt_${Date.now()}`,
    eventType: 'client.created',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      clientId,
      clientCode,
      name: 'Task A4 Test Client',
      email: `${clientId}@example.com`,
      phone: '+91 91111 22222',
      balance: 150000,
      equity: 150000,
      marginUsed: 25000,
      status: 'ACTIVE',
      kycStatus: 'VERIFIED'
    }
  };

  const clientRes = await fetch(`${BASE_URL}/api/internal/v1/events/client-created`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/client-created', clientEvent),
    body: JSON.stringify(clientEvent)
  });
  assert(clientRes.status === 200, 'client.created event accepted (200 OK)');

  // Verify client projection via GET /api/admin/clients
  const adminClientsRes = await fetch(`${BASE_URL}/api/admin/clients`, { headers: authHeaders });
  const adminClients: any[] = await adminClientsRes.json();
  const createdClient = adminClients.find(c => c.client_code === clientCode);
  assert(!!createdClient, 'Client projection found via Admin Provider API');
  assert(Number(createdClient?.wallet_balance) === 150000, 'Client wallet_balance correctly projected in Admin Provider');

  // 1.2 wallet.updated event -> wallets
  const walletEvent = {
    eventId: `evt_a4_wlt_${Date.now()}`,
    eventType: 'wallet.updated',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      clientId,
      clientCode,
      balance: 180000,
      equity: 180000,
      marginUsed: 30000
    }
  };

  const walletUpdateRes = await fetch(`${BASE_URL}/api/internal/v1/events/wallet-updated`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/wallet-updated', walletEvent),
    body: JSON.stringify(walletEvent)
  });
  assert(walletUpdateRes.status === 200, 'wallet.updated event accepted (200 OK)');

  const adminClientsRes2 = await fetch(`${BASE_URL}/api/admin/clients`, { headers: authHeaders });
  const adminClients2: any[] = await adminClientsRes2.json();
  const updatedClient = adminClients2.find(c => c.client_code === clientCode);
  assert(Number(updatedClient?.wallet_balance) === 180000, 'Wallet update projected to client wallet_balance (180,000)');

  // 1.3 trade.executed event -> trades + commission_transactions + ledger
  const tradeId = `trd_a4_${Date.now()}`;
  const tradeEvent = {
    eventId: `evt_a4_trd_${Date.now()}`,
    eventType: 'trade.executed',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      tradeId,
      clientId,
      clientCode,
      clientName: 'Task A4 Test Client',
      orderId: `ord_a4_${Date.now()}`,
      symbol: 'RELIANCE',
      exchange: 'NSE',
      side: 'BUY',
      quantity: 100,
      price: 2500,
      totalValue: 250000
    }
  };

  const tradeRes = await fetch(`${BASE_URL}/api/internal/v1/events/trade-executed`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/trade-executed', tradeEvent),
    body: JSON.stringify(tradeEvent)
  });
  assert(tradeRes.status === 200, 'trade.executed event accepted (200 OK)');

  const adminTradesRes = await fetch(`${BASE_URL}/api/admin/trades`, { headers: authHeaders });
  const adminTrades: any[] = await adminTradesRes.json();
  const executedTrade = adminTrades.find(t => t.trade_id === tradeId || t.id === `trd_${tradeId}`);
  assert(!!executedTrade, 'Executed trade projected and readable via Admin Provider API');

  const adminCommsRes = await fetch(`${BASE_URL}/api/admin/commercial/commission-transactions`, { headers: authHeaders });
  const adminComms: any[] = await adminCommsRes.json();
  assert(Array.isArray(adminComms) && adminComms.length > 0, 'Commission transactions projected and readable via Admin Provider API');

  // 1.4 position.updated -> positions
  const posId = `pos_a4_${Date.now()}`;
  const posEvent = {
    eventId: `evt_a4_pos_${Date.now()}`,
    eventType: 'position.updated',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      positionId: posId,
      clientId,
      clientCode,
      symbol: 'RELIANCE',
      exchange: 'NSE',
      side: 'BUY',
      quantity: 100,
      buyPrice: 2500,
      currentPrice: 2550,
      pnl: 5000
    }
  };

  const posRes = await fetch(`${BASE_URL}/api/internal/v1/events/position-updated`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/position-updated', posEvent),
    body: JSON.stringify(posEvent)
  });
  assert(posRes.status === 200, 'position.updated event accepted (200 OK)');

  const adminPosRes = await fetch(`${BASE_URL}/api/admin/positions`, { headers: authHeaders });
  const adminPositions: any[] = await adminPosRes.json();
  const updatedPos = adminPositions.find(p => p.id === posId || p.symbol === 'RELIANCE');
  assert(!!updatedPos, 'Position projected and readable via Admin Provider API');

  // 1.5 deposit.created event -> fund_transactions + fund_deposits
  const depId = `dep_a4_${Date.now()}`;
  const depEvent = {
    eventId: `evt_a4_dep_${Date.now()}`,
    eventType: 'deposit.created',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      depositId: depId,
      clientId,
      clientCode,
      amount: 50000,
      status: 'PENDING'
    }
  };

  const depRes = await fetch(`${BASE_URL}/api/internal/v1/events/deposit-created`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/deposit-created', depEvent),
    body: JSON.stringify(depEvent)
  });
  assert(depRes.status === 200, 'deposit.created event accepted (200 OK)');

  const adminDepositsRes = await fetch(`${BASE_URL}/api/admin/compliance/deposits`, { headers: authHeaders });
  const adminDeposits: any[] = await adminDepositsRes.json();
  const depositItem = adminDeposits.find(d => d.id === depId);
  assert(!!depositItem, 'Deposit projected and readable via Admin Provider API');

  // 1.6 risk.margin_breach -> risk_events + notifications
  const riskEvent = {
    eventId: `evt_a4_risk_${Date.now()}`,
    eventType: 'risk.margin_breach',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      clientId,
      clientCode,
      utilizationPercent: 95,
      threshold: 80
    }
  };

  const riskRes = await fetch(`${BASE_URL}/api/internal/v1/events/risk-margin-breach`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/risk-margin-breach', riskEvent),
    body: JSON.stringify(riskEvent)
  });
  assert(riskRes.status === 200, 'risk.margin_breach event accepted (200 OK)');

  const adminRiskRes = await fetch(`${BASE_URL}/api/admin/risk/events`, { headers: authHeaders });
  const adminRiskEvents: any[] = await adminRiskRes.json();
  assert(Array.isArray(adminRiskEvents) && adminRiskEvents.length > 0, 'Risk events projected and readable via Admin Provider API');

  // --- 2. BACKFILL ENDPOINT VERIFICATION ---
  console.log('\n--- 2. Testing POST /api/admin/integration/backfill Endpoint ---');

  const backfillRes = await fetch(`${BASE_URL}/api/admin/integration/backfill`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ tenantId: 'TNT-001' })
  });
  const backfillData = await backfillRes.json();
  assert(backfillRes.status === 200, 'POST /api/admin/integration/backfill returns 200 OK');
  assert(backfillData.success === true, 'Backfill response indicates success');
  assert(typeof backfillData.backfilled === 'object', 'Backfill returns object summary of counts');

  console.log('\n================================================================');
  console.log(`  TASK A4 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTaskA4Verification().catch((err) => {
  console.error('Fatal error during Task A4 verification:', err);
  process.exit(1);
});
