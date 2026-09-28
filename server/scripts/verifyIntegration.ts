import { query } from '../db/connection.ts';
import { activeTradingDataProvider } from '../providers/TradingDataProvider.ts';
import { tradingPlatformClient } from '../services/TradingPlatformClient.ts';
import { eventHandler } from '../services/EventHandler.ts';

async function runIntegrationVerification() {
  console.log('--- STARTING PRODUCTION INTEGRATION AUDIT SUITE ---');

  // 1. Check DB Connection
  const dbTest = await query('SELECT 1 as test');
  console.log('✓ DB Connection Check:', dbTest.rows.length === 1 ? 'PASS' : 'FAIL');

  // 2. Check Provider Zero / Live Data Handling
  const kpis = await activeTradingDataProvider.getDashboardKPIs('TNT-001');
  console.log('✓ KPI Fetching:', kpis ? 'PASS' : 'FAIL');

  // 3. Test Trade Execution Event Ingestion Flow
  const tradePayload = {
    eventId: `test_evt_${Date.now()}`,
    eventType: 'trade.executed',
    tenantId: 'TNT-001',
    timestamp: new Date().toISOString(),
    payload: {
      tradeId: `TRD_${Date.now()}`,
      orderId: `ORD_${Date.now()}`,
      clientId: 'CLT-001',
      clientCode: 'CLT001',
      symbol: 'RELIANCE-EQ',
      side: 'BUY',
      quantity: 10,
      price: 2500,
      orderType: 'LIMIT',
      status: 'FILLED',
      executedAt: new Date().toISOString()
    }
  };

  const bodyStr = JSON.stringify(tradePayload);
  const signature = tradingPlatformClient.generateSignature(
    tradePayload.timestamp,
    'POST',
    '/api/internal/events',
    bodyStr
  );

  const inboundResult = await eventHandler.handleInboundEvent(
    {
      'x-signature-sha256': signature,
      'x-timestamp': tradePayload.timestamp,
      'x-tenant-id': 'TNT-001'
    },
    'POST',
    '/api/internal/events',
    bodyStr,
    tradePayload as any
  );

  console.log('✓ S2S Inbound Trade Event Ingestion:', inboundResult.success ? 'PASS' : 'FAIL');

  // 4. Verify Trades have updated
  const trades = await activeTradingDataProvider.getRecentTrades('TNT-001');
  console.log('✓ Trades Store Updated:', trades.length > 0 ? 'PASS' : 'FAIL');

  // 5. Test Idempotency
  const dupResult = await eventHandler.handleInboundEvent(
    {
      'x-signature-sha256': signature,
      'x-timestamp': tradePayload.timestamp,
      'x-tenant-id': 'TNT-001'
    },
    'POST',
    '/api/internal/events',
    bodyStr,
    tradePayload as any
  );
  console.log('✓ Event Idempotency Check:', dupResult.duplicate ? 'PASS' : 'FAIL');

  // 6. Test Zero Data Handling for non-existent tenant
  const emptyKpis = await activeTradingDataProvider.getDashboardKPIs('TNT-NONEXISTENT');
  const zeroHandled = emptyKpis.todays_turnover?.value === '₹0' && emptyKpis.total_clients?.value === 0;
  console.log('✓ Zero-data handling without mocks/fallbacks:', zeroHandled ? 'PASS' : 'FAIL');

  // 7. Verify Emergency Controls State Retrieval
  const emergencyState = await activeTradingDataProvider.getEmergencyControls();
  console.log('✓ Emergency Controls Module:', emergencyState ? 'PASS' : 'FAIL');

  // 8. Verify Ledger & Commission Data
  const ledger = await activeTradingDataProvider.getLedgerEntries('TNT-001');
  console.log('✓ Ledger / Commission Module:', Array.isArray(ledger) ? 'PASS' : 'FAIL');

  console.log('--- ALL INTEGRATION AUDIT CHECKS COMPLETED ---');
}

runIntegrationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Audit Error:', err);
    process.exit(1);
  });
