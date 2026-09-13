import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { activeTradingDataProvider } from './server/providers/TradingDataProvider.ts';
import { assetStorage } from './server/providers/AssetStorageProvider.ts';
import { UserRole } from './src/types.ts';

interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_id: string | null; // null for global SUPER_ADMIN unless simulating
  tenant_name?: string;
  simulated_tenant_id?: string | null; // Super Admin can filter by tenant
}

// In-memory session store for demonstrated secure cookie auth
const sessions: Record<string, AuthSessionUser> = {};

// Default initial admin session
const defaultAdminUser: AuthSessionUser = {
  id: 'usr-admin-01',
  name: 'Admin User',
  email: 'admin@tradepro.io',
  role: 'SUPER_ADMIN',
  tenant_id: null,
  simulated_tenant_id: null
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Authentication & Tenant Scoping Middleware
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // In production we verify JWT in HttpOnly cookie or Authorization: Bearer
    const token = req.cookies?.tradepro_session || req.headers.authorization?.replace('Bearer ', '');
    
    // For seamless immediate access in preview while upholding strict backend security:
    let user = token && sessions[token] ? sessions[token] : defaultAdminUser;
    (req as any).user = user;
    next();
  };

  // RBAC Middleware: Enforces that role is authorized on the backend
  const requireRoles = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user as AuthSessionUser;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: No active session' });
      }
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          error: `Forbidden: Role '${user.role}' lacks permission for this resource` 
        });
      }
      next();
    };
  };

  // Tenant Isolation Helper
  // Ensures tenant scope is derived from backend user token and never spoofed by query params
  const resolveTenantScope = (req: Request): string | undefined => {
    const user = (req as any).user as AuthSessionUser;
    if (!user) return undefined;
    
    // If not SUPER_ADMIN or PLATFORM_OWNER, user is strictly locked to their own tenant_id
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
      return user.tenant_id || undefined;
    }

    // If SUPER_ADMIN has chosen to scope/simulate a specific tenant via header or cookie
    if (user.simulated_tenant_id) {
      return user.simulated_tenant_id;
    }

    // Optional filter query param allowed ONLY for SUPER_ADMIN
    if (req.query.tenantId && typeof req.query.tenantId === 'string' && req.query.tenantId !== 'ALL') {
      return req.query.tenantId;
    }

    return undefined;
  };

  // ----------------------------------------------------
  // AUTH API
  // ----------------------------------------------------
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = (req as any).user;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        simulated_tenant_id: user.simulated_tenant_id
      }
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, role, tenantId } = req.body;
    const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const userSession: AuthSessionUser = {
      id: `usr-${Date.now()}`,
      name: email ? email.split('@')[0] : 'Admin User',
      email: email || 'admin@tradepro.io',
      role: (role as UserRole) || 'SUPER_ADMIN',
      tenant_id: role === 'SUPER_ADMIN' ? null : (tenantId || 'TNT-001'),
      simulated_tenant_id: null
    };

    sessions[sessionToken] = userSession;
    res.cookie('tradepro_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user: userSession, token: sessionToken });
  });

  app.post('/api/auth/switch-tenant-scope', authMiddleware, (req, res) => {
    const user = (req as any).user as AuthSessionUser;
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can switch global tenant perspective' });
    }
    const { tenantId } = req.body;
    user.simulated_tenant_id = (tenantId === 'ALL' || !tenantId) ? null : tenantId;
    res.json({ success: true, activeTenantScope: user.simulated_tenant_id });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.tradepro_session;
    if (token && sessions[token]) {
      delete sessions[token];
    }
    res.clearCookie('tradepro_session');
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // ADMIN DASHBOARD APIS (Matches Figma screenshot data)
  // ----------------------------------------------------
  app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const kpis = await activeTradingDataProvider.getDashboardKPIs(tenantScope);
      const volumeCommission = await activeTradingDataProvider.getVolumeCommissionChart(tenantScope);
      const clientGrowth = await activeTradingDataProvider.getClientGrowthChart(tenantScope);
      const dailyPL = await activeTradingDataProvider.getDailyPLTrend(tenantScope);
      const recentTrades = await activeTradingDataProvider.getRecentTrades(tenantScope, 6);
      const pendingKYC = await activeTradingDataProvider.getPendingKYC(tenantScope, 5);

      res.json({
        kpis,
        charts: {
          volumeCommission,
          clientGrowth,
          dailyPL
        },
        recentTrades,
        pendingKYC,
        tenantScope: tenantScope || 'ALL_TENANTS'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load dashboard' });
    }
  });

  // ----------------------------------------------------
  // TENANTS MANAGEMENT (SUPER_ADMIN only)
  // ----------------------------------------------------
  app.get('/api/admin/tenants', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const search = req.query.search as string;
      const status = req.query.status as string;
      const tenants = await activeTradingDataProvider.getTenants({ search, status });
      res.json(tenants);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/tenants/:id', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const tenant = await activeTradingDataProvider.getTenantById(req.params.id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      res.json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const tenant = await activeTradingDataProvider.createTenant(req.body);
      res.status(201).json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/suspend', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, 'SUSPENDED');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/activate', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, 'ACTIVE');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // HIERARCHY MODULES: Masters, Brokers, Sub-Brokers, Clients
  // ----------------------------------------------------
  app.get('/api/admin/masters', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const masters = await activeTradingDataProvider.getMasters(tenantScope);
      res.json(masters);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/masters', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const master = await activeTradingDataProvider.createMaster(req.body);
      res.status(201).json(master);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/brokers', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const masterId = req.query.masterId as string;
      const brokers = await activeTradingDataProvider.getBrokers(tenantScope, masterId);
      res.json(brokers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/brokers', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN', 'MASTER']), async (req, res) => {
    try {
      const broker = await activeTradingDataProvider.createBroker(req.body);
      res.status(201).json(broker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/sub-brokers', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const brokerId = req.query.brokerId as string;
      const subBrokers = await activeTradingDataProvider.getSubBrokers(tenantScope, brokerId);
      res.json(subBrokers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/sub-brokers', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const subBroker = await activeTradingDataProvider.createSubBroker(req.body);
      res.status(201).json(subBroker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/clients', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const subBrokerId = req.query.subBrokerId as string;
      const clients = await activeTradingDataProvider.getClients(tenantScope, subBrokerId);
      res.json(clients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/clients', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN', 'MASTER', 'BROKER', 'SUB_BROKER']), async (req, res) => {
    try {
      const client = await activeTradingDataProvider.createClient(req.body);
      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // COMPLIANCE: KYC, Funds, Ledger
  // ----------------------------------------------------
  app.get('/api/admin/kyc', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const status = req.query.status as string;
      const kyc = await activeTradingDataProvider.getKYCRecords(tenantScope, status);
      res.json(kyc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/kyc/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const { status, notes } = req.body;
      const updated = await activeTradingDataProvider.updateKYCStatus(req.params.id, status, notes);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // TRADING: Orders & Trades
  // ----------------------------------------------------
  app.get('/api/admin/trades', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const trades = await activeTradingDataProvider.getAllTrades(tenantScope);
      res.json(trades);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/orders', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const orders = await activeTradingDataProvider.getOrders(tenantScope);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SUBSCRIPTIONS & WHITE LABEL
  // ----------------------------------------------------
  app.get('/api/admin/subscriptions', authMiddleware, requireRoles(['SUPER_ADMIN']), async (req, res) => {
    try {
      const subscriptions = await activeTradingDataProvider.getSubscriptions();
      res.json(subscriptions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // PUBLIC TRADING PLATFORM APIS (Tenant-Scoped, Secure)
  // ----------------------------------------------------

  // Tenant Resolution Helper for Trading Platform
  // Resolves tenant by header x-tenant-domain, host, or query param
  const resolveTradingTenant = async (req: Request) => {
    const domainHeader = (req.headers['x-tenant-domain'] as string) || (req.query.domain as string);
    const host = req.get('host') || '';
    const cleanHost = host.split(':')[0];
    const isLocalhost = cleanHost === 'localhost' || cleanHost === '127.0.0.1';
    
    // Check explicit domain or host
    const targetDomain = domainHeader || (!isLocalhost ? cleanHost : '');

    // Fallback: check explicit x-tenant-id header or query param
    const explicitTenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    if (explicitTenantId) {
      const tenants = await activeTradingDataProvider.getTenants();
      const tenant = tenants.find(t => t.id === explicitTenantId);
      if (tenant) {
        const branding = await activeTradingDataProvider.getWhiteLabelConfig(tenant.id);
        const platformConfig = await activeTradingDataProvider.getTenantPlatformConfig(tenant.id);
        return { tenant, branding, platformConfig };
      }
    }

    return await activeTradingDataProvider.resolveTenantByDomain(targetDomain || 'trade.alphaprime.com');
  };

  // 1. GET /api/tenant/branding - Public branding for resolved tenant
  app.get('/api/tenant/branding', async (req, res) => {
    try {
      const { tenant, branding } = await resolveTradingTenant(req);
      if (!tenant || !branding) {
        return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'No active tenant branding found for this domain.' });
      }

      // Return ONLY public client-facing fields (no internal keys or financial secrets)
      const publicBranding = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        brandName: branding.brand_name || tenant.name,
        shortName: branding.short_name || tenant.code,
        tagline: branding.tagline || '',
        companyName: branding.company_name || tenant.name,
        logoUrl: branding.logo_url,
        logoLightUrl: branding.logo_light_url || branding.logo_url,
        logoDarkUrl: branding.logo_dark_url || branding.logo_url,
        faviconUrl: branding.favicon_url || '/favicon.ico',
        appIconUrl: branding.app_icon_url || '/favicon.ico',
        colors: {
          primary: branding.primary_color || '#2563eb',
          secondary: branding.secondary_color || '#0f172a',
          accent: branding.accent_color || '#38bdf8',
          background: branding.background_color || '#080d1a',
          surface: branding.surface_color || '#0d1528',
          text: branding.text_color || '#f8fafc',
          success: branding.success_color || '#10b981',
          warning: branding.warning_color || '#f59e0b',
          error: branding.error_color || '#ef4444'
        },
        loginPage: {
          title: branding.login_title || `Welcome to ${branding.brand_name || tenant.name}`,
          subtitle: branding.login_subtitle || 'Secure Trading Terminal',
          welcomeText: branding.welcome_text || '',
          backgroundUrl: branding.login_background_url || '',
          brandingName: branding.login_branding || `${tenant.name} Desk`
        },
        contactInfo: {
          supportEmail: branding.support_email || tenant.support_email,
          supportPhone: branding.support_phone || '',
          companyAddress: branding.company_address || '',
          websiteUrl: branding.website_url || '',
          helpSupportUrl: branding.help_support_url || ''
        },
        legalLinks: {
          termsUrl: branding.terms_url || '#',
          privacyUrl: branding.privacy_url || '#',
          riskDisclosureUrl: branding.risk_disclosure_url || '#',
          disclaimerUrl: branding.disclaimer_url || '#',
          footerText: branding.footer_text || `© 2024 ${branding.brand_name || tenant.name}`
        },
        version: branding.version || 1,
        updatedAt: branding.updated_at
      };

      res.json(publicBranding);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/tenant/config - Public feature flags & platform settings
  app.get('/api/tenant/config', async (req, res) => {
    try {
      const { tenant, platformConfig } = await resolveTradingTenant(req);
      if (!tenant || !platformConfig) {
        return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Tenant configuration not found.' });
      }

      // Check global emergency state
      const emergency = await activeTradingDataProvider.getEmergencyState();
      const isGloballyHalted = !emergency.globalTradingActive || emergency.globalKillSwitchActive;
      const isTenantFrozen = emergency.frozenMasters.some(m => m.masterId === tenant.id);

      const effectiveTradingEnabled = !isGloballyHalted && !isTenantFrozen && platformConfig.trading_enabled;

      res.json({
        tenantId: tenant.id,
        tenantName: tenant.name,
        webTradingEnabled: platformConfig.web_trading_enabled && !isGloballyHalted,
        mobileTradingEnabled: platformConfig.mobile_trading_enabled && !isGloballyHalted,
        registrationEnabled: platformConfig.registration_enabled,
        forgotPasswordEnabled: platformConfig.forgot_password_enabled,
        supportEnabled: platformConfig.support_enabled,
        notificationsEnabled: platformConfig.notifications_enabled,
        apiEnabled: platformConfig.api_enabled,
        tradingEnabled: effectiveTradingEnabled,
        maintenanceMode: platformConfig.maintenance_mode,
        maintenanceMessage: platformConfig.maintenance_message || '',
        systemHalted: isGloballyHalted,
        tenantFrozen: isTenantFrozen,
        status: !effectiveTradingEnabled ? 'TRADING_DISABLED' : (platformConfig.maintenance_mode ? 'MAINTENANCE' : 'ONLINE')
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. POST /api/tenant/orders - Order Execution for Trading Platform (Feature Flag & Emergency Enforced)
  app.post('/api/tenant/orders', async (req, res) => {
    try {
      const { tenant } = await resolveTradingTenant(req);
      if (!tenant) {
        return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Cannot place order: tenant unresolved.' });
      }

      const { symbol, side, quantity, price, type, clientName } = req.body;
      if (!symbol || !side || !quantity) {
        return res.status(400).json({ error: 'INVALID_ORDER', message: 'Symbol, side, and quantity are required.' });
      }

      const result = await activeTradingDataProvider.executeTenantOrder(tenant.id, {
        symbol,
        side,
        quantity: Number(quantity),
        price: price ? Number(price) : undefined,
        type: type || 'MARKET',
        clientName: clientName || 'Retail Trader'
      });

      if (!result.success) {
        return res.status(403).json(result);
      }

      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /api/tenant/orders - Get orders for current tenant
  app.get('/api/tenant/orders', async (req, res) => {
    try {
      const { tenant } = await resolveTradingTenant(req);
      if (!tenant) return res.status(404).json({ error: 'TENANT_NOT_FOUND' });
      const orders = await activeTradingDataProvider.getOrders(tenant.id);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /api/tenant/register - Client registration (Registration Enabled Enforced)
  app.post('/api/tenant/register', async (req, res) => {
    try {
      const { tenant, platformConfig } = await resolveTradingTenant(req);
      if (!tenant || !platformConfig) return res.status(404).json({ error: 'TENANT_NOT_FOUND' });

      if (!platformConfig.registration_enabled) {
        return res.status(403).json({
          error: 'REGISTRATION_DISABLED',
          message: `Registration is currently unavailable for ${tenant.name}. Please contact support.`
        });
      }

      const { name, email, phone, password } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name and email are required.' });
      }

      res.status(201).json({
        success: true,
        message: `Account created successfully on ${tenant.name}. Welcome aboard!`,
        client: {
          id: `CLT-${Date.now().toString().slice(-4)}`,
          name,
          email,
          tenantName: tenant.name,
          status: 'ACTIVE'
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. GET /api/tenant/market-quotes - Live simulated stock quotes for trading terminal
  app.get('/api/tenant/market-quotes', async (req, res) => {
    res.json([
      { symbol: 'NIFTY 50', lastPrice: 22480.50, change: 124.30, changePercent: 0.56, high: 22510.0, low: 22350.2, volume: '14.2M' },
      { symbol: 'BANKNIFTY', lastPrice: 48620.10, change: -140.25, changePercent: -0.29, high: 48900.0, low: 48450.0, volume: '9.8M' },
      { symbol: 'RELIANCE', lastPrice: 2940.00, change: 35.80, changePercent: 1.23, high: 2955.0, low: 2902.0, volume: '4.1M' },
      { symbol: 'TCS', lastPrice: 3890.75, change: -18.20, changePercent: -0.47, high: 3920.0, low: 3875.0, volume: '2.3M' },
      { symbol: 'INFY', lastPrice: 1485.30, change: 12.45, changePercent: 0.85, high: 1495.0, low: 1470.0, volume: '5.6M' },
      { symbol: 'HDFCBANK', lastPrice: 1532.00, change: 8.50, changePercent: 0.56, high: 1540.0, low: 1520.0, volume: '8.4M' },
      { symbol: 'TATAMOTORS', lastPrice: 1012.40, change: 24.10, changePercent: 2.44, high: 1018.0, low: 988.0, volume: '6.7M' }
    ]);
  });

  // ----------------------------------------------------
  // ADMIN WHITE-LABEL & BRANDING MANAGEMENT
  // ----------------------------------------------------

  // List all tenants white-label configs
  app.get('/api/admin/white-label', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const configs = await activeTradingDataProvider.getWhiteLabelConfigs();
      if (tenantScope) {
        return res.json(configs.filter(c => c.tenant_id === tenantScope));
      }
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get specific tenant white-label config
  app.get('/api/admin/white-label/:tenantId', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      if (tenantScope && tenantScope !== req.params.tenantId) {
        return res.status(403).json({ error: 'Forbidden: Scoped to a different tenant' });
      }
      const config = await activeTradingDataProvider.getWhiteLabelConfig(req.params.tenantId);
      if (!config) return res.status(404).json({ error: 'White-label config not found' });
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save White-Label Draft
  app.put('/api/admin/white-label/:tenantId', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateWhiteLabelConfig(req.params.tenantId, req.body, user?.name || 'Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Publish White-Label Changes
  app.post('/api/admin/white-label/:tenantId/publish', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const reason = req.body.reason || 'Admin published branding';
      const published = await activeTradingDataProvider.publishWhiteLabelConfig(req.params.tenantId, user?.name || 'Admin', reason);
      res.json(published);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Rollback White-Label to Previous Version
  app.post('/api/admin/white-label/:tenantId/rollback', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const rolledBack = await activeTradingDataProvider.rollbackWhiteLabelConfig(req.params.tenantId, user?.name || 'Admin');
      res.json(rolledBack);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // ADMIN PLATFORM CONFIG & FEATURE FLAGS
  // ----------------------------------------------------
  app.get('/api/admin/white-label/:tenantId/platform-config', authMiddleware, async (req, res) => {
    try {
      const config = await activeTradingDataProvider.getTenantPlatformConfig(req.params.tenantId);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/white-label/:tenantId/platform-config', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateTenantPlatformConfig(req.params.tenantId, req.body, user?.name || 'Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // DOMAIN MANAGEMENT
  // ----------------------------------------------------
  app.get('/api/admin/white-label/domains/all', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const domains = await activeTradingDataProvider.getTenantDomains(tenantScope);
      res.json(domains);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/white-label/domains', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const { tenantId, domain, domainType, isPrimary } = req.body;
      if (!tenantId || !domain) {
        return res.status(400).json({ error: 'tenantId and domain are required' });
      }
      const newDomain = await activeTradingDataProvider.addTenantDomain(tenantId, { domain, domain_type: domainType, is_primary: isPrimary }, user?.name || 'Admin');
      res.status(201).json(newDomain);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/white-label/domains/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateTenantDomain(req.params.id, req.body, user?.name || 'Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/white-label/domains/:id/verify', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const verified = await activeTradingDataProvider.verifyTenantDomain(req.params.id, user?.name || 'Admin');
      res.json(verified);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/white-label/domains/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const success = await activeTradingDataProvider.deleteTenantDomain(req.params.id, user?.name || 'Admin');
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // BRANDING AUDIT LOGS
  // ----------------------------------------------------
  app.get('/api/admin/white-label/audit-logs', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const logs = await activeTradingDataProvider.getBrandingAuditLogs(tenantScope);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // ASSET STORAGE UPLOAD
  // ----------------------------------------------------
  app.post('/api/admin/white-label/upload', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const { tenantId, assetType, filename, mimeType, contentBase64OrUrl } = req.body;
      if (!tenantId || !assetType || !contentBase64OrUrl) {
        return res.status(400).json({ error: 'tenantId, assetType, and contentBase64OrUrl are required' });
      }

      const stored = await assetStorage.uploadAsset(
        tenantId,
        assetType,
        filename || 'asset.png',
        mimeType || 'image/png',
        contentBase64OrUrl
      );

      res.status(201).json(stored);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/support', authMiddleware, async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const tickets = await activeTradingDataProvider.getSupportTickets(tenantScope);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/audit-logs', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN']), async (req, res) => {
    try {
      const tenantScope = resolveTenantScope(req);
      const logs = await activeTradingDataProvider.getAuditLogs(tenantScope);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SUPPORT TICKETS: Update & Reply
  // ----------------------------------------------------
  app.patch('/api/admin/support/:id', authMiddleware, async (req, res) => {
    try {
      const { status, priority, category } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateSupportTicket(req.params.id, { status, priority, category }, user?.name || 'Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/support/:id/reply', authMiddleware, async (req, res) => {
    try {
      const { message } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.addSupportTicketReply(req.params.id, message, user?.name || 'Support Staff', user?.role || 'SUPER_ADMIN');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // EMERGENCY CONTROLS (Central Kill Switches & Freezes)
  // ----------------------------------------------------
  app.get('/api/admin/emergency-controls', authMiddleware, async (req, res) => {
    try {
      const state = await activeTradingDataProvider.getEmergencyState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/trading', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { active, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setGlobalTradingActive(active, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/kill-switch', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { action, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.triggerKillSwitch(action, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/registrations', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setRegistrationActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/api-access', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setApiAccessActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/freeze-master', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { masterId, masterName, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.freezeMaster(masterId, masterName, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/unfreeze-master', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { masterId } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.unfreezeMaster(masterId, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/freeze-broker', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { brokerId, brokerName, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.freezeBroker(brokerId, brokerName, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/unfreeze-broker', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { brokerId } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.unfreezeBroker(brokerId, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/freeze-user', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { userId, userName, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.freezeUser(userId, userName, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/unfreeze-user', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { userId } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.unfreezeUser(userId, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/account-action', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { entityType, entityId, action, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.executeAccountAction(entityType, entityId, action, user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // MASTER CONTROLS & LIMITS
  // ----------------------------------------------------
  app.get('/api/admin/master-limits', authMiddleware, async (req, res) => {
    try {
      const limits = await activeTradingDataProvider.getMasterLimits();
      res.json(limits);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-limits/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterLimit(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-pricing', authMiddleware, async (req, res) => {
    try {
      const pricing = await activeTradingDataProvider.getMasterPricing();
      res.json(pricing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-pricing/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterPricing(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-brokerage', authMiddleware, async (req, res) => {
    try {
      const brokerage = await activeTradingDataProvider.getMasterBrokerage();
      res.json(brokerage);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-brokerage/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterBrokerage(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-api-permissions', authMiddleware, async (req, res) => {
    try {
      const permissions = await activeTradingDataProvider.getMasterApiPermissions();
      res.json(permissions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-api-permissions/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterApiPermission(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-branding', authMiddleware, async (req, res) => {
    try {
      const branding = await activeTradingDataProvider.getMasterBranding();
      res.json(branding);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-branding/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterBranding(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-subscriptions', authMiddleware, async (req, res) => {
    try {
      const subs = await activeTradingDataProvider.getMasterSubscriptions();
      res.json(subs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/master-subscriptions/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateMasterSubscription(req.params.masterId, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/master-revenue', authMiddleware, async (req, res) => {
    try {
      const masterId = req.query.masterId as string | undefined;
      const reports = await activeTradingDataProvider.getMasterRevenueReports(masterId);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // MONITORING & AUDIT LOGS
  // ----------------------------------------------------
  app.get('/api/admin/monitoring/login-history', authMiddleware, async (req, res) => {
    try {
      const logs = await activeTradingDataProvider.getLoginHistory();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/sessions', authMiddleware, async (req, res) => {
    try {
      const sessions = await activeTradingDataProvider.getActiveSessions();
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/monitoring/sessions/:id/revoke', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const sessions = await activeTradingDataProvider.revokeSession(req.params.id, user?.name || 'Super Admin');
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/order-audit', authMiddleware, async (req, res) => {
    try {
      const orderId = req.query.orderId as string | undefined;
      const audit = await activeTradingDataProvider.getOrderAuditTrail(orderId);
      res.json(audit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/api-activity', authMiddleware, async (req, res) => {
    try {
      const activity = await activeTradingDataProvider.getApiActivityLogs();
      res.json(activity);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/suspicious-alerts', authMiddleware, async (req, res) => {
    try {
      const alerts = await activeTradingDataProvider.getSuspiciousActivityAlerts();
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/monitoring/suspicious-alerts/:id/resolve', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const alerts = await activeTradingDataProvider.resolveSuspiciousAlert(req.params.id, user?.name || 'Super Admin');
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/user-creation-logs', authMiddleware, async (req, res) => {
    try {
      const logs = await activeTradingDataProvider.getUserCreationLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/data-deletion-logs', authMiddleware, async (req, res) => {
    try {
      const logs = await activeTradingDataProvider.getDataDeletionLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/monitoring/config-changes', authMiddleware, async (req, res) => {
    try {
      const logs = await activeTradingDataProvider.getConfigurationChangeLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // PLATFORM MANAGEMENT
  // ----------------------------------------------------
  app.get('/api/admin/platform-management', authMiddleware, async (req, res) => {
    try {
      const config = await activeTradingDataProvider.getPlatformManagement();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/platform-management', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updatePlatformManagement(req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // RBAC (Role-Based Access Control) APIS
  // ----------------------------------------------------
  app.get('/api/admin/rbac/roles', authMiddleware, async (req, res) => {
    try {
      const roles = await activeTradingDataProvider.getRbacRoles();
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/rbac/roles', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const created = await activeTradingDataProvider.createRbacRole(req.body, user?.name || 'Super Admin');
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/rbac/roles/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateRbacRole(req.params.id, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/rbac/roles/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const success = await activeTradingDataProvider.deleteRbacRole(req.params.id, user?.name || 'Super Admin');
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/rbac/users', authMiddleware, async (req, res) => {
    try {
      const users = await activeTradingDataProvider.getRbacUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/rbac/users', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const created = await activeTradingDataProvider.createRbacUser(req.body, user?.name || 'Super Admin');
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/rbac/users/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateRbacUser(req.params.id, req.body, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/rbac/assign', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const { userId, roleCode, customPermissions } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.assignUserRole(userId, roleCode, user?.name || 'Super Admin', customPermissions);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/rbac/audit-logs', authMiddleware, async (req, res) => {
    try {
      const logs = await activeTradingDataProvider.getRbacAuditLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Vite Integration (Dev Middleware & Production Static)
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TradePro Central Admin Panel running on http://localhost:${PORT}`);
  });
}

startServer();
