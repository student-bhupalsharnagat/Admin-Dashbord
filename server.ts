import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { activeTradingDataProvider } from './server/providers/TradingDataProvider.ts';
import { assetStorage } from './server/providers/AssetStorageProvider.ts';
import { UserRole } from './src/types.ts';
import {
  authenticate,
  requireRole,
  requirePermission,
  requireTenantAccess,
  resolveStrictTenantScope
} from './server/auth/middleware.ts';
import {
  filterMastersForUser,
  filterBrokersForUser,
  filterSubBrokersForUser,
  filterClientsForUser,
  filterClientScopedItems
} from './server/auth/hierarchyFilter.ts';
import {
  hashPassword,
  verifyPassword,
  createAuthenticatedSession,
  invalidateSession,
  writeSecurityAuditLog
} from './server/auth/authService.ts';
import { getPermissionsForRole } from './server/auth/rbac.ts';
import { runMigrations } from './server/db/migrate.ts';
import { seedDatabase } from './server/db/seed.ts';
import { seedAuthAndRbac } from './server/db/seedAuthUsers.ts';
import { query } from './server/db/connection.ts';
import { HierarchyLevel } from './server/auth/types.ts';
import { appConfig } from './server/config/environment.ts';
import { tradingPlatformClient } from './server/services/TradingPlatformClient.ts';
import { eventHandler, adminEventBus } from './server/services/EventHandler.ts';
import { tenantConfigCache } from './server/providers/TenantConfigCache.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize and ensure database readiness
  try {
    const { testConnection } = await import('./server/db/connection.ts');
    await testConnection();
  } catch (err: any) {
    console.warn('[Server] Initial database readiness check:', err?.message);
  }

  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use(cookieParser());

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Production JWT authentication and authorization helpers
  const authMiddleware = authenticate;
  const requireRoles = (roles: (UserRole | string)[]) => requireRole(roles as any);
  const resolveTenantScope = (req: Request) => resolveStrictTenantScope(req);

  // ----------------------------------------------------
  // S2S INBOUND EVENT WEBHOOK (Trading Platform -> Central Admin)
  // ----------------------------------------------------
  app.post(['/api/internal/events', '/api/events/trading-platform'], async (req, res) => {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const result = await eventHandler.handleInboundEvent(
        req.headers as any,
        req.method,
        req.path,
        rawBody,
        req.body
      );
      const statusCode = result.success ? (result.duplicate ? 200 : 201) : 400;
      res.status(statusCode).json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // ----------------------------------------------------
  // S2S INBOUND WHITE-LABEL BRANDING SYNCHRONIZATION
  // ----------------------------------------------------
  const processedIdempotencyKeys = new Map<string, any>();

  app.post([
    '/api/internal/v1/white-label/:tenantId/sync',
    '/api/internal/white-label/:tenantId/sync',
    '/api/internal/v1/tenant/branding',
    '/api/internal/tenant/branding'
  ], async (req, res) => {
    try {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const signature = (req.headers['x-signature-sha256'] || req.headers['x-hmac-signature']) as string;
      const timestamp = (req.headers['x-timestamp'] as string) || '';
      const idempotencyKey = req.headers['x-idempotency-key'] as string;
      const correlationId = (req.headers['x-correlation-id'] || req.headers['x-request-id'] || `corr_${Date.now()}`) as string;

      // Verify S2S HMAC-SHA256 signature
      const verification = tradingPlatformClient.verifyInboundSignature(signature, timestamp, req.method, req.path, rawBody);
      if (!verification.valid) {
        return res.status(401).json({
          error: 'UNAUTHORIZED_S2S',
          message: verification.reason || 'Invalid HMAC signature or timestamp outside acceptable window'
        });
      }

      // Check Idempotency Key
      if (idempotencyKey && processedIdempotencyKeys.has(idempotencyKey)) {
        const cached = processedIdempotencyKeys.get(idempotencyKey);
        return res.status(200).json({ ...cached, duplicate: true });
      }

      const tenantId = req.params.tenantId || req.body.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'MISSING_TENANT_ID', message: 'tenantId is required' });
      }

      const branding = req.body.branding || req.body;
      const version = req.body.version || branding.version || 1;

      // Invalidate existing cache and update with incoming published branding
      tenantConfigCache.invalidateBranding(tenantId);
      tenantConfigCache.setBranding(tenantId, branding);
      if (branding.custom_domain) {
        tenantConfigCache.mapDomainToTenant(branding.custom_domain, tenantId);
      }

      // Broadcast safe real-time event to connected trading clients
      adminEventBus.emit('tenant.branding.updated', {
        tenantId,
        version,
        brandName: branding.brand_name || branding.brandName,
        colors: branding.colors || {
          primary: branding.primary_color,
          secondary: branding.secondary_color,
          accent: branding.accent_color,
          background: branding.background_color,
          surface: branding.surface_color
        },
        logoUrl: branding.logo_url || branding.logoUrl,
        updatedAt: new Date().toISOString()
      });

      const responsePayload = {
        success: true,
        tenantId,
        version,
        syncedAt: new Date().toISOString(),
        correlationId
      };

      if (idempotencyKey) {
        processedIdempotencyKeys.set(idempotencyKey, responsePayload);
        if (processedIdempotencyKeys.size > 500) {
          const firstKey = processedIdempotencyKeys.keys().next().value;
          if (firstKey) processedIdempotencyKeys.delete(firstKey);
        }
      }

      res.status(200).json(responsePayload);
    } catch (err: any) {
      res.status(500).json({ error: 'S2S_SYNC_ERROR', message: err.message });
    }
  });

  // ----------------------------------------------------
  // S2S INTEGRATION STATUS & OBSERVABILITY
  // ----------------------------------------------------
  app.get('/api/admin/integration/status', authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const cbState = tradingPlatformClient.getCircuitBreakerState();
      const stats = eventHandler.getEventStats();
      const dbEventsRes = await query('SELECT count(*) as total_events FROM processed_events');
      const syncStatesRes = await query('SELECT sync_status, count(*) as count FROM tenant_sync_state GROUP BY sync_status');

      res.json({
        trading_platform: {
          base_url: appConfig.tradingPlatformBaseUrl,
          circuit_breaker: cbState,
          configured: !!appConfig.tradingPlatformBaseUrl
        },
        inbound_events: {
          processed_in_memory: stats.processedCount,
          total_in_db: parseInt(dbEventsRes.rows[0]?.total_events || '0', 10),
          recent: stats.recentEvents
        },
        tenant_sync_summary: syncStatesRes.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // CENTRAL AUTHENTICATION & JWT APIS (Phase 4 Production)
  // ----------------------------------------------------
  app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = req.user!;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
        hierarchy_level: user.hierarchy_level,
        hierarchy_id: user.hierarchy_id,
        status: user.status,
        permissions: user.permissions,
        simulated_tenant_id: user.simulated_tenant_id
      }
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Desktop Browser';

      if (!email || !password) {
        return res.status(400).json({
          error: 'MISSING_CREDENTIALS',
          message: 'Email and password are required.'
        });
      }

      // Query user from PostgreSQL database
      const { rows } = await query<{
        id: string;
        tenant_id: string | null;
        name: string;
        email: string;
        role: string;
        status: string;
        password_hash: string | null;
        hierarchy_level: string | null;
        hierarchy_id: string | null;
        is_suspended: boolean | null;
      }>(
        `SELECT id, tenant_id, name, email, role, status, password_hash, hierarchy_level, hierarchy_id, is_suspended
         FROM users
         WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email.trim()]
      );

      let userRecord = rows[0];

      // If user not found on first boot, re-run auth seeder in case database was freshly migrated
      if (!userRecord) {
        await seedAuthAndRbac();
        const recheck = await query<any>(
          `SELECT id, tenant_id, name, email, role, status, password_hash, hierarchy_level, hierarchy_id, is_suspended
           FROM users
           WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email.trim()]
        );
        userRecord = recheck.rows[0];
      }

      if (!userRecord) {
        await writeSecurityAuditLog({
          tenantId: null,
          userName: email,
          action: 'LOGIN_FAILURE',
          module: 'AUTH',
          details: `Sign in failed: Account '${email}' does not exist`,
          ipAddress
        });
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        });
      }

      // Check account suspension status
      if (userRecord.status === 'SUSPENDED' || userRecord.is_suspended === true) {
        await writeSecurityAuditLog({
          tenantId: userRecord.tenant_id,
          userName: userRecord.name,
          action: 'LOGIN_REJECTED_SUSPENDED',
          module: 'AUTH',
          details: `Login blocked for suspended account: ${userRecord.email}`,
          ipAddress
        });
        return res.status(403).json({
          error: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact platform administration.'
        });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, userRecord.password_hash || '');
      if (!isPasswordValid) {
        await writeSecurityAuditLog({
          tenantId: userRecord.tenant_id,
          userName: userRecord.name,
          action: 'LOGIN_FAILURE',
          module: 'AUTH',
          details: `Password verification failed for user: ${userRecord.email}`,
          ipAddress
        });
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        });
      }

      // Update last_login
      await query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [userRecord.id]);

      // Resolve tenant name
      let tenantName: string | undefined;
      if (userRecord.tenant_id) {
        const tenantRes = await query<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [userRecord.tenant_id]);
        tenantName = tenantRes.rows[0]?.name;
      }

      // Create session in database and sign JWT
      const { token, sessionId, expiresAt } = await createAuthenticatedSession({
        userId: userRecord.id,
        tenantId: userRecord.tenant_id,
        userName: userRecord.name,
        role: userRecord.role as UserRole,
        hierarchyLevel: (userRecord.hierarchy_level as HierarchyLevel) || (userRecord.tenant_id ? 'TENANT' : 'PLATFORM'),
        hierarchyId: userRecord.hierarchy_id,
        email: userRecord.email,
        ipAddress,
        device: userAgent.substring(0, 128)
      });

      // Write login success audit log
      await writeSecurityAuditLog({
        tenantId: userRecord.tenant_id,
        userName: userRecord.name,
        action: 'LOGIN_SUCCESS',
        module: 'AUTH',
        details: `Successful sign in as ${userRecord.role} (Session: ${sessionId})`,
        ipAddress
      });

      // Issue secure HTTP-Only cookie
      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
      });

      const permissions = await getPermissionsForRole(userRecord.role as UserRole);

      res.json({
        success: true,
        token,
        user: {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          role: userRecord.role,
          tenant_id: userRecord.tenant_id,
          tenant_name: tenantName,
          client_code: (userRecord as any).client_code || 'vtx123',
          hierarchy_level: userRecord.hierarchy_level,
          hierarchy_id: userRecord.hierarchy_id,
          status: userRecord.status,
          permissions
        },
        sessionId,
        expiresAt
      });
    } catch (err: any) {
      console.error('[Auth API] Login exception:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: 'An internal authentication error occurred.' });
    }
  });

  // User Registration Endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role = 'CLIENT', tenantId, phone } = req.body;
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Desktop Browser';

      if (!name || !email || !password) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Full name, email address, and password are required.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Password must be at least 6 characters long.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existing = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [cleanEmail]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'EMAIL_EXISTS',
          message: 'An account with this email address already exists. Please sign in.'
        });
      }

      // Resolve tenant
      let assignedTenantId: string | null = tenantId || null;
      let tenantName = 'Alpha Prime Capital';

      if (assignedTenantId) {
        const tRes = await query('SELECT id, name FROM tenants WHERE id = $1 LIMIT 1', [assignedTenantId]);
        if (tRes.rows.length > 0) {
          tenantName = tRes.rows[0].name;
        } else {
          const fallbackT = await query('SELECT id, name FROM tenants WHERE status = $1 LIMIT 1', ['ACTIVE']);
          if (fallbackT.rows.length > 0) {
            assignedTenantId = fallbackT.rows[0].id;
            tenantName = fallbackT.rows[0].name;
          }
        }
      } else if (role !== 'SUPER_ADMIN' && role !== 'PLATFORM_OWNER') {
        const fallbackT = await query('SELECT id, name FROM tenants WHERE status = $1 LIMIT 1', ['ACTIVE']);
        if (fallbackT.rows.length > 0) {
          assignedTenantId = fallbackT.rows[0].id;
          tenantName = fallbackT.rows[0].name;
        }
      }

      const passwordHash = await hashPassword(password);
      const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const hierarchyLevel: HierarchyLevel = (role === 'SUPER_ADMIN' || role === 'PLATFORM_OWNER')
        ? 'PLATFORM'
        : (role === 'TENANT_ADMIN' ? 'TENANT' : (role as HierarchyLevel));
      const hierarchyId = assignedTenantId;

      await query(
        `INSERT INTO users (
          id, tenant_id, name, email, role, status, password_hash,
          phone, hierarchy_level, hierarchy_id, is_suspended, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          newUserId,
          assignedTenantId,
          name.trim(),
          cleanEmail,
          role,
          passwordHash,
          phone || null,
          hierarchyLevel,
          hierarchyId
        ]
      );

      // Create authenticated session
      const { token, sessionId, expiresAt } = await createAuthenticatedSession({
        userId: newUserId,
        tenantId: assignedTenantId,
        userName: name.trim(),
        role: role as any,
        hierarchyLevel,
        hierarchyId,
        email: cleanEmail,
        ipAddress,
        device: userAgent
      });

      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        expires: expiresAt,
        path: '/'
      });

      await writeSecurityAuditLog({
        tenantId: assignedTenantId,
        userName: name.trim(),
        action: 'USER_REGISTERED',
        module: 'AUTH',
        details: `New account registered: ${cleanEmail} (${role})`,
        ipAddress
      });

      const permissions = await getPermissionsForRole(role as any);

      // If registered account is a CLIENT, initialize client profile and code
      let clientCode = `VTX-${Math.floor(10000 + Math.random() * 90000)}`;
      if (role === 'CLIENT') {
        try {
          await activeTradingDataProvider.createClient({
            id: newUserId,
            name: name.trim(),
            email: cleanEmail,
            phone: phone || '+91 98765 43210',
            client_code: clientCode,
            tenant_id: assignedTenantId,
            status: 'ACTIVE',
            available_margin: 142840,
            wallet_balance: 142840,
            todays_pl: 252227
          });
        } catch (clientErr) {
          console.warn('[Register] Client provider auto-create notice:', clientErr);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: {
          id: newUserId,
          name: name.trim(),
          email: cleanEmail,
          role,
          tenant_id: assignedTenantId,
          tenant_name: tenantName,
          client_code: clientCode,
          hierarchy_level: hierarchyLevel,
          hierarchy_id: hierarchyId,
          status: 'ACTIVE',
          permissions
        },
        sessionId,
        expiresAt
      });
    } catch (err: any) {
      console.error('[Auth API] Registration exception:', err);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message || 'An error occurred during registration. Please try again.'
      });
    }
  });

  app.post('/api/auth/switch-tenant-scope', authenticate, async (req, res) => {
    const user = req.user!;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only Super Admin can switch global tenant perspective.'
      });
    }

    const { tenantId } = req.body;
    user.simulated_tenant_id = (tenantId === 'ALL' || !tenantId) ? null : tenantId;

    await writeSecurityAuditLog({
      tenantId: user.simulated_tenant_id,
      userName: user.name,
      action: 'TENANT_SCOPE_SWITCH',
      module: 'SECURITY',
      details: `Super Admin switched active tenant scope to: ${user.simulated_tenant_id || 'ALL_TENANTS'}`,
      ipAddress: req.ip || req.socket.remoteAddress
    });

    res.json({ success: true, activeTenantScope: user.simulated_tenant_id });
  });

  app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
      const user = req.user!;
      if (user.session_id) {
        await invalidateSession(user.session_id, user.name);
      }

      await writeSecurityAuditLog({
        tenantId: user.tenant_id,
        userName: user.name,
        action: 'LOGOUT',
        module: 'AUTH',
        details: `User logged out. Session ${user.session_id} invalidated.`,
        ipAddress: req.ip || req.socket.remoteAddress
      });
    } catch (err) {
      console.error('[Auth API] Logout error:', err);
    } finally {
      res.clearCookie('tradepro_session');
      res.json({ success: true, message: 'Logged out successfully.' });
    }
  });

  // ----------------------------------------------------
  // ADMIN DASHBOARD APIS (Matches Figma screenshot data)
  // ----------------------------------------------------
  app.get('/api/admin/dashboard', authenticate, requirePermission('dashboard.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const kpis = await activeTradingDataProvider.getDashboardKPIs(tenantScope);
      const volumeCommission = await activeTradingDataProvider.getVolumeCommissionChart(tenantScope);
      const clientGrowth = await activeTradingDataProvider.getClientGrowthChart(tenantScope);
      const dailyPL = await activeTradingDataProvider.getDailyPLTrend(tenantScope);
      const recentTrades = await activeTradingDataProvider.getRecentTrades(tenantScope, 6);
      const pendingKYC = await activeTradingDataProvider.getPendingKYC(tenantScope, 5);

      const tenants = await activeTradingDataProvider.getTenants({});

      res.json({
        kpis,
        volumeCommission,
        clientGrowth,
        dailyPL,
        charts: {
          volumeCommission,
          clientGrowth,
          dailyPL
        },
        recentTrades,
        pendingKYC,
        tenants,
        tenantScope: tenantScope || 'ALL_TENANTS'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load dashboard' });
    }
  });

  // ----------------------------------------------------
  // TENANTS MANAGEMENT (SUPER_ADMIN only)
  // ----------------------------------------------------
  app.get('/api/admin/tenants', authenticate, requirePermission('tenants.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const search = req.query.search as string;
      const status = req.query.status as string;
      const tenants = await activeTradingDataProvider.getTenants({ search, status });
      res.json(tenants);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/tenants/:id', authenticate, requirePermission('tenants.view'), requireTenantAccess, async (req, res) => {
    try {
      const tenant = await activeTradingDataProvider.getTenantById(req.params.id);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      res.json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants', authenticate, requirePermission('tenants.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const tenant = await activeTradingDataProvider.createTenant(req.body);
      await writeSecurityAuditLog({
        tenantId: tenant.id,
        userName: req.user!.name,
        action: 'TENANT_CREATED',
        module: 'TENANTS',
        details: `Created new tenant: ${tenant.name} (${tenant.id})`,
        ipAddress: req.ip
      });
      res.status(201).json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/suspend', authenticate, requirePermission('tenants.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, 'SUSPENDED');
      await writeSecurityAuditLog({
        tenantId: req.params.id,
        userName: req.user!.name,
        action: 'TENANT_SUSPENDED',
        module: 'TENANTS',
        details: `Tenant ${req.params.id} suspended by admin`,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/activate', authenticate, requirePermission('tenants.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, 'ACTIVE');
      await writeSecurityAuditLog({
        tenantId: req.params.id,
        userName: req.user!.name,
        action: 'TENANT_ACTIVATED',
        module: 'TENANTS',
        details: `Tenant ${req.params.id} activated by admin`,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/tenants/:id/status', authenticate, requirePermission('tenants.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, status || 'ACTIVE');
      if (!updated) return res.status(404).json({ error: 'Tenant not found' });
      await writeSecurityAuditLog({
        tenantId: req.params.id,
        userName: req.user!.name,
        action: 'TENANT_STATUS_CHANGED',
        module: 'TENANTS',
        details: `Tenant ${req.params.id} status changed to ${status}`,
        ipAddress: req.ip
      });
      // Automatically sync updated tenant status to Trading Platform
      await (activeTradingDataProvider as any).syncTenantConfig?.(req.params.id, req.user!.name).catch(() => {});
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual Trigger: Sync Tenant Configuration to Trading Platform S2S
  app.post('/api/admin/tenants/:id/sync', authenticate, requirePermission('tenants.update'), async (req, res) => {
    try {
      const actor = req.user?.name || 'Super Admin';
      const syncResult = await (activeTradingDataProvider as any).syncTenantConfig?.(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.params.id,
        userName: actor,
        action: 'TENANT_CONFIG_SYNCED',
        module: 'INTEGRATION',
        details: `Tenant ${req.params.id} configuration synced to Trading Platform. Status: ${syncResult?.sync_status}`,
        ipAddress: req.ip
      });
      res.json(syncResult || { success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Query Tenant Sync Status
  app.get('/api/admin/tenants/:id/sync-state', authenticate, async (req, res) => {
    try {
      const syncState = await (activeTradingDataProvider as any).getTenantSyncState?.(req.params.id);
      res.json(syncState);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // HIERARCHY MODULES: Masters, Brokers, Sub-Brokers, Clients
  // ----------------------------------------------------
  app.get(['/api/admin/masters', '/api/admin/hierarchy/masters'], authenticate, requirePermission('masters.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const allMasters = await activeTradingDataProvider.getMasters(tenantScope);
      const filtered = await filterMastersForUser(allMasters, req.user!);
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/masters', '/api/admin/hierarchy/masters'], authenticate, requirePermission('masters.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      const master = await activeTradingDataProvider.createMaster(data);
      await writeSecurityAuditLog({
        tenantId: master.tenant_id,
        userName: user.name,
        action: 'MASTER_CREATED',
        module: 'HIERARCHY',
        details: `Created master account ${master.name} (${master.id})`,
        ipAddress: req.ip
      });
      res.status(201).json(master);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/masters/:id', authenticate, requirePermission('masters.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateMaster(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Master not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/masters/:id/status', authenticate, requirePermission('masters.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateMasterStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Master not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/brokers', '/api/admin/hierarchy/brokers'], authenticate, requirePermission('brokers.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const masterId = req.query.masterId as string;
      const allBrokers = await activeTradingDataProvider.getBrokers(tenantScope, masterId);
      const filtered = await filterBrokersForUser(allBrokers, req.user!);
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/brokers', '/api/admin/hierarchy/brokers'], authenticate, requirePermission('brokers.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      // If creator is Master, enforce master_id
      if (user.role === 'MASTER' && user.hierarchy_id) {
        data.master_id = user.hierarchy_id;
      }
      const broker = await activeTradingDataProvider.createBroker(data);
      await writeSecurityAuditLog({
        tenantId: broker.tenant_id,
        userName: user.name,
        action: 'BROKER_CREATED',
        module: 'HIERARCHY',
        details: `Created broker account ${broker.name} (${broker.id}) under Master ${broker.master_id}`,
        ipAddress: req.ip
      });
      res.status(201).json(broker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/brokers/:id', authenticate, requirePermission('brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateBroker(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/brokers/:id/status', authenticate, requirePermission('brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateBrokerStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/sub-brokers', '/api/admin/hierarchy/sub-brokers'], authenticate, requirePermission('sub_brokers.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const brokerId = req.query.brokerId as string;
      const allSubBrokers = await activeTradingDataProvider.getSubBrokers(tenantScope, brokerId);
      const filtered = await filterSubBrokersForUser(allSubBrokers, req.user!);
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/sub-brokers', '/api/admin/hierarchy/sub-brokers'], authenticate, requirePermission('sub_brokers.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      if (user.role === 'BROKER' && user.hierarchy_id) {
        data.broker_id = user.hierarchy_id;
      }
      const subBroker = await activeTradingDataProvider.createSubBroker(data);
      await writeSecurityAuditLog({
        tenantId: subBroker.tenant_id,
        userName: user.name,
        action: 'SUB_BROKER_CREATED',
        module: 'HIERARCHY',
        details: `Created sub-broker ${subBroker.name} (${subBroker.id})`,
        ipAddress: req.ip
      });
      res.status(201).json(subBroker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/sub-brokers/:id', authenticate, requirePermission('sub_brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateSubBroker(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Sub-Broker not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/sub-brokers/:id/status', authenticate, requirePermission('sub_brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateSubBrokerStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Sub-Broker not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/clients', '/api/admin/hierarchy/clients'], authenticate, requirePermission('clients.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const subBrokerId = req.query.subBrokerId as string;
      const allClients = await activeTradingDataProvider.getClients(tenantScope, subBrokerId);
      const filtered = await filterClientsForUser(allClients, req.user!);
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/clients', '/api/admin/hierarchy/clients'], authenticate, requirePermission('clients.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER', 'SUB_BROKER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      if (user.role === 'SUB_BROKER' && user.hierarchy_id) {
        data.sub_broker_id = user.hierarchy_id;
      }
      const client = await activeTradingDataProvider.createClient(data);
      await writeSecurityAuditLog({
        tenantId: client.tenant_id,
        userName: user.name,
        action: 'CLIENT_CREATED',
        module: 'HIERARCHY',
        details: `Created client ${client.name} (${client.id}) under sub-broker ${client.sub_broker_id}`,
        ipAddress: req.ip
      });
      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/clients/:id', authenticate, requirePermission('clients.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER', 'SUB_BROKER']), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateClient(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/clients/:id/status', authenticate, requirePermission('clients.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER', 'SUB_BROKER']), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateClientStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Client Trading Platform Account Details & S2S Live Endpoints
  app.get('/api/admin/clients/:id/trading-account', authenticate, async (req, res) => {
    try {
      if (typeof (activeTradingDataProvider as any).getClientAccountDetails === 'function') {
        const details = await (activeTradingDataProvider as any).getClientAccountDetails(req.params.id, req.user?.tenant_id);
        return res.json(details);
      }
      res.status(501).json({ error: 'Client account details not supported by provider' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/clients/:id/orders', authenticate, async (req, res) => {
    try {
      if (typeof (activeTradingDataProvider as any).getClientOrders === 'function') {
        const orders = await (activeTradingDataProvider as any).getClientOrders(req.params.id, req.user?.tenant_id);
        return res.json(orders);
      }
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/clients/:id/trades', authenticate, async (req, res) => {
    try {
      if (typeof (activeTradingDataProvider as any).getClientTrades === 'function') {
        const trades = await (activeTradingDataProvider as any).getClientTrades(req.params.id, req.user?.tenant_id);
        return res.json(trades);
      }
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/clients/:id/positions', authenticate, async (req, res) => {
    try {
      if (typeof (activeTradingDataProvider as any).getClientPositions === 'function') {
        const positions = await (activeTradingDataProvider as any).getClientPositions(req.params.id, req.user?.tenant_id);
        return res.json(positions);
      }
      res.json([]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/clients/:id/positions/:posId/square-off', authenticate, async (req, res) => {
    try {
      const { id, posId } = req.params;
      const { reason } = req.body || {};
      const sqRes = await tradingPlatformClient.sendEmergencySquareOff({
        positionId: posId,
        actor: req.user?.name || 'Admin',
        reason: reason || `Square-off client position ${posId} for client ${id}`,
        tenantId: req.user?.tenant_id
      });
      res.json({ success: true, positionId: posId, result: sqRes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/integration/trading-platform-url', authenticate, (_req, res) => {
    const mainPlatformUrl = process.env.TRADING_PLATFORM_WEB_URL || 'https://ai.studio/apps/9cd34c34-cb38-4875-8889-4e68e6b8ed7e';
    res.json({
      webUrl: mainPlatformUrl,
      s2sUrl: process.env.TRADING_PLATFORM_URL || 'http://localhost:3001',
      circuitBreaker: tradingPlatformClient.getCircuitBreakerState(),
      metrics: tradingPlatformClient.getMetrics()
    });
  });

  // Generic status toggle adapter supporting /api/admin/entities/:type/:id/status
  app.patch('/api/admin/entities/:type/:id/status', authenticate, async (req, res) => {
    try {
      const { type, id } = req.params;
      const { status } = req.body;
      let updated: any = null;
      if (type === 'masters' || type === 'master') {
        updated = await activeTradingDataProvider.updateMasterStatus(id, status);
      } else if (type === 'brokers' || type === 'broker') {
        updated = await activeTradingDataProvider.updateBrokerStatus(id, status);
      } else if (type === 'sub-brokers' || type === 'sub_brokers' || type === 'subBroker') {
        updated = await activeTradingDataProvider.updateSubBrokerStatus(id, status);
      } else if (type === 'clients' || type === 'client') {
        updated = await activeTradingDataProvider.updateClientStatus(id, status);
      } else if (type === 'tenants' || type === 'tenant') {
        if (req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'PLATFORM_OWNER') {
          return res.status(403).json({ error: 'Forbidden' });
        }
        updated = await activeTradingDataProvider.updateTenantStatus(id, status);
      }
      if (!updated) return res.status(404).json({ error: 'Entity not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // COMPLIANCE: KYC, Funds, Ledger
  // ----------------------------------------------------
  app.get('/api/admin/kyc', authenticate, requirePermission('kyc.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const kyc = await activeTradingDataProvider.getKYCRecords(tenantScope, status);
      res.json(kyc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/kyc/:id', authenticate, requirePermission('kyc.review'), async (req, res) => {
    try {
      const { status, notes } = req.body;
      const user = req.user!;
      const updated = await activeTradingDataProvider.updateKYCStatus(req.params.id, status, notes);
      await writeSecurityAuditLog({
        tenantId: user.tenant_id,
        userName: user.name,
        action: 'KYC_STATUS_UPDATED',
        module: 'COMPLIANCE',
        details: `KYC record ${req.params.id} marked ${status} by ${user.name}`,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Funds Deposits
  app.get(['/api/admin/compliance/deposits', '/api/compliance/deposits'], authenticate, requirePermission('funds.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const deposits = await activeTradingDataProvider.getFundDeposits(tenantScope, status);
      res.json(deposits);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/deposits/:id/approve', '/api/compliance/deposits/:id/approve'], authenticate, requirePermission('funds.approve'), async (req, res) => {
    try {
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const result = await activeTradingDataProvider.approveFundDeposit(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'DEPOSIT_APPROVED',
        module: 'FUNDS',
        details: `Deposit ${req.params.id} approved`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/deposits/:id/reject', '/api/compliance/deposits/:id/reject'], authenticate, requirePermission('funds.reject'), async (req, res) => {
    try {
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const result = await activeTradingDataProvider.rejectFundDeposit(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'DEPOSIT_REJECTED',
        module: 'FUNDS',
        details: `Deposit ${req.params.id} rejected`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/deposits', '/api/compliance/deposits'], authenticate, requirePermission('funds.deposit'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const deposit = await activeTradingDataProvider.createFundDeposit(data);
      res.status(201).json(deposit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Funds Withdrawals
  app.get(['/api/admin/compliance/withdrawals', '/api/compliance/withdrawals'], authenticate, requirePermission('funds.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const withdrawals = await activeTradingDataProvider.getFundWithdrawals(tenantScope, status);
      res.json(withdrawals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/withdrawals/:id/approve', '/api/compliance/withdrawals/:id/approve'], authenticate, requirePermission('funds.approve'), async (req, res) => {
    try {
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const result = await activeTradingDataProvider.approveFundWithdrawal(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'WITHDRAWAL_APPROVED',
        module: 'FUNDS',
        details: `Withdrawal ${req.params.id} approved`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/withdrawals/:id/reject', '/api/compliance/withdrawals/:id/reject'], authenticate, requirePermission('funds.reject'), async (req, res) => {
    try {
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const result = await activeTradingDataProvider.rejectFundWithdrawal(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'WITHDRAWAL_REJECTED',
        module: 'FUNDS',
        details: `Withdrawal ${req.params.id} rejected`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/withdrawals', '/api/compliance/withdrawals'], authenticate, requirePermission('funds.withdraw'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const withdrawal = await activeTradingDataProvider.createFundWithdrawal(data);
      res.status(201).json(withdrawal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Immutable Ledger
  app.get(['/api/admin/compliance/ledger', '/api/compliance/ledger'], authenticate, requirePermission('ledger.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const type = req.query.type as string;
      const ledger = await activeTradingDataProvider.getLedgerEntries(tenantScope, type);
      res.json(ledger);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/ledger', '/api/compliance/ledger'], authenticate, requirePermission('ledger.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const entry = await activeTradingDataProvider.createLedgerEntry(data);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // TRADING: Orders, Trades & Positions
  // ----------------------------------------------------
  app.get(['/api/admin/positions', '/api/positions'], authenticate, requirePermission('positions.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const positions = await activeTradingDataProvider.getPositions(tenantScope);
      const scoped = await filterClientScopedItems(positions, req.user!);
      res.json(scoped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/positions/:id/square-off', '/api/positions/:id/square-off'], authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      const actor = req.user?.name || req.user?.email || 'Risk Manager';
      const result = await activeTradingDataProvider.squareOffPosition(req.params.id, actor);
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'POSITION_SQUARED_OFF',
        module: 'RISK',
        details: `Position ${req.params.id} squared off by ${actor}`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/commercial/commission-plans', authenticate, requirePermission('commission.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const plans = await activeTradingDataProvider.getCommissionPlans(tenantScope);
      res.json(plans);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/commercial/commission-rules', authenticate, requirePermission('commission.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const planId = req.query.planId as string;
      const rules = await activeTradingDataProvider.getCommissionRules(tenantScope, planId);
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/risk/profiles', authenticate, requirePermission('risk.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const profiles = await activeTradingDataProvider.getRiskProfiles(tenantScope);
      res.json(profiles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/risk/events', authenticate, requirePermission('risk.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const events = await activeTradingDataProvider.getRiskEvents(tenantScope);
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/notifications', authenticate, requirePermission('notifications.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const notifications = await activeTradingDataProvider.getNotifications(tenantScope);
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/notifications/:id/read', authenticate, requirePermission('notifications.view'), async (req, res) => {
    try {
      const result = await activeTradingDataProvider.markNotificationRead(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // TRADING: Orders & Trades
  // ----------------------------------------------------
  app.get(['/api/admin/trades', '/api/admin/trading/trades'], authenticate, requirePermission('trades.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const trades = await activeTradingDataProvider.getAllTrades(tenantScope);
      const scoped = await filterClientScopedItems(trades, req.user!);
      res.json(scoped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/orders', authenticate, requirePermission('orders.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const orders = await activeTradingDataProvider.getOrders(tenantScope);
      const scoped = await filterClientScopedItems(orders, req.user!);
      res.json(scoped);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SUBSCRIPTIONS & WHITE LABEL
  // ----------------------------------------------------
  app.get('/api/admin/subscriptions', authenticate, requirePermission('subscriptions.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
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
    const explicitTenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || (req.query.tenant_id as string);
    if (explicitTenantId) {
      const tenants = await activeTradingDataProvider.getTenants();
      const tenant = tenants.find(t => t.id === explicitTenantId || t.code.toLowerCase() === explicitTenantId.toLowerCase());
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
          footerText: branding.footer_copyright || branding.footer_text || `© 2026 ${branding.brand_name || tenant.name}. All rights reserved.`
        },
        footerCopyright: branding.footer_copyright || branding.footer_text || `© 2026 ${branding.brand_name || tenant.name}. All rights reserved.`,
        version: branding.version || 1,
        status: branding.status || 'PUBLISHED',
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

  // Query White-Label Version History
  app.get('/api/admin/white-label/:tenantId/versions', authMiddleware, async (req, res) => {
    try {
      const versions = await (activeTradingDataProvider as any).getWhiteLabelVersions?.(req.params.tenantId) || [];
      res.json(versions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
  app.get('/api/admin/white-label/:tenantId/audit-logs', authMiddleware, async (req, res) => {
    try {
      const tenantScope = req.params.tenantId;
      const logs = await activeTradingDataProvider.getBrandingAuditLogs(tenantScope);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/white-label/audit-logs', authMiddleware, async (req, res) => {
    try {
      const tenantScope = (req.query.tenantId as string) || (req.query.tenant_id as string) || (req.headers['x-tenant-id'] as string) || resolveTenantScope(req);
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

  // Serve stored branding assets (logo, favicon, etc.) as clean URLs
  app.get('/api/assets/:id', async (req, res) => {
    try {
      const asset = await assetStorage.getAsset(req.params.id);
      if (!asset) return res.status(404).send('Asset not found');
      if (asset.contentBuffer) {
        res.setHeader('Content-Type', asset.mime_type || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(asset.contentBuffer);
      }
      if (asset.public_url && (asset.public_url.startsWith('http://') || asset.public_url.startsWith('https://'))) {
        return res.redirect(asset.public_url);
      }
      res.status(404).send('Asset not found');
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // Real-time Server-Sent Events stream for Admin Console
  app.get('/api/admin/events/stream', authenticate, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const user = req.user;
    const isGlobal = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_OWNER';
    const tenantScope = isGlobal ? null : user?.tenant_id;

    const listener = (event: any) => {
      if (tenantScope && event.tenantId && event.tenantId !== tenantScope) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    adminEventBus.on('event', listener);

    // Keep-alive heartbeat every 20s
    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adminEventBus.off('event', listener);
    });
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

  app.get('/api/admin/emergency-controls/trading', authMiddleware, async (req, res) => {
    try {
      const state = await activeTradingDataProvider.getEmergencyState();
      res.json({
        active: state.globalTradingActive,
        paused: !state.globalTradingActive,
        reason: state.tradingReason,
        trading_paused_at: state.trading_paused_at,
        trading_paused_by: state.trading_paused_by
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/trading', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { active, paused, reason } = req.body;
      const effectiveActive = active !== undefined ? Boolean(active) : (paused !== undefined ? !paused : false);
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setGlobalTradingActive(effectiveActive, user?.name || 'Super Admin', reason);
      res.json({ success: true, active: effectiveActive, paused: !effectiveActive, state: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/emergency-controls/cancel-all-orders', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const reason = req.body?.reason || 'Emergency Mass Order Cancellation by Super Admin';
      const result = await activeTradingDataProvider.cancelAllOrders(user?.name || 'Super Admin', reason);
      res.json({ success: true, ...result });
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

  // Emergency Controls Compatibility Aliases (/api/admin/emergency/*)
  app.get('/api/admin/emergency/trading', authMiddleware, async (req, res) => {
    try {
      const state = await activeTradingDataProvider.getEmergencyState();
      res.json({ active: state.globalTradingActive, paused: !state.globalTradingActive, reason: state.tradingReason });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/trading', authMiddleware, async (req, res) => {
    try {
      const { active, paused, reason } = req.body;
      const effectiveActive = active !== undefined ? Boolean(active) : (paused !== undefined ? !paused : false);
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setGlobalTradingActive(effectiveActive, user?.name || 'Super Admin', reason);
      res.json({ success: true, active: effectiveActive, paused: !effectiveActive, state: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/kill-switch', authMiddleware, async (req, res) => {
    try {
      const { action, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.triggerKillSwitch(action || 'TRIGGER', user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/kill-switch/reset', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.triggerKillSwitch('RESET', user?.name || 'Super Admin', req.body?.reason || 'Kill switch reset');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/registrations', authMiddleware, async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setRegistrationActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/api-access', authMiddleware, async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setApiAccessActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/freeze', authMiddleware, async (req, res) => {
    try {
      const { entityType, entityId, action, reason } = req.body;
      const user = (req as any).user;
      const result = await activeTradingDataProvider.executeAccountAction(entityType, entityId, action, user?.name || 'Super Admin', reason || 'Emergency Freeze');
      res.json(result);
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
  const handleGetPlatformManagement = async (req: Request, res: Response) => {
    try {
      const config = await activeTradingDataProvider.getPlatformManagement();
      res.json({
        ...config,
        maintenanceMode: config.web_maintenance_mode,
        webPlatform: config.web_trading_enabled ? 'ACTIVE' : 'SUSPENDED',
        mobilePlatform: (config.mobile_android_enabled && config.mobile_ios_enabled) ? 'ACTIVE' : 'SUSPENDED',
        minAppVersion: config.mobile_android_min_version,
        broadcastMessage: config.broadcast_message
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  const handleUpdatePlatformManagement = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const body = req.body || {};
      const payload: any = { ...body };

      if (body.maintenanceMode !== undefined) {
        payload.web_maintenance_mode = Boolean(body.maintenanceMode);
      }
      if (body.enabled !== undefined && (body.message !== undefined || body.until !== undefined)) {
        payload.web_maintenance_mode = Boolean(body.enabled);
        if (body.message) payload.broadcast_message = body.message;
      }
      if (body.message !== undefined && body.target !== undefined) {
        payload.broadcast_message = body.message;
      }
      if (body.webPlatform) {
        payload.web_trading_enabled = body.webPlatform === 'ACTIVE';
      }
      if (body.mobilePlatform) {
        payload.mobile_android_enabled = body.mobilePlatform === 'ACTIVE';
        payload.mobile_ios_enabled = body.mobilePlatform === 'ACTIVE';
      }
      if (body.minAppVersion) {
        payload.mobile_android_min_version = body.minAppVersion;
        payload.mobile_ios_min_version = body.minAppVersion;
      }

      const updated = await activeTradingDataProvider.updatePlatformManagement(payload, user?.name || 'Super Admin');
      res.json({
        ...updated,
        maintenanceMode: updated.web_maintenance_mode,
        webPlatform: updated.web_trading_enabled ? 'ACTIVE' : 'SUSPENDED',
        mobilePlatform: (updated.mobile_android_enabled && updated.mobile_ios_enabled) ? 'ACTIVE' : 'SUSPENDED',
        minAppVersion: updated.mobile_android_min_version,
        broadcastMessage: updated.broadcast_message
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.get('/api/admin/platform-management', authMiddleware, handleGetPlatformManagement);
  app.put('/api/admin/platform-management', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), handleUpdatePlatformManagement);
  app.post('/api/admin/platform-management', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), handleUpdatePlatformManagement);

  // Platform Compatibility Aliases (/api/admin/platform*)
  app.get('/api/admin/platform', authMiddleware, handleGetPlatformManagement);
  app.put('/api/admin/platform', authMiddleware, handleUpdatePlatformManagement);
  app.post('/api/admin/platform', authMiddleware, handleUpdatePlatformManagement);
  app.post('/api/admin/platform/maintenance', authMiddleware, handleUpdatePlatformManagement);
  app.post('/api/admin/platform/broadcast', authMiddleware, handleUpdatePlatformManagement);

  // Monitoring session and alert deletion/resolution aliases
  app.delete('/api/admin/monitoring/sessions/:id', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      await activeTradingDataProvider.revokeSession(req.params.id, user?.name || 'Super Admin');
      res.json({ success: true, revoked: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/monitoring/alerts/:id/resolve', authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      await activeTradingDataProvider.resolveSuspiciousAlert(req.params.id, user?.name || 'Super Admin');
      res.json({ success: true, resolved: req.params.id });
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
  // DEMO QUICK-ACCESS & TRADING PLATFORM API ENDPOINTS
  // ----------------------------------------------------

  // 1-Click Demo Login Endpoint
  app.post('/api/auth/demo', async (req, res) => {
    try {
      const { role = 'CLIENT' } = req.body;
      const isClient = role === 'CLIENT';
      const email = isClient ? 'client@alphaprime.com' : 'admin@platform.com';
      const name = isClient ? 'Demo Trader' : 'Admin John';
      const tenantId = isClient ? 'TNT-001' : null;
      const tenantName = isClient ? 'VERTEX Trading' : 'All Tenants (Global Scope)';
      const clientCode = isClient ? 'vtx123' : undefined;

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Demo Session';

      // Find or create the demo user record
      let userRes = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
      let userRecord = userRes.rows[0];

      if (!userRecord) {
        const passwordHash = await hashPassword('password123');
        const newUserId = isClient ? 'usr_demo_client_1' : 'usr_demo_admin_1';
        await query(
          `INSERT INTO users (
            id, tenant_id, name, email, role, status, password_hash,
            phone, hierarchy_level, hierarchy_id, is_suspended, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, '+91 98765 43210', $7, $8, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE'`,
          [
            newUserId,
            tenantId,
            name,
            email,
            role,
            passwordHash,
            isClient ? 'CLIENT' : 'PLATFORM',
            tenantId
          ]
        );
        userRes = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [newUserId]);
        userRecord = userRes.rows[0];
      }

      const { token, sessionId, expiresAt } = await createAuthenticatedSession({
        userId: userRecord.id,
        tenantId: userRecord.tenant_id,
        userName: userRecord.name,
        role: userRecord.role as UserRole,
        hierarchyLevel: (userRecord.hierarchy_level as HierarchyLevel) || (userRecord.tenant_id ? 'TENANT' : 'PLATFORM'),
        hierarchyId: userRecord.hierarchy_id,
        email: userRecord.email,
        ipAddress,
        device: userAgent.substring(0, 128)
      });

      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
      });

      const permissions = await getPermissionsForRole(userRecord.role as UserRole);

      res.json({
        success: true,
        token,
        user: {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          role: userRecord.role,
          tenant_id: userRecord.tenant_id,
          tenant_name: tenantName,
          client_code: clientCode || (userRecord as any).client_code || 'vtx123',
          hierarchy_level: userRecord.hierarchy_level,
          hierarchy_id: userRecord.hierarchy_id,
          status: userRecord.status,
          permissions
        },
        sessionId,
        expiresAt
      });
    } catch (err: any) {
      console.error('[Auth API] Demo login exception:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // Trading Memory Store
  let tradingWalletState = {
    availableBalance: 897804.97,
    usedMargin: 100308.0,
    todayPnL: 252227.0,
    totalPnL: 381321.15,
    marginCoverageRatio: 89.2
  };

  let tradingPositionsState = [
    {
      id: 'pos-1',
      symbol: 'GOLD FUT',
      name: 'Gold Mini Futures 100G',
      side: 'BUY',
      productType: 'INTRADAY',
      lots: 2,
      quantity: 200,
      buyAvgPrice: 157366.34,
      currentPrice: 158496.61,
      unrealizedPnL: 226054.0,
      pnlPercent: 0.72,
      marginUsed: 62808.0,
      entryTime: '09:45 AM'
    },
    {
      id: 'pos-2',
      symbol: 'CRUDE OIL FUT',
      name: 'Crude Oil Futures',
      side: 'BUY',
      productType: 'HOLDING',
      lots: 5,
      quantity: 500,
      buyAvgPrice: 6132.0,
      currentPrice: 6184.0,
      unrealizedPnL: 26000.0,
      pnlPercent: 0.85,
      marginUsed: 37500.0,
      entryTime: '10:12 AM'
    }
  ];

  let tradingOrdersState = [
    {
      id: 'ORD-90124',
      symbol: 'GOLD FUT',
      name: 'Gold Mini Futures 100G',
      side: 'BUY',
      productType: 'INTRADAY',
      orderType: 'MARKET',
      lots: 2,
      quantity: 200,
      price: 157366.34,
      triggerPrice: 0,
      status: 'EXECUTED',
      placedAt: '22 Sep 2026, 09:45:12 AM',
      filledQuantity: 200
    },
    {
      id: 'ORD-90125',
      symbol: 'CRUDE OIL FUT',
      name: 'Crude Oil Futures',
      side: 'BUY',
      productType: 'HOLDING',
      orderType: 'LIMIT',
      lots: 5,
      quantity: 500,
      price: 6132.0,
      triggerPrice: 0,
      status: 'EXECUTED',
      placedAt: '22 Sep 2026, 10:12:44 AM',
      filledQuantity: 500
    },
    {
      id: 'ORD-90126',
      symbol: 'SILVER FUT',
      name: 'Silver Futures',
      side: 'BUY',
      productType: 'INTRADAY',
      orderType: 'LIMIT',
      lots: 1,
      quantity: 100,
      price: 2360.0,
      triggerPrice: 0,
      status: 'OPEN',
      placedAt: '22 Sep 2026, 10:45:10 AM',
      filledQuantity: 0
    }
  ];

  let tradingTicketsState = [
    {
      id: 'TCK-8812',
      category: 'Trading & Orders',
      priority: 'HIGH',
      subject: 'Order execution rate query on GOLD FUT Intraday',
      status: 'OPEN',
      createdAt: '22 Sep 2026, 11:15 AM',
      lastUpdate: '22 Sep 2026, 11:20 AM',
      messages: [
        {
          id: 'MSG-1',
          sender: 'CLIENT',
          senderName: 'Demo Trader',
          message: 'Hello Support, I noticed an execution variance of 2 ticks on my market buy order for GOLD FUT. Could you please check the exchange timestamp?',
          timestamp: '22 Sep 2026, 11:15 AM'
        },
        {
          id: 'MSG-2',
          sender: 'SUPPORT',
          senderName: 'VERTEX Compliance Desk',
          message: 'Hi Demo Trader, our surveillance team is inspecting the millisecond order matching log for tick variance. We will update this ticket shortly.',
          timestamp: '22 Sep 2026, 11:20 AM'
        }
      ]
    }
  ];

  // GET /api/trading/portfolio
  app.get('/api/trading/portfolio', (req, res) => {
    res.json({
      success: true,
      wallet: tradingWalletState,
      positions: tradingPositionsState
    });
  });

  // GET /api/trading/orders
  app.get(['/api/trading/orders', '/api/trading/order'], (req, res) => {
    res.json({
      success: true,
      orders: tradingOrdersState
    });
  });

  // POST /api/trading/order
  app.post(['/api/trading/order', '/api/trading/orders'], (req, res) => {
    try {
      const {
        symbol,
        name = symbol,
        side = 'BUY',
        productType = 'INTRADAY',
        orderType = 'MARKET',
        lots = 1,
        quantity = 100,
        price = 1000,
        triggerPrice = 0
      } = req.body;

      const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
      const requiredMargin = Number(price) * Number(quantity) * (productType === 'INTRADAY' ? 0.2 : 1.0);

      if (requiredMargin > tradingWalletState.availableBalance) {
        return res.status(400).json({
          success: false,
          error: 'INSUFFICIENT_MARGIN',
          message: `Insufficient margin. Required ₹${requiredMargin.toFixed(2)}, Available ₹${tradingWalletState.availableBalance.toFixed(2)}`
        });
      }

      const newOrder = {
        id: orderId,
        symbol,
        name,
        side,
        productType,
        orderType,
        lots: Number(lots),
        quantity: Number(quantity),
        price: Number(price),
        triggerPrice: Number(triggerPrice),
        status: orderType === 'MARKET' ? 'EXECUTED' : 'OPEN',
        placedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        filledQuantity: orderType === 'MARKET' ? Number(quantity) : 0
      };

      tradingOrdersState = [newOrder, ...tradingOrdersState];

      if (orderType === 'MARKET') {
        tradingWalletState.availableBalance -= requiredMargin;
        tradingWalletState.usedMargin += requiredMargin;

        const newPos = {
          id: `pos-${Date.now()}`,
          symbol,
          name,
          side,
          productType,
          lots: Number(lots),
          quantity: Number(quantity),
          buyAvgPrice: Number(price),
          currentPrice: Number(price),
          unrealizedPnL: 0,
          pnlPercent: 0,
          marginUsed: requiredMargin,
          entryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        tradingPositionsState = [newPos, ...tradingPositionsState];
      }

      res.status(201).json({
        success: true,
        message: `Order ${orderId} placed successfully.`,
        order: newOrder,
        wallet: tradingWalletState
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/trading/orders/:id/cancel
  app.post('/api/trading/orders/:id/cancel', (req, res) => {
    const { id } = req.params;
    tradingOrdersState = tradingOrdersState.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o);
    res.json({ success: true, message: `Order ${id} cancelled.` });
  });

  // POST /api/trading/positions/close
  app.post('/api/trading/positions/close', (req, res) => {
    const { positionId } = req.body;
    const target = tradingPositionsState.find(p => p.id === positionId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Position not found' });
    }

    tradingWalletState.availableBalance += target.marginUsed + target.unrealizedPnL;
    tradingWalletState.usedMargin -= target.marginUsed;
    tradingWalletState.totalPnL += target.unrealizedPnL;

    tradingPositionsState = tradingPositionsState.filter(p => p.id !== positionId);

    res.json({
      success: true,
      message: `Position for ${target.symbol} closed.`,
      wallet: tradingWalletState,
      positions: tradingPositionsState
    });
  });

  // POST /api/trading/positions/close-all
  app.post('/api/trading/positions/close-all', (req, res) => {
    let releasedMargin = 0;
    let totalPnLRealized = 0;

    tradingPositionsState.forEach(p => {
      releasedMargin += p.marginUsed;
      totalPnLRealized += p.unrealizedPnL;
    });

    tradingWalletState.availableBalance += releasedMargin + totalPnLRealized;
    tradingWalletState.usedMargin = 0;
    tradingWalletState.totalPnL += totalPnLRealized;
    tradingPositionsState = [];

    res.json({
      success: true,
      message: 'All open positions squared off.',
      wallet: tradingWalletState,
      positions: []
    });
  });

  // POST /api/trading/funds/deposit
  app.post('/api/trading/funds/deposit', (req, res) => {
    const { amount = 50000, method = 'UPI' } = req.body;
    const numAmount = Number(amount);
    tradingWalletState.availableBalance += numAmount;

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString()} successfully credited via ${method}.`,
      wallet: tradingWalletState
    });
  });

  // POST /api/trading/funds/withdraw
  app.post('/api/trading/funds/withdraw', (req, res) => {
    const { amount = 10000 } = req.body;
    const numAmount = Number(amount);
    if (numAmount > tradingWalletState.availableBalance) {
      return res.status(400).json({ success: false, error: 'INSUFFICIENT_FUNDS' });
    }
    tradingWalletState.availableBalance -= numAmount;

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString()} withdrawal submitted via IMPS.`,
      wallet: tradingWalletState
    });
  });

  // GET /api/trading/tickets
  app.get('/api/trading/tickets', (req, res) => {
    res.json({
      success: true,
      tickets: tradingTicketsState
    });
  });

  // POST /api/trading/tickets
  app.post('/api/trading/tickets', (req, res) => {
    const { category, priority, subject, message } = req.body;
    const newTicket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      category: category || 'Trading & Orders',
      priority: priority || 'MEDIUM',
      subject: subject || 'Support request',
      status: 'OPEN',
      createdAt: 'Just now',
      lastUpdate: 'Just now',
      messages: [
        {
          id: `MSG-${Date.now()}`,
          sender: 'CLIENT',
          senderName: 'Demo Trader',
          message: message || '',
          timestamp: 'Just now'
        }
      ]
    };
    tradingTicketsState = [newTicket, ...tradingTicketsState];
    res.status(201).json({ success: true, ticket: newTicket });
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
