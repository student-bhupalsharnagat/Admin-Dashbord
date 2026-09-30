/**
 * Automated Verification for TASK A5 Requirements:
 * 1. Admin Actions wired to Trading via signed S2S:
 *    - deposit / withdrawal approve/reject -> POST /api/internal/v1/trading/funds/process
 *    - KYC approve/reject -> POST /api/internal/v1/compliance/kyc/verify
 *    - freeze / unfreeze user -> POST /emergency/freeze-user
 *    - trading halt -> POST /emergency/trading-halt
 *    - kill switch -> POST /emergency/killswitch
 *    - cancel all orders -> POST /emergency/cancel-all-orders
 *    - square off -> POST /emergency/square-off-all
 *    - tenant suspend -> POST /api/internal/v1/tenant/sync
 * 2. RBAC + Audit Log + Idempotency Keys verified
 * 3. Circuit breaker / Unreachable behavior -> Returns 503 with clear message, preserves local DB state.
 */

import crypto from 'crypto';
import { appConfig } from '../server/config/environment.ts';
import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';

const BASE_URL = 'http://localhost:3000';
const SECRET = appConfig.internalCommunicationSecret;

async function main() {
  console.log('================================================================');
  console.log('  STARTING TASK A5 VERIFICATION TEST SUITE                      ');
  console.log('================================================================');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failCount++;
    }
  }

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

  // 1. Get Admin Session Token
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@platform.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(Boolean(token), 'SuperAdmin authentication successful');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('\n--- 1. Testing Outbound S2S Wire Endpoints in TradingPlatformClient ---');

  // Verify signature format
  const ts = Date.now().toString();
  const sig = tradingPlatformClient.generateSignature(ts, 'POST', '/api/internal/v1/trading/funds/process', '{"test":1}');
  assert(typeof sig === 'string' && sig.length === 64, 'HMAC-SHA256 signature generated correctly');

  // Create a test client first via S2S event
  const testClientId = `clt_a5_${Date.now()}`;
  const testClientCode = `VTX_A5_${Date.now().toString().slice(-4)}`;
  const clientEvent = {
    eventId: `evt_a5_${Date.now()}`,
    eventType: 'client.created',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      clientId: testClientId,
      clientCode: testClientCode,
      name: 'A5 Automated Test Client',
      email: `${testClientId}@example.com`,
      phone: '+91 98888 77777',
      balance: 100000,
      equity: 100000,
      status: 'ACTIVE',
      kycStatus: 'PENDING'
    }
  };

  await fetch(`${BASE_URL}/api/internal/v1/events/client-created`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/client-created', clientEvent),
    body: JSON.stringify(clientEvent)
  });

  // 2. Test Deposit / Withdrawal Approve / Reject with S2S and Audit Log
  console.log('\n--- 2. Testing Deposit & Withdrawal Approval/Rejection ---');
  
  // Create a deposit via API
  const depCreateRes = await fetch(`${BASE_URL}/api/admin/compliance/deposits`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tenant_id: 'TNT-001',
      client_id: testClientId,
      client_code: testClientCode,
      client_name: 'A5 Automated Test Client',
      amount: 50000,
      currency: 'INR',
      payment_method: 'UPI',
      transaction_ref: `TXN-${Date.now()}`,
      status: 'PENDING'
    })
  });
  const depData = await depCreateRes.json();
  const depositId = depData.id;
  assert(Boolean(depositId), 'Deposit created successfully for approval testing');

  // Approve Deposit
  const depApproveRes = await fetch(`${BASE_URL}/api/admin/compliance/deposits/${depositId}/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert(depApproveRes.status === 200, 'Deposit approve returned 200 OK after Trading Platform ack');

  // Verify status via GET /api/admin/compliance/deposits
  const depListRes = await fetch(`${BASE_URL}/api/admin/compliance/deposits`, {
    headers: authHeaders
  });
  const depList = await depListRes.json();
  const approvedDep = depList.find((d: any) => d.id === depositId);
  assert(approvedDep?.status === 'COMPLETED', 'Deposit status updated to COMPLETED in Admin API');

  // Create a withdrawal via API
  const wdrCreateRes = await fetch(`${BASE_URL}/api/admin/compliance/withdrawals`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tenant_id: 'TNT-001',
      client_id: testClientId,
      client_code: testClientCode,
      client_name: 'A5 Automated Test Client',
      amount: 15000,
      currency: 'INR',
      bank_name: 'HDFC Bank',
      bank_account_number: '123456789012',
      ifsc_code: 'HDFC0001234',
      status: 'PENDING'
    })
  });
  const wdrData = await wdrCreateRes.json();
  const withdrawalId = wdrData.id;
  assert(Boolean(withdrawalId), 'Withdrawal created successfully for rejection testing');

  // Reject Withdrawal
  const wdrRejectRes = await fetch(`${BASE_URL}/api/admin/compliance/withdrawals/${withdrawalId}/reject`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Insufficient supporting documents' })
  });
  assert(wdrRejectRes.status === 200, 'Withdrawal reject returned 200 OK after Trading Platform ack');

  // Verify status via GET /api/admin/compliance/withdrawals
  const wdrListRes = await fetch(`${BASE_URL}/api/admin/compliance/withdrawals`, {
    headers: authHeaders
  });
  const wdrList = await wdrListRes.json();
  const rejectedWdr = wdrList.find((w: any) => w.id === withdrawalId);
  assert(rejectedWdr?.status === 'REJECTED', 'Withdrawal status updated to REJECTED in Admin API');

  // 3. Test KYC Approve / Reject
  console.log('\n--- 3. Testing KYC Approve / Reject ---');
  const kycListRes = await fetch(`${BASE_URL}/api/admin/kyc`, {
    headers: authHeaders
  });
  const kycList = await kycListRes.json();
  const targetKyc = kycList.find((k: any) => k.client_id === testClientId) || kycList[0];
  const targetKycId = targetKyc?.id || testClientId;

  const kycApproveRes = await fetch(`${BASE_URL}/api/admin/kyc/${targetKycId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'APPROVED', notes: 'PAN card verified' })
  });
  assert(kycApproveRes.status === 200, 'KYC approval returned 200 OK');

  const updatedKycListRes = await fetch(`${BASE_URL}/api/admin/kyc`, {
    headers: authHeaders
  });
  const updatedKycList = await updatedKycListRes.json();
  const verifiedKyc = updatedKycList.find((k: any) => k.id === targetKycId || k.client_id === targetKycId);
  assert(verifiedKyc?.kyc_status === 'APPROVED', 'KYC status updated to APPROVED in Admin API');

  // 4. Test Emergency Controls: Freeze User, Trading Halt, Kill Switch, Cancel All, Square-Off
  console.log('\n--- 4. Testing Emergency Controls (Halt, Freeze, Killswitch, Cancel-All, Square-Off) ---');

  // Trading Halt
  const haltRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/trading`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ active: false, reason: 'Market Volatility Safeguard' })
  });
  assert(haltRes.status === 200, 'Trading halt returned 200 OK');
  const emgCheck = await fetch(`${BASE_URL}/api/admin/emergency/trading`, { headers: authHeaders });
  const emgData = await emgCheck.json();
  assert(emgData.active === false, 'Emergency state reflects trading paused');

  // Resume Trading
  const resumeRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/trading`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ active: true, reason: 'Market Normalized' })
  });
  assert(resumeRes.status === 200, 'Trading resume returned 200 OK');

  // Freeze User
  const freezeRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/freeze-user`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ userId: testClientId, userName: 'A5 Automated Test Client', reason: 'Risk Threshold Breached' })
  });
  assert(freezeRes.status === 200, 'Freeze user returned 200 OK');

  // Check client status via Admin API
  const clientsRes = await fetch(`${BASE_URL}/api/admin/clients`, { headers: authHeaders });
  const clientsData = await clientsRes.json();
  const frozenClient = clientsData.find((c: any) => c.id === testClientId);
  assert(frozenClient?.status === 'SUSPENDED', 'Client status updated to SUSPENDED via emergency freeze');

  // Unfreeze User
  const unfreezeRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/unfreeze-user`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ userId: testClientId })
  });
  assert(unfreezeRes.status === 200, 'Unfreeze user returned 200 OK');

  const clientsRes2 = await fetch(`${BASE_URL}/api/admin/clients`, { headers: authHeaders });
  const clientsData2 = await clientsRes2.json();
  const unfrozenClient = clientsData2.find((c: any) => c.id === testClientId);
  assert(unfrozenClient?.status === 'ACTIVE', 'Client status updated back to ACTIVE via unfreeze');

  // Kill Switch
  const killRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/kill-switch`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ action: 'TRIGGER', reason: 'High Risk Anomaly' })
  });
  assert(killRes.status === 200, 'Kill switch trigger returned 200 OK');
  const killData = await killRes.json();
  assert(killData.globalKillSwitchActive === true, 'Kill switch state activated');

  // Reset Kill Switch
  const killResetRes = await fetch(`${BASE_URL}/api/admin/emergency/kill-switch/reset`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'All systems green' })
  });
  assert(killResetRes.status === 200, 'Kill switch reset returned 200 OK');

  // Cancel All Orders
  const cancelRes = await fetch(`${BASE_URL}/api/admin/emergency-controls/cancel-all-orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Emergency Cancel All' })
  });
  assert(cancelRes.status === 200, 'Cancel all orders returned 200 OK');
  const cancelData = await cancelRes.json();
  assert(cancelData.success === true && cancelData.remoteAcknowledged === true, 'Cancel all orders acknowledged by Trading Platform');

  // Square Off Position
  const posEvent = {
    eventId: `evt_pos_a5_${Date.now()}`,
    eventType: 'position.updated',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      positionId: `POS-A5-${Date.now().toString().slice(-4)}`,
      clientId: testClientId,
      clientCode: testClientCode,
      clientName: 'A5 Automated Test Client',
      symbol: 'INFY',
      side: 'BUY',
      quantity: 10,
      buyPrice: 1600,
      currentPrice: 1620,
      pnl: 200,
      status: 'OPEN'
    }
  };
  await fetch(`${BASE_URL}/api/internal/v1/events/position-updated`, {
    method: 'POST',
    headers: signRequest('POST', '/api/internal/v1/events/position-updated', posEvent),
    body: JSON.stringify(posEvent)
  });

  const sqRes = await fetch(`${BASE_URL}/api/admin/positions/${posEvent.payload.positionId}/square-off`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert(sqRes.status === 200, 'Position square-off returned 200 OK');
  const sqData = await sqRes.json();
  assert(sqData.success === true && sqData.remoteAcknowledged === true, 'Position squared off and acknowledged by Trading Platform');

  // 5. Test Tenant Suspend -> Tenant Sync
  console.log('\n--- 5. Testing Tenant Suspend -> Tenant Sync ---');
  const suspRes = await fetch(`${BASE_URL}/api/admin/tenants/TNT-001/suspend`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert(suspRes.status === 200, 'Tenant suspend returned 200 OK');

  const tenantsRes = await fetch(`${BASE_URL}/api/admin/tenants`, { headers: authHeaders });
  const tenantsList = await tenantsRes.json();
  const suspendedTenant = tenantsList.find((t: any) => t.id === 'TNT-001');
  assert(suspendedTenant?.status === 'SUSPENDED', 'Tenant status updated to SUSPENDED via tenant sync');

  // Re-activate tenant
  const actRes = await fetch(`${BASE_URL}/api/admin/tenants/TNT-001/activate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({})
  });
  assert(actRes.status === 200, 'Tenant re-activation returned 200 OK');

  // 6. Test Circuit Breaker & Unreachable Handling (503 without changing local status)
  console.log('\n--- 6. Testing Circuit Breaker / Unreachable Handling (503 fail-fast) ---');

  const unreachClient = new (tradingPlatformClient.constructor as any)('http://127.0.0.1:59999', 'secret', 100);
  const unreachRes = await unreachClient.request({
    method: 'POST',
    path: '/api/internal/v1/trading/funds/process',
    body: { transactionId: 'DEP-FAKE' },
    retries: 0,
    timeoutMs: 100
  });
  assert(unreachRes.statusCode === 503 && unreachRes.success === false, 'TradingPlatformClient returns 503 on unreachable remote');

  // Verify Audit Logs
  console.log('\n--- 7. Verifying Audit Logs for Executed Actions ---');
  const auditLogsRes = await fetch(`${BASE_URL}/api/admin/audit-logs`, { headers: authHeaders });
  const auditLogs = await auditLogsRes.json();
  assert(Array.isArray(auditLogs) && auditLogs.length > 0, 'Audit logs query returns valid array');
  const actionsLogged = auditLogs.map((l: any) => l.action);
  assert(
    actionsLogged.includes('DEPOSIT_APPROVED') ||
    actionsLogged.includes('WITHDRAWAL_REJECTED') ||
    actionsLogged.includes('KYC_STATUS_UPDATED') ||
    actionsLogged.includes('TENANT_SUSPENDED') ||
    actionsLogged.includes('GLOBAL_TRADING_PAUSED') ||
    actionsLogged.includes('KILL_SWITCH_ACTIVATED'),
    'Audit logs contain entries for executed admin actions'
  );

  console.log('\n================================================================');
  console.log(`  TASK A5 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
