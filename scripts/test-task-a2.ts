/**
 * Automated Verification for TASK A2 Requirements:
 * 1. Signing format: `${ts}.${METHOD}.${pathWithoutQuery}.${rawBody}`, HMAC-SHA256 hex with INTERNAL_COMMUNICATION_SECRET.
 * 2. Headers: X-Internal-Timestamp, X-Internal-Nonce (uuid), X-Internal-Signature, X-Tenant-ID, X-Correlation-ID.
 * 3. Inbound verify: constant-time compare, max age 30s, nonce replay store (5 min TTL), reject Bearer JWT.
 * 4. Inbound routes: POST /api/internal/v1/events/:slug, /api/internal/events, /api/events/trading-platform all route to eventHandler.handleInboundEvent.
 *    Idempotent on eventId (processed_events). Returns 200 on duplicate, 401 on bad sig, never 404.
 * 5. Legacy X-Signature-SHA256 accepted ONLY for white-label inbound routes.
 */

import crypto from 'crypto';
import { appConfig } from '../server/config/environment.ts';
import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';

async function runTaskA2Verification() {
  console.log('================================================================');
  console.log('  STARTING TASK A2 VERIFICATION TEST SUITE                      ');
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

  // --- Helper to sign S2S requests ---
  function signRequest(method: string, path: string, body: any, tsOffsetMs: number = 0, customNonce?: string) {
    const timestamp = (Date.now() + tsOffsetMs).toString();
    const nonce = customNonce || crypto.randomUUID();
    const pathWithoutQuery = path.split('?')[0];
    const rawBody = body ? JSON.stringify(body) : '';
    const payload = `${timestamp}.${method.toUpperCase()}.${pathWithoutQuery}.${rawBody}`;
    const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    return {
      'Content-Type': 'application/json',
      'X-Internal-Timestamp': timestamp,
      'X-Internal-Nonce': nonce,
      'X-Internal-Signature': signature,
      'X-Tenant-ID': 'TNT-001',
      'X-Correlation-ID': `corr_${Date.now()}`
    };
  }

  // --- TEST 1: Valid S2S Event on /api/internal/v1/events/order-created ---
  const event1Id = `evt_a2_test_${Date.now()}_1`;
  const event1Body = {
    eventId: event1Id,
    eventType: 'order.created',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      orderId: `ord_${Date.now()}`,
      clientCode: 'CLT-001',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 10,
      price: 2500,
      status: 'OPEN'
    }
  };

  const path1 = '/api/internal/v1/events/order-created';
  const headers1 = signRequest('POST', path1, event1Body);
  const res1 = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify(event1Body)
  });
  const data1 = await res1.json();
  assert(res1.status === 200, `POST ${path1} returns 200 OK for valid signature`);
  assert(data1.success === true, 'Event processed successfully');

  // --- TEST 2: Idempotency on eventId -> returns 200 on duplicate ---
  const headers1Dup = signRequest('POST', path1, event1Body);
  const res1Dup = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headers1Dup,
    body: JSON.stringify(event1Body)
  });
  const data1Dup = await res1Dup.json();
  assert(res1Dup.status === 200, 'Duplicate eventId returns 200 OK');
  assert(data1Dup.duplicate === true, 'Response explicitly flags duplicate: true');

  // --- TEST 3: Inbound routes alias testing (/api/internal/events and /api/events/trading-platform) ---
  const event2Id = `evt_a2_test_${Date.now()}_2`;
  const event2Body = {
    eventId: event2Id,
    eventType: 'trade.executed',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    version: 1,
    payload: {
      tradeId: `trd_${Date.now()}`,
      orderId: `ord_${Date.now()}`,
      clientCode: 'CLT-001',
      symbol: 'INFY',
      side: 'BUY',
      quantity: 5,
      price: 1500,
      status: 'EXECUTED'
    }
  };

  const path2 = '/api/internal/events';
  const res2 = await fetch(`${BASE_URL}${path2}`, {
    method: 'POST',
    headers: signRequest('POST', path2, event2Body),
    body: JSON.stringify(event2Body)
  });
  assert(res2.status === 200, `POST ${path2} returns 200 OK`);

  const event3Id = `evt_a2_test_${Date.now()}_3`;
  const event3Body = { ...event2Body, eventId: event3Id };
  const path3 = '/api/events/trading-platform';
  const res3 = await fetch(`${BASE_URL}${path3}`, {
    method: 'POST',
    headers: signRequest('POST', path3, event3Body),
    body: JSON.stringify(event3Body)
  });
  assert(res3.status === 200, `POST ${path3} returns 200 OK`);

  // --- TEST 4: Nonce Replay Prevention (same nonce within 5 mins is rejected) ---
  const replayNonce = `nonce_replay_${Date.now()}`;
  const event4Body = { ...event1Body, eventId: `evt_a2_test_${Date.now()}_4` };
  const headers4a = signRequest('POST', path1, event4Body, 0, replayNonce);
  const res4a = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headers4a,
    body: JSON.stringify(event4Body)
  });
  assert(res4a.status === 200, 'First request with unique nonce succeeds (200)');

  const event5Body = { ...event1Body, eventId: `evt_a2_test_${Date.now()}_5` };
  const headers4b = signRequest('POST', path1, event5Body, 0, replayNonce); // REUSE SAME NONCE
  const res4b = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headers4b,
    body: JSON.stringify(event5Body)
  });
  assert(res4b.status === 401, 'Reused nonce is rejected with 401 (Replay prevention)');

  // --- TEST 5: Max age 30s enforcement (>30s timestamp drift rejected) ---
  const event6Body = { ...event1Body, eventId: `evt_a2_test_${Date.now()}_6` };
  const headersOld = signRequest('POST', path1, event6Body, -35000); // 35 seconds in past
  const resOld = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headersOld,
    body: JSON.stringify(event6Body)
  });
  assert(resOld.status === 401, 'Request with >30s timestamp drift is rejected with 401');

  // --- TEST 6: Reject Bearer JWT on S2S routes ---
  const event7Body = { ...event1Body, eventId: `evt_a2_test_${Date.now()}_7` };
  const headersWithBearer = {
    ...signRequest('POST', path1, event7Body),
    'Authorization': 'Bearer some_jwt_token_here'
  };
  const resBearer = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headersWithBearer,
    body: JSON.stringify(event7Body)
  });
  assert(resBearer.status === 401, 'Bearer JWT on S2S route is rejected with 401');

  // --- TEST 7: Invalid HMAC signature rejected ---
  const event8Body = { ...event1Body, eventId: `evt_a2_test_${Date.now()}_8` };
  const headersBadSig = {
    ...signRequest('POST', path1, event8Body),
    'X-Internal-Signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  };
  const resBadSig = await fetch(`${BASE_URL}${path1}`, {
    method: 'POST',
    headers: headersBadSig,
    body: JSON.stringify(event8Body)
  });
  assert(resBadSig.status === 401, 'Bad HMAC signature is rejected with 401');

  // --- TEST 8: /api/internal/v1/events/* never returns 404 ---
  const resNonExistentSlug = await fetch(`${BASE_URL}/api/internal/v1/events/some-non-existent-sub-path`, {
    method: 'GET'
  });
  assert(resNonExistentSlug.status !== 404, '/api/internal/v1/events/* never returns 404 (returns 405 on non-POST)');

  // --- TEST 9: White-label inbound routes accept legacy X-Signature-SHA256 ---
  const wlTimestamp = Date.now().toString();
  const wlPath = '/api/internal/v1/white-label/TNT-001/sync';
  const wlBody = { primaryColor: '#2563eb', platformName: 'Custom Brand' };
  const wlBodyString = JSON.stringify(wlBody);
  const wlLegacySignature = tradingPlatformClient.generateLegacySignature(wlTimestamp, 'POST', wlPath, wlBodyString);

  const resWl = await fetch(`${BASE_URL}${wlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-SHA256': wlLegacySignature,
      'X-Timestamp': wlTimestamp
    },
    body: wlBodyString
  });
  assert(resWl.status === 200, 'Legacy X-Signature-SHA256 accepted for white-label sync route');

  console.log('\n================================================================');
  console.log(`  TASK A2 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTaskA2Verification().catch((err) => {
  console.error('Fatal error during Task A2 verification:', err);
  process.exit(1);
});
