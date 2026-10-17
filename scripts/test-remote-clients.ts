import crypto from 'crypto';
import { appConfig } from '../server/config/environment.ts';

async function main() {
  console.log('1. Querying health for exact server date...');
  const healthRes = await fetch('https://trading-platform-2t6r.onrender.com/health');
  const serverDateStr = healthRes.headers.get('date');
  const serverTime = serverDateStr ? new Date(serverDateStr).getTime() : Date.now();
  console.log('Remote Server Time:', new Date(serverTime).toISOString());

  const path = '/api/internal/v1/trading/clients';
  const method = 'GET';
  const timestamp = serverTime.toString();
  const nonce = crypto.randomUUID();
  const correlationId = `corr-${Date.now()}`;
  const tenantId = 'vertex-default'; // let's check tenants: vertex-default, default, TNT-001, etc.
  const candidateSecrets = [
    'nextrade-internal-hmac-secret-2026',
    'Tr@dingS2S#2026!Kp8$Xm4&Qr7r7484',
    'tradematrix-s2s-hmac-secret-32chars-min-2026',
    'dev-internal-s2s-secret-32chars-tradematrix',
    'vtx_dev_internal_shared_secret_do_not_use_in_prod',
    'vertex_internal_comm_secret_test_key_32_chars_long!',
    'another_ultra_secure_hmac_secret_key_32_characters_minimum_67890',
    '0123456789012345678901234567890123456789',
    'dev-jwt-secret-key-32chars-min-tradematrix-2026',
    'tradematrix-prod-jwt-secret-key-32chars-min-2026'
  ];

  for (const secret of candidateSecrets) {
    console.log('\nTesting secret:', secret);
    const payload = `${timestamp}.${method}.${path}.`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const headers = {
      'Accept': 'application/json',
      'X-Internal-Timestamp': timestamp,
      'X-Internal-Nonce': crypto.randomUUID(),
      'X-Internal-Signature': signature,
      'X-Correlation-ID': correlationId,
      'X-Tenant-ID': tenantId
    };

    const res = await fetch(`https://trading-platform-2t6r.onrender.com${path}`, {
      method,
      headers
    });

    console.log('HTTP Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.slice(0, 150));
    if (res.status === 200) {
      console.log('🎉 FOUND MATCHING SECRET:', secret);
      break;
    }
  }
}

main();
