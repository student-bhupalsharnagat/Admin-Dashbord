import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';

async function runLiveServerAudit() {
  console.log('================================================================');
  console.log('       TESTING LIVE RUNNING ADMIN PANEL API ENDPOINTS           ');
  console.log('================================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Check health
  const healthRes = await fetch(`${baseUrl}/health`);
  console.log(`1. GET /health -> Status: ${healthRes.status}`);

  // 2. Login as Super Admin
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@platform.com', password: 'Admin@123456' })
  });
  console.log(`2. POST /api/auth/login -> Status: ${loginRes.status}`);
  const cookie = loginRes.headers.get('set-cookie') || '';

  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  // 3. Test API Endpoints & Latencies
  const endpoints = [
    '/api/auth/me',
    '/api/admin/dashboard',
    '/api/admin/clients',
    '/api/admin/trades',
    '/api/admin/orders',
    '/api/admin/positions',
    '/api/admin/funds/deposits',
    '/api/admin/funds/withdrawals',
    '/api/admin/system/health',
    '/api/admin/commission/transactions',
    '/api/admin/tenants',
    '/api/admin/masters',
    '/api/admin/brokers',
    '/api/admin/sub-brokers',
    '/api/admin/kyc'
  ];

  console.log('\n--- Section-by-Section Live Data & Latency Check ---');
  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}${ep}`, { headers });
      const elapsed = Date.now() - t0;
      let dataSummary = '';
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body)) {
          dataSummary = `Array[${body.length}]`;
        } else if (body && typeof body === 'object') {
          if (body.clients && Array.isArray(body.clients)) {
            dataSummary = `clients: ${body.clients.length}`;
          } else if (body.kpis) {
            dataSummary = `kpis keys: ${Object.keys(body.kpis).length}, turnover: ${body.kpis.todays_turnover?.value || 'N/A'}`;
          } else {
            dataSummary = `Object keys: [${Object.keys(body).slice(0, 4).join(', ')}]`;
          }
        }
      } else {
        dataSummary = `Error: ${res.statusText}`;
      }
      console.log(`[${res.status}] ${ep.padEnd(35)} -> ${elapsed}ms | ${dataSummary}`);
    } catch (err: any) {
      console.error(`[ERR] ${ep.padEnd(35)} -> ${err.message}`);
    }
  }

  // 4. Test Inbound S2S Webhook / Event Ingestion from Trading Platform
  console.log('\n--- Inbound Event Verification (Trading Platform -> Admin Panel) ---');
  const nowIso = new Date().toISOString();
  const testTradeEvent = {
    eventId: `evt-live-test-${Date.now()}`,
    eventType: 'trade.executed',
    tenantId: 'vertex-default',
    timestamp: nowIso,
    payload: {
      id: `TRD-LIVE-${Date.now()}`,
      tradeId: `TRD-LIVE-${Date.now()}`,
      orderId: `ORD-LIVE-${Date.now()}`,
      clientId: 'usr-TNT-001-arav12',
      clientName: 'Aarav Patel',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 50,
      price: 2850.50,
      totalValue: 142525.00,
      timestamp: nowIso
    }
  };

  const rawEventBody = JSON.stringify(testTradeEvent);
  const signature = tradingPlatformClient.generateSignature(nowIso, 'POST', '/api/internal/events', rawEventBody);

  const inboundRes = await fetch(`${baseUrl}/api/internal/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-sha256': signature,
      'x-timestamp': nowIso,
      'x-tenant-id': 'vertex-default'
    },
    body: rawEventBody
  });

  const inboundData = await inboundRes.json().catch(() => ({}));
  console.log(`Inbound S2S Event POST /api/internal/events -> Status: ${inboundRes.status}`, inboundData);

  // 5. Test Replay Attack Rejection (same event ID)
  const replayRes = await fetch(`${baseUrl}/api/internal/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-sha256': signature,
      'x-timestamp': nowIso,
      'x-tenant-id': 'vertex-default'
    },
    body: rawEventBody
  });
  const replayData = await replayRes.json().catch(() => ({}));
  console.log(`Duplicate Event Replay Rejection / Idempotency -> Status: ${replayRes.status}`, replayData);

  // 6. Test Tampered Signature Rejection
  const badSigRes = await fetch(`${baseUrl}/api/internal/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-sha256': '0000000000000000000000000000000000000000000000000000000000000000',
      'x-timestamp': nowIso,
      'x-tenant-id': 'vertex-default'
    },
    body: rawEventBody
  });
  console.log(`Tampered HMAC Signature Rejection -> Status: ${badSigRes.status}`);
}

runLiveServerAudit().catch(console.error);
