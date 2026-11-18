import assert from 'assert';
import { TradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { generateReferralCode } from '../server/providers/PostgresTradingDataProvider.ts';

async function main() {
  // 1. Verify referral code format
  const mstCode = generateReferralCode('MST');
  const brkCode = generateReferralCode('BRK');
  const subCode = generateReferralCode('SUB');
  assert.match(mstCode, /^MST-[A-Z0-9]{4}$/, `Invalid master referral code: ${mstCode}`);
  assert.match(brkCode, /^BRK-[A-Z0-9]{4}$/, `Invalid broker referral code: ${brkCode}`);
  assert.match(subCode, /^SUB-[A-Z0-9]{4}$/, `Invalid sub-broker referral code: ${subCode}`);

  // 2. Capture outgoing S2S requests by intercepting global fetch
  const captured: Array<{ url: string; method: string; headers: Record<string, string>; body: any; rawBody: string }> = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.toString();
    const rawBody = typeof init?.body === 'string' ? init.body : '';
    const rawHeaders = (init?.headers || {}) as Record<string, string>;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      headers[k.toLowerCase()] = v;
    }
    if (!url.endsWith('/health')) {
      captured.push({
        url,
        method: init?.method || 'GET',
        headers,
        body: rawBody ? JSON.parse(rawBody) : null,
        rawBody
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;

  try {
    const client = new TradingPlatformClient(
      'https://tp.test.local',
      'test-hmac-secret-12345678901234567890',
      5000,
      'https://up.test.local'
    );

    // Test dual-target hierarchy sync
    await client.syncHierarchyNode({
      type: 'broker',
      action: 'created',
      tenantId: 'vertex-default',
      node: {
        id: 'BRK-901',
        name: 'Alpha Broker',
        email: 'alpha@broker.test',
        phone: '+91 99999 00001',
        passwordHash: '$2b$10$fakehashvalue',
        role: 'BROKER',
        masterId: 'MST-001',
        brokerId: 'BRK-901',
        subBrokerId: null,
        commissionShare: '15%',
        referralCode: brkCode
      }
    });

    const tpSync = captured.find(c => c.url === 'https://tp.test.local/api/internal/v1/hierarchy/sync');
    const upSync = captured.find(c => c.url === 'https://up.test.local/api/internal/v1/hierarchy/sync');
    assert(tpSync, 'Expected S2S hierarchy sync to Trading Platform');
    assert(upSync, 'Expected S2S hierarchy sync to User Panel');

    for (const req of [tpSync, upSync]) {
      const verify = client.verifyInternalS2S(req.headers, 'POST', '/api/internal/v1/hierarchy/sync', req.rawBody);
      assert.strictEqual(verify.valid, true, `HMAC verification failed for ${req.url}: ${verify.reason}`);
      assert.strictEqual(req.body.id, 'BRK-901');
      assert.strictEqual(req.body.email, 'alpha@broker.test');
      assert.strictEqual(req.body.passwordHash, '$2b$10$fakehashvalue');
      assert.strictEqual(req.body.role, 'BROKER');
      assert.strictEqual(req.body.masterId, 'MST-001');
      assert.strictEqual(req.body.brokerId, 'BRK-901');
      assert.strictEqual(req.body.commissionShare, '15%');
      assert.strictEqual(req.body.referralCode, brkCode);
    }

    // Test dual-target white-label broadcast
    captured.length = 0;
    await client.syncWhiteLabel(
      'vertex-default',
      {
        brand_name: 'KwikTrade Pro',
        logo_url: 'https://cdn.test/logo.png',
        primary_color: '#1d4ed8',
        support_email: 'help@kwiktrade.test',
        custom_domain: 'trade.kwiktrade.test'
      },
      2,
      { actor: 'SuperAdmin' }
    );

    const tpWl = captured.find(c => c.url === 'https://tp.test.local/api/internal/v1/tenant/branding');
    const upWl = captured.find(c => c.url === 'https://up.test.local/api/internal/v1/tenant/branding');
    assert(tpWl, 'Expected white-label S2S broadcast to Trading Platform');
    assert(upWl, 'Expected white-label S2S broadcast to User Panel');
    for (const req of [tpWl, upWl]) {
      const verify = client.verifyInternalS2S(req.headers, 'POST', '/api/internal/v1/tenant/branding', req.rawBody);
      assert.strictEqual(verify.valid, true, `White-label HMAC verification failed for ${req.url}: ${verify.reason}`);
      assert.strictEqual(req.body.brandName, 'KwikTrade Pro');
      assert.strictEqual(req.body.logoUrl, 'https://cdn.test/logo.png');
      assert.strictEqual(req.body.primaryColor, '#1d4ed8');
      assert.strictEqual(req.body.supportEmail, 'help@kwiktrade.test');
      assert.strictEqual(req.body.domain, 'trade.kwiktrade.test');
    }

    console.log('PASS: B2B hierarchy sync, referral codes, HMAC verification, and white-label dual broadcast verified.');
  } finally {
    globalThis.fetch = origFetch;
  }
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
