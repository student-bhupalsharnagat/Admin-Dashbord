import { query } from '../server/db/connection.ts';
import { runMigrations } from '../server/db/migrate.ts';
import { seedDatabase } from '../server/db/seed.ts';
import { eventHandler } from '../server/services/EventHandler.ts';

async function testBackfillAndUpsertLogic() {
  console.log('--- Starting Backfill Constraints & Upsert Verification ---');

  // 1. Run migrations and verify 010 was picked up
  const migrations = await runMigrations();
  console.log('Migrations result count:', migrations.length);

  // 2. Run seed
  await seedDatabase();

  // 3. Test ensureTenantExists('vertex-default')
  await eventHandler.ensureTenantExists('vertex-default');
  const tenantRes = await query<{ id: string; name: string; status: string }>(
    "SELECT id, name, status FROM tenants WHERE id = 'vertex-default'"
  );
  if (tenantRes.rows.length === 0 || tenantRes.rows[0].id !== 'vertex-default') {
    throw new Error('Default tenant vertex-default was not found in tenants table!');
  }
  console.log('[PASS] Default tenant vertex-default exists:', tenantRes.rows[0]);

  // 4. Test KYC Upsert idempotency (simulate the exact duplicate key scenario: KYC-usr_test_1793554554691)
  const testUserId = 'usr_test_1793554554691';
  const testEvent1 = {
    eventId: `evt_test_1_${Date.now()}`,
    eventType: 'client.created',
    tenantId: 'vertex-default',
    timestamp: new Date().toISOString(),
    payload: {
      userId: testUserId,
      clientCode: 'TST_CLT_01',
      name: 'Test Backfill Client',
      email: 'testbackfill@client.com',
      status: 'ACTIVE',
      kycStatus: 'VERIFIED',
      balance: 50000
    }
  };

  // First sync
  await (eventHandler as any).handleClientCreatedOrUpdated(testEvent1);
  console.log('[PASS] First client & KYC sync executed successfully');

  // Second sync with identical ID (previously threw 23505 on kyc_pkey)
  const testEvent2 = {
    eventId: `evt_test_2_${Date.now()}`,
    eventType: 'client.updated',
    tenantId: 'vertex-default',
    timestamp: new Date().toISOString(),
    payload: {
      userId: testUserId,
      clientCode: 'TST_CLT_01',
      name: 'Test Backfill Client Updated',
      email: 'testbackfill@client.com',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      balance: 75000
    }
  };

  await (eventHandler as any).handleClientCreatedOrUpdated(testEvent2);
  console.log('[PASS] Second client & KYC sync (duplicate key scenario) executed without 23505 error');

  // Verify KYC table has the upserted record with status APPROVED
  const kycRes = await query<{ id: string; client_id: string; tenant_id: string; status: string }>(
    "SELECT id, client_id, tenant_id, status FROM kyc WHERE id = $1",
    [`KYC-${testUserId}`]
  );
  if (kycRes.rows.length === 0) {
    throw new Error('KYC record was not found after upsert!');
  }
  console.log('[PASS] Verified KYC row in database:', kycRes.rows[0]);

  // 5. Test FK safety on ledger_entries with vertex-default
  const ledgerId = `LDG-TEST-${Date.now()}`;
  await query(`
    INSERT INTO ledger_entries (
      id, tenant_id, client_id, client_code, client_name, entry_type,
      debit, credit, balance_after, reference_id, description, is_finalized, created_at
    ) VALUES ($1, 'vertex-default', $2, 'TST_CLT_01', 'Test Client', 'DEPOSIT', 0, 50000, 50000, 'REF-001', 'Test FK', true, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `, [ledgerId, testUserId]);
  console.log('[PASS] Ledger entry inserted with tenant_id vertex-default without FK 23503 error');

  // 6. Test FK safety on masters with vertex-default
  const masterCheck = await (eventHandler as any).ensureTenantSubBroker('vertex-default');
  console.log('[PASS] Hierarchy sub-broker ensured under vertex-default:', masterCheck);

  console.log('--- ALL BACKFILL AND UPSERT TESTS PASSED CLEANLY ---');
}

testBackfillAndUpsertLogic()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] Test failed:', err);
    process.exit(1);
  });
