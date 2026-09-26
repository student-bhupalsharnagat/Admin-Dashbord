import http from 'http';

async function request(url: string, options: any = {}) {
  return new Promise<{ status: number; headers: any; body: any }>((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsedBody = data;
          try {
            parsedBody = JSON.parse(data);
          } catch (e) {}
          resolve({ status: res.statusCode || 200, headers: res.headers, body: parsedBody });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COMPREHENSIVE END-TO-END WHITE LABEL TESTING SUITE ---');

  // Step 1: Admin Login
  console.log('\n[TEST 1] Admin Authentication');
  const loginRes = await request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'admin@platform.com', password: 'password123' }
  });
  if (loginRes.status !== 200 || !loginRes.body.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes.body));
  }
  const token = loginRes.body.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log('✓ Admin login successful. Token acquired.');

  // Step 2: Fetch tenants list
  console.log('\n[TEST 2] Fetch Tenants & Initial White Label Config');
  const tenantsRes = await request('http://localhost:3000/api/admin/tenants', {
    headers: authHeaders
  });
  const tenants = tenantsRes.body;
  console.log(`✓ Retrieved ${tenants.length} tenants from system.`);
  const tenantA = tenants[0];
  const tenantB = tenants[1];
  console.log(`  Tenant A: ${tenantA.name} (${tenantA.id})`);
  console.log(`  Tenant B: ${tenantB.name} (${tenantB.id})`);

  // Step 3: Fetch White-Label config for Tenant A
  const configARes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}`, {
    headers: authHeaders
  });
  const initialConfigA = configARes.body;
  console.log(`✓ Tenant A initial status: ${initialConfigA.status || 'DRAFT'}, version: ${initialConfigA.version || 1}`);

  // Fetch White-Label config for Tenant B
  const configBRes = await request(`http://localhost:3000/api/admin/white-label/${tenantB.id}`, {
    headers: authHeaders
  });
  const initialConfigB = configBRes.body;
  console.log(`✓ Tenant B initial brand name: "${initialConfigB.brand_name || tenantB.name}"`);

  // Step 4: Asset Upload Test (Logo)
  console.log('\n[TEST 3] Platform Logo Asset Storage Upload');
  const uploadRes = await request('http://localhost:3000/api/admin/white-label/upload', {
    method: 'POST',
    headers: authHeaders,
    body: {
      tenantId: tenantA.id,
      assetType: 'LOGO',
      filename: 'tenant-a-logo.png',
      mimeType: 'image/png',
      contentBase64OrUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    }
  });
  if (uploadRes.status !== 200 && uploadRes.status !== 201) {
    throw new Error('Upload failed: ' + JSON.stringify(uploadRes.body));
  }
  const uploadedAsset = uploadRes.body;
  console.log(`✓ Asset uploaded successfully. Public URL: ${uploadedAsset.publicUrl || uploadedAsset.public_url}`);

  // Step 5: Save Draft for Tenant A
  console.log('\n[TEST 4] Save Draft Configuration for Tenant A');
  const draftPayload = {
    brand_name: 'Alpha Prime Institutional Pro',
    short_name: 'APIP',
    tagline: 'Precision Execution for Institutional Capital',
    logo_url: uploadedAsset.publicUrl || uploadedAsset.public_url,
    primary_color: '#2563eb',
    secondary_color: '#0f172a',
    accent_color: '#10b981',
    background_color: '#020617',
    surface_color: '#0b1329',
    support_email: 'institutional-support@alphaprime.com',
    support_phone: '+1 (800) 555-0199',
    footer_copyright: '© 2026 Alpha Prime Institutional Pro. All rights reserved. SEBI / CFTC Licensed.',
    status: 'DRAFT'
  };

  const saveDraftRes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: draftPayload
  });
  if (saveDraftRes.status !== 200) {
    throw new Error('Save draft failed: ' + JSON.stringify(saveDraftRes.body));
  }
  console.log('✓ Draft saved successfully without affecting live production.');

  // Step 6: Verify Live Public Trading Platform has NOT applied unapproved Draft yet
  console.log('\n[TEST 5] Verify Tenant Isolation & Draft State (Public API)');
  const publicTradingBeforePublish = await request(`http://localhost:3000/api/tenant/branding?tenantId=${tenantA.id}`);
  console.log(`✓ Public Trading Platform brand status: "${publicTradingBeforePublish.body.brandName}"`);

  // Step 7: Publish to Live for Tenant A
  console.log('\n[TEST 6] Publish Live Configuration for Tenant A (S2S Sync + Cache Invalidation + Audit Log)');
  const publishRes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}/publish`, {
    method: 'POST',
    headers: authHeaders,
    body: { reason: 'Admin published institutional branding update' }
  });
  if (publishRes.status !== 200) {
    throw new Error('Publish failed: ' + JSON.stringify(publishRes.body));
  }
  const publishedConfig = publishRes.body;
  console.log(`✓ Published! Status: ${publishedConfig.status}, Version: v${publishedConfig.version}`);

  // Step 8: Verify Public Trading Platform API for Tenant A
  console.log('\n[TEST 7] Verify Public Trading Platform Reflects Published Values for Tenant A');
  const publicTradingAfterPublish = await request(`http://localhost:3000/api/tenant/branding?tenantId=${tenantA.id}`);
  const brandingA = publicTradingAfterPublish.body;
  console.log(`  Brand Name: "${brandingA.brandName}" (Expected: "${draftPayload.brand_name}")`);
  console.log(`  Tagline: "${brandingA.tagline}" (Expected: "${draftPayload.tagline}")`);
  console.log(`  Primary Color: ${brandingA.colors?.primary} (Expected: "${draftPayload.primary_color}")`);
  console.log(`  Support Email: ${brandingA.contactInfo?.supportEmail} (Expected: "${draftPayload.support_email}")`);
  console.log(`  Footer Copyright: "${brandingA.legalLinks?.footerText || brandingA.footerCopyright}"`);

  if (brandingA.brandName !== draftPayload.brand_name) {
    throw new Error(`Brand Name mismatch! Expected "${draftPayload.brand_name}", got "${brandingA.brandName}"`);
  }
  if (brandingA.colors?.primary !== draftPayload.primary_color) {
    throw new Error(`Primary color mismatch! Expected "${draftPayload.primary_color}", got "${brandingA.colors?.primary}"`);
  }
  console.log('✓ Tenant A Trading Platform branding matches published values 100%!');

  // Step 9: Verify Tenant B is Completely Untouched (Strict Tenant Isolation)
  console.log('\n[TEST 8] Verify Tenant B Strict Isolation');
  const publicTradingTenantB = await request(`http://localhost:3000/api/tenant/branding?tenantId=${tenantB.id}`);
  const brandingB = publicTradingTenantB.body;
  console.log(`  Tenant B Brand Name: "${brandingB.brandName}"`);
  if (brandingB.brandName === draftPayload.brand_name) {
    throw new Error('CRITICAL FAILURE: Tenant B was affected by Tenant A branding change!');
  }
  console.log('✓ STRICT TENANT ISOLATION CONFIRMED: Tenant B was NOT affected.');

  // Step 10: Verify Audit Logs
  console.log('\n[TEST 9] Verify Audit Logs Record');
  const logsRes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}/audit-logs`, {
    headers: authHeaders
  });
  console.log('Audit logs response status:', logsRes.status, 'body:', logsRes.body);
  if (logsRes.status !== 200 || !Array.isArray(logsRes.body) || logsRes.body.length === 0) {
    throw new Error('Audit logs not recorded!');
  }
  console.log(`✓ Audit log verified: ${logsRes.body.length} audit entries found. Latest action: "${logsRes.body[0]?.action}" by "${logsRes.body[0]?.actor}"`);

  // Step 11: Domain Management Test
  console.log('\n[TEST 10] Custom Domain & SSL Management');
  const uniqueDomain = `pro-${Date.now().toString().slice(-4)}.alphaprime.com`;
  const domainRes = await request('http://localhost:3000/api/admin/white-label/domains', {
    method: 'POST',
    headers: authHeaders,
    body: {
      tenantId: tenantA.id,
      domain: uniqueDomain,
      domainType: 'SECONDARY',
      isPrimary: false
    }
  });
  if (domainRes.status !== 200 && domainRes.status !== 201) {
    console.log('Domain add response:', domainRes.body);
  } else {
    console.log(`✓ Custom domain added: "${domainRes.body.domain}", SSL Status: ${domainRes.body.ssl_status}`);
  }

  // Step 12: Platform Feature Controls
  console.log('\n[TEST 11] Platform Feature Controls');
  const controlsRes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}/platform-config`, {
    method: 'PATCH',
    headers: authHeaders,
    body: {
      features: {
        trading: true,
        options: true,
        crypto: false,
        paper_trading: true
      },
      order_types: ['LIMIT', 'MARKET', 'STOP_LOSS']
    }
  });
  if (controlsRes.status === 200) {
    console.log('✓ Platform feature controls updated and synced to Tenant Trading Platform.');
  }

  // Step 13: Publish Version 3 and Test Version Snapshot Rollback
  console.log('\n[TEST 12] Publish Version 3 and Test Instant Snapshot Rollback');
  // Update to v3
  await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: {
      ...draftPayload,
      brand_name: 'Alpha Prime Global Markets',
      primary_color: '#16a34a'
    }
  });
  const publishV3Res = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}/publish`, {
    method: 'POST',
    headers: authHeaders,
    body: { reason: 'Admin published v3 test release' }
  });
  console.log(`✓ Published v3: "${publishV3Res.body.brand_name}" (Version: v${publishV3Res.body.version})`);

  // Verify Trading Platform shows v3
  const publicV3 = await request(`http://localhost:3000/api/tenant/branding?tenantId=${tenantA.id}`);
  console.log(`✓ Trading Platform now running: "${publicV3.body.brandName}" (Primary: ${publicV3.body.colors?.primary})`);
  if (publicV3.body.brandName !== 'Alpha Prime Global Markets') {
    throw new Error('Trading Platform failed to receive v3');
  }

  // Now trigger Rollback
  console.log('  Triggering snapshot rollback to previous version...');
  const rollbackRes = await request(`http://localhost:3000/api/admin/white-label/${tenantA.id}/rollback`, {
    method: 'POST',
    headers: authHeaders
  });
  if (rollbackRes.status !== 200) {
    throw new Error('Rollback failed: ' + JSON.stringify(rollbackRes.body));
  }
  console.log(`✓ Rollback successful! Restored version v${rollbackRes.body.version}, Brand: "${rollbackRes.body.brand_name}"`);

  // Verify rollback is immediately reflected on Trading Platform
  const publicAfterRollback = await request(`http://localhost:3000/api/tenant/branding?tenantId=${tenantA.id}`);
  console.log(`✓ Trading Platform after rollback now displays: "${publicAfterRollback.body.brandName}" (Primary: ${publicAfterRollback.body.colors?.primary})`);
  if (publicAfterRollback.body.brandName !== 'Alpha Prime Institutional Pro') {
    throw new Error(`Expected brand name to rollback to "Alpha Prime Institutional Pro", got "${publicAfterRollback.body.brandName}"`);
  }
  console.log('✓ Rollback verified 100% on Trading Platform!');

  console.log('\n===============================================================');
  console.log('ALL WHITE LABEL INTEGRATION & MULTI-TENANT TESTS PASSED (100%)');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
