import crypto from 'crypto';

async function queryRemote(path: string) {
  const healthRes = await fetch('https://trading-platform-2t6r.onrender.com/health', { signal: AbortSignal.timeout(6000) });
  const serverDateStr = healthRes.headers.get('date');
  const serverTime = serverDateStr ? new Date(serverDateStr).getTime() : Date.now();
  const timestamp = serverTime.toString();
  const method = 'GET';
  const secret = 'nextrade-internal-hmac-secret-2026';
  const tenantId = 'vertex-default';

  const payload = `${timestamp}.${method}.${path}.`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const headers = {
    'Accept': 'application/json',
    'X-Internal-Timestamp': timestamp,
    'X-Internal-Nonce': crypto.randomUUID(),
    'X-Internal-Signature': signature,
    'X-Correlation-ID': `corr-${Date.now()}`,
    'X-Tenant-ID': tenantId
  };

  const res = await fetch(`https://trading-platform-2t6r.onrender.com${path}`, {
    method,
    headers,
    signal: AbortSignal.timeout(10000)
  });

  return res.json();
}

async function run() {
  const data = await queryRemote('/api/internal/v1/trading/clients?limit=100');
  console.log('Total:', data.total, 'Count:', data.clients?.length);
  for (const c of (data.clients || [])) {
    console.log(`id=${c.id} userId=${c.userId} code=${c.clientCode} name=${c.name}`);
  }
}

run();
