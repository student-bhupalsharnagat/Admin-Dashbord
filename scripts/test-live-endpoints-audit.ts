import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';

async function testLiveConnection() {
  console.log('================================================================');
  console.log('       AUDITING LIVE CONNECTION TO TRADING PLATFORM             ');
  console.log('================================================================\n');

  console.log('Base URL:', tradingPlatformClient.getBaseUrl());

  // 1. Health check & clock sync
  const startHealth = Date.now();
  try {
    const healthRes = await fetch(`${tradingPlatformClient.getBaseUrl()}/health`);
    const healthLatency = Date.now() - startHealth;
    const healthBody = await healthRes.json().catch(() => ({}));
    console.log(`[Health] Status: ${healthRes.status} | Latency: ${healthLatency}ms | Body:`, healthBody);
    console.log(`[Health] Remote Date Header: ${healthRes.headers.get('date')}`);
  } catch (err: any) {
    console.error('[Health] Failed:', err.message);
  }

  // 2. Clock drift sync
  const offset = await tradingPlatformClient.syncClockOffset(true);
  console.log(`[Clock Sync] Calibrated Clock Offset: ${offset}ms (${Math.round(offset / 1000)}s)\n`);

  // 3. Test each live S2S endpoint
  const endpoints = [
    { name: 'Live Clients', fn: () => tradingPlatformClient.getLiveClients('vertex-default') },
    { name: 'Live Orders', fn: () => tradingPlatformClient.getLiveOrders('vertex-default') },
    { name: 'Live Trades', fn: () => tradingPlatformClient.getLiveTrades('vertex-default') },
    { name: 'Live Positions', fn: () => tradingPlatformClient.getLivePositions('vertex-default') },
    { name: 'Live Funds', fn: () => tradingPlatformClient.getLiveFunds('vertex-default') },
    { name: 'Live Summary', fn: () => tradingPlatformClient.getLiveSummary('vertex-default') },
    { name: 'Live Ledger', fn: () => tradingPlatformClient.getLiveLedger('vertex-default') },
  ];

  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const res = await ep.fn();
      const elapsed = Date.now() - t0;
      const count = Array.isArray(res.data) 
        ? res.data.length 
        : (Array.isArray((res.data as any)?.clients) 
            ? (res.data as any).clients.length 
            : (Array.isArray((res.data as any)?.trades) 
                ? (res.data as any).trades.length 
                : (Array.isArray((res.data as any)?.orders) 
                    ? (res.data as any).orders.length 
                    : (Array.isArray((res.data as any)?.positions)
                        ? (res.data as any).positions.length 
                        : (Array.isArray((res.data as any)?.funds)
                            ? (res.data as any).funds.length
                            : (res.data ? 'object' : 0))))));
      console.log(`[${ep.name}] Status: ${res.statusCode} | Latency: ${elapsed}ms (server reported: ${res.latencyMs}ms) | Count/Type: ${count}`);
      if (!res.success) {
        console.warn(`  Warning: ${res.error}`);
      }
    } catch (err: any) {
      console.error(`[${ep.name}] Error:`, err.message);
    }
  }

  // 4. Test Concurrent Load (Simulation of Admin Panel loading dashboard + hierarchy)
  console.log('\n--- Testing Concurrent S2S Load (5 parallel requests) ---');
  const t0Concurrent = Date.now();
  const concurrentResults = await Promise.allSettled([
    tradingPlatformClient.getLiveClients('vertex-default'),
    tradingPlatformClient.getLiveOrders('vertex-default'),
    tradingPlatformClient.getLiveTrades('vertex-default'),
    tradingPlatformClient.getLivePositions('vertex-default'),
    tradingPlatformClient.getLiveSummary('vertex-default')
  ]);
  const totalConcurrentTime = Date.now() - t0Concurrent;
  console.log(`Concurrent 5 calls took: ${totalConcurrentTime}ms`);
  concurrentResults.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      console.log(`  Call #${idx + 1}: status=${r.value.statusCode}, success=${r.value.success}, latency=${r.value.latencyMs}ms`);
    } else {
      console.log(`  Call #${idx + 1}: rejected with ${r.reason}`);
    }
  });

  console.log('\nCircuit Breaker Metrics:', tradingPlatformClient.getMetrics());
}

testLiveConnection().catch(console.error);
