/**
 * Automated Verification for TASK A1 Requirements:
 * 1. /api/auth/register ignores body.role and always creates CLIENT role. tenantId must be valid ACTIVE tenant.
 * 2. Min password 8 chars. Rate limiter 10/min/IP on login/register.
 * 3. Production: ALLOWED_ORIGINS='*' is rejected (throw). Session cookie httpOnly, secure, sameSite=lax.
 * 4. Seed users: in production takes SEED_ADMIN_PASSWORD; skips demo accounts if SEED_DEMO_USERS !== 'true'.
 * 5. Privileged roles created only via authenticated admin endpoints.
 */

import { validateAndLoadConfig } from '../server/config/environment.ts';

async function runTaskA1Verification() {
  console.log('================================================================');
  console.log('  STARTING TASK A1 VERIFICATION TEST SUITE                      ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:3000';
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

  // --- TEST 1: Public register ignores body.role and forces CLIENT ---
  const regEmail = `test_client_${Date.now()}@alphaprime.com`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify({
      name: 'Escalation Attempt User',
      email: regEmail,
      password: 'password123',
      role: 'SUPER_ADMIN', // Attempt privilege escalation
      tenantId: 'TNT-001'
    })
  });
  const regData = await regRes.json();
  assert(regRes.status === 201 || regRes.status === 200, 'Registration returns 201 Created / 200 OK');
  assert(regData.user && regData.user.role === 'CLIENT', 'Registered user role is strictly CLIENT (body.role ignored)');
  assert(regData.user && regData.user.tenant_id === 'TNT-001', 'User assigned to specified active tenant');
  assert(typeof regData.token === 'string', 'Registration returns JWT auth token');

  // --- TEST 2: Registration with invalid / inactive tenant is rejected ---
  const badTenantRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
    body: JSON.stringify({
      name: 'Bad Tenant User',
      email: `bad_tenant_${Date.now()}@example.com`,
      password: 'password123',
      tenantId: 'TNT-NON-EXISTENT'
    })
  });
  assert(badTenantRes.status === 400, 'Registration with non-existent tenant returns 400');

  // --- TEST 3: Min password length 8 chars enforced on login & register ---
  const shortPassReg = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.3' },
    body: JSON.stringify({
      name: 'Short Pass User',
      email: `shortpass_${Date.now()}@alphaprime.com`,
      password: '12345', // < 8 chars
      tenantId: 'TNT-001'
    })
  });
  assert(shortPassReg.status === 400, 'Registration with < 8 char password returns 400');

  const shortPassLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.4' },
    body: JSON.stringify({
      email: 'admin@platform.com',
      password: 'short'
    })
  });
  assert(shortPassLogin.status === 400, 'Login with < 8 char password returns 400');

  // --- TEST 4: Rate limit 10/min/IP enforced on login ---
  const testIp = `192.168.100.${Math.floor(Math.random() * 200 + 10)}`;
  let hitRateLimit = false;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': testIp },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'password123'
      })
    });
    if (res.status === 429) {
      hitRateLimit = true;
      break;
    }
  }
  assert(hitRateLimit, 'Rate limit (10/min/IP) properly returns 429 Too Many Requests');

  // --- TEST 5: Production environment rejection of ALLOWED_ORIGINS='*' ---
  const originalEnv = process.env.NODE_ENV;
  const originalOrigins = process.env.ALLOWED_ORIGINS;
  const originalJwt = process.env.JWT_SECRET;
  const originalSecret = process.env.INTERNAL_COMMUNICATION_SECRET;
  const originalBaseUrl = process.env.TRADING_PLATFORM_BASE_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = '*';
    process.env.JWT_SECRET = '0123456789012345678901234567890123456789';
    process.env.INTERNAL_COMMUNICATION_SECRET = '0123456789012345678901234567890123456789';
    process.env.TRADING_PLATFORM_BASE_URL = 'http://localhost:3001';

    let threw = false;
    try {
      validateAndLoadConfig();
    } catch (err: any) {
      threw = err.message.includes('ALLOWED_ORIGINS cannot be "*"');
    }
    assert(threw, 'In production mode, ALLOWED_ORIGINS="*" throws configuration error');
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.ALLOWED_ORIGINS = originalOrigins;
    process.env.JWT_SECRET = originalJwt;
    process.env.INTERNAL_COMMUNICATION_SECRET = originalSecret;
    process.env.TRADING_PLATFORM_BASE_URL = originalBaseUrl;
  }

  // --- TEST 6: Authenticated admin endpoints require privileged authorization ---
  const unauthMasterRes = await fetch(`${BASE_URL}/api/admin/masters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Privileged Master', tenant_id: 'TNT-001' })
  });
  assert(unauthMasterRes.status === 401, 'Unauthenticated attempt to create MASTER is rejected (401)');

  const clientToken = regData.token;
  const clientMasterRes = await fetch(`${BASE_URL}/api/admin/masters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientToken}`
    },
    body: JSON.stringify({ name: 'Privileged Master', tenant_id: 'TNT-001' })
  });
  assert(clientMasterRes.status === 403, 'CLIENT token attempt to create MASTER is rejected with 403 Forbidden');

  console.log('\n================================================================');
  console.log(`  TASK A1 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTaskA1Verification().catch((err) => {
  console.error('Fatal error during Task A1 verification:', err);
  process.exit(1);
});
