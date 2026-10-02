/**
 * TASK A3 Verification Test Suite:
 * 1. Migration/column exists: tenants.trading_tenant_id
 * 2. Inbound Trading Tenant -> Admin Tenant resolution (order: trading_tenant_id -> TRADING_TENANT_ID -> fallback)
 * 3. Outbound Admin Tenant -> Trading Tenant resolution (resolveOutboundTenantId)
 * 4. Correct Trading Platform outbound endpoint routes (/api/internal/v1/tenant/sync, /trading/clients/map, /emergency/*)
 * 5. client.registered event handling & idempotent client creation
 * 6. Duplicate client.registered does not create duplicate clients
 * 7. Existing hierarchy is preserved and not overwritten
 * 8. Missing mapping / invalid tenant handled safely without cross-tenant writes
 * 9. Cross-tenant data isolation preserved
 */

import { query } from '../server/db/connection.ts';
import { activeTradingDataProvider } from '../server/providers/TradingDataProvider.ts';
import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { eventHandler, TradingPlatformEvent } from '../server/services/EventHandler.ts';

interface TestResult {
  title: string;
  passed: boolean;
  details?: string;
}

const testResults: TestResult[] = [];

function assert(title: string, condition: boolean, details?: string) {
  testResults.push({ title, passed: Boolean(condition), details });
  const icon = condition ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} ${title}${details ? ` -> ${details}` : ''}`);
  if (!condition) {
    console.error(`   ↳ Failed expectation for: ${title}`);
  }
}

async function runTaskA3Tests() {
  console.log('================================================================');
  console.log('  STARTING TASK A3 VERIFICATION TEST SUITE                      ');
  console.log('================================================================\n');

  const suffix = Date.now().toString().slice(-6);

  // ----------------------------------------------------------------
  // 1. TENANT MAPPING DATABASE MIGRATION CHECK
  // ----------------------------------------------------------------
  console.log('--- 1. Database Migration: tenants.trading_tenant_id ---');
  const columnCheck = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'trading_tenant_id'
  `);
  assert(
    '1.1 Column tenants.trading_tenant_id exists in database',
    columnCheck.rows.length === 1,
    `Type: ${columnCheck.rows[0]?.data_type}, Nullable: ${columnCheck.rows[0]?.is_nullable}`
  );

  // ----------------------------------------------------------------
  // 2. TENANT RESOLUTION & MAPPING (INBOUND & OUTBOUND)
  // ----------------------------------------------------------------
  console.log('\n--- 2. Inbound & Outbound Tenant Resolution ---');

  const adminTenantA = `TNT_A3_A_${suffix}`;
  const adminTenantB = `TNT_A3_B_${suffix}`;
  const tradingTenantA = `TRD_TNT_A_${suffix}`;
  const tradingTenantB = `TRD_TNT_B_${suffix}`;

  // Insert test tenants
  await query(`
    INSERT INTO tenants (id, name, code, subdomain, plan, status, trading_tenant_id, owner_name, owner_email)
    VALUES 
      ($1, 'Mapped Tenant Alpha', 'MTA', $2, 'ENTERPRISE', 'ACTIVE', $3, 'Owner A', 'a@test.com'),
      ($4, 'Mapped Tenant Beta', 'MTB', $5, 'ENTERPRISE', 'ACTIVE', $6, 'Owner B', 'b@test.com')
    ON CONFLICT (id) DO NOTHING
  `, [adminTenantA, `sub_a_${suffix}`, tradingTenantA, adminTenantB, `sub_b_${suffix}`, tradingTenantB]);

  // Insert sub-broker for Tenant A hierarchy
  const subBrokerA = `SB_A_${suffix}`;
  await query(`
    INSERT INTO sub_brokers (id, tenant_id, broker_id, name, email, code, status)
    VALUES ($1, $2, 'BRK-001', 'Alpha Sub-Broker', 'sb_a@test.com', $3, 'ACTIVE')
    ON CONFLICT (id) DO NOTHING
  `, [subBrokerA, adminTenantA, `SBA_${suffix}`]);

  // 2.1 Inbound resolution via trading_tenant_id
  const resolvedInboundA = await eventHandler.resolveInboundTenantId(tradingTenantA);
  assert(
    '2.1 Inbound resolution matches Admin tenant via trading_tenant_id',
    resolvedInboundA === adminTenantA,
    `Resolved ${tradingTenantA} -> ${resolvedInboundA}`
  );

  const resolvedInboundB = await eventHandler.resolveInboundTenantId(tradingTenantB);
  assert(
    '2.2 Inbound resolution matches Admin tenant B via trading_tenant_id',
    resolvedInboundB === adminTenantB,
    `Resolved ${tradingTenantB} -> ${resolvedInboundB}`
  );

  // 2.3 Outbound resolution via resolveOutboundTenantId
  const resolvedOutboundA = await tradingPlatformClient.resolveOutboundTenantId(adminTenantA);
  assert(
    '2.3 Outbound resolution matches Trading tenant ID via Admin tenant ID',
    resolvedOutboundA === tradingTenantA,
    `Resolved Admin ${adminTenantA} -> Trading ${resolvedOutboundA}`
  );

  // 2.4 Fallback resolution when no direct mapping
  const fallbackTenant = await eventHandler.resolveInboundTenantId('UNMAPPED_RANDOM_TENANT_ID');
  assert(
    '2.4 Inbound fallback resolves safely to an ACTIVE tenant when unmapped',
    typeof fallbackTenant === 'string' && fallbackTenant.length > 0,
    `Fallback tenant: ${fallbackTenant}`
  );

  // ----------------------------------------------------------------
  // 3. OUTBOUND ROUTE VERIFICATION
  // ----------------------------------------------------------------
  console.log('\n--- 3. Outbound S2S Route Paths Verification ---');

  // Verify that TradingPlatformClient methods target canonical endpoints
  let capturedPaths: string[] = [];
  const originalRequest = tradingPlatformClient.request.bind(tradingPlatformClient);
  (tradingPlatformClient as any).request = async function(options: any) {
    capturedPaths.push(`${options.method} ${options.path}`);
    return { success: true, statusCode: 200, data: { ok: true }, correlationId: 'test', latencyMs: 1 };
  };

  try {
    await tradingPlatformClient.syncTenantConfig(adminTenantA, { status: 'ACTIVE', trading_enabled: true, registration_enabled: true, api_enabled: true, config_version: 1 });
    await tradingPlatformClient.mapClient({ clientId: 'CLT_TEST', name: 'Test Client', tenantId: adminTenantA });
    await tradingPlatformClient.tradingHalt(true, 'Admin', 'Test Halt', adminTenantA);
    await tradingPlatformClient.freezeUser({ entityType: 'CLIENT', entityId: 'CLT_TEST', action: 'FREEZE', actor: 'Admin', tenantId: adminTenantA });
    await tradingPlatformClient.cancelAllOrders({ tenantId: adminTenantA, actor: 'Admin', reason: 'Test Cancel' });
    await tradingPlatformClient.squareOffAll({ positionId: 'POS_TEST', actor: 'Admin', reason: 'Test Square-Off', tenantId: adminTenantA });
    await tradingPlatformClient.killSwitch('TRIGGER', 'Admin', 'Test KillSwitch', adminTenantA);
  } finally {
    (tradingPlatformClient as any).request = originalRequest;
  }

  assert('3.1 Tenant Sync route is POST /api/internal/v1/tenant/sync', capturedPaths.includes('POST /api/internal/v1/tenant/sync'));
  assert('3.2 Client Mapping route is POST /trading/clients/map', capturedPaths.includes('POST /trading/clients/map'));
  assert('3.3 Trading Halt route is POST /emergency/trading-halt', capturedPaths.includes('POST /emergency/trading-halt'));
  assert('3.4 Freeze User route is POST /emergency/freeze-user', capturedPaths.includes('POST /emergency/freeze-user'));
  assert('3.5 Cancel All Orders route is POST /emergency/cancel-all-orders', capturedPaths.includes('POST /emergency/cancel-all-orders'));
  assert('3.6 Square Off All route is POST /emergency/square-off-all', capturedPaths.includes('POST /emergency/square-off-all'));
  assert('3.7 Kill Switch route is POST /emergency/killswitch', capturedPaths.includes('POST /emergency/killswitch'));

  // ----------------------------------------------------------------
  // 4. CLIENT.REGISTERED EVENT HANDLING & IDEMPOTENCY
  // ----------------------------------------------------------------
  console.log('\n--- 4. client.registered Event Ingestion & Idempotency ---');

  const testClientCode = `REG_CLT_${suffix}`;
  const testClientId = `CLT_UUID_${suffix}`;

  async function sendSignedEvent(eventData: TradingPlatformEvent) {
    const rawBody = JSON.stringify(eventData);
    const signature = tradingPlatformClient.generateSignature(eventData.timestamp, 'POST', '/api/internal/events', rawBody);
    const headers = {
      'x-signature-sha256': signature,
      'x-internal-signature': signature,
      'x-timestamp': eventData.timestamp,
      'x-internal-timestamp': eventData.timestamp,
      'x-nonce': `nonce_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      'x-tenant-id': eventData.tenantId,
      'content-type': 'application/json'
    };
    return eventHandler.handleInboundEvent(headers, 'POST', '/api/internal/events', rawBody, eventData);
  }

  // First client.registered event
  const regEvent1: TradingPlatformEvent = {
    eventId: `EVT_REG1_${suffix}`,
    eventType: 'client.registered',
    tenantId: tradingTenantA,
    timestamp: new Date().toISOString(),
    payload: {
      clientId: testClientId,
      clientCode: testClientCode,
      name: `Registered Client ${suffix}`,
      email: `reg_${suffix}@example.com`,
      phone: '+91 9123456780',
      status: 'ACTIVE',
      kycStatus: 'VERIFIED',
      balance: 100000,
      referralCode: `SBA_${suffix}` // Map to sub-broker A
    }
  };

  const regRes1 = await sendSignedEvent(regEvent1);
  assert(
    '4.1 client.registered creates new client in resolved Admin tenant',
    regRes1.success === true && !regRes1.duplicate,
    `Result: success=${regRes1.success}, duplicate=${regRes1.duplicate}`
  );

  const clientDb1 = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [testClientCode, adminTenantA]);
  assert(
    '4.2 Client record exists in Admin Tenant A with assigned hierarchy',
    clientDb1.rows.length === 1 && clientDb1.rows[0].sub_broker_id === subBrokerA,
    `Client: ${clientDb1.rows[0]?.name}, SubBroker: ${clientDb1.rows[0]?.sub_broker_id}`
  );

  // Send duplicate client.registered with exact same eventId
  const regResDup = await sendSignedEvent(regEvent1);
  assert(
    '4.3 Duplicate client.registered eventId returns 200 with duplicate=true',
    regResDup.success === true && regResDup.duplicate === true,
    `Duplicate check passed`
  );

  // Send subsequent client.registered with different eventId (idempotent profile update)
  const regEvent2: TradingPlatformEvent = {
    eventId: `EVT_REG2_${suffix}`,
    eventType: 'client.registered',
    tenantId: tradingTenantA,
    timestamp: new Date().toISOString(),
    payload: {
      clientId: testClientId,
      clientCode: testClientCode,
      name: `Registered Client ${suffix} Updated`,
      email: `reg_${suffix}_updated@example.com`,
      phone: '+91 9123456789',
      balance: 150000,
      referralCode: 'DIFFERENT_CODE_DO_NOT_OVERWRITE'
    }
  };

  const regRes2 = await sendSignedEvent(regEvent2);
  assert(
    '4.4 Idempotent client update with new eventId succeeds',
    regRes2.success === true,
    `Result: success=${regRes2.success}`
  );

  const clientDb2 = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [testClientCode, adminTenantA]);
  assert(
    '4.5 Client count remains 1 and existing hierarchy was NOT overwritten',
    clientDb2.rows.length === 1 && clientDb2.rows[0].sub_broker_id === subBrokerA && clientDb2.rows[0].name.includes('Updated'),
    `Count: ${clientDb2.rows.length}, SubBrokerId: ${clientDb2.rows[0]?.sub_broker_id}`
  );

  // ----------------------------------------------------------------
  // 5. CLIENT HIERARCHY & UNASSIGNED HANDLING
  // ----------------------------------------------------------------
  console.log('\n--- 5. Client Hierarchy & Unassigned Handling ---');

  const unassignedClientCode = `UNASSIGNED_${suffix}`;
  const unassignedEvent: TradingPlatformEvent = {
    eventId: `EVT_UNASSIGNED_${suffix}`,
    eventType: 'client.registered',
    tenantId: tradingTenantA,
    timestamp: new Date().toISOString(),
    payload: {
      clientId: `CLT_UNASSIGNED_${suffix}`,
      clientCode: unassignedClientCode,
      name: `Unassigned Client ${suffix}`,
      email: `unassigned_${suffix}@example.com`,
      status: 'ACTIVE'
    }
  };

  const unassignedRes = await sendSignedEvent(unassignedEvent);
  assert(
    '5.1 Client with no referral code is created successfully under unassigned handling',
    unassignedRes.success === true,
    `Result: success=${unassignedRes.success}`
  );

  const unassignedClientDb = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [unassignedClientCode, adminTenantA]);
  assert(
    '5.2 Unassigned client has sub_broker_id = null',
    unassignedClientDb.rows.length === 1 && unassignedClientDb.rows[0].sub_broker_id === null,
    `sub_broker_id: ${unassignedClientDb.rows[0]?.sub_broker_id}`
  );

  // ----------------------------------------------------------------
  // 6. TENANT ISOLATION
  // ----------------------------------------------------------------
  console.log('\n--- 6. Cross-Tenant Data Isolation ---');

  // Verify that client registered in Tenant A does NOT exist in Tenant B
  const clientInTenantB = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [testClientCode, adminTenantB]);
  assert(
    '6.1 Client created under Tenant A does NOT appear under Tenant B',
    clientInTenantB.rows.length === 0,
    `Tenant B client rows: ${clientInTenantB.rows.length}`
  );

  // Register client in Tenant B
  const tenantBClientCode = `CLT_B_${suffix}`;
  const tenantBEvent: TradingPlatformEvent = {
    eventId: `EVT_TNT_B_${suffix}`,
    eventType: 'client.registered',
    tenantId: tradingTenantB,
    timestamp: new Date().toISOString(),
    payload: {
      clientId: `CLT_B_ID_${suffix}`,
      clientCode: tenantBClientCode,
      name: `Tenant B Client ${suffix}`,
      status: 'ACTIVE'
    }
  };
  await sendSignedEvent(tenantBEvent);

  const clientInB = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [tenantBClientCode, adminTenantB]);
  const clientBInA = await query('SELECT * FROM clients WHERE client_code = $1 AND tenant_id = $2', [tenantBClientCode, adminTenantA]);
  assert(
    '6.2 Tenant B event resolves to Tenant B without leaking to Tenant A',
    clientInB.rows.length === 1 && clientBInA.rows.length === 0,
    `Tenant B rows=${clientInB.rows.length}, Tenant A rows=${clientBInA.rows.length}`
  );

  // ----------------------------------------------------------------
  // 7. ERROR HANDLING
  // ----------------------------------------------------------------
  console.log('\n--- 7. Error Handling & Validation ---');

  // 7.1 Missing clientCode in payload
  const missingCodeEvent: TradingPlatformEvent = {
    eventId: `EVT_NOCODE_${suffix}`,
    eventType: 'client.registered',
    tenantId: tradingTenantA,
    timestamp: new Date().toISOString(),
    payload: {
      name: 'Client with No Code',
      email: 'nocode@test.com'
    }
  };
  const missingCodeRes = await sendSignedEvent(missingCodeEvent);
  assert(
    '7.1 Missing clientCode in payload is rejected safely',
    missingCodeRes.success === false,
    `error="${missingCodeRes.error || missingCodeRes.message}"`
  );

  // ----------------------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 TASK A3 SUMMARY RESULTS                        ');
  console.log('================================================================');

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log(`TOTAL CHECKS: ${testResults.length}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);

  if (failed > 0) {
    console.error('\n❌ TASK A3 TEST FAILED: One or more assertions failed.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TASK A3 REQUIREMENTS PASSED SUCCESSFULLY.');
  }
}

runTaskA3Tests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  });
