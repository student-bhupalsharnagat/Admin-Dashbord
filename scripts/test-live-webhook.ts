import crypto from 'crypto';

async function main() {
  const secret = 'Tr@dingS2S#2026!Kp8$Xm4&Qr7r7484';
  
  // Calibrate with server time
  const healthRes = await fetch('https://admin-dashbord-2.onrender.com/api/health');
  const serverDateStr = healthRes.headers.get('date');
  const serverTime = serverDateStr ? new Date(serverDateStr).getTime() : Date.now();
  const timestamp = serverTime.toString();
  const method = 'POST';
  const path = '/api/internal/v1/events/client-registered';
  const tenantId = 'vertex-default';

  const event = {
    eventId: 'test-evt-' + Date.now(),
    eventType: 'client.registered',
    tenantId: 'vertex-default',
    timestamp: new Date().toISOString(),
    payload: {
      userId: 'test_sync_check',
      clientCode: 'TEST_SYNC_CHECK',
      name: 'Render Integration Test Client',
      email: 'testsync@vertex.com',
      phone: '+919999999999',
      status: 'ACTIVE',
      kycStatus: 'VERIFIED'
    }
  };

  const bodyString = JSON.stringify(event);
  const payload = `${timestamp}.${method}.${path}.${bodyString}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Internal-Timestamp': timestamp,
    'X-Internal-Nonce': crypto.randomUUID(),
    'X-Internal-Signature': signature,
    'X-Correlation-ID': 'test-corr-' + Date.now(),
    'X-Tenant-ID': tenantId
  };

  console.log('Sending webhook to live Admin Panel...');
  const res = await fetch('https://admin-dashbord-2.onrender.com' + path, {
    method,
    headers,
    body: bodyString
  });

  console.log('Admin Panel Webhook Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

main();
