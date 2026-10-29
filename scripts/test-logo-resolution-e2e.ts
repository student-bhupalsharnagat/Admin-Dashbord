import { tradingPlatformClient } from '../server/services/TradingPlatformClient.ts';
import { assetStorage } from '../server/providers/AssetStorageProvider.ts';

async function testLogoResolution() {
  console.log('--- Step 1: Testing AssetStorageProvider uploadAsset ---');
  const sampleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32"><rect width="120" height="32" rx="6" fill="#3b82f6"/><text x="60" y="21" fill="#fff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">NEXTRADE</text></svg>';
  const sampleDataUri = `data:image/svg+xml;base64,${Buffer.from(sampleSvg).toString('base64')}`;

  const storedAsset = await assetStorage.uploadAsset(
    'TNT-001',
    'logo',
    'nextrade_logo.svg',
    'image/svg+xml',
    sampleDataUri
  );

  console.log('Stored Asset ID:', storedAsset.id);
  console.log('Stored Asset public_url:', storedAsset.public_url.substring(0, 40) + '...');
  if (!storedAsset.public_url.startsWith('data:')) {
    throw new Error('Expected uploadAsset to preserve portable data URI');
  }

  console.log('\n--- Step 2: Testing syncWhiteLabel with relative /api/assets/ path ---');
  // Pass relative /api/assets/:id to verify that syncWhiteLabel resolves it to a self-contained Data URI
  const relativeAssetPath = `/api/assets/${storedAsset.id}`;
  const s2sRes = await tradingPlatformClient.syncWhiteLabel('vertex-default', {
    brand_name: 'NEXTRADE PRIME',
    short_name: 'NXTR',
    tagline: 'Institutional Precision Execution',
    logo_url: relativeAssetPath,
    primary_color: '#2563eb',
    secondary_color: '#0f172a',
    accent_color: '#10b981',
    background_color: '#080d1a',
    surface_color: '#0d1528',
    support_email: 'support@nextrade.io',
    support_phone: '+1 800 555 0199',
    footer_text: '© 2026 Nextrade Prime Execution.'
  }, 100);

  console.log('S2S sync success:', s2sRes.success, 'Status:', s2sRes.statusCode);
  if (!s2sRes.success) {
    throw new Error(`S2S sync failed: ${s2sRes.error}`);
  }

  console.log('\n--- Step 3: Verifying live Trading Platform branding ---');
  const tpRes = await fetch('https://trading-platform-2t6r.onrender.com/api/tenant/current');
  const tpJson = await tpRes.json();
  const liveBranding = tpJson.data?.branding;

  console.log('Live TP Brand Name:', liveBranding?.brandName);
  console.log('Live TP Logo URL type:', liveBranding?.logoUrl?.startsWith('data:') ? 'Self-Contained Data URI (Success)' : liveBranding?.logoUrl);

  if (!liveBranding?.logoUrl) {
    throw new Error('Trading Platform has no logoUrl in branding!');
  }

  if (liveBranding.logoUrl.startsWith('/api/assets/')) {
    throw new Error('Regression: logoUrl is still a relative path that 404s on the Trading Platform!');
  }

  console.log('\nAll logo resolution & synchronization checks PASSED successfully!');
}

testLogoResolution().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
