import pg from 'pg';
import { getPool, withTransaction } from './connection.ts';

export async function seedDatabase(customPool?: pg.Pool): Promise<void> {
  console.log('[Seed Runner] Seeding development dataset into PostgreSQL...');

  await withTransaction(async (client) => {
    // --------------------------------------------------------------------
    // 1. TENANTS & BRANDING & PLATFORM SETTINGS
    // --------------------------------------------------------------------
    const tenants = [
      {
        id: 'TNT-001',
        name: 'Alpha Prime Capital',
        code: 'ALPHA',
        subdomain: 'alphaprime',
        custom_domain: 'trade.alphaprime.com',
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        owner_name: 'Aditya Birla',
        owner_email: 'aditya@alphaprime.com',
        region: 'ap-south-1',
        user_count: 1420,
        max_users: 10000,
        monthly_volume: '₹142.8M',
        monthly_revenue: '₹1.84M'
      },
      {
        id: 'TNT-002',
        name: 'Horizon Securities',
        code: 'HORIZON',
        subdomain: 'horizonsec',
        custom_domain: 'portal.horizonsec.in',
        plan: 'PRO',
        status: 'ACTIVE',
        owner_name: 'Kavita Menon',
        owner_email: 'kavita@horizonsec.in',
        region: 'ap-south-1',
        user_count: 850,
        max_users: 5000,
        monthly_volume: '₹78.4M',
        monthly_revenue: '₹950K'
      },
      {
        id: 'TNT-003',
        name: 'Apex Capital Markets',
        code: 'APEX',
        subdomain: 'apexcap',
        custom_domain: 'trading.apexcap.io',
        plan: 'STARTER',
        status: 'ACTIVE',
        owner_name: 'Farhan Akhtar',
        owner_email: 'farhan@apexcap.io',
        region: 'ap-south-1',
        user_count: 320,
        max_users: 2000,
        monthly_volume: '₹28.2M',
        monthly_revenue: '₹340K'
      }
    ];

    for (const t of tenants) {
      await client.query(`
        INSERT INTO tenants (
          id, name, code, subdomain, custom_domain, plan, status,
          owner_name, owner_email, region, user_count, max_users,
          monthly_volume, monthly_revenue
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          plan = EXCLUDED.plan,
          status = EXCLUDED.status,
          user_count = EXCLUDED.user_count,
          monthly_volume = EXCLUDED.monthly_volume,
          monthly_revenue = EXCLUDED.monthly_revenue,
          updated_at = CURRENT_TIMESTAMP
      `, [
        t.id, t.name, t.code, t.subdomain, t.custom_domain, t.plan, t.status,
        t.owner_name, t.owner_email, t.region, t.user_count, t.max_users,
        t.monthly_volume, t.monthly_revenue
      ]);

      // Tenant Branding
      await client.query(`
        INSERT INTO tenant_branding (
          id, tenant_id, company_name, portal_name, tagline, logo_url, favicon_url, primary_color, accent_color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id) DO UPDATE SET
          company_name = EXCLUDED.company_name,
          portal_name = EXCLUDED.portal_name,
          updated_at = CURRENT_TIMESTAMP
      `, [
        `BRD-${t.id}`, t.id, t.name, `${t.name} Admin`, 'Next-Gen Multi-Asset Institutional Execution',
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=128&q=80',
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=32&q=80',
        '#3b82f6', '#10b981'
      ]);

      // Platform Settings
      await client.query(`
        INSERT INTO platform_settings (
          id, tenant_id, web_trading_enabled, web_version, web_maintenance_mode,
          mobile_android_enabled, mobile_android_version, mobile_ios_enabled, mobile_ios_version,
          api_enabled, api_rate_limit, ip_whitelist_enabled, allowed_ips
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tenant_id) DO UPDATE SET
          web_version = EXCLUDED.web_version,
          updated_at = CURRENT_TIMESTAMP
      `, [
        `SET-${t.id}`, t.id, true, 'v4.8.2-stable', false,
        true, 'v2.14.0', true, 'v2.14.0',
        true, 120, false, []
      ]);
    }

    // --------------------------------------------------------------------
    // 2. HIERARCHY: MASTERS -> BROKERS -> SUB-BROKERS -> CLIENTS
    // --------------------------------------------------------------------
    const masters = [
      { id: 'MST-001', tenant_id: 'TNT-001', name: 'Rohan Deshmukh', company: 'Deshmukh Securities Ltd', code: 'MST-1', email: 'rohan@deshmukhsec.in', phone: '+91 98201 11223', status: 'ACTIVE', brokers_count: 14, clients_count: 420, turnover: '₹84.2M', commission: '₹740K' },
      { id: 'MST-002', tenant_id: 'TNT-001', name: 'Vikram Singhania', company: 'Singhania Wealth LLP', code: 'MST-2', email: 'vikram@singhaniawealth.com', phone: '+91 98202 22334', status: 'ACTIVE', brokers_count: 8, clients_count: 260, turnover: '₹42.6M', commission: '₹390K' },
      { id: 'MST-003', tenant_id: 'TNT-002', name: 'Arvind Mehta', company: 'Mehta Equities & Advisory', code: 'MST-3', email: 'arvind@mehtaequities.com', phone: '+91 98203 33445', status: 'ACTIVE', brokers_count: 11, clients_count: 310, turnover: '₹55.1M', commission: '₹480K' }
    ];

    for (const m of masters) {
      await client.query(`
        INSERT INTO masters (
          id, tenant_id, name, company, code, email, phone, status,
          brokers_count, clients_count, turnover, commission
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          company = EXCLUDED.company,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        m.id, m.tenant_id, m.name, m.company, m.code, m.email, m.phone, m.status,
        m.brokers_count, m.clients_count, m.turnover, m.commission
      ]);
    }

    const brokers = [
      { id: 'BRK-001', tenant_id: 'TNT-001', master_id: 'MST-001', master_name: 'Rohan Deshmukh', name: 'Vikas Shah', company: 'Shah Financial Services', code: 'BRK-101', email: 'vikas@shahfin.in', phone: '+91 98301 44556', status: 'ACTIVE', sub_brokers_count: 5, clients_count: 180, turnover: '₹34.5M', commission: '₹310K' },
      { id: 'BRK-002', tenant_id: 'TNT-001', master_id: 'MST-001', master_name: 'Rohan Deshmukh', name: 'Priya Nair', company: 'Nair Equities', code: 'BRK-102', email: 'priya@nairequities.com', phone: '+91 98302 55667', status: 'ACTIVE', sub_brokers_count: 4, clients_count: 140, turnover: '₹28.2M', commission: '₹250K' },
      { id: 'BRK-003', tenant_id: 'TNT-002', master_id: 'MST-003', master_name: 'Arvind Mehta', name: 'Rajesh Khanna', company: 'Khanna Brokerage', code: 'BRK-201', email: 'rajesh@khannabroker.com', phone: '+91 98303 66778', status: 'ACTIVE', sub_brokers_count: 6, clients_count: 195, turnover: '₹38.4M', commission: '₹340K' }
    ];

    for (const b of brokers) {
      await client.query(`
        INSERT INTO brokers (
          id, tenant_id, master_id, master_name, name, company, code, email, phone, status,
          sub_brokers_count, clients_count, turnover, commission
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        b.id, b.tenant_id, b.master_id, b.master_name, b.name, b.company, b.code, b.email, b.phone, b.status,
        b.sub_brokers_count, b.clients_count, b.turnover, b.commission
      ]);
    }

    const subBrokers = [
      { id: 'SBRK-001', tenant_id: 'TNT-001', broker_id: 'BRK-001', broker_name: 'Vikas Shah', name: 'Kunal Verma', code: 'SBRK-1011', email: 'kunal@vermatrading.com', phone: '+91 98401 77889', status: 'ACTIVE', clients_count: 45, turnover: '₹12.4M', commission: '₹110K' },
      { id: 'SBRK-002', tenant_id: 'TNT-001', broker_id: 'BRK-002', broker_name: 'Priya Nair', name: 'Deepak Joshi', code: 'SBRK-1021', email: 'deepak@joshifin.in', phone: '+91 98402 88990', status: 'ACTIVE', clients_count: 38, turnover: '₹9.8M', commission: '₹88K' },
      { id: 'SBRK-003', tenant_id: 'TNT-002', broker_id: 'BRK-003', broker_name: 'Rajesh Khanna', name: 'Sneha Reddy', code: 'SBRK-2011', email: 'sneha@reddywealth.in', phone: '+91 98403 99001', status: 'ACTIVE', clients_count: 52, turnover: '₹15.2M', commission: '₹135K' }
    ];

    for (const sb of subBrokers) {
      await client.query(`
        INSERT INTO sub_brokers (
          id, tenant_id, broker_id, broker_name, name, code, email, phone, status,
          clients_count, turnover, commission
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        sb.id, sb.tenant_id, sb.broker_id, sb.broker_name, sb.name, sb.code, sb.email, sb.phone, sb.status,
        sb.clients_count, sb.turnover, sb.commission
      ]);
    }

    const clients = [
      { id: 'CLT-001', tenant_id: 'TNT-001', sub_broker_id: 'SBRK-001', sub_broker_name: 'Kunal Verma', client_code: 'CLT001', name: 'Arjun Patel', email: 'arjun.patel@gmail.com', phone: '+91 98111 22334', status: 'ACTIVE', kyc_status: 'VERIFIED', balance: 145000.00, equity: 178200.00, margin_used: 32000.00, total_trades: 48 },
      { id: 'CLT-002', tenant_id: 'TNT-001', sub_broker_id: 'SBRK-001', sub_broker_name: 'Kunal Verma', client_code: 'CLT002', name: 'Neha Sharma', email: 'neha.sharma@yahoo.com', phone: '+91 98112 33445', status: 'ACTIVE', kyc_status: 'VERIFIED', balance: 88500.00, equity: 92400.00, margin_used: 18000.00, total_trades: 24 },
      { id: 'CLT-003', tenant_id: 'TNT-001', sub_broker_id: 'SBRK-002', sub_broker_name: 'Deepak Joshi', client_code: 'CLT003', name: 'Suresh Pillai', email: 'suresh.pillai@outlook.com', phone: '+91 98113 44556', status: 'ACTIVE', kyc_status: 'PENDING', balance: 210000.00, equity: 210000.00, margin_used: 0.00, total_trades: 0 },
      { id: 'CLT-004', tenant_id: 'TNT-002', sub_broker_id: 'SBRK-003', sub_broker_name: 'Sneha Reddy', client_code: 'CLT004', name: 'Pooja Nair', email: 'pooja.nair@gmail.com', phone: '+91 98114 55667', status: 'ACTIVE', kyc_status: 'VERIFIED', balance: 320000.00, equity: 345000.00, margin_used: 65000.00, total_trades: 62 }
    ];

    for (const c of clients) {
      await client.query(`
        INSERT INTO clients (
          id, tenant_id, sub_broker_id, sub_broker_name, client_code, name, email, phone,
          status, kyc_status, balance, equity, margin_used, total_trades
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          kyc_status = EXCLUDED.kyc_status,
          balance = EXCLUDED.balance,
          updated_at = CURRENT_TIMESTAMP
      `, [
        c.id, c.tenant_id, c.sub_broker_id, c.sub_broker_name, c.client_code, c.name, c.email, c.phone,
        c.status, c.kyc_status, c.balance, c.equity, c.margin_used, c.total_trades
      ]);
    }

    // --------------------------------------------------------------------
    // 3. KYC RECORDS
    // --------------------------------------------------------------------
    const kycRecords = [
      { id: 'KYC-001', tenant_id: 'TNT-001', client_id: 'CLT-001', client_code: 'CLT001', client_name: 'Arjun Patel', email: 'arjun.patel@gmail.com', phone: '+91 98111 22334', pan_number: 'ABCDE1234F', aadhaar_number: 'XXXX-XXXX-9012', kyc_status: 'APPROVED', reviewed_by: 'Super Admin' },
      { id: 'KYC-002', tenant_id: 'TNT-001', client_id: 'CLT-002', client_code: 'CLT002', client_name: 'Neha Sharma', email: 'neha.sharma@yahoo.com', phone: '+91 98112 33445', pan_number: 'PQRS5678T', aadhaar_number: 'XXXX-XXXX-4567', kyc_status: 'APPROVED', reviewed_by: 'Super Admin' },
      { id: 'KYC-003', tenant_id: 'TNT-001', client_id: 'CLT-003', client_code: 'CLT003', client_name: 'Suresh Pillai', email: 'suresh.pillai@outlook.com', phone: '+91 98113 44556', pan_number: 'XYZW9876K', aadhaar_number: 'XXXX-XXXX-8901', kyc_status: 'PENDING', reviewed_by: null }
    ];

    for (const k of kycRecords) {
      await client.query(`
        INSERT INTO kyc_records (
          id, tenant_id, client_id, client_code, client_name, email, phone,
          pan_number, aadhaar_number, kyc_status, reviewed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          kyc_status = EXCLUDED.kyc_status,
          reviewed_by = EXCLUDED.reviewed_by,
          updated_at = CURRENT_TIMESTAMP
      `, [
        k.id, k.tenant_id, k.client_id, k.client_code, k.client_name, k.email, k.phone,
        k.pan_number, k.aadhaar_number, k.kyc_status, k.reviewed_by
      ]);
    }

    // --------------------------------------------------------------------
    // 4. SAMPLE ORDERS & TRADES
    // --------------------------------------------------------------------
    const orders = [
      { id: 'ORD-001', tenant_id: 'TNT-001', client_id: 'CLT-001', client_code: 'CLT001', client_name: 'Arjun Patel', symbol: 'RELIANCE', exchange: 'NSE', order_type: 'LIMIT', side: 'BUY', quantity: 50, price: 2940.50, status: 'PENDING' },
      { id: 'ORD-002', tenant_id: 'TNT-001', client_id: 'CLT-001', client_code: 'CLT001', client_name: 'Arjun Patel', symbol: 'TCS', exchange: 'NSE', order_type: 'LIMIT', side: 'BUY', quantity: 20, price: 3850.00, status: 'EXECUTED' },
      { id: 'ORD-003', tenant_id: 'TNT-001', client_id: 'CLT-002', client_code: 'CLT002', client_name: 'Neha Sharma', symbol: 'HDFCBANK', exchange: 'NSE', order_type: 'LIMIT', side: 'SELL', quantity: 40, price: 1680.00, status: 'EXECUTED' }
    ];

    for (const o of orders) {
      await client.query(`
        INSERT INTO orders (
          id, tenant_id, client_id, client_code, client_name, symbol, exchange,
          order_type, side, quantity, price, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
      `, [
        o.id, o.tenant_id, o.client_id, o.client_code, o.client_name, o.symbol, o.exchange,
        o.order_type, o.side, o.quantity, o.price, o.status
      ]);
    }

    const trades = [
      { id: 'tr-001', tenant_id: 'TNT-001', trade_id: 'TRD001', client_id: 'CLT-001', client_name: 'Arjun Patel', symbol: 'TCS', exchange: 'NSE', side: 'BUY', quantity: 20, price: 3850.00, total_value: 77000.00, status: 'EXECUTED', timestamp: '2026-03-29 10:14:22' },
      { id: 'tr-002', tenant_id: 'TNT-001', trade_id: 'TRD002', client_id: 'CLT-002', client_name: 'Neha Sharma', symbol: 'HDFCBANK', exchange: 'NSE', side: 'SELL', quantity: 40, price: 1680.00, total_value: 67200.00, status: 'EXECUTED', timestamp: '2026-03-29 11:25:40' },
      { id: 'tr-003', tenant_id: 'TNT-002', trade_id: 'TRD003', client_id: 'CLT-004', client_name: 'Pooja Nair', symbol: 'INFY', exchange: 'NSE', side: 'BUY', quantity: 100, price: 1540.00, total_value: 154000.00, status: 'EXECUTED', timestamp: '2026-03-29 12:45:10' }
    ];

    for (const tr of trades) {
      await client.query(`
        INSERT INTO trades (
          id, tenant_id, trade_id, client_id, client_name, symbol, exchange,
          side, quantity, price, total_value, status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING
      `, [
        tr.id, tr.tenant_id, tr.trade_id, tr.client_id, tr.client_name, tr.symbol, tr.exchange,
        tr.side, tr.quantity, tr.price, tr.total_value, tr.status, tr.timestamp
      ]);
    }

    // --------------------------------------------------------------------
    // 5. IMMUTABLE LEDGER ENTRIES
    // --------------------------------------------------------------------
    const ledgerEntries = [
      { id: 'LDG-001', tenant_id: 'TNT-001', client_id: 'CLT-001', client_code: 'CLT001', client_name: 'Arjun Patel', entry_type: 'DEPOSIT', debit: 0.00, credit: 200000.00, balance_after: 200000.00, reference_id: 'DEP-UPI-98214', description: 'Instant UPI Bank Deposit', is_finalized: true },
      { id: 'LDG-002', tenant_id: 'TNT-001', client_id: 'CLT-001', client_code: 'CLT001', client_name: 'Arjun Patel', entry_type: 'TRADE_BUY', debit: 77000.00, credit: 0.00, balance_after: 123000.00, reference_id: 'TRD001', description: 'Bought 20 qty TCS @ ₹3850.00', is_finalized: true },
      { id: 'LDG-003', tenant_id: 'TNT-001', client_id: 'CLT-002', client_code: 'CLT002', client_name: 'Neha Sharma', entry_type: 'DEPOSIT', debit: 0.00, credit: 100000.00, balance_after: 100000.00, reference_id: 'DEP-IMPS-44312', description: 'IMPS Bank Transfer Deposit', is_finalized: true }
    ];

    for (const le of ledgerEntries) {
      await client.query(`
        INSERT INTO ledger_entries (
          id, tenant_id, client_id, client_code, client_name, entry_type,
          debit, credit, balance_after, reference_id, description, is_finalized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        le.id, le.tenant_id, le.client_id, le.client_code, le.client_name, le.entry_type,
        le.debit, le.credit, le.balance_after, le.reference_id, le.description, le.is_finalized
      ]);
    }

    // --------------------------------------------------------------------
    // 6. EMERGENCY CONTROLS
    // --------------------------------------------------------------------
    await client.query(`
      INSERT INTO emergency_controls (
        id, tenant_id, global_trading_active, global_kill_switch_active,
        new_user_creation_enabled, api_access_enabled, trading_reason,
        frozen_masters, frozen_brokers, frozen_users
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO NOTHING
    `, [
      'EMG-GLOBAL', null, true, false, true, true, 'Normal Market Operations',
      JSON.stringify([]), JSON.stringify([]), JSON.stringify([])
    ]);

    // --------------------------------------------------------------------
    // 7. AUDIT LOGS
    // --------------------------------------------------------------------
    const auditLogs = [
      { id: 'LOG-001', tenant_id: 'TNT-001', user_name: 'Super Admin', action: 'DATABASE_SEED_COMPLETED', module: 'SYSTEM', details: 'PostgreSQL development seed data successfully initialized', ip_address: '127.0.0.1' },
      { id: 'LOG-002', tenant_id: 'TNT-001', user_name: 'Aditya Birla', action: 'TENANT_PROVISIONED', module: 'TENANTS', details: 'Tenant Alpha Prime Capital configured with Enterprise limits', ip_address: '103.21.58.12' },
      { id: 'LOG-003', tenant_id: 'TNT-001', user_name: 'Super Admin', action: 'HIERARCHY_INITIALIZED', module: 'HIERARCHY', details: 'Root master Rohan Deshmukh mapped to Alpha Prime Capital', ip_address: '127.0.0.1' }
    ];

    for (const al of auditLogs) {
      await client.query(`
        INSERT INTO audit_logs (
          id, tenant_id, user_name, action, module, details, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        al.id, al.tenant_id, al.user_name, al.action, al.module, al.details, al.ip_address
      ]);
    }
  }, customPool);

  const { seedAuthAndRbac } = await import('./seedAuthUsers.ts');
  await seedAuthAndRbac(true);

  console.log('[Seed Runner] PostgreSQL development seed dataset successfully seeded.');
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      console.log('[Seed Runner] Completed.');
      const { closePool } = await import('./connection.ts');
      await closePool();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Runner] Fatal error:', err);
      process.exit(1);
    });
}
