import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';

async function main() {
  console.log('Testing tradingPlatformClient.syncWhiteLabel against live Trading Platform...');
  const res = await tradingPlatformClient.syncWhiteLabel('vertex-default', {
    brand_name: 'ABTS',
    short_name: 'ABTS',
    tagline: 'Next-Gen Multi-Asset Institutional Execution',
    logo_url: '/api/assets/ast-1791050352711-gzb2y',
    primary_color: '#3b82f6',
    secondary_color: '#0f172a',
    accent_color: '#10b981',
    background_color: '#080d1a',
    surface_color: '#0d1528',
    support_email: 'support@tradematrix.io.com',
    support_phone: '9343624322',
    footer_text: '© 2026 Alpha Prime Capital. All rights reserved.'
  }, 4);

  console.log('Success:', res.success);
  console.log('HTTP Status Code:', res.statusCode);
  console.log('Response Data:', JSON.stringify(res.data, null, 2));

  if (!res.success) {
    console.error('Error details:', res.error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
