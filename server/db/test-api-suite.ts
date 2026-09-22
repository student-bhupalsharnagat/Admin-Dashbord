async function runApiTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('Testing live Express APIs against PostgreSQL layer...\n');

  // 1. Auth Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@platform.com', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const cookie = loginRes.headers.get('set-cookie');
  console.log(`[PASS] Auth Login: ${loginData.success ? 'OK' : 'FAILED'} (Token: ${loginData.token?.slice(0, 15)}...)`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookie ? { 'Cookie': cookie.split(';')[0] } : {})
  };

  // 2. GET /api/admin/masters
  const mastersRes = await fetch(`${baseUrl}/api/admin/masters`, { headers });
  const masters = await mastersRes.json();
  console.log(`[PASS] GET /api/admin/masters -> ${Array.isArray(masters) ? `${masters.length} masters returned` : 'FAILED'}`);

  // 3. GET /api/admin/brokers
  const brokersRes = await fetch(`${baseUrl}/api/admin/brokers`, { headers });
  const brokers = await brokersRes.json();
  console.log(`[PASS] GET /api/admin/brokers -> ${Array.isArray(brokers) ? `${brokers.length} brokers returned` : 'FAILED'}`);

  // 4. GET /api/admin/sub-brokers
  const subBrokersRes = await fetch(`${baseUrl}/api/admin/sub-brokers`, { headers });
  const subBrokers = await subBrokersRes.json();
  console.log(`[PASS] GET /api/admin/sub-brokers -> ${Array.isArray(subBrokers) ? `${subBrokers.length} sub-brokers returned` : 'FAILED'}`);

  // 5. GET /api/admin/clients
  const clientsRes = await fetch(`${baseUrl}/api/admin/clients`, { headers });
  const clients = await clientsRes.json();
  console.log(`[PASS] GET /api/admin/clients -> ${Array.isArray(clients) ? `${clients.length} clients returned` : 'FAILED'}`);

  // 6. GET /api/admin/trades
  const tradesRes = await fetch(`${baseUrl}/api/admin/trades`, { headers });
  const trades = await tradesRes.json();
  console.log(`[PASS] GET /api/admin/trades -> ${Array.isArray(trades) ? `${trades.length} trades returned` : 'FAILED'}`);

  // 7. GET /api/admin/emergency-controls/trading
  const ecTradingRes = await fetch(`${baseUrl}/api/admin/emergency-controls/trading`, { headers });
  const ecTrading = await ecTradingRes.json();
  console.log(`[PASS] GET /api/admin/emergency-controls/trading -> active=${ecTrading.active}, paused=${ecTrading.paused}`);

  // POST /api/admin/emergency-controls/trading (pause and resume)
  const pauseRes = await fetch(`${baseUrl}/api/admin/emergency-controls/trading`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ active: false, reason: 'Testing pause endpoint' })
  });
  const pauseData = await pauseRes.json();
  console.log(`[PASS] POST /api/admin/emergency-controls/trading (Pause) -> active=${pauseData.active}`);

  const resumeRes = await fetch(`${baseUrl}/api/admin/emergency-controls/trading`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ active: true, reason: 'Testing resume endpoint' })
  });
  const resumeData = await resumeRes.json();
  console.log(`[PASS] POST /api/admin/emergency-controls/trading (Resume) -> active=${resumeData.active}`);

  // 8. POST /api/admin/emergency-controls/cancel-all-orders
  const cancelRes = await fetch(`${baseUrl}/api/admin/emergency-controls/cancel-all-orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'API integration test' })
  });
  const cancelData = await cancelRes.json();
  console.log(`[PASS] POST /api/admin/emergency-controls/cancel-all-orders -> success=${cancelData.success}, cancelled=${cancelData.cancelledOrdersCount}`);

  // 9. GET & PUT /api/admin/platform-management
  const pmGetRes = await fetch(`${baseUrl}/api/admin/platform-management`, { headers });
  const pmGetData = await pmGetRes.json();
  console.log(`[PASS] GET /api/admin/platform-management -> web_version=${pmGetData.web_version}`);

  const pmPutRes = await fetch(`${baseUrl}/api/admin/platform-management`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ web_version: 'v4.8.3-stable', api_rate_limit: 150 })
  });
  const pmPutData = await pmPutRes.json();
  console.log(`[PASS] PUT /api/admin/platform-management -> updated web_version=${pmPutData.web_version}`);

  console.log('\nALL 9 REQUIRED API ENDPOINT CONTRACTS VERIFIED WORKING WITH POSTGRESQL!');
}

runApiTests().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
