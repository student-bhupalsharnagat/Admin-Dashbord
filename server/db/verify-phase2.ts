import { query, testConnection, closePool } from './connection.ts';
import { runMigrations } from './migrate.ts';
import { seedDatabase } from './seed.ts';
import { PostgresTradingDataProvider } from '../providers/PostgresTradingDataProvider.ts';

async function runVerification() {
  console.log('====================================================');
  console.log('Phase 2: PostgreSQL Database & Migration Verification');
  console.log('====================================================\n');

  const provider = new PostgresTradingDataProvider();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      throw new Error(`Assertion failed for test: ${testName}`);
    }
  }

  // 1. Connection Test
  console.log('--- 1. Testing Database Connection ---');
  const isConnected = await testConnection();
  assert(isConnected, 'Database connected successfully');

  // 2. Migrations Test
  console.log('\n--- 2. Testing Database Migrations ---');
  const migrationResults = await runMigrations();
  assert(Array.isArray(migrationResults), 'Migrations executed without error');
  const appliedMigrations = await query('SELECT version FROM schema_migrations');
  assert(appliedMigrations.rows.length >= 1, `Migrations recorded in schema_migrations (${appliedMigrations.rows.length} found)`);

  // Verify core tables exist
  const tableCheck = await query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'tenants', 'tenant_branding', 'custom_domains', 'platform_settings',
      'users', 'roles', 'permissions', 'masters', 'brokers', 'sub_brokers', 'clients',
      'kyc_records', 'fund_deposits', 'fund_withdrawals', 'ledger_entries',
      'orders', 'trades', 'positions',
      'commission_plans', 'commission_rules', 'risk_profiles', 'risk_events',
      'audit_logs', 'sessions', 'login_history', 'support_tickets', 'notifications'
    );
  `);
  assert(tableCheck.rows.length >= 25, `Core tables created in PostgreSQL (${tableCheck.rows.length}/27 verified)`);

  // 3. Seed Test
  console.log('\n--- 3. Testing Database Seed ---');
  await seedDatabase();
  const seedTenants = await query('SELECT count(*) as cnt FROM tenants');
  const tenantCount = parseInt(seedTenants.rows[0].cnt, 10);
  assert(tenantCount >= 2, `Seeded at least 2 tenants (found ${tenantCount})`);

  // 4. Tenant Creation & Retrieval
  console.log('\n--- 4. Testing Tenant Management ---');
  const newTenant = await provider.createTenant({
    name: 'Verification Capital',
    code: 'VRF',
    domain: 'verification-cap.tradepro.com',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    admin_name: 'John Verification',
    admin_email: 'john@verification.io'
  });
  assert(!!newTenant.id && newTenant.code === 'VRF', `Tenant created with ID ${newTenant.id}`);
  
  const fetchedTenant = await provider.getTenantById(newTenant.id);
  assert(fetchedTenant?.name === 'Verification Capital', 'Tenant retrieved by ID matches');

  // 5. Hierarchy Creation: Master -> Broker -> Sub-Broker -> Client
  console.log('\n--- 5. Testing Hierarchy (Master -> Broker -> SubBroker -> Client) ---');
  const master = await provider.createMaster({
    tenant_id: newTenant.id,
    name: 'Apex Master Admin',
    code: 'MST-APX',
    email: 'apex@master.io',
    phone: '+91 9876543210'
  });
  assert(!!master.id && master.tenant_id === newTenant.id, `Master created with ID ${master.id}`);

  const broker = await provider.createBroker({
    tenant_id: newTenant.id,
    master_id: master.id,
    name: 'Apex Broker Alpha',
    code: 'BRK-APX',
    email: 'alpha@broker.io'
  });
  assert(!!broker.id && broker.master_id === master.id, `Broker created under Master ${master.id}`);

  const subBroker = await provider.createSubBroker({
    tenant_id: newTenant.id,
    broker_id: broker.id,
    name: 'Apex SubBroker Beta',
    code: 'SB-APX',
    email: 'beta@subbroker.io'
  });
  assert(!!subBroker.id && subBroker.broker_id === broker.id, `Sub-Broker created under Broker ${broker.id}`);

  const client = await provider.createClient({
    tenant_id: newTenant.id,
    sub_broker_id: subBroker.id,
    name: 'Priya Sharma',
    client_code: 'CLT-APX-01',
    email: 'priya@apexclient.io',
    phone: '+91 9876543213',
    kyc_status: 'APPROVED'
  });
  assert(!!client.id && client.sub_broker_id === subBroker.id, `Client created under Sub-Broker ${subBroker.id}`);

  // 6. Status Updates
  console.log('\n--- 6. Testing Status Updates ---');
  const suspendedClient = await provider.updateClientStatus(client.id, 'SUSPENDED');
  assert(suspendedClient?.status === 'SUSPENDED', `Client status updated to SUSPENDED`);
  const activatedClient = await provider.updateClientStatus(client.id, 'ACTIVE');
  assert(activatedClient?.status === 'ACTIVE', `Client status reactivated to ACTIVE`);

  // 7. Trades Retrieval
  console.log('\n--- 7. Testing Trades Retrieval ---');
  const recentTrades = await provider.getRecentTrades(undefined, 5);
  assert(Array.isArray(recentTrades) && recentTrades.length > 0, `Retrieved ${recentTrades.length} recent trades from PostgreSQL`);
  assert(recentTrades[0].symbol && recentTrades[0].price > 0, 'Trade record has valid symbol and price');

  // 8. Emergency Controls: Trading Pause & Resume
  console.log('\n--- 8. Testing Emergency Controls: Trading Pause & Resume ---');
  const pausedState = await provider.setGlobalTrading(false, 'Automated Test Actor', 'Phase 2 Test Pause');
  assert(pausedState.globalTradingActive === false, 'Global trading pause verified');
  const resumedState = await provider.setGlobalTrading(true, 'Automated Test Actor', 'Phase 2 Test Resume');
  assert(resumedState.globalTradingActive === true, 'Global trading resume verified');

  // 9. Emergency Controls: Cancel All Orders
  console.log('\n--- 9. Testing Emergency Controls: Cancel All Orders ---');
  // Insert a test pending order first
  const orderId = `ORD-TEST-${Date.now()}`;
  await query(`
    INSERT INTO orders (id, tenant_id, client_id, client_code, client_name, symbol, side, order_type, quantity, price, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [orderId, newTenant.id, client.id, client.client_code, client.name, 'RELIANCE', 'BUY', 'LIMIT', 50, 2450.00, 'PENDING']);
  
  const cancelResult = await provider.cancelAllOrders('Super Admin', 'Emergency Order Test', newTenant.id);
  assert(cancelResult.cancelledOrdersCount >= 1, `Cancelled ${cancelResult.cancelledOrdersCount} orders successfully`);
  
  const checkOrder = await query('SELECT status FROM orders WHERE id = $1', [orderId]);
  assert(checkOrder.rows[0].status === 'CANCELLED', `Test order marked as CANCELLED in database`);

  // 10. Audit Log Creation
  console.log('\n--- 10. Testing Audit Log Creation ---');
  const auditLogs = await provider.getAuditLogs(newTenant.id);
  assert(auditLogs.length >= 1, `Audit log found for tenant (action: ${auditLogs[0]?.action})`);

  // 11. Multi-Tenant Isolation Test
  console.log('\n--- 11. Testing Multi-Tenant Data Isolation ---');
  // Fetch clients for newTenant
  const tenantClients = await provider.getClients(newTenant.id);
  assert(tenantClients.every(c => c.tenant_id === newTenant.id), 'All returned clients belong strictly to the requested tenant');
  
  // Fetch clients for a different tenant
  const otherClients = await provider.getClients('TNT-001');
  assert(otherClients.every(c => c.tenant_id === 'TNT-001'), 'Clients for TNT-001 are strictly isolated from new tenant');
  assert(!tenantClients.some(tc => otherClients.some(oc => oc.id === tc.id)), 'Zero client overlap between isolated tenants');

  // 12. Ledger Immutability Trigger Test
  console.log('\n--- 12. Testing Financial Ledger Immutability ---');
  const ledgerId = `LDG-${Date.now()}`;
  await query(`
    INSERT INTO ledger_entries (
      id, tenant_id, client_id, client_code, client_name,
      entry_type, debit, credit, balance_after, reference_id, description, is_finalized
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
  `, [ledgerId, newTenant.id, client.id, client.client_code, client.name, 'DEPOSIT', 0.00, 100000.00, 100000.00, 'REF-TEST-001', 'Verified Deposit']);

  let triggerBlockedUpdate = false;
  try {
    await query('UPDATE ledger_entries SET credit = 999999 WHERE id = $1', [ledgerId]);
  } catch (err: any) {
    triggerBlockedUpdate = true;
    console.log(`[PASS] Trigger successfully blocked UPDATE on finalized ledger: "${err.message}"`);
  }
  assert(triggerBlockedUpdate, 'PostgreSQL trigger blocked UPDATE of finalized ledger entry');

  let triggerBlockedDelete = false;
  try {
    await query('DELETE FROM ledger_entries WHERE id = $1', [ledgerId]);
  } catch (err: any) {
    triggerBlockedDelete = true;
    console.log(`[PASS] Trigger successfully blocked DELETE on finalized ledger: "${err.message}"`);
  }
  assert(triggerBlockedDelete, 'PostgreSQL trigger blocked DELETE of finalized ledger entry');

  console.log('\n====================================================');
  console.log(`ALL VERIFICATION CHECKS PASSED: ${passedCount}/${totalCount}`);
  console.log('====================================================\n');

  await closePool();
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FATAL] Verification failed:', err);
    process.exit(1);
  });
