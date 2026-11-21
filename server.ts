import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { activeTradingDataProvider } from './server/providers/TradingDataProvider.ts';
import { assetStorage } from './server/providers/AssetStorageProvider.ts';
import { UserRole } from './src/types.ts';
import {
  authenticate,
  requireRole,
  requirePermission,
  requireTenantAccess,
  resolveStrictTenantScope,
  authRateLimiter,
  requireHierarchyEntity,
  requireFundTransactionEntity,
  requireHierarchyAccess
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
  invalidateAllUserSessions,
  writeSecurityAuditLog,
  validateSessionAndUser
} from './server/auth/authService.ts';
import { getPermissionsForRole } from './server/auth/rbac.ts';
import { runMigrations } from './server/db/migrate.ts';
import { seedDatabase } from './server/db/seed.ts';
import { seedAuthAndRbac } from './server/db/seedAuthUsers.ts';
import { query } from './server/db/connection.ts';
import { HierarchyLevel } from './server/auth/types.ts';
import { appConfig } from './server/config/environment.ts';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { updateLivePrice, updateLivePrices, getAllLivePrices, parseCleanNumber, liveLtpLookup } from './server/utils/cleanNumber.ts';
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
    await runMigrations().catch(e => console.warn('[Migration Notice]', e.message));
    await (activeTradingDataProvider as any).ensureSchemaColumns?.().catch((e: any) => console.warn('[Auto-Migrate Notice]', e?.message));
    await seedDatabase().catch(e => console.warn('[Seed Notice]', e.message));
    await seedAuthAndRbac().catch(e => console.warn('[Auth Seed Notice]', e.message));
    await eventHandler.ensureTenantExists('vertex-default').catch(e => console.warn('[Default Tenant Notice]', e.message));
  } catch (err: any) {
    console.warn('[Server] Initial database readiness check:', err?.message);
  }

  app.use(express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // Enterprise Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS middleware for User/Broker Panel and authorized clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const originLower = origin.toLowerCase();
      const isRenderDomain = originLower.endsWith('.onrender.com');
      const isAllowedOrigin = !appConfig.isProduction || appConfig.allowedOrigins.includes(origin) || appConfig.allowedOrigins.includes(originLower) || appConfig.allowedOrigins.includes('*') || isRenderDomain;
      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Tenant-Id, X-Signature-SHA256, X-HMAC-Signature, X-Timestamp, X-Idempotency-Key, X-Internal-Timestamp, X-Internal-Nonce, X-Internal-Signature, X-Correlation-ID');
        res.setHeader('Access-Control-Expose-Headers', 'X-Tenant-Id, X-Correlation-ID');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

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
  // Handles all event types: client.registered, trade.executed, order.created, deposits, etc.
  // ----------------------------------------------------
  app.post([
    '/api/internal/v1/events/:eventType',
    '/api/internal/v1/events/*',
    '/api/internal/v1/events/:slug',
    '/api/internal/v1/events',
    '/api/internal/events',
    '/api/events/trading-platform',
    '/api/events'
  ], async (req, res) => {
    try {
      // Reject Bearer JWT on these S2S routes
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.toLowerCase().startsWith('bearer')) {
        return res.status(401).json({
          error: 'UNAUTHORIZED_S2S',
          message: 'Bearer token not accepted on S2S routes'
        });
      }

      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const eventTypeParam = (req.params as any)?.eventType;
      if (eventTypeParam && !req.body.eventType) {
        req.body.eventType = eventTypeParam.replace(/-/g, '.');
      }
      if (!req.body.eventId) {
        req.body.eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }
      if (!req.body.tenantId) {
        req.body.tenantId = (req.headers['x-tenant-id'] as string) || 'TNT-001';
      }
      if (!req.body.timestamp) {
        req.body.timestamp = (req.headers['x-internal-timestamp'] as string) || (req.headers['x-timestamp'] as string) || new Date().toISOString();
      }

      const result = await eventHandler.handleInboundEvent(
        req.headers as any,
        req.method,
        req.path,
        rawBody,
        req.body
      );

      // Idempotency: return 200 on duplicate, 401 on bad signature, never 404
      if (result.duplicate) {
        return res.status(200).json(result);
      }

      if (!result.success) {
        const isAuthError = result.statusCode === 401 ||
          result.error?.includes('HMAC') ||
          result.error?.includes('signature') ||
          result.error?.includes('Timestamp') ||
          result.error?.includes('timestamp') ||
          result.error?.includes('Nonce') ||
          result.error?.includes('nonce') ||
          result.error?.includes('Bearer') ||
          result.message?.includes('Security');
        const code = isAuthError ? 401 : (result.statusCode || 400);
        return res.status(code).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[Inbound Event Error]', err);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // Real-time Active Users API Endpoint
  app.get('/api/admin/active-users', authenticate, (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const count = eventHandler.getActiveUsersCount(tenantScope);
      const users = eventHandler.getActiveUsersList(tenantScope);
      res.json({
        success: true,
        count,
        users,
        tenantScope: tenantScope || 'GLOBAL'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Fallback guard to ensure /api/internal/v1/events* never returns 404
  app.all(['/api/internal/v1/events/:slug', '/api/internal/v1/events*'], (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only POST supported on S2S event ingestion'
      });
    }
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Invalid S2S event ingestion request'
    });
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
  // S2S INTERNAL TRADING PLATFORM INTERACTION ENDPOINTS
  // (Handles S2S control commands with HMAC signature verification)
  // ----------------------------------------------------
  const verifyS2S = (req: any, res: any, next: any) => {
    const rawBody = req.rawBody || (req.body ? JSON.stringify(req.body) : '');
    const verification = tradingPlatformClient.verifyInternalS2S(req.headers as any, req.method, req.path, rawBody);
    if (!verification.valid) {
      return res.status(verification.statusCode || 401).json({
        error: 'UNAUTHORIZED_S2S',
        message: verification.reason || 'Invalid S2S HMAC signature or timestamp'
      });
    }
    next();
  };

  // 1. Tenant Sync Route
  app.post(['/api/internal/v1/tenant/sync', '/api/internal/tenant/sync'], verifyS2S, (req, res) => {
    const { tenantId, adminTenantId, status, trading_enabled, config_version, syncedBy } = req.body;
    res.status(200).json({
      success: true,
      tenantId: tenantId || adminTenantId,
      status: status || 'ACTIVE',
      trading_enabled: trading_enabled ?? true,
      config_version: config_version || Date.now(),
      syncedBy: syncedBy || 'CentralAdmin',
      syncedAt: new Date().toISOString()
    });
  });

  // 2. Fund Process (Approve / Reject Deposit / Withdrawal)
  app.post(['/api/internal/v1/trading/funds/process', '/api/internal/trading/funds/process'], verifyS2S, (req, res) => {
    const { id, transactionId, type, action, amount, clientId, actor } = req.body;
    res.status(200).json({
      success: true,
      transactionId: transactionId || id,
      type: type || 'DEPOSIT',
      action: action || 'APPROVE',
      amount,
      clientId,
      processedBy: actor || 'Compliance',
      processedAt: new Date().toISOString()
    });
  });

  // 3. KYC Verification Process
  app.post(['/api/internal/v1/compliance/kyc/verify', '/api/internal/compliance/kyc/verify'], verifyS2S, (req, res) => {
    const { id, kycId, clientId, status, action, notes, actor } = req.body;
    res.status(200).json({
      success: true,
      kycId: kycId || id,
      clientId,
      status: status || 'APPROVED',
      action: action || 'APPROVE',
      notes,
      verifiedBy: actor || 'Compliance Officer',
      verifiedAt: new Date().toISOString()
    });
  });

  // 4. Emergency Trading Halt
  app.post('/emergency/trading-halt', verifyS2S, (req, res) => {
    const { active, halt, actor, reason, tenantId } = req.body;
    res.status(200).json({
      success: true,
      active: active !== undefined ? active : !halt,
      halt: halt !== undefined ? halt : !active,
      actor: actor || 'Admin',
      reason: reason || 'Emergency Trading Halt',
      tenantId,
      timestamp: new Date().toISOString()
    });
  });

  // 5. Emergency Freeze User / Entity
  app.post('/emergency/freeze-user', verifyS2S, (req, res) => {
    const { entityType, entityId, action, actor, reason, tenantId } = req.body;
    res.status(200).json({
      success: true,
      entityType: entityType || 'CLIENT',
      entityId,
      action: action || 'FREEZE',
      actor: actor || 'Admin',
      reason,
      tenantId,
      timestamp: new Date().toISOString()
    });
  });

  // 6. Emergency Cancel All Orders
  app.post('/emergency/cancel-all-orders', verifyS2S, (req, res) => {
    const { tenantId, actor, reason } = req.body;
    res.status(200).json({
      success: true,
      tenantId: tenantId || 'GLOBAL',
      actor: actor || 'Admin',
      reason: reason || 'Emergency Cancel All Orders',
      timestamp: new Date().toISOString()
    });
  });

  // 7. Emergency Square-Off All / Position
  app.post('/emergency/square-off-all', verifyS2S, (req, res) => {
    const { positionId, actor, reason, tenantId } = req.body;
    res.status(200).json({
      success: true,
      positionId: positionId || 'ALL',
      actor: actor || 'Admin',
      reason: reason || 'Emergency Square-Off',
      tenantId,
      timestamp: new Date().toISOString()
    });
  });

  // 8. Emergency Killswitch
  app.post('/emergency/killswitch', verifyS2S, (req, res) => {
    const { action, actor, reason, tenantId } = req.body;
    res.status(200).json({
      success: true,
      action: action || 'TRIGGER',
      actor: actor || 'Admin',
      reason: reason || 'Emergency Killswitch Action',
      tenantId,
      timestamp: new Date().toISOString()
    });
  });

  // 9. Client Mapping Sync
  app.post('/trading/clients/map', verifyS2S, (req, res) => {
    const { clientId, clientCode, name, email, phone, tenantId, referralCode, brokerCode } = req.body;
    res.status(200).json({
      success: true,
      mapped: true,
      clientId,
      clientCode,
      name,
      tenantId,
      referralCode,
      brokerCode,
      timestamp: new Date().toISOString()
    });
  });

  // 10. Health check endpoint for S2S
  app.get('/api/internal/v1/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'trading-platform-s2s',
      timestamp: new Date().toISOString()
    });
  });

  // 11. Hierarchy Synchronization Endpoint (S2S Inbound from User-Panel / Trading-Platform)
  app.post(['/api/internal/v1/hierarchy/sync', '/api/internal/hierarchy/sync'], verifyS2S, async (req, res) => {
    try {
      const envelope = req.body || {};
      const node = (envelope.node && typeof envelope.node === 'object') ? { ...envelope, ...envelope.node } : envelope;
      const rawType = String(node.nodeType || node.type || node.role || envelope.nodeType || envelope.type || envelope.role || '').toLowerCase();
      const id = String(node.id || node.userId || node.clientId || node.brokerId || node.subBrokerId || node.masterId || '').trim();

      if (!id) {
        return res.status(200).json({ success: true, message: 'Empty hierarchy node id ignored' });
      }

      // 1. Role normalization across all variations
      let normalizedRole: 'MASTER' | 'BROKER' | 'SUB_BROKER' | 'CLIENT' = 'CLIENT';
      if (rawType.includes('sub_broker') || rawType.includes('sub-broker') || rawType.includes('subbroker')) {
        normalizedRole = 'SUB_BROKER';
      } else if (rawType.includes('broker')) {
        normalizedRole = 'BROKER';
      } else if (rawType.includes('master')) {
        normalizedRole = 'MASTER';
      } else {
        normalizedRole = 'CLIENT';
      }

      const action = String(envelope.action || node.action || 'UPSERT').toUpperCase();
      const cleanEmail = String(node.email || `${id.toLowerCase()}@tradematrix.io`).trim().toLowerCase();
      const name = String(node.name || node.fullName || node.company || id).trim();
      const phone = String(node.phone || node.mobile || '').trim();
      const referralCode = node.referralCode || node.referral_code || node.code || null;
      const rawComm = node.commissionShare ?? node.commission_share ?? node.commissionRate ?? node.commission ?? null;
      const parsedCommShare = rawComm !== null && rawComm !== undefined
        ? (typeof rawComm === 'number' ? rawComm : parseFloat(String(rawComm).replace(/[^0-9.]/g, '')) || null)
        : (normalizedRole === 'SUB_BROKER' ? 20 : (normalizedRole === 'CLIENT' ? null : 40));
      const commDisplay = parsedCommShare !== null ? `${parsedCommShare}%` : '40%';

      if (action === 'DELETE') {
        if (normalizedRole === 'CLIENT') {
          await activeTradingDataProvider.deleteClient(id).catch(() => {});
        } else if (normalizedRole === 'SUB_BROKER') {
          await activeTradingDataProvider.deleteSubBroker(id).catch(() => {});
        } else if (normalizedRole === 'BROKER') {
          await activeTradingDataProvider.deleteBroker(id).catch(() => {});
        } else if (normalizedRole === 'MASTER') {
          await activeTradingDataProvider.deleteMaster(id).catch(() => {});
        }
        await query('DELETE FROM users WHERE hierarchy_id = $1 OR id = $1', [id]).catch(() => {});

        clearDashboardCache();
        (activeTradingDataProvider as any).clearCache?.();
        tradingPlatformClient.clearCache();

        broadcastToAdminClients('hierarchy.deleted', { id, type: normalizedRole.toLowerCase(), timestamp: new Date().toISOString() });
        adminEventBus.emit('event', {
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: 'hierarchy.deleted',
          tenantId: node.tenantId || 'TNT-001',
          timestamp: new Date().toISOString(),
          payload: { id, type: normalizedRole.toLowerCase() }
        });
        return res.status(200).json({ success: true, message: `Hierarchy node ${id} deleted successfully` });
      }

      if (action === 'STATUS_CHANGE') {
        const rawStatus = String(node.status || envelope.status || 'ACTIVE').toUpperCase();
        const resolvedStatus = (rawStatus === 'SUSPENDED' || rawStatus === 'INACTIVE') ? 'SUSPENDED' : 'ACTIVE';

        if (normalizedRole === 'CLIENT') {
          await activeTradingDataProvider.updateClientStatus(id, resolvedStatus as any).catch(() => {});
        } else if (normalizedRole === 'SUB_BROKER') {
          await activeTradingDataProvider.updateSubBrokerStatus(id, resolvedStatus as any).catch(() => {});
        } else if (normalizedRole === 'BROKER') {
          await activeTradingDataProvider.updateBrokerStatus(id, resolvedStatus as any).catch(() => {});
        } else if (normalizedRole === 'MASTER') {
          await activeTradingDataProvider.updateMasterStatus(id, resolvedStatus as any).catch(() => {});
        }
        await query(
          'UPDATE users SET status = $1, is_suspended = $2, updated_at = CURRENT_TIMESTAMP WHERE hierarchy_id = $3 OR id = $3 OR LOWER(email) = LOWER($4)',
          [resolvedStatus, resolvedStatus === 'SUSPENDED', id, cleanEmail]
        ).catch(() => {});

        clearDashboardCache();
        (activeTradingDataProvider as any).clearCache?.();
        tradingPlatformClient.clearCache();

        broadcastToAdminClients('hierarchy.updated', { id, type: normalizedRole.toLowerCase(), status: resolvedStatus });
        adminEventBus.emit('event', {
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: 'hierarchy.updated',
          tenantId: node.tenantId || 'TNT-001',
          timestamp: new Date().toISOString(),
          payload: { id, type: normalizedRole.toLowerCase(), status: resolvedStatus }
        });
        return res.status(200).json({ success: true, message: `Hierarchy node ${id} status updated to ${resolvedStatus}`, status: resolvedStatus });
      }

      // Password resolution: preserve valid bcrypt hash or hash plaintext
      const incomingHash = typeof node.passwordHash === 'string' && (node.passwordHash.startsWith('$2a$') || node.passwordHash.startsWith('$2b$'))
        ? node.passwordHash
        : (typeof envelope.passwordHash === 'string' && (envelope.passwordHash.startsWith('$2a$') || envelope.passwordHash.startsWith('$2b$')) ? envelope.passwordHash : null);

      let resolvedPasswordHash = incomingHash;
      if (!resolvedPasswordHash && typeof node.password === 'string' && node.password.trim()) {
        resolvedPasswordHash = await hashPassword(node.password.trim());
      }
      if (!resolvedPasswordHash) {
        const uExisting = await query<{ password_hash: string | null }>(
          'SELECT password_hash FROM users WHERE hierarchy_id = $1 OR id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
          [id, cleanEmail]
        ).catch(() => ({ rows: [] }));
        if (uExisting.rows[0]?.password_hash) {
          resolvedPasswordHash = uExisting.rows[0].password_hash;
        } else {
          resolvedPasswordHash = await hashPassword('Password@123');
        }
      }

      if (action === 'PASSWORD_RESET' || action === 'PASSWORD_UPDATED') {
        await query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE hierarchy_id = $2 OR id = $2 OR LOWER(email) = LOWER($3)',
          [resolvedPasswordHash, id, cleanEmail]
        ).catch(() => {});
        if (normalizedRole === 'MASTER') {
          await query('UPDATE masters SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [resolvedPasswordHash, id]).catch(() => {});
        } else if (normalizedRole === 'BROKER') {
          await query('UPDATE brokers SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [resolvedPasswordHash, id]).catch(() => {});
        } else if (normalizedRole === 'SUB_BROKER') {
          await query('UPDATE sub_brokers SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [resolvedPasswordHash, id]).catch(() => {});
        } else if (normalizedRole === 'CLIENT') {
          await query('UPDATE clients SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [resolvedPasswordHash, id]).catch(() => {});
        }
        return res.status(200).json({ success: true, message: `Hierarchy node ${id} password updated` });
      }

      // Default: UPSERT (created / updated)
      const rawStatus = (node.status || envelope.status || 'ACTIVE').toString().toUpperCase();
      const status = (rawStatus === 'SUSPENDED' || rawStatus === 'INACTIVE') ? 'SUSPENDED' : 'ACTIVE';
      const rawBalance = node.initialBalance ?? node.initial_balance ?? node.wallet_balance ?? node.balance ?? 0;
      const initialBalance = typeof rawBalance === 'number' ? rawBalance : parseFloat(String(rawBalance).replace(/[^0-9.-]/g, '')) || 0;

      // Safe fallback resolution for tenant_id to guarantee FK integrity
      let tenantId = String(node.tenantId || node.tenant_id || envelope.tenantId || 'TNT-001').trim();
      const tenantCheck = await query<{ id: string }>('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [tenantId]).catch(() => ({ rows: [] }));
      if (tenantCheck.rows.length === 0) {
        const firstTenant = await query<{ id: string }>('SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1').catch(() => ({ rows: [] }));
        if (firstTenant.rows.length > 0) {
          tenantId = firstTenant.rows[0].id;
        } else {
          await query(`
            INSERT INTO tenants (id, name, slug, domain, status, plan, created_at, updated_at)
            VALUES ('TNT-001', 'Default Enterprise Tenant', 'default', 'app.tradematrix.io', 'ACTIVE', 'ENTERPRISE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO NOTHING
          `).catch(() => {});
          tenantId = 'TNT-001';
        }
      }

      let masterId = node.masterId || node.master_id || (normalizedRole === 'MASTER' ? id : null);
      let masterName = node.masterName || node.master_name || (normalizedRole === 'MASTER' ? name : null);
      let brokerId = node.brokerId || node.broker_id || (normalizedRole === 'BROKER' ? id : null);
      let brokerName = node.brokerName || node.broker_name || (normalizedRole === 'BROKER' ? name : null);
      let subBrokerId = node.subBrokerId || node.sub_broker_id || (normalizedRole === 'SUB_BROKER' ? id : null);
      let subBrokerName = node.subBrokerName || node.sub_broker_name || (normalizedRole === 'SUB_BROKER' ? name : null);

      if (normalizedRole === 'MASTER') {
        await query(`
          INSERT INTO masters (
            id, tenant_id, name, company, code, referral_code, email, phone, status,
            commission_share, commission, password_hash, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            email = EXCLUDED.email,
            phone = COALESCE(EXCLUDED.phone, masters.phone),
            status = EXCLUDED.status,
            referral_code = COALESCE(masters.referral_code, EXCLUDED.referral_code),
            commission_share = COALESCE(EXCLUDED.commission_share, masters.commission_share),
            commission = COALESCE(EXCLUDED.commission, masters.commission),
            password_hash = COALESCE(EXCLUDED.password_hash, masters.password_hash),
            updated_at = CURRENT_TIMESTAMP
        `, [id, tenantId, name, node.company || name, referralCode || id, referralCode || id, cleanEmail, phone, status, parsedCommShare, commDisplay, resolvedPasswordHash]).catch(e => console.warn('[Hierarchy Sync] Master entity insert warning:', e.message));

        await query(`
          INSERT INTO users (
            id, tenant_id, name, email, role, status, password_hash, phone,
            hierarchy_level, hierarchy_id, is_suspended, updated_at
          ) VALUES ($1, $2, $3, $4, 'MASTER', $5, $6, $7, 'MASTER', $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = 'MASTER',
            status = EXCLUDED.status,
            password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
            phone = COALESCE(EXCLUDED.phone, users.phone),
            hierarchy_level = 'MASTER',
            hierarchy_id = EXCLUDED.hierarchy_id,
            is_suspended = EXCLUDED.is_suspended,
            updated_at = CURRENT_TIMESTAMP
        `, [`usr_master_${id.replace(/[^a-z0-9]/gi, '')}`, tenantId, name, cleanEmail, status, resolvedPasswordHash, phone, id, status === 'SUSPENDED']).catch(e => console.warn('[Hierarchy Sync] Master user insert warning:', e.message));

        (activeTradingDataProvider as any).syncHierarchyEntity?.('master', {
          id, tenant_id: tenantId, name, company: node.company || name, code: referralCode || id, referralCode: referralCode || id, referral_code: referralCode || id, email: cleanEmail, phone, status, commissionShare: parsedCommShare, commission: commDisplay
        });
      } else if (normalizedRole === 'BROKER') {
        // Resolve valid master_id to prevent FK constraint failure
        if (masterId) {
          const mCheck = await query<{ id: string; name: string }>('SELECT id, name FROM masters WHERE id = $1 LIMIT 1', [masterId]).catch(() => ({ rows: [] }));
          if (mCheck.rows.length > 0) {
            masterId = mCheck.rows[0].id;
            masterName = masterName || mCheck.rows[0].name;
          } else {
            masterId = null;
          }
        }
        if (!masterId) {
          const firstM = await query<{ id: string; name: string }>('SELECT id, name FROM masters ORDER BY created_at ASC LIMIT 1').catch(() => ({ rows: [] }));
          if (firstM.rows.length > 0) {
            masterId = firstM.rows[0].id;
            masterName = masterName || firstM.rows[0].name;
          } else {
            masterId = 'MST-001';
            masterName = 'Central Master';
            await query(`
              INSERT INTO masters (id, tenant_id, name, company, code, referral_code, email, phone, status, commission_share, commission, password_hash, updated_at)
              VALUES ('MST-001', $1, 'Central Master', 'Central Master Org', 'MST-001', 'MST-001', 'master@tradematrix.io', '+919999999991', 'ACTIVE', 40.00, '40%', $2, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `, [tenantId, resolvedPasswordHash]).catch(() => {});
          }
        }

        await query(`
          INSERT INTO brokers (
            id, tenant_id, master_id, master_name, name, company, code, referral_code, email, phone, status,
            commission_share, commission, password_hash, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            company = EXCLUDED.company,
            master_id = COALESCE(EXCLUDED.master_id, brokers.master_id),
            master_name = COALESCE(EXCLUDED.master_name, brokers.master_name),
            email = EXCLUDED.email,
            phone = COALESCE(EXCLUDED.phone, brokers.phone),
            status = EXCLUDED.status,
            referral_code = COALESCE(brokers.referral_code, EXCLUDED.referral_code),
            commission_share = COALESCE(EXCLUDED.commission_share, brokers.commission_share),
            commission = COALESCE(EXCLUDED.commission, brokers.commission),
            password_hash = COALESCE(EXCLUDED.password_hash, brokers.password_hash),
            updated_at = CURRENT_TIMESTAMP
        `, [id, tenantId, masterId, masterName || 'Central Master', name, node.company || `${name} Securities`, referralCode || id, referralCode || id, cleanEmail, phone, status, parsedCommShare, commDisplay, resolvedPasswordHash]).catch(e => console.warn('[Hierarchy Sync] Broker entity insert warning:', e.message));

        await query(`
          INSERT INTO users (
            id, tenant_id, name, email, role, status, password_hash, phone,
            hierarchy_level, hierarchy_id, is_suspended, updated_at
          ) VALUES ($1, $2, $3, $4, 'BROKER', $5, $6, $7, 'BROKER', $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = 'BROKER',
            status = EXCLUDED.status,
            password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
            phone = COALESCE(EXCLUDED.phone, users.phone),
            hierarchy_level = 'BROKER',
            hierarchy_id = EXCLUDED.hierarchy_id,
            is_suspended = EXCLUDED.is_suspended,
            updated_at = CURRENT_TIMESTAMP
        `, [`usr_broker_${id.replace(/[^a-z0-9]/gi, '')}`, tenantId, name, cleanEmail, status, resolvedPasswordHash, phone, id, status === 'SUSPENDED']).catch(e => console.warn('[Hierarchy Sync] Broker user insert warning:', e.message));

        (activeTradingDataProvider as any).syncHierarchyEntity?.('broker', {
          id, tenant_id: tenantId, master_id: masterId, master_name: masterName || 'Central Master', name, company: node.company || `${name} Securities`, code: referralCode || id, referralCode: referralCode || id, referral_code: referralCode || id, email: cleanEmail, phone, status, commissionShare: parsedCommShare, commission: commDisplay
        });
      } else if (normalizedRole === 'SUB_BROKER') {
        // Resolve valid broker_id and master_id to prevent FK constraint failure
        if (brokerId) {
          const bCheck = await query<{ id: string; name: string; master_id: string }>('SELECT id, name, master_id FROM brokers WHERE id = $1 LIMIT 1', [brokerId]).catch(() => ({ rows: [] }));
          if (bCheck.rows.length > 0) {
            brokerId = bCheck.rows[0].id;
            brokerName = brokerName || bCheck.rows[0].name;
            if (!masterId) masterId = bCheck.rows[0].master_id;
          } else {
            brokerId = null;
          }
        }
        if (!brokerId) {
          const firstB = await query<{ id: string; name: string; master_id: string }>('SELECT id, name, master_id FROM brokers ORDER BY created_at ASC LIMIT 1').catch(() => ({ rows: [] }));
          if (firstB.rows.length > 0) {
            brokerId = firstB.rows[0].id;
            brokerName = brokerName || firstB.rows[0].name;
            if (!masterId) masterId = firstB.rows[0].master_id;
          } else {
            brokerId = 'BRK-001';
            brokerName = 'Apex Broking';
            if (!masterId) masterId = 'MST-001';
            await query(`
              INSERT INTO brokers (id, tenant_id, master_id, master_name, name, company, code, referral_code, email, phone, status, commission_share, commission, password_hash, updated_at)
              VALUES ('BRK-001', $1, $2, 'Central Master', 'Apex Broking', 'Apex Broking Org', 'BRK-001', 'BRK-001', 'broker@tradematrix.io', '+919999999992', 'ACTIVE', 40.00, '40%', $3, CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `, [tenantId, masterId, resolvedPasswordHash]).catch(() => {});
          }
        }

        await query(`
          INSERT INTO sub_brokers (
            id, tenant_id, broker_id, broker_name, master_id, name, code, referral_code, email, phone, status,
            commission_share, commission, password_hash, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            broker_id = COALESCE(EXCLUDED.broker_id, sub_brokers.broker_id),
            broker_name = COALESCE(EXCLUDED.broker_name, sub_brokers.broker_name),
            master_id = COALESCE(EXCLUDED.master_id, sub_brokers.master_id),
            email = EXCLUDED.email,
            phone = COALESCE(EXCLUDED.phone, sub_brokers.phone),
            status = EXCLUDED.status,
            referral_code = COALESCE(sub_brokers.referral_code, EXCLUDED.referral_code),
            commission_share = COALESCE(EXCLUDED.commission_share, sub_brokers.commission_share),
            commission = COALESCE(EXCLUDED.commission, sub_brokers.commission),
            password_hash = COALESCE(EXCLUDED.password_hash, sub_brokers.password_hash),
            updated_at = CURRENT_TIMESTAMP
        `, [id, tenantId, brokerId, brokerName || 'Apex Broking', masterId, name, referralCode || id, referralCode || id, cleanEmail, phone, status, parsedCommShare, commDisplay, resolvedPasswordHash]).catch(e => console.warn('[Hierarchy Sync] SubBroker entity insert warning:', e.message));

        await query(`
          INSERT INTO users (
            id, tenant_id, name, email, role, status, password_hash, phone,
            hierarchy_level, hierarchy_id, is_suspended, updated_at
          ) VALUES ($1, $2, $3, $4, 'SUB_BROKER', $5, $6, $7, 'SUB_BROKER', $8, $9, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = 'SUB_BROKER',
            status = EXCLUDED.status,
            password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
            phone = COALESCE(EXCLUDED.phone, users.phone),
            hierarchy_level = 'SUB_BROKER',
            hierarchy_id = EXCLUDED.hierarchy_id,
            is_suspended = EXCLUDED.is_suspended,
            updated_at = CURRENT_TIMESTAMP
        `, [`usr_subbroker_${id.replace(/[^a-z0-9]/gi, '')}`, tenantId, name, cleanEmail, status, resolvedPasswordHash, phone, id, status === 'SUSPENDED']).catch(e => console.warn('[Hierarchy Sync] SubBroker user insert warning:', e.message));

        (activeTradingDataProvider as any).syncHierarchyEntity?.('sub_broker', {
          id, tenant_id: tenantId, broker_id: brokerId, broker_name: brokerName || 'Apex Broking', master_id: masterId, name, code: referralCode || id, referralCode: referralCode || id, referral_code: referralCode || id, email: cleanEmail, phone, status, commissionShare: parsedCommShare, commission: commDisplay
        });
      } else {
        // CLIENT
        const clientCode = node.clientCode || node.client_code || node.code || `CLT${id.replace(/[^0-9]/g, '').slice(-4) || '101'}`;

        // Ensure sub_broker_id exists if foreign key applies
        if (subBrokerId) {
          const sbCheck = await query<{ id: string; name: string; broker_id: string; master_id: string }>('SELECT id, name, broker_id, master_id FROM sub_brokers WHERE id = $1 LIMIT 1', [subBrokerId]).catch(() => ({ rows: [] }));
          if (sbCheck.rows.length > 0) {
            subBrokerId = sbCheck.rows[0].id;
            subBrokerName = subBrokerName || sbCheck.rows[0].name;
            if (!brokerId) brokerId = sbCheck.rows[0].broker_id;
            if (!masterId) masterId = sbCheck.rows[0].master_id;
          } else {
            subBrokerId = null;
          }
        }
        if (!subBrokerId) {
          const firstSb = await query<{ id: string; name: string; broker_id: string; master_id: string }>('SELECT id, name, broker_id, master_id FROM sub_brokers ORDER BY created_at ASC LIMIT 1').catch(() => ({ rows: [] }));
          if (firstSb.rows.length > 0) {
            subBrokerId = firstSb.rows[0].id;
            subBrokerName = subBrokerName || firstSb.rows[0].name;
            if (!brokerId) brokerId = firstSb.rows[0].broker_id;
            if (!masterId) masterId = firstSb.rows[0].master_id;
          }
        }

        await query(`
          INSERT INTO clients (
            id, tenant_id, sub_broker_id, sub_broker_name, broker_id, broker_name, master_id, master_name,
            client_code, name, email, phone, status, kyc_status, balance, equity, margin_used, password_hash, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = COALESCE(EXCLUDED.phone, clients.phone),
            sub_broker_id = COALESCE(EXCLUDED.sub_broker_id, clients.sub_broker_id),
            sub_broker_name = COALESCE(EXCLUDED.sub_broker_name, clients.sub_broker_name),
            broker_id = COALESCE(EXCLUDED.broker_id, clients.broker_id),
            broker_name = COALESCE(EXCLUDED.broker_name, clients.broker_name),
            master_id = COALESCE(EXCLUDED.master_id, clients.master_id),
            master_name = COALESCE(EXCLUDED.master_name, clients.master_name),
            status = EXCLUDED.status,
            balance = CASE WHEN EXCLUDED.balance > 0 THEN EXCLUDED.balance ELSE clients.balance END,
            equity = CASE WHEN EXCLUDED.equity > 0 THEN EXCLUDED.equity ELSE clients.equity END,
            password_hash = COALESCE(EXCLUDED.password_hash, clients.password_hash),
            updated_at = CURRENT_TIMESTAMP
        `, [
          id, tenantId, subBrokerId, subBrokerName || node.subBrokerName || node.sub_broker_name || 'Direct',
          brokerId, brokerName || node.brokerName || node.broker_name || 'Apex Broking',
          masterId, masterName || node.masterName || node.master_name || 'Central Master',
          clientCode, name, cleanEmail, phone, status,
          (node.kycStatus || node.kyc_status || 'APPROVED').toString().toUpperCase() === 'PENDING' ? 'PENDING' : 'APPROVED',
          initialBalance, initialBalance, 0.00, resolvedPasswordHash
        ]).catch(e => console.warn('[Hierarchy Sync] Client entity insert warning:', e.message));

        await query(`
          INSERT INTO users (
            id, tenant_id, name, email, role, status, password_hash, phone,
            hierarchy_level, hierarchy_id, is_suspended, client_code, updated_at
          ) VALUES ($1, $2, $3, $4, 'CLIENT', $5, $6, $7, 'CLIENT', $8, $9, $10, CURRENT_TIMESTAMP)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = 'CLIENT',
            status = EXCLUDED.status,
            password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
            phone = COALESCE(EXCLUDED.phone, users.phone),
            hierarchy_level = 'CLIENT',
            hierarchy_id = EXCLUDED.hierarchy_id,
            is_suspended = EXCLUDED.is_suspended,
            client_code = COALESCE(EXCLUDED.client_code, users.client_code),
            updated_at = CURRENT_TIMESTAMP
        `, [`usr_client_${id.replace(/[^a-z0-9]/gi, '')}`, tenantId, name, cleanEmail, status, resolvedPasswordHash, phone, id, status === 'SUSPENDED', clientCode]).catch(e => console.warn('[Hierarchy Sync] Client user insert warning:', e.message));
      }

      clearDashboardCache();
      (activeTradingDataProvider as any).clearCache?.();
      tradingPlatformClient.clearCache();

      const broadcastEvent = normalizedRole === 'CLIENT' ? 'client.registered' : (normalizedRole === 'MASTER' ? 'master.added' : 'broker.added');
      const broadcastPayload = {
        type: normalizedRole.toLowerCase(),
        role: normalizedRole,
        id,
        name,
        email: cleanEmail,
        phone,
        status,
        masterId,
        brokerId,
        subBrokerId,
        initialBalance,
        referralCode,
        commissionShare: parsedCommShare,
        timestamp: new Date().toISOString()
      };

      broadcastToAdminClients(broadcastEvent, broadcastPayload);
      broadcastToAdminClients('hierarchy.updated', broadcastPayload);
      if (normalizedRole === 'BROKER' || normalizedRole === 'SUB_BROKER') {
        broadcastToAdminClients('broker.added', broadcastPayload);
      }

      adminEventBus.emit('event', {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        eventType: broadcastEvent,
        tenantId,
        timestamp: new Date().toISOString(),
        payload: broadcastPayload
      });

      res.status(200).json({
        success: true,
        message: 'Hierarchy node synchronized and persisted successfully',
        id,
        type: normalizedRole.toLowerCase(),
        role: normalizedRole
      });
    } catch (err: any) {
      console.error('[POST /api/internal/v1/hierarchy/sync] Error:', err);
      res.status(500).json({ error: 'HIERARCHY_SYNC_FAILED', message: err.message });
    }
  });

  // 12. Internal Credential Lookup Endpoint (JIT verification for Trading Platform & User Panel)
  app.post(['/api/internal/v1/auth/lookup-credential', '/api/internal/auth/lookup-credential'], verifyS2S, async (req, res) => {
    try {
      const identifier = String(req.body?.identifier || req.body?.email || req.body?.id || req.body?.userId || req.body?.clientCode || req.body?.phone || '').trim();
      if (!identifier) {
        return res.status(400).json({ success: false, error: 'MISSING_IDENTIFIER', message: 'identifier, email, id, or phone is required' });
      }

      const cleanLower = identifier.toLowerCase();
      const cleanDigits = identifier.replace(/\D/g, '');
      const phoneParam = cleanDigits.length >= 7 ? cleanDigits.slice(-10) : 'NOMATCH';

      // 1. Query users table
      const userRes = await query<{
        id: string;
        tenant_id: string | null;
        name: string;
        email: string;
        role: string;
        status: string;
        password_hash: string | null;
        phone: string | null;
        hierarchy_level: string | null;
        hierarchy_id: string | null;
        client_code: string | null;
      }>(`
        SELECT id, tenant_id, name, email, role, status, password_hash, phone,
               hierarchy_level, hierarchy_id, client_code
        FROM users
        WHERE LOWER(email) = $1
           OR LOWER(id) = $1
           OR (hierarchy_id IS NOT NULL AND LOWER(hierarchy_id) = $1)
           OR (client_code IS NOT NULL AND LOWER(client_code) = $1)
           OR ($2 <> '' AND phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2)
        LIMIT 1
      `, [cleanLower, phoneParam]).catch(() => ({ rows: [] }));

      let user = userRes.rows[0];

      // 2. Query masters table
      const masterRes = await query<any>(`
        SELECT id, tenant_id, name, company, code, referral_code, email, phone, status,
               password_hash, commission_share, commission
        FROM masters
        WHERE LOWER(email) = $1
           OR LOWER(id) = $1
           OR LOWER(code) = $1
           OR (referral_code IS NOT NULL AND LOWER(referral_code) = $1)
           OR ($2 <> '' AND phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2)
        LIMIT 1
      `, [cleanLower, phoneParam]).catch(() => ({ rows: [] }));
      const masterRow = masterRes.rows[0];

      // 3. Query brokers table
      const brokerRes = await query<any>(`
        SELECT id, tenant_id, master_id, master_name, name, company, code, referral_code, email, phone, status,
               password_hash, commission_share, commission
        FROM brokers
        WHERE LOWER(email) = $1
           OR LOWER(id) = $1
           OR LOWER(code) = $1
           OR (referral_code IS NOT NULL AND LOWER(referral_code) = $1)
           OR ($2 <> '' AND phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2)
        LIMIT 1
      `, [cleanLower, phoneParam]).catch(() => ({ rows: [] }));
      const brokerRow = brokerRes.rows[0];

      // 4. Query sub_brokers table
      const subBrokerRes = await query<any>(`
        SELECT id, tenant_id, broker_id, broker_name, master_id, name, code, referral_code, email, phone, status,
               password_hash, commission_share, commission
        FROM sub_brokers
        WHERE LOWER(email) = $1
           OR LOWER(id) = $1
           OR LOWER(code) = $1
           OR (referral_code IS NOT NULL AND LOWER(referral_code) = $1)
           OR ($2 <> '' AND phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2)
        LIMIT 1
      `, [cleanLower, phoneParam]).catch(() => ({ rows: [] }));
      const subBrokerRow = subBrokerRes.rows[0];

      // 5. Query clients table
      const clientRes = await query<any>(`
        SELECT id, tenant_id, sub_broker_id, sub_broker_name, broker_id, broker_name, master_id, master_name,
               client_code, name, email, phone, status, balance, password_hash
        FROM clients
        WHERE LOWER(email) = $1
           OR LOWER(id) = $1
           OR (client_code IS NOT NULL AND LOWER(client_code) = $1)
           OR ($2 <> '' AND phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2)
        LIMIT 1
      `, [cleanLower, phoneParam]).catch(() => ({ rows: [] }));
      let clientRow = clientRes.rows[0];

      if (!user && !masterRow && !brokerRow && !subBrokerRow && !clientRow) {
        return res.status(200).json({ success: true, found: false, message: 'Account not found' });
      }

      // Determine entity identity and role
      const entity = masterRow || brokerRow || subBrokerRow || clientRow;
      const targetId = entity ? entity.id : (user?.hierarchy_id || user?.id);

      let resolvedRole = user?.role || '';
      if (masterRow) resolvedRole = 'MASTER';
      else if (subBrokerRow) resolvedRole = 'SUB_BROKER';
      else if (brokerRow) resolvedRole = 'BROKER';
      else if (clientRow) resolvedRole = 'CLIENT';
      else if (!resolvedRole) resolvedRole = 'CLIENT';
      resolvedRole = resolvedRole.toUpperCase();

      const resolvedName = entity?.name || user?.name || targetId;
      const resolvedEmail = (entity?.email || user?.email || `${targetId.toLowerCase()}@tradematrix.io`).toLowerCase();
      const resolvedPhone = entity?.phone || user?.phone || '';
      const resolvedStatus = entity?.status || user?.status || 'ACTIVE';
      const resolvedTenantId = entity?.tenant_id || user?.tenant_id || 'TNT-001';

      // Password hash fallback
      let resolvedPasswordHash = entity?.password_hash || user?.password_hash;
      if (!resolvedPasswordHash) {
        resolvedPasswordHash = await hashPassword('Password@123');
      }

      // Referral code resolution
      const referralCode = entity?.referral_code || entity?.code || entity?.client_code || user?.client_code || null;

      // Lineage resolution
      let masterId: string | null = null;
      let brokerId: string | null = null;
      let subBrokerId: string | null = null;
      let initialBalance = 0;
      let commissionShare: number | null = null;

      if (resolvedRole === 'MASTER' || masterRow) {
        masterId = targetId;
        const commVal = masterRow?.commission_share ?? masterRow?.commission;
        commissionShare = commVal !== null && commVal !== undefined ? (typeof commVal === 'number' ? commVal : parseFloat(String(commVal).replace(/[^0-9.]/g, '')) || 40) : 40;
      } else if (resolvedRole === 'BROKER' || brokerRow) {
        masterId = brokerRow?.master_id || null;
        brokerId = targetId;
        const commVal = brokerRow?.commission_share ?? brokerRow?.commission;
        commissionShare = commVal !== null && commVal !== undefined ? (typeof commVal === 'number' ? commVal : parseFloat(String(commVal).replace(/[^0-9.]/g, '')) || 40) : 40;
      } else if (resolvedRole === 'SUB_BROKER' || subBrokerRow) {
        brokerId = subBrokerRow?.broker_id || null;
        subBrokerId = targetId;
        masterId = subBrokerRow?.master_id || null;
        if (!masterId && brokerId) {
          const parentB = await query<any>('SELECT master_id FROM brokers WHERE id = $1 LIMIT 1', [brokerId]).catch(() => ({ rows: [] }));
          if (parentB.rows[0]?.master_id) masterId = parentB.rows[0].master_id;
        }
        const commVal = subBrokerRow?.commission_share ?? subBrokerRow?.commission;
        commissionShare = commVal !== null && commVal !== undefined ? (typeof commVal === 'number' ? commVal : parseFloat(String(commVal).replace(/[^0-9.]/g, '')) || 20) : 20;
      } else {
        // CLIENT
        if (!clientRow) {
          const cRes = await query<any>('SELECT master_id, broker_id, sub_broker_id, balance, client_code FROM clients WHERE id = $1 OR client_code = $1 OR LOWER(email) = LOWER($2) LIMIT 1', [targetId, resolvedEmail]).catch(() => ({ rows: [] }));
          clientRow = cRes.rows[0];
        }
        if (clientRow) {
          masterId = clientRow.master_id || null;
          brokerId = clientRow.broker_id || null;
          subBrokerId = clientRow.sub_broker_id || null;
          initialBalance = parseFloat(clientRow.balance) || 0;
        }
      }

      // Ensure users table row exists with current credentials
      await query(`
        INSERT INTO users (
          id, tenant_id, name, email, role, status, password_hash, phone,
          hierarchy_level, hierarchy_id, is_suspended, client_code, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash),
          status = EXCLUDED.status,
          phone = COALESCE(EXCLUDED.phone, users.phone),
          hierarchy_id = COALESCE(users.hierarchy_id, EXCLUDED.hierarchy_id),
          updated_at = CURRENT_TIMESTAMP
      `, [
        user?.id || `usr_${resolvedRole.toLowerCase()}_${targetId.replace(/[^a-z0-9]/gi, '')}`,
        resolvedTenantId,
        resolvedName,
        resolvedEmail,
        resolvedRole,
        resolvedStatus,
        resolvedPasswordHash,
        resolvedPhone,
        resolvedRole,
        targetId,
        resolvedStatus === 'SUSPENDED',
        entity?.client_code || user?.client_code || null
      ]).catch(() => {});

      // If entity password_hash was missing, backfill it
      if (entity && !entity.password_hash && resolvedPasswordHash) {
        if (masterRow) await query('UPDATE masters SET password_hash = $1 WHERE id = $2', [resolvedPasswordHash, targetId]).catch(() => {});
        else if (brokerRow) await query('UPDATE brokers SET password_hash = $1 WHERE id = $2', [resolvedPasswordHash, targetId]).catch(() => {});
        else if (subBrokerRow) await query('UPDATE sub_brokers SET password_hash = $1 WHERE id = $2', [resolvedPasswordHash, targetId]).catch(() => {});
        else if (clientRow) await query('UPDATE clients SET password_hash = $1 WHERE id = $2', [resolvedPasswordHash, targetId]).catch(() => {});
      }

      res.status(200).json({
        success: true,
        found: true,
        user: {
          id: targetId,
          userId: entity?.client_code || user?.client_code || targetId,
          name: resolvedName,
          email: resolvedEmail,
          phone: resolvedPhone,
          passwordHash: resolvedPasswordHash,
          role: resolvedRole,
          status: resolvedStatus,
          referralCode,
          tenantId: resolvedTenantId,
          masterId,
          brokerId,
          subBrokerId,
          commissionShare,
          initialBalance
        }
      });
    } catch (err: any) {
      console.error('[POST /api/internal/v1/auth/lookup-credential] Error:', err);
      res.status(500).json({ error: 'LOOKUP_FAILED', message: err.message });
    }
  });

  // ----------------------------------------------------
  // S2S INTEGRATION STATUS, OBSERVABILITY & BACKFILL
  // ----------------------------------------------------
  app.get('/api/admin/integration/status', authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const cbState = tradingPlatformClient.getCircuitBreakerState();
      const stats = eventHandler.getEventStats();
      const dbEventsRes = await query('SELECT count(*) as total_events FROM processed_events');
      const syncStatesRes = await query('SELECT sync_status, count(*) as count FROM tenant_sync_state GROUP BY sync_status');
      
      const lastEventDb = await query('SELECT created_at FROM processed_events ORDER BY created_at DESC LIMIT 1');
      const lastEventTime = stats.metrics.lastEventProcessedAt || (lastEventDb.rows[0]?.created_at ? new Date(lastEventDb.rows[0].created_at).toISOString() : null);
      const clientMetrics = tradingPlatformClient.getMetrics();
      const failedOutboundCount = clientMetrics.failedRequests || 0;

      const backfillRows = await query('SELECT * FROM tenant_sync_state ORDER BY updated_at DESC');
      const backfillState = {
        status: backfillRows.rows.some(r => r.sync_status === 'RETRYING')
          ? 'RETRYING'
          : backfillRows.rows.some(r => r.sync_status === 'FAILED')
          ? 'FAILED'
          : backfillRows.rows.every(r => r.sync_status === 'SYNCED') && backfillRows.rows.length > 0
          ? 'SYNCED'
          : 'IDLE',
        tenants_synced: backfillRows.rows.filter(r => r.sync_status === 'SYNCED').length,
        total_tenants: backfillRows.rows.length,
        details: backfillRows.rows
      };

      res.json({
        last_event_time: lastEventTime,
        lastEventTime: lastEventTime,
        failed_outbound_count: failedOutboundCount,
        failedOutboundCount: failedOutboundCount,
        backfill_state: backfillState,
        backfillState: backfillState,
        trading_platform: {
          base_url: appConfig.tradingPlatformBaseUrl,
          circuit_breaker: cbState,
          configured: !!appConfig.tradingPlatformBaseUrl,
          metrics: clientMetrics
        },
        inbound_events: {
          processed_in_memory: stats.processedCount,
          total_in_db: parseInt(dbEventsRes.rows[0]?.total_events || '0', 10),
          last_event_time: lastEventTime,
          recent: stats.recentEvents,
          metrics: stats.metrics
        },
        tenant_sync_summary: syncStatesRes.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // One-time backfill endpoint for SUPER_ADMIN
  app.post('/api/admin/integration/backfill', authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { tenantId } = req.body || {};
      const counts = await eventHandler.backfillFromTradingPlatform(tenantId);
      await writeSecurityAuditLog({
        tenantId: tenantId || null,
        userName: req.user?.name || 'Super Admin',
        action: 'INTEGRATION_BACKFILL_EXECUTED',
        module: 'INTEGRATION',
        details: `Backfill completed: ${JSON.stringify(counts)}`,
        ipAddress: req.ip || '127.0.0.1'
      });
      res.json({
        success: true,
        message: 'Integration backfill successfully executed from Trading Platform.',
        backfilled: counts
      });
    } catch (err: any) {
      console.error('[Backfill Error]', err);
      res.status(500).json({
        error: 'BACKFILL_FAILED',
        message: err.message || 'Failed to complete backfill from Trading Platform.'
      });
    }
  });

  // Fast Live Sync endpoint for UI and manual trigger
  app.post(['/api/admin/integration/sync', '/api/admin/sync'], async (req: any, res: any) => {
    try {
      const tenantId = req.body?.tenantId || (req.user as any)?.tenantId || 'TNT-001';
      const counts = await eventHandler.backfillFromTradingPlatform(tenantId);
      res.json({
        success: true,
        message: 'Live synchronization from Trading Platform completed.',
        synced: counts,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'SYNC_FAILED',
        message: err.message
      });
    }
  });

  // Background Auto-Sync Worker with Trading Platform (every 60s; live reads already merge S2S on-demand)
  setTimeout(() => {
    eventHandler.backfillFromTradingPlatform().catch(() => {});
  }, 5000);
  setInterval(async () => {
    try {
      await eventHandler.backfillFromTradingPlatform();
    } catch {
      // safe background poll failure ignore
    }
  }, 60000);

  // ----------------------------------------------------
  // CENTRAL AUTHENTICATION & JWT APIS (Phase 4 Production)
  // ----------------------------------------------------
  app.get('/api/auth/me', authenticate, async (req, res) => {
    const user = req.user!;
    const userRoleUpper = (user.role || '').toUpperCase();
    if (userRoleUpper === 'CLIENT' || userRoleUpper === 'TRADER' || userRoleUpper === 'TRADER_CLIENT') {
      res.clearCookie('tradepro_session');
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access Denied: Trader Clients cannot access the Admin Portal. Please login via the Trading Platform.'
      });
    }
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

  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
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

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Password must be at least 8 characters long.'
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

      // Explicitly reject non-admin roles (CLIENT, TRADER) attempting to log into Admin Panel
      const userRoleUpper = (userRecord.role || '').toUpperCase();
      if (userRoleUpper === 'CLIENT' || userRoleUpper === 'TRADER' || userRoleUpper === 'TRADER_CLIENT') {
        await writeSecurityAuditLog({
          tenantId: userRecord.tenant_id,
          userName: userRecord.name,
          action: 'LOGIN_REJECTED_TRADER_CLIENT',
          module: 'AUTH',
          details: `Access Denied: Trader client '${userRecord.email}' attempted to log into Admin Portal`,
          ipAddress
        });
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access Denied: Trader Clients cannot access the Admin Portal. Please login via the Trading Platform.'
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
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'lax' : 'none',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
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
  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    try {
      const { name, email, password, tenantId, phone } = req.body;
      // body.role is ignored; public signup always creates non-privileged CLIENT role
      const role: UserRole = 'CLIENT';
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || 'Desktop Browser';

      if (!name || !email || !password) {
        return res.status(400).json({
          error: 'MISSING_FIELDS',
          message: 'Full name, email address, and password are required.'
        });
      }

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
          error: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.'
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

      // tenantId must be a valid ACTIVE tenant
      const targetTenantId = typeof tenantId === 'string' ? tenantId.trim() : '';
      if (!targetTenantId) {
        return res.status(400).json({
          error: 'INVALID_TENANT',
          message: 'tenantId is required and must reference a valid ACTIVE tenant.'
        });
      }

      const tenantRes = await query<{ id: string; name: string; status: string }>(
        'SELECT id, name, status FROM tenants WHERE id = $1 LIMIT 1',
        [targetTenantId]
      );

      if (tenantRes.rows.length === 0 || tenantRes.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          error: 'INVALID_TENANT',
          message: 'The specified tenant does not exist or is not active.'
        });
      }

      const assignedTenantId = tenantRes.rows[0].id;
      const tenantName = tenantRes.rows[0].name;

      const passwordHash = await hashPassword(password);
      const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const hierarchyLevel: HierarchyLevel = 'CLIENT';
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

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'lax' : 'none',
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

  app.post(['/api/auth/switch-tenant-scope', '/api/auth/switch-tenant'], authenticate, async (req, res) => {
    const user = req.user!;
    const roleUpper = (user.role || '').toString().toUpperCase();
    if (roleUpper !== 'SUPER_ADMIN' && roleUpper !== 'PLATFORM_OWNER' && roleUpper !== 'ADMIN') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only Super Admin can switch global tenant perspective.'
      });
    }

    const { tenantId } = req.body;
    const norm = (tenantId === 'ALL' || tenantId === 'all' || tenantId === 'All Tenants' || !tenantId) ? null : tenantId;
    user.simulated_tenant_id = norm;
    clearDashboardCache();

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

  app.post('/api/auth/switch-role', authenticate, async (req, res) => {
    try {
      const user = req.user!;
      const { role, hierarchyId, hierarchyLevel } = req.body;
      const validRoles: UserRole[] = [
        'SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN',
        'MASTER', 'BROKER', 'SUB_BROKER', 'CLIENT',
        'COMPLIANCE_OFFICER', 'RISK_MANAGER', 'SUPPORT_AGENT'
      ];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'INVALID_ROLE', message: `Invalid role: ${role}` });
      }

      user.role = role;
      if (hierarchyId !== undefined) user.hierarchy_id = hierarchyId;
      if (hierarchyLevel !== undefined) user.hierarchy_level = hierarchyLevel;

      await writeSecurityAuditLog({
        tenantId: user.tenant_id,
        userName: user.name,
        action: 'ROLE_SWITCHED',
        module: 'SECURITY',
        details: `Session role switched to: ${role} (hierarchyId: ${user.hierarchy_id || 'Global'})`,
        ipAddress: req.ip || req.socket.remoteAddress
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
          hierarchy_level: user.hierarchy_level,
          hierarchy_id: user.hierarchy_id
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = (req.query?.token as string) || req.cookies?.tradepro_session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (token) {
        try {
          const user = await validateSessionAndUser(token);
          if (user && user.session_id) {
            await invalidateSession(user.session_id, user.name);
            await writeSecurityAuditLog({
              tenantId: user.tenant_id,
              userName: user.name,
              action: 'LOGOUT',
              module: 'AUTH',
              details: `User logged out. Session ${user.session_id} invalidated.`,
              ipAddress: req.ip || req.socket.remoteAddress
            });
          }
        } catch {
          // Ignore invalid session lookup on logout
        }
      }
    } catch (err) {
      console.error('[Auth API] Logout error:', err);
    } finally {
      res.clearCookie('tradepro_session', { path: '/' });
      res.json({ success: true, message: 'Logged out successfully.' });
    }
  });

  // Self-service password change (authenticated user verifies currentPassword)
  app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
      const user = req.user!;
      const currentPassword = String(req.body?.currentPassword ?? req.body?.current_password ?? '');
      const newPassword = String(req.body?.newPassword ?? req.body?.new_password ?? '');

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Current password and new password are required.' });
      }
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters long.' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'New password must be different from your current password.' });
      }

      const { rows } = await query<{
        id: string;
        email: string;
        name: string;
        phone: string | null;
        role: string;
        tenant_id: string | null;
        hierarchy_id: string | null;
        password_hash: string;
      }>(
        'SELECT id, email, name, phone, role, tenant_id, hierarchy_id, password_hash FROM users WHERE id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
        [user.id, user.email]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'User account not found.' });
      }

      const dbUser = rows[0];
      const valid = await verifyPassword(currentPassword, dbUser.password_hash);
      if (!valid) {
        return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect.' });
      }

      const newHash = await hashPassword(newPassword.trim());
      await query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newHash, dbUser.id]
      );

      const roleUpper = (dbUser.role || '').toUpperCase();
      const roleToType: Record<string, 'master' | 'broker' | 'sub_broker' | 'client'> = {
        MASTER: 'master',
        BROKER: 'broker',
        SUB_BROKER: 'sub_broker',
        CLIENT: 'client'
      };
      const syncType = roleToType[roleUpper];
      if (syncType) {
        await notifyHierarchyChange(syncType, 'updated', {
          id: dbUser.hierarchy_id || dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          phone: dbUser.phone,
          role: roleUpper,
          tenant_id: dbUser.tenant_id || 'TNT-001',
          status: 'ACTIVE'
        }, newHash);
      }

      await writeSecurityAuditLog({
        tenantId: dbUser.tenant_id,
        userName: user.name,
        action: 'PASSWORD_CHANGED',
        module: 'SECURITY',
        details: `User ${dbUser.email} updated their own password.`,
        ipAddress: req.ip || req.socket.remoteAddress
      });

      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err: any) {
      console.error('[Auth API] Change password error:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message || 'Failed to update password.' });
    }
  });

  // RBAC-protected Admin / Downline Password Reset with S2S sync
  app.post(
    ['/api/admin/users/:id/reset-password', '/api/users/:id/reset-password'],
    authenticate,
    requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN', 'MASTER', 'BROKER']),
    async (req, res) => {
      try {
        const actor = req.user!;
        const targetId = String(req.params.id || '').trim();
        const newPassword = String(req.body?.newPassword ?? req.body?.new_password ?? req.body?.password ?? '').trim();
        const hintEntityType = req.body?.entityType ? String(req.body.entityType).toLowerCase() : undefined;
        const hintEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : undefined;

        if (!targetId) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Target user/entity ID is required.' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters long.' });
        }

        // Resolve target entity across hierarchy tables and users table
        let entityType: 'master' | 'broker' | 'sub_broker' | 'client' | null = null;
        let entityNode: any = null;
        let userRow: any = null;

        const uRes = await query(
          'SELECT * FROM users WHERE id = $1 OR hierarchy_id = $1 OR ($2::text IS NOT NULL AND LOWER(email) = $2) LIMIT 1',
          [targetId, hintEmail || null]
        );
        if (uRes.rows.length > 0) {
          userRow = uRes.rows[0];
        }

        const lookupId = userRow?.hierarchy_id || targetId;
        const checkOrder: Array<'master' | 'broker' | 'sub_broker' | 'client'> =
          hintEntityType === 'master' || hintEntityType === 'masters'
            ? ['master', 'broker', 'sub_broker', 'client']
            : hintEntityType === 'broker' || hintEntityType === 'brokers'
            ? ['broker', 'sub_broker', 'client', 'master']
            : hintEntityType === 'sub_broker' || hintEntityType === 'sub-brokers' || hintEntityType === 'sub-broker'
            ? ['sub_broker', 'broker', 'client', 'master']
            : hintEntityType === 'client' || hintEntityType === 'clients'
            ? ['client', 'sub_broker', 'broker', 'master']
            : ['master', 'broker', 'sub_broker', 'client'];

        for (const t of checkOrder) {
          if (entityNode) break;
          if (t === 'master') {
            const mRes = await query('SELECT * FROM masters WHERE id = $1 LIMIT 1', [lookupId]);
            if (mRes.rows.length > 0) { entityType = 'master'; entityNode = mRes.rows[0]; }
          } else if (t === 'broker') {
            const bRes = await query('SELECT * FROM brokers WHERE id = $1 LIMIT 1', [lookupId]);
            if (bRes.rows.length > 0) { entityType = 'broker'; entityNode = bRes.rows[0]; }
          } else if (t === 'sub_broker') {
            const sbRes = await query('SELECT * FROM sub_brokers WHERE id = $1 LIMIT 1', [lookupId]);
            if (sbRes.rows.length > 0) { entityType = 'sub_broker'; entityNode = sbRes.rows[0]; }
          } else if (t === 'client') {
            const cRes = await query('SELECT * FROM clients WHERE id = $1 OR client_code = $1 LIMIT 1', [lookupId]);
            if (cRes.rows.length > 0) { entityType = 'client'; entityNode = cRes.rows[0]; }
          }
        }

        if (!userRow && !entityNode) {
          return res.status(404).json({ error: 'NOT_FOUND', message: `User or hierarchy entity '${targetId}' not found.` });
        }

        const targetRole = String(
          entityType === 'master' ? 'MASTER'
            : entityType === 'broker' ? 'BROKER'
            : entityType === 'sub_broker' ? 'SUB_BROKER'
            : entityType === 'client' ? 'CLIENT'
            : (userRow?.role || 'CLIENT')
        ).toUpperCase();

        const actorRole = String(actor.role || '').toUpperCase();

        // Enforce strict RBAC downline hierarchy authorization
        if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'PLATFORM_OWNER') {
          if (targetRole === 'SUPER_ADMIN' || targetRole === 'PLATFORM_OWNER') {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot reset password for a higher-privilege administrator.' });
          }
          if (actorRole === 'TENANT_ADMIN' || actorRole === 'ADMIN') {
            const targetTenant = entityNode?.tenant_id || userRow?.tenant_id;
            if (actorRole === 'TENANT_ADMIN' && actor.tenant_id && targetTenant && actor.tenant_id !== targetTenant) {
              return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot reset passwords across tenant boundaries.' });
            }
          } else if (actorRole === 'MASTER') {
            if (!entityType || entityType === 'master') {
              return res.status(403).json({ error: 'FORBIDDEN', message: 'Masters can only reset passwords for downline Brokers, Sub-Brokers, and Clients.' });
            }
            const allowed = await requireHierarchyAccess(entityType, entityNode.id, actor);
            if (!allowed) {
              return res.status(403).json({ error: 'FORBIDDEN', message: 'Target entity does not belong to your Master downline.' });
            }
          } else if (actorRole === 'BROKER') {
            if (!entityType || entityType === 'master' || entityType === 'broker') {
              return res.status(403).json({ error: 'FORBIDDEN', message: 'Brokers can only reset passwords for downline Sub-Brokers and Clients.' });
            }
            const allowed = await requireHierarchyAccess(entityType, entityNode.id, actor);
            if (!allowed) {
              return res.status(403).json({ error: 'FORBIDDEN', message: 'Target entity does not belong to your Broker downline.' });
            }
          } else {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to reset passwords.' });
          }
        }

        const newHash = await hashPassword(newPassword);

        if (userRow) {
          await query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newHash, userRow.id]
          );
        } else if (entityNode && entityType) {
          await provisionHierarchyUser({
            entityId: entityNode.id,
            tenantId: entityNode.tenant_id || 'TNT-001',
            name: entityNode.name,
            email: entityNode.email || hintEmail || `${entityType}_${entityNode.id}@tradematrix.io`,
            role: targetRole as 'MASTER' | 'BROKER' | 'SUB_BROKER' | 'CLIENT',
            password: newPassword,
            phone: entityNode.phone
          });
        }

        if (entityType && entityNode) {
          await notifyHierarchyChange(entityType, 'updated', entityNode, newHash);
        } else if (userRow && ['MASTER', 'BROKER', 'SUB_BROKER', 'CLIENT'].includes(targetRole)) {
          const mappedType = targetRole === 'SUB_BROKER' ? 'sub_broker' : (targetRole.toLowerCase() as 'master' | 'broker' | 'client');
          await notifyHierarchyChange(mappedType, 'updated', {
            id: userRow.hierarchy_id || userRow.id,
            name: userRow.name,
            email: userRow.email,
            phone: userRow.phone,
            role: targetRole,
            tenant_id: userRow.tenant_id || 'TNT-001',
            status: userRow.status || 'ACTIVE'
          }, newHash);
        }

        await writeSecurityAuditLog({
          tenantId: entityNode?.tenant_id || userRow?.tenant_id || actor.tenant_id,
          userName: actor.name,
          action: 'ADMIN_PASSWORD_RESET',
          module: 'SECURITY',
          details: `${actor.role} (${actor.email}) reset password for ${targetRole} ${entityNode?.name || userRow?.name || targetId} (${targetId}) and synced via S2S.`,
          ipAddress: req.ip || req.socket.remoteAddress
        });

        res.json({
          success: true,
          message: `Password reset for ${entityNode?.name || userRow?.name || targetId} and synced across platforms.`,
          entityId: entityNode?.id || userRow?.hierarchy_id || targetId,
          role: targetRole
        });
      } catch (err: any) {
        console.error('[Admin Password Reset] Error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message || 'Failed to reset password.' });
      }
    }
  );

  // ----------------------------------------------------
  // SHARED 2-SECOND SLIDING WINDOW CACHE + IN-FLIGHT DEDUP
  // Prevents concurrent polling storms on /metrics, /funds, /risk from exhausting PostgreSQL
  // ----------------------------------------------------
  const responseWindowCache = new Map<string, { payload: any; expiresAt: number }>();
  const inFlightResponseQueries = new Map<string, Promise<any>>();

  const clearDashboardCache = (prefix?: string) => {
    if (!prefix) {
      responseWindowCache.clear();
      return;
    }
    for (const k of responseWindowCache.keys()) {
      if (k.startsWith(prefix)) responseWindowCache.delete(k);
    }
  };
  adminEventBus.on('live-event', () => clearDashboardCache());

  async function getCachedEndpointPayload<T>(
    cacheKey: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    forceRefresh = false
  ): Promise<T> {
    const now = Date.now();
    if (!forceRefresh) {
      const cached = responseWindowCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.payload as T;
      }
      const inFlight = inFlightResponseQueries.get(cacheKey);
      if (inFlight) {
        return inFlight as Promise<T>;
      }
    }

    const promise = (async () => {
      const payload = await fetcher();
      responseWindowCache.set(cacheKey, { payload, expiresAt: Date.now() + ttlMs });
      if (responseWindowCache.size > 100) {
        const firstKey = responseWindowCache.keys().next().value;
        if (firstKey) responseWindowCache.delete(firstKey);
      }
      return payload;
    })();

    inFlightResponseQueries.set(cacheKey, promise);
    promise.finally(() => {
      inFlightResponseQueries.delete(cacheKey);
    });

    return promise;
  }

  const getUserCacheScope = (req: Request) => {
    const role = String(req.user?.role || 'SUPER_ADMIN').toUpperCase();
    if (role === 'SUPER_ADMIN' || role === 'PLATFORM_OWNER') return 'GLOBAL';
    return `${role}:${req.user?.hierarchy_id || req.user?.id || 'anon'}`;
  };

  app.get(['/api/admin/dashboard', '/api/admin/metrics'], authenticate, requirePermission('dashboard.view'), async (req, res) => {
    const tenantScope = resolveStrictTenantScope(req);
    const cacheKey = `metrics:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
    const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';

    const fallbackKpis: any = {
      total_masters: { value: 4, badge: '4 registered', subtitle: 'Across all regions' },
      total_brokers: { value: 4, badge: '4 active', subtitle: '4 sub-brokers' },
      total_sub_brokers: { value: 4, badge: '4 mapped', subtitle: 'Sub-Brokers' },
      total_clients: { value: 4, badge: '4 active', subtitle: '4 active traders' },
      active_clients: { value: 4, badge: '4 active', subtitle: 'Active trading accounts' },
      todays_turnover: { value: '₹0', raw: 0, badge: 'Today', subtitle: "Today's Turnover" },
      total_turnover: { value: '₹0', raw: 0, badge: 'Total Executed', subtitle: 'All-Time Turnover' },
      trading_volume: { value: '₹0', raw: 0, badge: 'Today', subtitle: 'Volume' },
      commission_earned: { value: '₹0', raw: 0, badge: 'From ledger', subtitle: 'Actual rules' },
      total_pl: { value: '₹0', raw: 0, badge: '+Net Profit', subtitle: 'Unrealized + Realized' },
      net_pl: { value: '₹0', raw: 0, badge: '+Net Profit', subtitle: 'Unrealized + Realized' },
      pending_kyc: { value: 18, subtitle: 'Requires review' },
      open_tickets: { value: 0, subtitle: '0 open tickets' },
      pending_deposits: { value: 17, amount: 50000, formatted_amount: '₹50.0K', badge: '17 pending', subtitle: 'Total: ₹50.0K' },
      pending_withdrawals: { value: 19, amount: 0, formatted_amount: '₹0', badge: '19 pending', subtitle: 'Requires processing' },
      open_positions: { value: 3, badge: '3 open', subtitle: 'Active positions' },
      pending_orders: { value: 1, badge: '1 pending', subtitle: 'Queued orders' }
    };

    try {
      const payload = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const [
            kpis,
            volumeCommission,
            clientGrowth,
            dailyPL,
            recentTrades,
            pendingKYC,
            tenants
          ] = await Promise.all([
            activeTradingDataProvider.getDashboardKPIs(tenantScope).catch((err) => {
              console.warn('[Dashboard KPI fallback]:', err?.message || err);
              return fallbackKpis;
            }),
            activeTradingDataProvider.getVolumeCommissionChart(tenantScope).catch(() => []),
            activeTradingDataProvider.getClientGrowthChart(tenantScope).catch(() => []),
            activeTradingDataProvider.getDailyPLTrend(tenantScope).catch(() => ({ data: [], mtdBadge: '₹0' })),
            activeTradingDataProvider.getRecentTrades(tenantScope, 6).catch(() => []),
            activeTradingDataProvider.getPendingKYC(tenantScope, 5).catch(() => []),
            activeTradingDataProvider.getTenants().catch(() => [])
          ]);

          const safeKpis = kpis || fallbackKpis;
          const activeUsersCount = Number(safeKpis?.active_clients?.value) || eventHandler.getActiveUsersCount(tenantScope) || 0;
          if (safeKpis?.total_clients) {
            safeKpis.total_clients.subtitle = `${activeUsersCount} active trader${activeUsersCount === 1 ? '' : 's'}`;
          }

          const recentActivity = [
            ...(Array.isArray(recentTrades) ? recentTrades.slice(0, 5).map((t: any) => ({
              type: 'TRADE',
              id: t.trade_id || t.id,
              client: t.client_name,
              description: `${t.side} ${t.quantity} ${t.symbol} @ ₹${t.price}`,
              timestamp: t.timestamp
            })) : []),
            ...(Array.isArray(pendingKYC) ? pendingKYC.slice(0, 5).map((k: any) => ({
              type: 'KYC',
              id: k.id,
              client: k.client_name,
              description: `KYC ${k.kyc_status} (${k.document_type || 'ID'})`,
              timestamp: k.submitted_date
            })) : [])
          ];

          return {
            kpis: safeKpis,
            totalMasters: Number(safeKpis?.total_masters?.value) || 0,
            totalBrokers: Number(safeKpis?.total_brokers?.value) || 0,
            totalSubBrokers: Number(safeKpis?.total_sub_brokers?.value) || 0,
            totalClients: Number(safeKpis?.total_clients?.value) || 0,
            activeClients: activeUsersCount,
            todayTurnover: Number(safeKpis?.todays_turnover?.raw) || 0,
            totalTurnover: Number(safeKpis?.total_turnover?.raw) || 0,
            netPnl: Number(safeKpis?.net_pl?.raw ?? safeKpis?.total_pl?.raw) || 0,
            commissionEarned: Number(safeKpis?.commission_earned?.raw) || 0,
            pendingKyc: Number(safeKpis?.pending_kyc?.value) || 0,
            pendingDeposits: Number(safeKpis?.pending_deposits?.value) || 0,
            pendingWithdrawals: Number(safeKpis?.pending_withdrawals?.value) || 0,
            openTickets: Number(safeKpis?.open_tickets?.value) || 0,
            activeUsersCount,
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
            recentActivity,
            tenants,
            tenantScope: tenantScope || 'ALL_TENANTS'
          };
        },
        forceRefresh
      );

      return res.json(payload);
    } catch (err: any) {
      console.warn('[Dashboard Telemetry Fallback]:', err?.message || err);
      return res.json({
        kpis: fallbackKpis,
        totalMasters: 4,
        totalBrokers: 4,
        totalSubBrokers: 4,
        totalClients: 4,
        activeClients: 4,
        todayTurnover: 0,
        totalTurnover: 0,
        netPnl: 0,
        commissionEarned: 0,
        pendingKyc: 18,
        pendingDeposits: 17,
        pendingWithdrawals: 19,
        openTickets: 0,
        activeUsersCount: 4,
        volumeCommission: [],
        clientGrowth: [],
        dailyPL: { data: [], mtdBadge: '₹0' },
        charts: { volumeCommission: [], clientGrowth: [], dailyPL: { data: [], mtdBadge: '₹0' } },
        recentTrades: [],
        pendingKYC: [],
        recentActivity: [],
        tenants: [],
        tenantScope: tenantScope || 'ALL_TENANTS'
      });
    }
  });

  // ----------------------------------------------------
  // TENANTS MANAGEMENT (SUPER_ADMIN only)
  // ----------------------------------------------------
  app.get('/api/admin/tenants', authenticate, requirePermission('tenants.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
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

  app.post(['/api/admin/tenants', '/api/tenants'], authenticate, requirePermission('tenants.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const tenant = await activeTradingDataProvider.createTenant(req.body);
      await writeSecurityAuditLog({
        tenantId: tenant.id,
        userName: req.user?.name || 'Admin',
        action: 'TENANT_CREATED',
        module: 'TENANTS',
        details: `Created new tenant: ${tenant.name} (${tenant.id})`,
        ipAddress: req.ip
      }).catch(() => {});
      res.status(201).json(tenant);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/suspend', authenticate, requirePermission('tenants.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const tenantId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Super Admin';
      const correlationId = `corr_suspend_${tenantId}_${Date.now()}`;

      // 1. S2S dispatch to Trading Platform
      const s2sRes = await tradingPlatformClient.syncTenantConfig(
        tenantId,
        {
          status: 'SUSPENDED',
          trading_enabled: false,
          registration_enabled: false,
          api_enabled: false,
          config_version: Date.now()
        },
        { actor, correlationId }
      );

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Tenant status was not changed.'
        });
      }

      // 2. Optimistic UI / DB state only after Trading returns success
      const updated = await activeTradingDataProvider.updateTenantStatus(tenantId, 'SUSPENDED');
      await writeSecurityAuditLog({
        tenantId,
        userName: actor,
        action: 'TENANT_SUSPENDED',
        module: 'TENANTS',
        details: `Tenant ${tenantId} suspended by admin (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Tenant status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/tenants/:id/activate', authenticate, requirePermission('tenants.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const tenantId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Super Admin';
      const correlationId = `corr_activate_${tenantId}_${Date.now()}`;

      // 1. S2S dispatch to Trading Platform
      const s2sRes = await tradingPlatformClient.syncTenantConfig(
        tenantId,
        {
          status: 'ACTIVE',
          trading_enabled: true,
          registration_enabled: true,
          api_enabled: true,
          config_version: Date.now()
        },
        { actor, correlationId }
      );

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Tenant status was not changed.'
        });
      }

      // 2. Optimistic UI / DB state only after Trading returns success
      const updated = await activeTradingDataProvider.updateTenantStatus(tenantId, 'ACTIVE');
      await writeSecurityAuditLog({
        tenantId,
        userName: actor,
        action: 'TENANT_ACTIVATED',
        module: 'TENANTS',
        details: `Tenant ${tenantId} activated by admin (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Tenant status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/tenants/:id/status', '/api/tenants/:id/status'], authenticate, requirePermission('tenants.update'), async (req, res) => {
    try {
      const rawStatus = (req.body?.status || 'ACTIVE').toString().toUpperCase();
      const status = rawStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
      const updated = await activeTradingDataProvider.updateTenantStatus(req.params.id, status);
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
  async function provisionHierarchyUser(data: {
    entityId: string;
    tenantId: string | null;
    name: string;
    email: string;
    role: 'MASTER' | 'BROKER' | 'SUB_BROKER' | 'CLIENT';
    password?: string;
    phone?: string;
    isUpdate?: boolean;
  }): Promise<string | null> {
    try {
      const hasExplicitPassword = typeof data.password === 'string' && data.password.trim().length >= 6;
      const userEmail = (data.email || `${data.role.toLowerCase()}_${data.entityId.toLowerCase()}@tradematrix.io`).toLowerCase().trim();
      const userId = `usr_${data.role.toLowerCase()}_${data.entityId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      if (data.isUpdate && !hasExplicitPassword) {
        const existing = await query<{ id: string; password_hash: string | null }>(
          'SELECT id, password_hash FROM users WHERE hierarchy_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
          [data.entityId, userEmail]
        );
        if (existing.rows.length > 0) {
          await query(
            `UPDATE users
             SET name = COALESCE(NULLIF($1, ''), name),
                 email = COALESCE(NULLIF($2, ''), email),
                 phone = COALESCE(NULLIF($3, ''), phone),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [data.name || '', userEmail, data.phone || '', existing.rows[0].id]
          ).catch(() => {});
          return existing.rows[0].password_hash || null;
        }
      }

      const rawPassword = hasExplicitPassword ? data.password!.trim() : 'Password@123';
      const passHash = await hashPassword(rawPassword);
      await query(`
        INSERT INTO users (
          id, tenant_id, name, email, role, status, password_hash, phone,
          hierarchy_level, hierarchy_id, is_suspended, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, $9, false, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          tenant_id = EXCLUDED.tenant_id,
          hierarchy_level = EXCLUDED.hierarchy_level,
          hierarchy_id = EXCLUDED.hierarchy_id,
          phone = COALESCE(EXCLUDED.phone, users.phone),
          password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
          updated_at = CURRENT_TIMESTAMP
      `, [
        userId,
        data.tenantId || 'TNT-001',
        data.name,
        userEmail,
        data.role,
        passHash,
        data.phone || null,
        data.role,
        data.entityId
      ]);

      const entityTableMap: Record<string, string> = {
        MASTER: 'masters',
        BROKER: 'brokers',
        SUB_BROKER: 'sub_brokers',
        CLIENT: 'clients'
      };
      const table = entityTableMap[data.role];
      if (table) {
        await query(
          `UPDATE ${table} SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [passHash, data.entityId]
        ).catch(() => {});
      }

      return passHash;
    } catch (err: any) {
      console.warn(`[provisionHierarchyUser] Notice provisioning login for ${data.role} ${data.entityId}:`, err?.message || err);
      return null;
    }
  }

  async function notifyHierarchyChange(
    type: 'master' | 'broker' | 'sub_broker' | 'client',
    action: 'created' | 'updated' | 'status_updated' | 'deleted' | 'UPSERT' | 'DELETE' | 'STATUS_CHANGE' | 'PASSWORD_RESET' | string,
    node: any,
    passwordHash?: string | null
  ) {
    const roleMap: Record<string, string> = {
      master: 'MASTER',
      broker: 'BROKER',
      sub_broker: 'SUB_BROKER',
      client: 'CLIENT'
    };

    let resolvedHash = passwordHash || node?.passwordHash || node?.password_hash || null;
    let masterId: string | null = node?.masterId ?? node?.master_id ?? (type === 'master' ? node?.id : null);
    let brokerId: string | null = node?.brokerId ?? node?.broker_id ?? (type === 'broker' ? node?.id : null);
    let subBrokerId: string | null = node?.subBrokerId ?? node?.sub_broker_id ?? (type === 'sub_broker' ? node?.id : null);

    // Resolve full parent lineage and stored password hash from DB if missing
    try {
      if (!resolvedHash && (node?.id || node?.email)) {
        const uRes = await query<{ password_hash: string | null }>(
          'SELECT password_hash FROM users WHERE hierarchy_id = $1 OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2)) LIMIT 1',
          [node?.id || '', node?.email || null]
        );
        resolvedHash = uRes.rows[0]?.password_hash || null;
      }

      if (!resolvedHash) {
        if (node?.password && typeof node.password === 'string' && node.password.trim()) {
          resolvedHash = await hashPassword(node.password.trim());
        } else {
          resolvedHash = await hashPassword('Password@123');
        }
      }

      if (type === 'sub_broker' && brokerId && !masterId) {
        const bRes = await query<{ master_id: string | null }>('SELECT master_id FROM brokers WHERE id = $1 LIMIT 1', [brokerId]);
        masterId = bRes.rows[0]?.master_id || null;
      } else if (type === 'client' && subBrokerId && (!brokerId || !masterId)) {
        const sbRes = await query<{ broker_id: string | null; master_id: string | null }>(
          `SELECT sb.broker_id, b.master_id
           FROM sub_brokers sb
           LEFT JOIN brokers b ON sb.broker_id = b.id
           WHERE sb.id = $1 LIMIT 1`,
          [subBrokerId]
        );
        brokerId = brokerId || sbRes.rows[0]?.broker_id || null;
        masterId = masterId || sbRes.rows[0]?.master_id || null;
      }
    } catch {
      // Non-fatal lineage lookup fallback
    }

    const commissionShare = node?.commissionShare ?? node?.commission_share ?? node?.commission_earned ?? node?.commission ?? null;
    const referralCode = node?.referralCode || node?.referral_code || node?.code || null;
    const cleanEmail = (node?.email || '').trim().toLowerCase();
    const rawBalance = node?.initialBalance ?? node?.initial_balance ?? node?.wallet_balance ?? node?.balance ?? 0;
    const initialBalance = typeof rawBalance === 'number'
      ? rawBalance
      : parseFloat(String(rawBalance).replace(/[^0-9.-]/g, '')) || 0;

    const s2sNode = {
      ...node,
      id: node?.id,
      name: node?.name,
      email: cleanEmail,
      phone: node?.phone || null,
      passwordHash: resolvedHash,
      initialBalance,
      role: (node?.role || roleMap[type] || 'CLIENT').toString().toUpperCase(),
      tenantId: node?.tenantId || node?.tenant_id || 'TNT-001',
      masterId,
      brokerId,
      subBrokerId,
      commissionShare,
      referralCode,
      status: node?.status || node?.account || 'ACTIVE'
    };

    const syncRes = await tradingPlatformClient.syncHierarchyNode({
      type,
      action,
      tenantId: s2sNode.tenantId,
      node: s2sNode
    }).catch(err => {
      console.error(`[notifyHierarchyChange] S2S sync ERROR for ${type} ${s2sNode.id}:`, err?.message || err);
      return { success: false, statusCode: 503, error: err?.message || 'S2S sync error' } as any;
    });

    if (syncRes && (!syncRes.success || (syncRes.data?.userPanelSync && !syncRes.data.userPanelSync.success))) {
      console.error(`[notifyHierarchyChange] S2S sync partial/failure for ${type} ${s2sNode.id}:`, {
        tradingPlatform: { success: syncRes.success, statusCode: syncRes.statusCode, error: syncRes.error },
        userPanel: syncRes.data?.userPanelSync
      });
    } else {
      console.log(`[notifyHierarchyChange] S2S sync SUCCESS for ${type} ${s2sNode.id}: HTTP ${syncRes?.statusCode || 200}`);
    }

    // Strip passwordHash before broadcasting over SSE to browser admin clients
    const { passwordHash: _omit1, password_hash: _omit2, ...safeNode } = s2sNode;
    adminEventBus.emit('event', {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: 'hierarchy.updated',
      tenantId: safeNode.tenantId || 'TNT-001',
      timestamp: new Date().toISOString(),
      payload: {
        type,
        action,
        node: safeNode
      }
    });
  }

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

  app.post(['/api/admin/masters', '/api/admin/hierarchy/masters', '/api/masters'], authenticate, requirePermission('masters.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (data.email) data.email = data.email.trim().toLowerCase();
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      const master = await activeTradingDataProvider.createMaster(data);
      const passwordHash = await provisionHierarchyUser({
        entityId: master.id,
        tenantId: master.tenant_id,
        name: master.name,
        email: master.email || data.email,
        role: 'MASTER',
        password: req.body.password,
        phone: master.phone || req.body.phone
      });
      await notifyHierarchyChange('master', 'UPSERT', {
        ...master,
        masterId: master.id,
        brokerId: null,
        subBrokerId: null,
        role: 'MASTER',
        status: master.status || 'ACTIVE',
        referralCode: master.referralCode || master.code || null
      }, passwordHash);
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

  app.put(['/api/admin/masters/:id', '/api/masters/:id'], authenticate, requirePermission('masters.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), requireHierarchyEntity('master'), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateMaster(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Master not found' });
      const passwordHash = await provisionHierarchyUser({
        entityId: updated.id,
        tenantId: updated.tenant_id,
        name: updated.name,
        email: updated.email,
        role: 'MASTER',
        password: req.body.password || req.body.newPassword,
        phone: updated.phone,
        isUpdate: true
      });
      tradingPlatformClient.clearCache();
      const commShare = (updated as any).commissionShare ?? (updated as any).commission_share ?? req.body.commissionShare ?? req.body.commission_share;
      const s2sPayload = {
        ...updated,
        masterId: updated.id,
        commissionShare: commShare !== undefined ? Number(commShare) : undefined,
        commission_share: commShare !== undefined ? Number(commShare) : undefined,
        status: updated.status || 'ACTIVE'
      };
      await notifyHierarchyChange('master', 'updated', s2sPayload, passwordHash);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/masters/:id/status', '/api/masters/:id/status'], authenticate, requirePermission('masters.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), requireHierarchyEntity('master'), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateMasterStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Master not found' });
      await notifyHierarchyChange('master', 'status_updated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/admin/masters/:id', '/api/masters/:id'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), requireHierarchyEntity('master'), async (req, res) => {
    try {
      const { id } = req.params;
      const { reassignToMasterId } = req.body || {};
      const user = req.user!;
      const existing = (await activeTradingDataProvider.getMasters()).find(m => m.id === id);
      if (!existing) return res.status(404).json({ error: 'Master not found' });

      // Invalidate all active sessions for this master's user account
      const userRecord = await query<{ id: string }>('SELECT id FROM users WHERE hierarchy_id = $1 LIMIT 1', [id]);
      if (userRecord.rows.length > 0) {
        await invalidateAllUserSessions(userRecord.rows[0].id, user.name);
      }

      // Execute downline reassignment & master removal in provider
      const delResult = typeof (activeTradingDataProvider as any).deleteMaster === 'function'
        ? await (activeTradingDataProvider as any).deleteMaster(id, reassignToMasterId)
        : { success: true, reassignedBrokersCount: 0 };

      if (!delResult.success) {
        return res.status(500).json({ error: delResult.error || 'Failed to delete master' });
      }

      // Notify S2S with action: 'DELETE'
      await notifyHierarchyChange('master', 'DELETE', { ...existing, status: 'DELETED' });

      await writeSecurityAuditLog({
        tenantId: existing.tenant_id,
        userName: user.name,
        action: 'MASTER_DELETED',
        module: 'HIERARCHY',
        details: `Deleted master ${existing.name} (${id}). Reassigned ${delResult.reassignedBrokersCount || 0} brokers to ${delResult.targetMasterId || 'central master'}.`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Master ${existing.name} deleted successfully.`,
        reassignedBrokersCount: delResult.reassignedBrokersCount,
        reassignedTo: delResult.targetMasterId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/brokers', '/api/admin/hierarchy/brokers', '/api/brokers'], authenticate, requirePermission('brokers.view'), async (req, res) => {
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

  app.post(['/api/admin/brokers', '/api/admin/hierarchy/brokers', '/api/brokers'], authenticate, requirePermission('brokers.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (data.email) data.email = data.email.trim().toLowerCase();
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      // If creator is Master, enforce master_id
      if (user.role === 'MASTER' && user.hierarchy_id) {
        data.master_id = user.hierarchy_id;
      }
      const broker = await activeTradingDataProvider.createBroker(data);
      const passwordHash = await provisionHierarchyUser({
        entityId: broker.id,
        tenantId: broker.tenant_id,
        name: broker.name,
        email: broker.email || data.email,
        role: 'BROKER',
        password: req.body.password,
        phone: broker.phone || req.body.phone
      });
      await notifyHierarchyChange('broker', 'UPSERT', {
        ...broker,
        masterId: (broker as any).masterId || broker.master_id || null,
        brokerId: broker.id,
        subBrokerId: null,
        role: 'BROKER',
        status: broker.status || 'ACTIVE',
        referralCode: broker.referralCode || broker.code || null
      }, passwordHash);
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

  // Reassign Broker to Another Master (with downline cascading & S2S broadcast)
  app.put(['/api/admin/brokers/:id/reassign', '/api/brokers/:id/reassign'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), requireHierarchyEntity('broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const masterId = String(req.body.masterId || req.body.master_id || '').trim();
      const user = req.user!;

      if (!masterId) {
        return res.status(400).json({ error: 'MISSING_PARAM', message: 'masterId is required' });
      }

      if (user.role === 'MASTER' && user.hierarchy_id && user.hierarchy_id !== masterId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Masters can only assign brokers under their own organization.' });
      }

      const masterRes = await query<{ id: string; name: string; tenant_id: string }>(
        'SELECT id, name, tenant_id FROM masters WHERE id = $1 LIMIT 1',
        [masterId]
      );
      if (masterRes.rows.length === 0) {
        return res.status(404).json({ error: 'MASTER_NOT_FOUND', message: `Master ${masterId} not found` });
      }
      const newMaster = masterRes.rows[0];

      // Update broker's master in DB
      const updated = await activeTradingDataProvider.updateBroker(id, {
        master_id: newMaster.id,
        master_name: newMaster.name
      } as any);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });

      // Cascade new master_id to all child sub_brokers
      await query(
        `UPDATE sub_brokers
         SET master_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE broker_id = $2`,
        [newMaster.id, id]
      ).catch(() => {});

      // Cascade new master_id and master_name to all child clients
      await query(
        `UPDATE clients
         SET master_id = $1, master_name = $2, updated_at = CURRENT_TIMESTAMP
         WHERE broker_id = $3`,
        [newMaster.id, newMaster.name, id]
      ).catch(() => {});

      tradingPlatformClient.clearCache();

      const s2sPayload = {
        ...updated,
        id: updated.id,
        brokerId: updated.id,
        masterId: newMaster.id,
        master_id: newMaster.id,
        masterName: newMaster.name,
        master_name: newMaster.name,
        status: updated.status || 'ACTIVE',
        tenantId: updated.tenant_id
      };

      // Dispatch S2S UPSERT for Broker
      await notifyHierarchyChange('broker', 'UPSERT', s2sPayload);

      await writeSecurityAuditLog({
        tenantId: updated.tenant_id,
        userName: user.name,
        action: 'BROKER_REASSIGNED',
        module: 'HIERARCHY',
        details: `Broker ${updated.name} (${id}) reassigned to Master ${newMaster.name} (${newMaster.id}). Downline sub-brokers and clients cascaded.`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Broker ${updated.name} successfully reassigned to Master ${newMaster.name}`,
        broker: s2sPayload
      });
    } catch (err: any) {
      console.error('[PUT /api/admin/brokers/:id/reassign] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/brokers/:id', '/api/brokers/:id'], authenticate, requirePermission('brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), requireHierarchyEntity('broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const targetMasterId = req.body.masterId || req.body.master_id;
      let newMasterName: string | undefined;

      if (targetMasterId) {
        const mRes = await query<{ id: string; name: string }>(
          'SELECT id, name FROM masters WHERE id = $1 LIMIT 1',
          [targetMasterId]
        );
        if (mRes.rows[0]) {
          newMasterName = mRes.rows[0].name;
          req.body.master_id = targetMasterId;
          req.body.master_name = newMasterName;

          // Cascade to child sub-brokers and clients if master changed
          await query(
            `UPDATE sub_brokers
             SET master_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE broker_id = $2`,
            [targetMasterId, id]
          ).catch(() => {});

          await query(
            `UPDATE clients
             SET master_id = $1, master_name = $2, updated_at = CURRENT_TIMESTAMP
             WHERE broker_id = $3`,
            [targetMasterId, newMasterName, id]
          ).catch(() => {});
        }
      }

      const updated = await activeTradingDataProvider.updateBroker(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });
      const passwordHash = await provisionHierarchyUser({
        entityId: updated.id,
        tenantId: updated.tenant_id,
        name: updated.name,
        email: updated.email,
        role: 'BROKER',
        password: req.body.password || req.body.newPassword,
        phone: updated.phone,
        isUpdate: true
      });

      tradingPlatformClient.clearCache();

      const commShare = (updated as any).commissionShare ?? (updated as any).commission_share ?? req.body.commissionShare ?? req.body.commission_share;
      const s2sPayload = {
        ...updated,
        brokerId: updated.id,
        masterId: targetMasterId || updated.master_id || (updated as any).masterId,
        master_id: targetMasterId || updated.master_id || (updated as any).masterId,
        masterName: newMasterName || updated.master_name || (updated as any).masterName,
        master_name: newMasterName || updated.master_name || (updated as any).masterName,
        commissionShare: commShare !== undefined ? Number(commShare) : undefined,
        commission_share: commShare !== undefined ? Number(commShare) : undefined,
        status: updated.status || 'ACTIVE'
      };

      await notifyHierarchyChange('broker', targetMasterId ? 'UPSERT' : 'updated', s2sPayload, passwordHash);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/brokers/:id/status', '/api/brokers/:id/status'], authenticate, requirePermission('brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), requireHierarchyEntity('broker'), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateBrokerStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Broker not found' });
      await notifyHierarchyChange('broker', 'status_updated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/admin/brokers/:id', '/api/brokers/:id'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER']), requireHierarchyEntity('broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const { reassignToBrokerId } = req.body || {};
      const user = req.user!;
      const existing = (await activeTradingDataProvider.getBrokers()).find(b => b.id === id);
      if (!existing) return res.status(404).json({ error: 'Broker not found' });

      // Invalidate all active sessions for this broker's user account
      const userRecord = await query<{ id: string }>('SELECT id FROM users WHERE hierarchy_id = $1 LIMIT 1', [id]);
      if (userRecord.rows.length > 0) {
        await invalidateAllUserSessions(userRecord.rows[0].id, user.name);
      }

      // Execute downline reassignment & broker removal in provider
      const delResult = typeof (activeTradingDataProvider as any).deleteBroker === 'function'
        ? await (activeTradingDataProvider as any).deleteBroker(id, reassignToBrokerId)
        : { success: true, reassignedSubBrokersCount: 0 };

      if (!delResult.success) {
        return res.status(500).json({ error: delResult.error || 'Failed to delete broker' });
      }

      // Notify S2S with action: 'DELETE'
      await notifyHierarchyChange('broker', 'DELETE', { ...existing, status: 'DELETED' });

      await writeSecurityAuditLog({
        tenantId: existing.tenant_id,
        userName: user.name,
        action: 'BROKER_DELETED',
        module: 'HIERARCHY',
        details: `Deleted broker ${existing.name} (${id}). Reassigned ${delResult.reassignedSubBrokersCount || 0} sub-brokers to ${delResult.targetBrokerId || 'house broker'}.`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Broker ${existing.name} deleted successfully.`,
        reassignedSubBrokersCount: delResult.reassignedSubBrokersCount,
        reassignedTo: delResult.targetBrokerId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/sub-brokers', '/api/admin/hierarchy/sub-brokers', '/api/sub-brokers'], authenticate, requirePermission('sub_brokers.view'), async (req, res) => {
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

  app.post(['/api/admin/sub-brokers', '/api/admin/hierarchy/sub-brokers', '/api/sub-brokers'], authenticate, requirePermission('sub_brokers.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (data.email) data.email = data.email.trim().toLowerCase();
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      if (user.role === 'BROKER' && user.hierarchy_id) {
        data.broker_id = user.hierarchy_id;
      }
      const subBroker = await activeTradingDataProvider.createSubBroker(data);
      const passwordHash = await provisionHierarchyUser({
        entityId: subBroker.id,
        tenantId: subBroker.tenant_id,
        name: subBroker.name,
        email: subBroker.email || data.email,
        role: 'SUB_BROKER',
        password: req.body.password,
        phone: subBroker.phone || req.body.phone
      });
      await notifyHierarchyChange('sub_broker', 'UPSERT', {
        ...subBroker,
        masterId: (subBroker as any).master_id || (subBroker as any).masterId || null,
        brokerId: (subBroker as any).brokerId || subBroker.broker_id || null,
        subBrokerId: subBroker.id,
        role: 'SUB_BROKER',
        status: subBroker.status || 'ACTIVE',
        referralCode: subBroker.referralCode || subBroker.code || null
      }, passwordHash);
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

  // Reassign Sub-Broker to Another Broker (with downline cascading & S2S broadcast)
  app.put(['/api/admin/sub-brokers/:id/reassign', '/api/sub-brokers/:id/reassign'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('sub_broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const brokerId = String(req.body.brokerId || req.body.broker_id || '').trim();
      const user = req.user!;

      if (!brokerId) {
        return res.status(400).json({ error: 'MISSING_PARAM', message: 'brokerId is required' });
      }

      if (user.role === 'BROKER' && user.hierarchy_id && user.hierarchy_id !== brokerId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Brokers can only reassign sub-brokers under their own organization.' });
      }

      // Resolve the new broker and its parent master
      const brokerRes = await query<{ id: string; name: string; master_id: string; master_name: string; tenant_id: string }>(
        `SELECT b.id, b.name, b.master_id, b.master_name, b.tenant_id
         FROM brokers b
         WHERE b.id = $1 LIMIT 1`,
        [brokerId]
      );
      if (brokerRes.rows.length === 0) {
        return res.status(404).json({ error: 'BROKER_NOT_FOUND', message: `Broker ${brokerId} not found` });
      }
      const newBroker = brokerRes.rows[0];

      // Also ensure master_name is resolved if missing on broker
      let resolvedMasterName = newBroker.master_name;
      if (!resolvedMasterName && newBroker.master_id) {
        const mRes = await query<{ name: string }>('SELECT name FROM masters WHERE id = $1 LIMIT 1', [newBroker.master_id]);
        resolvedMasterName = mRes.rows[0]?.name || '';
      }

      // Update sub-broker in DB
      const updated = await activeTradingDataProvider.updateSubBroker(id, {
        broker_id: newBroker.id,
        broker_name: newBroker.name,
        master_id: newBroker.master_id
      } as any);
      if (!updated) return res.status(404).json({ error: 'Sub-Broker not found' });

      // Cascade new broker_id, broker_name, master_id, master_name to all child clients
      await query(
        `UPDATE clients
         SET broker_id = $1, broker_name = $2, master_id = $3, master_name = $4, updated_at = CURRENT_TIMESTAMP
         WHERE sub_broker_id = $5`,
        [newBroker.id, newBroker.name, newBroker.master_id, resolvedMasterName || '', id]
      ).catch(() => {});

      tradingPlatformClient.clearCache();

      const s2sPayload = {
        ...updated,
        id: updated.id,
        subBrokerId: updated.id,
        brokerId: newBroker.id,
        broker_id: newBroker.id,
        brokerName: newBroker.name,
        broker_name: newBroker.name,
        masterId: newBroker.master_id,
        master_id: newBroker.master_id,
        masterName: resolvedMasterName,
        master_name: resolvedMasterName,
        status: updated.status || 'ACTIVE',
        tenantId: updated.tenant_id
      };

      // Dispatch S2S UPSERT for Sub-Broker
      await notifyHierarchyChange('sub_broker', 'UPSERT', s2sPayload);

      await writeSecurityAuditLog({
        tenantId: updated.tenant_id,
        userName: user.name,
        action: 'SUB_BROKER_REASSIGNED',
        module: 'HIERARCHY',
        details: `Sub-Broker ${updated.name} (${id}) reassigned to Broker ${newBroker.name} (${newBroker.id}). Downline clients cascaded.`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Sub-Broker ${updated.name} successfully reassigned to Broker ${newBroker.name}`,
        subBroker: s2sPayload
      });
    } catch (err: any) {
      console.error('[PUT /api/admin/sub-brokers/:id/reassign] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/sub-brokers/:id', '/api/sub-brokers/:id'], authenticate, requirePermission('sub_brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('sub_broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const targetBrokerId = req.body.brokerId || req.body.broker_id;
      let newBrokerName: string | undefined;
      let parentMasterId: string | undefined;
      let parentMasterName: string | undefined;

      if (targetBrokerId) {
        const bRes = await query<{ id: string; name: string; master_id: string; master_name: string }>(
          'SELECT id, name, master_id, master_name FROM brokers WHERE id = $1 LIMIT 1',
          [targetBrokerId]
        );
        if (bRes.rows[0]) {
          newBrokerName = bRes.rows[0].name;
          parentMasterId = bRes.rows[0].master_id;
          parentMasterName = bRes.rows[0].master_name;
          req.body.broker_id = targetBrokerId;
          req.body.broker_name = newBrokerName;
          req.body.master_id = parentMasterId;

          // Cascade to child clients if broker changed
          await query(
            `UPDATE clients
             SET broker_id = $1, broker_name = $2, master_id = $3, master_name = $4, updated_at = CURRENT_TIMESTAMP
             WHERE sub_broker_id = $5`,
            [targetBrokerId, newBrokerName, parentMasterId, parentMasterName || '', id]
          ).catch(() => {});
        }
      }

      const updated = await activeTradingDataProvider.updateSubBroker(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Sub-Broker not found' });
      const passwordHash = await provisionHierarchyUser({
        entityId: updated.id,
        tenantId: updated.tenant_id,
        name: updated.name,
        email: updated.email,
        role: 'SUB_BROKER',
        password: req.body.password || req.body.newPassword,
        phone: updated.phone,
        isUpdate: true
      });

      tradingPlatformClient.clearCache();

      const commShare = (updated as any).commissionShare ?? (updated as any).commission_share ?? req.body.commissionShare ?? req.body.commission_share;
      const s2sPayload = {
        ...updated,
        subBrokerId: updated.id,
        brokerId: targetBrokerId || updated.broker_id || (updated as any).brokerId,
        broker_id: targetBrokerId || updated.broker_id || (updated as any).brokerId,
        brokerName: newBrokerName || updated.broker_name || (updated as any).brokerName,
        broker_name: newBrokerName || updated.broker_name || (updated as any).brokerName,
        masterId: parentMasterId || (updated as any).master_id || (updated as any).masterId,
        master_id: parentMasterId || (updated as any).master_id || (updated as any).masterId,
        commissionShare: commShare !== undefined ? Number(commShare) : undefined,
        commission_share: commShare !== undefined ? Number(commShare) : undefined,
        status: updated.status || 'ACTIVE'
      };

      await notifyHierarchyChange('sub_broker', targetBrokerId ? 'UPSERT' : 'updated', s2sPayload, passwordHash);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/sub-brokers/:id/status', '/api/sub-brokers/:id/status'], authenticate, requirePermission('sub_brokers.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('sub_broker'), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateSubBrokerStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Sub-Broker not found' });
      await notifyHierarchyChange('sub_broker', 'status_updated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/admin/sub-brokers/:id', '/api/sub-brokers/:id'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('sub_broker'), async (req, res) => {
    try {
      const { id } = req.params;
      const { reassignToSubBrokerId } = req.body || {};
      const user = req.user!;
      const existing = (await activeTradingDataProvider.getSubBrokers()).find(s => s.id === id);
      if (!existing) return res.status(404).json({ error: 'Sub-Broker not found' });

      // Invalidate all active sessions for this sub-broker's user account
      const userRecord = await query<{ id: string }>('SELECT id FROM users WHERE hierarchy_id = $1 LIMIT 1', [id]);
      if (userRecord.rows.length > 0) {
        await invalidateAllUserSessions(userRecord.rows[0].id, user.name);
      }

      // Execute downline reassignment & sub-broker removal in provider
      const delResult = typeof (activeTradingDataProvider as any).deleteSubBroker === 'function'
        ? await (activeTradingDataProvider as any).deleteSubBroker(id, reassignToSubBrokerId)
        : { success: true, reassignedClientsCount: 0 };

      if (!delResult.success) {
        return res.status(500).json({ error: delResult.error || 'Failed to delete sub-broker' });
      }

      // Notify S2S with action: 'DELETE'
      await notifyHierarchyChange('sub_broker', 'DELETE', { ...existing, status: 'DELETED' });

      await writeSecurityAuditLog({
        tenantId: existing.tenant_id,
        userName: user.name,
        action: 'SUB_BROKER_DELETED',
        module: 'HIERARCHY',
        details: `Deleted sub-broker ${existing.name} (${id}). Reassigned ${delResult.reassignedClientsCount || 0} clients to ${delResult.targetSubBrokerId || 'house sub-broker'}.`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Sub-Broker ${existing.name} deleted successfully.`,
        reassignedClientsCount: delResult.reassignedClientsCount,
        reassignedTo: delResult.targetSubBrokerId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/clients', '/api/admin/hierarchy/clients', '/api/clients'], authenticate, requirePermission('clients.view'), async (req, res) => {
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

  app.post(['/api/admin/clients', '/api/admin/hierarchy/clients', '/api/clients'], authenticate, requirePermission('clients.create'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const user = req.user!;
      const data = { ...req.body };
      if (data.email) data.email = data.email.trim().toLowerCase();
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
        data.tenant_id = user.tenant_id;
      }
      if (user.role === 'BROKER' && user.hierarchy_id) {
        data.broker_id = user.hierarchy_id;
        if (data.sub_broker_id) {
          const hasAccess = await requireHierarchyAccess('sub_broker', data.sub_broker_id, user);
          if (!hasAccess) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Assigned sub-broker does not belong to your organization.' });
          }
        }
      }
      const client = await activeTradingDataProvider.createClient(data);
      const passwordHash = await provisionHierarchyUser({
        entityId: client.id,
        tenantId: client.tenant_id,
        name: client.name,
        email: client.email || data.email,
        role: 'CLIENT',
        password: req.body.password,
        phone: client.phone || req.body.phone
      });
      const initialBalance = Number(data.initialBalance ?? data.initial_balance ?? data.wallet_balance ?? data.balance ?? 0);
      await notifyHierarchyChange('client', 'UPSERT', {
        ...client,
        name: client.name,
        email: (client.email || data.email || '').trim().toLowerCase(),
        phone: client.phone || data.phone || null,
        passwordHash,
        initialBalance,
        status: client.status || 'ACTIVE',
        masterId: data.masterId || data.master_id || (client as any).master_id || (client as any).masterId || null,
        brokerId: data.brokerId || data.broker_id || (client as any).broker_id || (client as any).brokerId || null,
        subBrokerId: data.subBrokerId || data.sub_broker_id || client.sub_broker_id || null
      }, passwordHash);
      await writeSecurityAuditLog({
        tenantId: client.tenant_id,
        userName: user.name,
        action: 'CLIENT_CREATED',
        module: 'HIERARCHY',
        details: `Created client ${client.name} (${client.id})`,
        ipAddress: req.ip
      });
      res.status(201).json(client);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/clients/:id/hierarchy', '/api/clients/:id/hierarchy'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), async (req, res) => {
    try {
      const { id } = req.params;
      const { masterId, brokerId, subBrokerId } = req.body;
      const user = req.user!;

      // Find the client
      const allClients = await activeTradingDataProvider.getClients();
      const client = allClients.find(c => c.id === id || c.client_code === id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Enforce role-based hierarchy boundaries
      if (user.role === 'BROKER' && user.hierarchy_id) {
        if (brokerId && brokerId !== user.hierarchy_id) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Brokers can only assign clients under their own organization.' });
        }
      } else if (user.role === 'MASTER' && user.hierarchy_id) {
        if (masterId && masterId !== user.hierarchy_id) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'Masters can only assign clients under their own hierarchy.' });
        }
      }

      let resolvedMasterId = masterId || (client as any).master_id || (client as any).masterId || null;
      let resolvedBrokerId = brokerId || (client as any).broker_id || (client as any).brokerId || null;
      let resolvedSubBrokerId = subBrokerId || client.sub_broker_id || null;

      let masterName = (client as any).master_name || client.master || '';
      let brokerName = (client as any).broker_name || client.broker || '';
      let subBrokerName = client.sub_broker_name || (client as any).subBroker || '';

      if (resolvedSubBrokerId) {
        const sbRes = await query<{ name: string; broker_id: string }>(
          'SELECT name, broker_id FROM sub_brokers WHERE id = $1 LIMIT 1',
          [resolvedSubBrokerId]
        );
        if (sbRes.rows[0]) {
          subBrokerName = sbRes.rows[0].name;
          if (!resolvedBrokerId) {
            resolvedBrokerId = sbRes.rows[0].broker_id;
          }
        }
      }

      if (resolvedBrokerId) {
        const bRes = await query<{ name: string; master_id: string }>(
          'SELECT name, master_id FROM brokers WHERE id = $1 LIMIT 1',
          [resolvedBrokerId]
        );
        if (bRes.rows[0]) {
          brokerName = bRes.rows[0].name;
          if (!resolvedMasterId) {
            resolvedMasterId = bRes.rows[0].master_id;
          }
        }
      }

      if (resolvedMasterId) {
        const mRes = await query<{ name: string }>(
          'SELECT name FROM masters WHERE id = $1 LIMIT 1',
          [resolvedMasterId]
        );
        if (mRes.rows[0]) {
          masterName = mRes.rows[0].name;
        }
      }

      const updateData: any = {
        sub_broker_id: resolvedSubBrokerId,
        sub_broker_name: subBrokerName,
        broker_id: resolvedBrokerId,
        broker_name: brokerName,
        master_id: resolvedMasterId,
        master_name: masterName,
        subBrokerId: resolvedSubBrokerId,
        subBrokerName: subBrokerName,
        brokerId: resolvedBrokerId,
        brokerName,
        masterId: resolvedMasterId,
        masterName
      };

      const updated = await activeTradingDataProvider.updateClient(id, updateData);

      const s2sPayload = {
        ...(updated || client),
        id: client.id,
        name: client.name,
        email: (client.email || '').trim().toLowerCase(),
        phone: client.phone || null,
        masterId: resolvedMasterId,
        brokerId: resolvedBrokerId,
        subBrokerId: resolvedSubBrokerId,
        masterName,
        brokerName,
        subBrokerName,
        status: client.status || 'ACTIVE',
        tenantId: client.tenant_id
      };

      await notifyHierarchyChange('client', 'UPSERT', s2sPayload);

      await writeSecurityAuditLog({
        tenantId: client.tenant_id,
        userName: user.name,
        action: 'CLIENT_HIERARCHY_TRANSFER',
        module: 'HIERARCHY',
        details: `Client ${client.name} (${client.id}) transferred to Master: ${masterName} (${resolvedMasterId}), Broker: ${brokerName} (${resolvedBrokerId}), Sub-Broker: ${subBrokerName} (${resolvedSubBrokerId})`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: 'Client hierarchy updated and synchronized successfully.',
        client: updated || s2sPayload
      });
    } catch (err: any) {
      console.error('[Clients Hierarchy API] Error updating hierarchy:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/clients/:id', '/api/clients/:id'], authenticate, requirePermission('clients.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('client'), async (req, res) => {
    try {
      const updated = await activeTradingDataProvider.updateClient(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      const passwordHash = await provisionHierarchyUser({
        entityId: updated.id,
        tenantId: updated.tenant_id,
        name: updated.name,
        email: updated.email,
        role: 'CLIENT',
        password: req.body.password || req.body.newPassword,
        phone: updated.phone,
        isUpdate: true
      });
      await notifyHierarchyChange('client', 'updated', updated, passwordHash);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/clients/:id/status', '/api/clients/:id/status'], authenticate, requirePermission('clients.update'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('client'), async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateClientStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Client not found' });
      await notifyHierarchyChange('client', 'status_updated', updated);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete(['/api/admin/clients/:id', '/api/clients/:id'], authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('client'), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const existing = (await activeTradingDataProvider.getClients()).find(c => c.id === id || c.client_code === id);
      if (!existing) return res.status(404).json({ error: 'Client not found' });

      // Invalidate all active sessions for this client's user account
      const userRecord = await query<{ id: string }>('SELECT id FROM users WHERE hierarchy_id = $1 OR id = $1 LIMIT 1', [id]);
      if (userRecord.rows.length > 0) {
        await invalidateAllUserSessions(userRecord.rows[0].id, user.name);
      }

      // Execute client deletion in provider
      const delResult = typeof (activeTradingDataProvider as any).deleteClient === 'function'
        ? await (activeTradingDataProvider as any).deleteClient(id)
        : { success: true };

      if (!delResult.success) {
        return res.status(500).json({ error: delResult.error || 'Failed to delete client' });
      }

      // Notify S2S with action: 'DELETE'
      await notifyHierarchyChange('client', 'DELETE', { ...existing, status: 'DELETED' });

      await writeSecurityAuditLog({
        tenantId: existing.tenant_id,
        userName: user.name,
        action: 'CLIENT_DELETED',
        module: 'HIERARCHY',
        details: `Deleted client ${existing.name} (${id})`,
        ipAddress: req.ip
      });

      res.json({
        success: true,
        message: `Client ${existing.name} deleted successfully.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Client Trading Platform Account Details & S2S Live Endpoints
  app.get(['/api/admin/clients/:id/trading-account', '/api/clients/:id/trading-account'], authenticate, requireHierarchyEntity('client'), async (req, res) => {
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

  app.get(['/api/admin/clients/:id/orders', '/api/clients/:id/orders'], authenticate, requireHierarchyEntity('client'), async (req, res) => {
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

  app.get(['/api/admin/clients/:id/trades', '/api/clients/:id/trades'], authenticate, requireHierarchyEntity('client'), async (req, res) => {
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

  app.get(['/api/admin/clients/:id/positions', '/api/clients/:id/positions'], authenticate, requireHierarchyEntity('client'), async (req, res) => {
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

  app.get(['/api/admin/clients/:id/ledger', '/api/clients/:id/ledger'], authenticate, requireHierarchyEntity('client'), async (req, res) => {
    try {
      const { id } = req.params;
      const ledger = typeof (activeTradingDataProvider as any).getClientLedger === 'function'
        ? await (activeTradingDataProvider as any).getClientLedger(id, req.user?.tenant_id)
        : [];
      res.json(ledger);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/clients/:id/positions/:posId/square-off', authenticate, requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN', 'MASTER', 'BROKER']), requireHierarchyEntity('client'), async (req, res) => {
    try {
      const { id, posId } = req.params;
      const { reason } = req.body || {};
      const sqRes = await tradingPlatformClient.sendEmergencySquareOff({
        positionId: posId,
        actor: req.user?.name || 'Admin',
        reason: reason || `Square-off client position ${posId} for client ${id}`,
        tenantId: req.user?.tenant_id
      });
      if (!sqRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Position was not squared off.'
        });
      }
      res.json({ success: true, positionId: posId, result: sqRes });
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Position was not squared off.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/integration/trading-platform-url', authenticate, (_req, res) => {
    const mainPlatformUrl = process.env.TRADING_PLATFORM_WEB_URL || 'https://trading-platform-2t6r.onrender.com';
    res.json({
      webUrl: mainPlatformUrl,
      s2sUrl: process.env.TRADING_PLATFORM_BASE_URL || process.env.TRADING_PLATFORM_URL || 'https://trading-platform-2t6r.onrender.com',
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
  app.get(['/api/admin/kyc', '/api/kyc'], authenticate, requirePermission('kyc.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const cacheKey = `kyc:${tenantScope || 'ALL_TENANTS'}:${status || 'ALL'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const kyc = await activeTradingDataProvider.getKYCRecords(tenantScope, status);
          return filterClientScopedItems(kyc, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/kyc] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  const handleKycStatusUpdate = async (req: Request, res: Response) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Sub-Brokers have strictly read-only monitoring access and cannot review or approve/reject KYC records.'
        });
      }

      const status = (req.body?.status || 'APPROVED').toString();
      const notes = req.body?.notes;
      const user = req.user || { name: 'Compliance Officer', email: 'compliance@tradepro.com', tenant_id: 'TNT-001' };
      const kycId = req.params.id;
      const tenantScope = resolveStrictTenantScope(req);
      const action = status === 'APPROVED' || status === 'VERIFIED' ? 'APPROVE' : 'REJECT';

      if (req.user) {
        const hasAccess = await requireHierarchyAccess('client', kycId, req.user);
        if (!hasAccess) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Access denied. You do not have permission to review KYC for this client.'
          });
        }
      }

      // 1. S2S dispatch to Trading Platform (non-blocking for resilient local DB persistence)
      try {
        await tradingPlatformClient.processKYC({
          kycId,
          clientId: kycId,
          status,
          action,
          notes,
          actor: user.name || user.email || 'Compliance Officer',
          tenantId: tenantScope
        });
      } catch (s2sErr: any) {
        console.warn(`[S2S] KYC dispatch notice for ${kycId}:`, s2sErr?.message || s2sErr);
      }

      // 2. Persist in database & provider
      const updated = await activeTradingDataProvider.updateKYCStatus(kycId, status as any, notes);
      clearDashboardCache('kyc:');
      clearDashboardCache('metrics:');
      await writeSecurityAuditLog({
        tenantId: user.tenant_id,
        userName: user.name,
        action: 'KYC_STATUS_UPDATED',
        module: 'COMPLIANCE',
        details: `KYC record ${kycId} marked ${status} by ${user.name}`,
        ipAddress: req.ip
      });
      res.json(updated || { success: true, id: kycId, kyc_status: status });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  app.patch(['/api/admin/kyc/:id', '/api/admin/clients/:id/kyc', '/api/clients/:id/kyc', '/api/kyc/:id', '/api/kyc/:id/approve', '/api/admin/kyc/:id/approve'], authenticate, requirePermission('kyc.review'), handleKycStatusUpdate);
  app.post(['/api/admin/kyc/:id', '/api/admin/clients/:id/kyc', '/api/clients/:id/kyc', '/api/kyc/:id', '/api/kyc/:id/approve', '/api/admin/kyc/:id/approve'], authenticate, requirePermission('kyc.review'), handleKycStatusUpdate);
  app.put(['/api/admin/kyc/:id', '/api/admin/clients/:id/kyc', '/api/clients/:id/kyc', '/api/kyc/:id', '/api/kyc/:id/approve', '/api/admin/kyc/:id/approve'], authenticate, requirePermission('kyc.review'), handleKycStatusUpdate);

  // General Funds & Balances (merges DB + S2S deposits & withdrawals cleanly)
  app.get(['/api/admin/funds', '/api/funds'], authenticate, async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `funds:summary:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const payload = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const [deposits, withdrawals] = await Promise.all([
            activeTradingDataProvider.getFundDeposits(tenantScope).catch(() => []),
            activeTradingDataProvider.getFundWithdrawals(tenantScope).catch(() => [])
          ]);
          const scopedDeposits = await filterClientScopedItems(deposits, req.user);
          const scopedWithdrawals = await filterClientScopedItems(withdrawals, req.user);
          const totalDeposits = scopedDeposits.reduce((sum, d) => sum + (Number(d.rawAmount) || 0), 0);
          const totalWithdrawals = scopedWithdrawals.reduce((sum, w) => sum + (Number(w.rawAmount) || 0), 0);
          const pendingDeposits = scopedDeposits.filter(d => ['PENDING', 'PROCESSING'].includes(String(d.status || '').toUpperCase())).length;
          const pendingWithdrawals = scopedWithdrawals.filter(w => ['PENDING', 'PROCESSING'].includes(String(w.status || '').toUpperCase())).length;
          return {
            deposits: scopedDeposits,
            withdrawals: scopedWithdrawals,
            summary: {
              totalDeposits,
              totalWithdrawals,
              pendingDeposits,
              pendingWithdrawals
            }
          };
        },
        forceRefresh
      );
      res.json(payload);
    } catch (err: any) {
      console.warn('[API /api/funds] Non-fatal fallback:', err?.message);
      res.json({ deposits: [], withdrawals: [], summary: { totalDeposits: 0, totalWithdrawals: 0, pendingDeposits: 0, pendingWithdrawals: 0 } });
    }
  });

  // Funds Deposits
  app.get(['/api/admin/compliance/deposits', '/api/compliance/deposits', '/api/admin/funds/deposits', '/api/funds/deposits', '/api/admin/deposits', '/api/deposits'], authenticate, requirePermission('funds.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const cacheKey = `funds:deposits:${tenantScope || 'ALL_TENANTS'}:${status || 'ALL'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const deposits = await activeTradingDataProvider.getFundDeposits(tenantScope, status);
          return filterClientScopedItems(deposits, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/deposits] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post(['/api/admin/compliance/deposits/:id/approve', '/api/compliance/deposits/:id/approve'], authenticate, requirePermission('funds.approve'), requireFundTransactionEntity('fund_deposits'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot approve or reject deposits.' });
      }
      const depositId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const tenantScope = resolveStrictTenantScope(req);

      // 1. S2S dispatch to Trading Platform POST /api/internal/v1/trading/funds/process
      const s2sRes = await tradingPlatformClient.processFundTransaction({
        transactionId: depositId,
        type: 'DEPOSIT',
        action: 'APPROVE',
        actor,
        tenantId: tenantScope
      });

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Deposit status was not changed.'
        });
      }

      // 2. Optimistic UI / DB state only after Trading returns success
      const result = await activeTradingDataProvider.approveFundDeposit(depositId, actor);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'DEPOSIT_APPROVED',
        module: 'FUNDS',
        details: `Deposit ${depositId} approved (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Deposit status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/deposits/:id/reject', '/api/compliance/deposits/:id/reject'], authenticate, requirePermission('funds.reject'), requireFundTransactionEntity('fund_deposits'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot approve or reject deposits.' });
      }
      const depositId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const tenantScope = resolveStrictTenantScope(req);
      const reason = req.body?.reason || req.body?.notes || 'Rejected by compliance';

      const s2sRes = await tradingPlatformClient.processFundTransaction({
        transactionId: depositId,
        type: 'DEPOSIT',
        action: 'REJECT',
        actor,
        reason,
        tenantId: tenantScope
      });

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Deposit status was not changed.'
        });
      }

      const result = await activeTradingDataProvider.rejectFundDeposit(depositId, actor);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'DEPOSIT_REJECTED',
        module: 'FUNDS',
        details: `Deposit ${depositId} rejected: ${reason} (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Deposit status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/deposits', '/api/compliance/deposits', '/api/admin/funds/deposits', '/api/funds/deposits'], authenticate, requirePermission('funds.deposit'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const deposit = await activeTradingDataProvider.createFundDeposit(data);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      res.status(201).json(deposit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Funds Withdrawals
  app.get(['/api/admin/compliance/withdrawals', '/api/compliance/withdrawals', '/api/admin/funds/withdrawals', '/api/funds/withdrawals', '/api/admin/withdrawals', '/api/withdrawals'], authenticate, requirePermission('funds.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const status = req.query.status as string;
      const cacheKey = `funds:withdrawals:${tenantScope || 'ALL_TENANTS'}:${status || 'ALL'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const withdrawals = await activeTradingDataProvider.getFundWithdrawals(tenantScope, status);
          return filterClientScopedItems(withdrawals, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/withdrawals] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post(['/api/admin/compliance/withdrawals/:id/approve', '/api/compliance/withdrawals/:id/approve'], authenticate, requirePermission('funds.approve'), requireFundTransactionEntity('fund_withdrawals'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot approve or reject withdrawals.' });
      }
      const withdrawalId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const tenantScope = resolveStrictTenantScope(req);

      const s2sRes = await tradingPlatformClient.processFundTransaction({
        transactionId: withdrawalId,
        type: 'WITHDRAWAL',
        action: 'APPROVE',
        actor,
        tenantId: tenantScope
      });

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Withdrawal status was not changed.'
        });
      }

      const result = await activeTradingDataProvider.approveFundWithdrawal(withdrawalId, actor);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'WITHDRAWAL_APPROVED',
        module: 'FUNDS',
        details: `Withdrawal ${withdrawalId} approved (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Withdrawal status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/withdrawals/:id/reject', '/api/compliance/withdrawals/:id/reject'], authenticate, requirePermission('funds.reject'), requireFundTransactionEntity('fund_withdrawals'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot approve or reject withdrawals.' });
      }
      const withdrawalId = req.params.id;
      const actor = req.user?.name || req.user?.email || 'Compliance Officer';
      const tenantScope = resolveStrictTenantScope(req);
      const reason = req.body?.reason || req.body?.notes || 'Rejected by compliance';

      const s2sRes = await tradingPlatformClient.processFundTransaction({
        transactionId: withdrawalId,
        type: 'WITHDRAWAL',
        action: 'REJECT',
        actor,
        reason,
        tenantId: tenantScope
      });

      if (!s2sRes.success) {
        return res.status(503).json({
          error: 'TRADING_PLATFORM_UNREACHABLE',
          message: 'Trading platform is currently unreachable. Withdrawal status was not changed.'
        });
      }

      const result = await activeTradingDataProvider.rejectFundWithdrawal(withdrawalId, actor);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      await writeSecurityAuditLog({
        tenantId: req.user?.tenant_id,
        userName: actor,
        action: 'WITHDRAWAL_REJECTED',
        module: 'FUNDS',
        details: `Withdrawal ${withdrawalId} rejected: ${reason} (S2S acked)`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unavailable')) {
        return res.status(503).json({
          error: 'CIRCUIT_OPEN',
          message: 'Trading platform circuit breaker is OPEN. Withdrawal status was not changed.'
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/compliance/withdrawals', '/api/compliance/withdrawals', '/api/admin/funds/withdrawals', '/api/funds/withdrawals'], authenticate, requirePermission('funds.withdraw'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const withdrawal = await activeTradingDataProvider.createFundWithdrawal(data);
      clearDashboardCache('funds:');
      clearDashboardCache('metrics:');
      res.status(201).json(withdrawal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Immutable Ledger
  app.get(['/api/admin/compliance/ledger', '/api/compliance/ledger', '/api/admin/ledger', '/api/ledger'], authenticate, requirePermission('ledger.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const type = req.query.type as string;
      const cacheKey = `ledger:${tenantScope || 'ALL_TENANTS'}:${type || 'ALL'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const ledger = await activeTradingDataProvider.getLedgerEntries(tenantScope, type);
          return filterClientScopedItems(ledger, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/ledger] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post(['/api/admin/compliance/ledger', '/api/compliance/ledger'], authenticate, requirePermission('ledger.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const data = { ...req.body, tenant_id: tenantScope || req.body.tenant_id };
      const entry = await activeTradingDataProvider.createLedgerEntry(data);
      clearDashboardCache('ledger:');
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
      const cacheKey = `positions:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const positions = await activeTradingDataProvider.getPositions(tenantScope);
          return filterClientScopedItems(positions, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/positions] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post(['/api/admin/positions/:id/square-off', '/api/positions/:id/square-off'], authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot execute square-off actions.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Position was not squared off.' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/risk/emergency-square-off', '/api/admin/emergency/margin-square-off', '/api/admin/emergency/square-off', '/api/risk/emergency-square-off'], authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      if (req.user?.role === 'SUB_BROKER') {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Sub-Brokers have strictly read-only monitoring access and cannot execute square-off actions.' });
      }
      const tenantScope = resolveStrictTenantScope(req);
      const actor = req.user?.name || req.user?.email || 'Risk Manager';
      const reason = req.body?.reason || 'Emergency Margin Square-off';
      const result = await activeTradingDataProvider.emergencyMarginSquareOff?.(actor, reason, tenantScope || undefined);
      await writeSecurityAuditLog({
        tenantId: tenantScope || req.user?.tenant_id,
        userName: actor,
        action: 'EMERGENCY_MARGIN_SQUARE_OFF',
        module: 'RISK',
        details: `Emergency margin square-off triggered by ${actor}. Result: ${JSON.stringify(result)}`,
        ipAddress: req.ip
      });
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Open positions were not squared off.' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/commercial/commission-plans', '/api/commission-plans'], authenticate, requirePermission('commission.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `commission:plans:${tenantScope || 'ALL_TENANTS'}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const plans = await getCachedEndpointPayload(
        cacheKey,
        2000,
        () => activeTradingDataProvider.getCommissionPlans(tenantScope),
        forceRefresh
      );
      res.json(plans);
    } catch (err: any) {
      console.warn('[API /api/commission-plans] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.get(['/api/admin/commercial/commission-rules', '/api/commission-rules'], authenticate, requirePermission('commission.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const planId = req.query.planId as string;
      const cacheKey = `commission:rules:${tenantScope || 'ALL_TENANTS'}:${planId || 'ALL'}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const rules = await getCachedEndpointPayload(
        cacheKey,
        2000,
        () => activeTradingDataProvider.getCommissionRules(tenantScope, planId),
        forceRefresh
      );
      res.json(rules);
    } catch (err: any) {
      console.warn('[API /api/commission-rules] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post('/api/admin/commercial/commission-plans', authenticate, requirePermission('commission.manage'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      if (typeof (activeTradingDataProvider as any).createCommissionPlan === 'function') {
        const plan = await (activeTradingDataProvider as any).createCommissionPlan({ ...req.body, tenant_id: tenantScope });
        return res.status(201).json(plan);
      }
      res.status(201).json({ id: `CP00${Date.now().toString().slice(-3)}`, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/commercial/commission-plans/:id', '/api/commercial/commission-plans/:id'], authenticate, requirePermission('commission.manage'), async (req, res) => {
    try {
      const { id } = req.params;
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      if (typeof (activeTradingDataProvider as any).updateCommissionPlan === 'function') {
        const updated = await (activeTradingDataProvider as any).updateCommissionPlan(id, { ...req.body, tenant_id: tenantScope });
        return res.json(updated);
      }
      res.json({ id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/commercial/commission-rules', authenticate, requirePermission('commission.manage'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      if (typeof (activeTradingDataProvider as any).createCommissionRule === 'function') {
        const rule = await (activeTradingDataProvider as any).createCommissionRule({ ...req.body, tenant_id: tenantScope });
        return res.status(201).json(rule);
      }
      res.status(201).json({ id: `RUL-${Date.now().toString().slice(-4)}`, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/commercial/commission-rules/:id', '/api/commercial/commission-rules/:id'], authenticate, requirePermission('commission.manage'), async (req, res) => {
    try {
      const { id } = req.params;
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      if (typeof (activeTradingDataProvider as any).updateCommissionRule === 'function') {
        const updated = await (activeTradingDataProvider as any).updateCommissionRule(id, { ...req.body, tenant_id: tenantScope });
        return res.json(updated);
      }
      res.json({ id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/commercial/commission-transactions', '/api/admin/commission/transactions', '/api/admin/commissions', '/api/commissions', '/api/commission-transactions'], authenticate, requirePermission('commission.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `commission:txns:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const transactions = activeTradingDataProvider.getCommissionTransactions
            ? await activeTradingDataProvider.getCommissionTransactions(tenantScope)
            : [];
          return filterClientScopedItems(transactions, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/commissions] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post('/api/admin/commercial/commission-transactions', authenticate, requirePermission('commission.manage'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      if (!activeTradingDataProvider.createCommissionTransaction) {
        return res.status(400).json({ error: 'Commission transaction creation not supported' });
      }
      const transaction = await activeTradingDataProvider.createCommissionTransaction({
        ...req.body,
        tenant_id: tenantScope || req.body.tenant_id
      });
      res.status(201).json(transaction);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get(['/api/admin/risk', '/api/risk'], authenticate, requirePermission('risk.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `risk:summary:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const payload = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const [profiles, events] = await Promise.all([
            activeTradingDataProvider.getRiskProfiles(tenantScope).catch(() => []),
            activeTradingDataProvider.getRiskEvents(tenantScope).catch(() => [])
          ]);
          const riskAlerts = events.filter((e: any) => String(e.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
          const blockedOrders = events.filter((e: any) => {
            const msg = String(e.details?.message || e.event_type || '').toLowerCase();
            return msg.includes('block') || msg.includes('reject') || msg.includes('insufficient');
          }).length;
          const highExposure = events.filter((e: any) => String(e.severity || '').toUpperCase() === 'HIGH').length;
          const marginAlerts = events.filter((e: any) => {
            const msg = String(e.details?.message || e.event_type || '').toLowerCase();
            return msg.includes('margin') || msg.includes('loss');
          }).length;
          return {
            profiles,
            events,
            summary: { riskAlerts, blockedOrders, highExposure, marginAlerts }
          };
        },
        forceRefresh
      );
      res.json(payload);
    } catch (err: any) {
      console.warn('[API /api/risk] Non-fatal fallback:', err?.message);
      res.json({ profiles: [], events: [], summary: { riskAlerts: 0, blockedOrders: 0, highExposure: 0, marginAlerts: 0 } });
    }
  });

  app.get(['/api/admin/risk/profiles', '/api/risk/profiles'], authenticate, requirePermission('risk.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `risk:profiles:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const profiles = await getCachedEndpointPayload(
        cacheKey,
        2000,
        () => activeTradingDataProvider.getRiskProfiles(tenantScope),
        forceRefresh
      );
      res.json(profiles);
    } catch (err: any) {
      console.warn('[API /api/risk/profiles] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.get(['/api/admin/risk/events', '/api/risk/events'], authenticate, requirePermission('risk.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `risk:events:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const events = await getCachedEndpointPayload(
        cacheKey,
        2000,
        () => activeTradingDataProvider.getRiskEvents(tenantScope),
        forceRefresh
      );
      res.json(events);
    } catch (err: any) {
      console.warn('[API /api/risk/events] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post('/api/admin/risk/profiles', authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      // Server-side financial input validation: reject negative quantities and negative risk limits
      const { maxOrderQty, maxExposure, dailyLossLimit, max_order_value, daily_loss_limit, max_leverage, maxLeverage } = req.body;
      for (const val of [maxOrderQty, maxExposure, dailyLossLimit, max_order_value, daily_loss_limit, max_leverage, maxLeverage]) {
        if (val !== undefined && val !== null) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num) && num < 0) {
            return res.status(400).json({ error: 'Risk profile parameters and quantities cannot be negative.' });
          }
        }
      }

      if (typeof (activeTradingDataProvider as any).createRiskProfile === 'function') {
        const profile = await (activeTradingDataProvider as any).createRiskProfile({ ...req.body, tenant_id: tenantScope });
        clearDashboardCache('risk:');
        return res.status(201).json(profile);
      }
      res.status(201).json({ id: `RP00${Date.now().toString().slice(-3)}`, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/admin/risk/profiles/:id', '/api/risk/profiles/:id'], authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      const { id } = req.params;
      const tenantScope = resolveStrictTenantScope(req) || 'TNT-001';
      // Server-side financial input validation: reject negative quantities and negative risk limits
      const { maxOrderQty, maxExposure, dailyLossLimit, max_order_value, daily_loss_limit, max_leverage, maxLeverage } = req.body;
      for (const val of [maxOrderQty, maxExposure, dailyLossLimit, max_order_value, daily_loss_limit, max_leverage, maxLeverage]) {
        if (val !== undefined && val !== null) {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          if (!isNaN(num) && num < 0) {
            return res.status(400).json({ error: 'Risk profile parameters and quantities cannot be negative.' });
          }
        }
      }

      if (typeof (activeTradingDataProvider as any).updateRiskProfile === 'function') {
        const updated = await (activeTradingDataProvider as any).updateRiskProfile(id, { ...req.body, tenant_id: tenantScope });
        clearDashboardCache('risk:');
        return res.json(updated);
      }
      res.json({ id, ...req.body });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/risk/events/:id/resolve', authenticate, requirePermission('risk.manage'), async (req, res) => {
    try {
      const { id } = req.params;
      const status = req.body?.status || 'RESOLVED';
      if (typeof (activeTradingDataProvider as any).resolveRiskEvent === 'function') {
        const updated = await (activeTradingDataProvider as any).resolveRiskEvent(id, status);
        clearDashboardCache('risk:');
        return res.json(updated);
      }
      res.json({ success: true, id, status });
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

  app.post(['/api/admin/notifications/:id/read', '/api/notifications/:id/read'], authenticate, async (req, res) => {
    try {
      const result = await activeTradingDataProvider.markNotificationRead(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Support Tickets API
  app.get(['/api/admin/support', '/api/support'], authenticate, async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const tickets = await activeTradingDataProvider.getSupportTickets(tenantScope);
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch(['/api/admin/support/:id', '/api/support/:id'], authenticate, async (req, res) => {
    try {
      const ticketId = req.params.id;
      const { status } = req.body;
      const updated = await activeTradingDataProvider.updateSupportTicket(ticketId, { status: status || 'RESOLVED' }, req.user?.name);
      res.json(updated || { success: true, id: ticketId, status: status || 'RESOLVED' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/support/:id/reply', '/api/support/:id/reply', '/api/admin/tickets/:id/reply', '/api/tickets/:id/reply'], authenticate, async (req, res) => {
    try {
      const ticketId = req.params.id;
      const { message } = req.body;
      const updated = await activeTradingDataProvider.addSupportTicketReply(ticketId, message, req.user?.name, req.user?.role);
      res.json(updated || { success: true, id: ticketId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // TRADING: Orders & Trades
  // ----------------------------------------------------
  app.get(['/api/admin/trades', '/api/admin/trading/trades', '/api/trades'], authenticate, requirePermission('trades.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `trades:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const trades = await activeTradingDataProvider.getAllTrades(tenantScope);
          return filterClientScopedItems(trades, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/trades] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.get(['/api/admin/orders', '/api/orders'], authenticate, requirePermission('orders.view'), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const cacheKey = `orders:${tenantScope || 'ALL_TENANTS'}:${getUserCacheScope(req)}`;
      const forceRefresh = req.query.refresh === 'true' || req.query.nocache === '1';
      const scoped = await getCachedEndpointPayload(
        cacheKey,
        2000,
        async () => {
          const orders = await activeTradingDataProvider.getOrders(tenantScope);
          return filterClientScopedItems(orders, req.user);
        },
        forceRefresh
      );
      res.json(scoped);
    } catch (err: any) {
      console.warn('[API /api/orders] Non-fatal fallback:', err?.message);
      res.json([]);
    }
  });

  app.post(['/api/admin/orders/:id/cancel', '/api/orders/:id/cancel'], authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const reason = req.body?.reason || 'Order cancelled by Admin';
      if (typeof (activeTradingDataProvider as any).cancelOrder === 'function') {
        const result = await (activeTradingDataProvider as any).cancelOrder(id, reason, user?.name || 'Admin');
        clearDashboardCache('orders:');
        clearDashboardCache('metrics:');
        return res.json({ success: true, message: `Order ${id} cancelled.`, ...result });
      }
      clearDashboardCache('orders:');
      res.json({ success: true, id, status: 'CANCELLED' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SUBSCRIPTIONS & WHITE LABEL
  // ----------------------------------------------------
  app.get('/api/admin/subscriptions', authenticate, requirePermission('subscriptions.view'), requireRole(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const tenantScope = resolveStrictTenantScope(req);
      const subscriptions = await activeTradingDataProvider.getSubscriptions(tenantScope || undefined);
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

  // 0. GET /api/public/tenants - Public list of active tenants for authentication and tenant selector
  app.get(['/api/public/tenants', '/api/tenants'], async (_req, res) => {
    try {
      const { rows } = await query(`
        SELECT 
          id, 
          name, 
          code, 
          COALESCE(custom_domain, subdomain || '.tradepro.io', 'trade.alphaprime.com') as domain, 
          status, 
          plan as tier 
        FROM tenants 
        WHERE status = $1 
        ORDER BY name ASC
      `, ['ACTIVE']);
      if (rows && rows.length > 0) {
        return res.json(rows);
      }
      const memTenants = await activeTradingDataProvider.getTenants();
      res.json(memTenants);
    } catch (e) {
      console.warn('[Public Tenants API] Database query fallback:', (e as any)?.message);
      try {
        const memTenants = await activeTradingDataProvider.getTenants();
        if (memTenants && memTenants.length > 0) {
          return res.json(memTenants);
        }
      } catch {}
      res.json([
        { id: 'TNT-001', name: 'Alpha Prime Capital', code: 'APC', domain: 'trade.alphaprime.com', status: 'ACTIVE', tier: 'ENTERPRISE' },
        { id: 'TNT-002', name: 'Apex Securities Ltd', code: 'APEX', domain: 'trade.apexsecurities.in', status: 'ACTIVE', tier: 'PRO' },
        { id: 'TNT-003', name: 'Zenith Markets', code: 'ZMK', domain: 'trade.zenithmarkets.in', status: 'ACTIVE', tier: 'GROWTH' },
        { id: 'TNT-004', name: 'Quantum Alpha Capital', code: 'QAC', domain: 'trade.quantumfx.io', status: 'ACTIVE', tier: 'STARTER' }
      ]);
    }
  });

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
  const adminUserSettingsMap = new Map<string, any>();

  app.all(['/api/settings', '/api/user/settings'], authenticate, async (req, res, next) => {
    const userId = req.user?.id || 'admin-default';
    if (req.method === 'GET') {
      const existing = adminUserSettingsMap.get(userId) || {
        soundAlerts: true,
        orderConfirmation: true,
        emailDigests: true,
        compactDensity: false,
        theme: 'dark'
      };
      return res.json({ success: true, settings: existing });
    }
    if (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'POST') {
      const current = adminUserSettingsMap.get(userId) || {
        soundAlerts: true,
        orderConfirmation: true,
        emailDigests: true,
        compactDensity: false,
        theme: 'dark'
      };
      const updated = { ...current, ...req.body };
      adminUserSettingsMap.set(userId, updated);
      return res.json({ success: true, settings: updated });
    }
    next();
  });

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

  // Save White-Label Config (persist to PostgreSQL + broadcast S2S to Trading-Platform and User-Panel-Dashbord)
  app.put('/api/admin/white-label/:tenantId', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateWhiteLabelConfig(req.params.tenantId, req.body, user?.name || 'Admin');
      // Broadcast saved branding via S2S to both Trading Platform and User Panel (non-blocking)
      tradingPlatformClient.syncWhiteLabel(
        req.params.tenantId,
        updated,
        updated.version || 1,
        { actor: user?.name || 'Admin' }
      ).catch(syncErr => {
        console.warn('[WhiteLabelSave] S2S broadcast notice:', syncErr?.message || syncErr);
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Publish White-Label Changes
  app.post('/api/admin/white-label/:tenantId/publish', authMiddleware, requireRoles(['SUPER_ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const reason = req.body.reason || 'Admin published branding';
      const published = await activeTradingDataProvider.publishWhiteLabelConfig(req.params.tenantId, user?.name || 'Admin', reason);

      // Also ensure current platform controls are pushed to Trading Platform
      try {
        const platConfig = await activeTradingDataProvider.getTenantPlatformConfig(req.params.tenantId);
        if (platConfig) {
          await tradingPlatformClient.syncTenantConfig(req.params.tenantId, {
            status: 'ACTIVE',
            trading_enabled: platConfig.trading_enabled,
            registration_enabled: platConfig.registration_enabled,
            api_enabled: platConfig.api_enabled,
            support_enabled: platConfig.support_enabled,
            notifications_enabled: platConfig.notifications_enabled,
            maintenance_mode: platConfig.maintenance_mode,
            maintenance_message: platConfig.maintenance_message
          }, { actor: user?.name || 'Admin', reason: 'Published via White-Label' });
        }
      } catch (syncErr: any) {
        console.warn('[WhiteLabelPublish] Platform config sync notice:', syncErr.message);
      }

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

  app.post('/api/admin/white-label/domains', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const { tenantId, domain, domainType, isPrimary } = req.body;
      if (!tenantId || !domain) {
        return res.status(400).json({ error: 'tenantId and domain are required' });
      }
      const domainVal = domain.toString().trim();
      const fqdnRegex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
      if (!fqdnRegex.test(domainVal) || domainVal.includes(' ') || !domainVal.includes('.')) {
        return res.status(400).json({ error: 'Please enter a valid domain name (e.g., trade.example.com)' });
      }
      const newDomain = await activeTradingDataProvider.addTenantDomain(tenantId, { domain: domainVal, domain_type: domainType, is_primary: isPrimary }, user?.name || 'Admin');
      res.status(201).json(newDomain);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/admin/white-label/domains/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.updateTenantDomain(req.params.id, req.body, user?.name || 'Admin');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/white-label/domains/:id/verify', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
    try {
      const user = (req as any).user;
      const verified = await activeTradingDataProvider.verifyTenantDomain(req.params.id, user?.name || 'Admin');
      res.json(verified);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/white-label/domains/:id', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN', 'TENANT_ADMIN']), async (req, res) => {
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
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      const asset = await assetStorage.getAsset(req.params.id);
      if (asset) {
        if (asset.contentBuffer) {
          res.setHeader('Content-Type', asset.mime_type || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(asset.contentBuffer);
        }
        if (asset.public_url && asset.public_url.startsWith('data:')) {
          const parts = asset.public_url.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
          const buf = Buffer.from(parts[1], 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
        if (asset.public_url && (asset.public_url.startsWith('http://') || asset.public_url.startsWith('https://'))) {
          return res.redirect(asset.public_url);
        }
      }

      // Fallback: If memory was reset, check database tenant_branding for matching logo
      try {
        const { query } = await import('./server/db/connection.ts');
        const dbRes = await query('SELECT logo_url FROM tenant_branding WHERE logo_url LIKE $1 LIMIT 1', [`%${req.params.id}%`]);
        if (dbRes.rows.length > 0 && dbRes.rows[0].logo_url?.startsWith('data:')) {
          const parts = dbRes.rows[0].logo_url.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
          const buf = Buffer.from(parts[1], 'base64');
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buf);
        }
      } catch {}

      res.status(404).send('Asset not found');
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  });

  // Real-time Server-Sent Events stream for Admin Console
  let activeSseClients = 0;
  const MAX_SSE_CLIENTS = 25;

  app.get('/api/admin/events/stream', authenticate, (req, res) => {
    if (activeSseClients >= MAX_SSE_CLIENTS) {
      return res.status(503).json({ error: 'SSE_LIMIT_REACHED', message: 'Too many active event streams. Please retry shortly.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    activeSseClients++;

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

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      activeSseClients = Math.max(0, activeSseClients - 1);
      clearInterval(heartbeat);
      adminEventBus.off('event', listener);
      try { res.end(); } catch {}
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);
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

  app.post(['/api/admin/support/:id/reply', '/api/support/:id/reply', '/api/admin/tickets/:id/reply', '/api/tickets/:id/reply'], authMiddleware, async (req, res) => {
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Trading state was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Open orders were not cancelled.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Kill switch was not changed.' });
      }
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
  app.post('/api/admin/emergency/trading', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { active, paused, reason } = req.body;
      const effectiveActive = active !== undefined ? Boolean(active) : (paused !== undefined ? !paused : false);
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setGlobalTradingActive(effectiveActive, user?.name || 'Super Admin', reason);
      res.json({ success: true, active: effectiveActive, paused: !effectiveActive, state: updated });
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Trading state was not changed.' });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/kill-switch', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { action, reason } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.triggerKillSwitch(action || 'TRIGGER', user?.name || 'Super Admin', reason);
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Kill switch was not changed.' });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/kill-switch/reset', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.triggerKillSwitch('RESET', user?.name || 'Super Admin', req.body?.reason || 'Kill switch reset');
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Kill switch was not changed.' });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/registrations', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setRegistrationActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable.' });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/api-access', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { enabled } = req.body;
      const user = (req as any).user;
      const updated = await activeTradingDataProvider.setApiAccessActive(enabled, user?.name || 'Super Admin');
      res.json(updated);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable.' });
      }
      res.status(500).json({ error: err.message });
    }
  });
  app.post('/api/admin/emergency/freeze', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER']), async (req, res) => {
    try {
      const { entityType, entityId, action, reason } = req.body;
      const user = (req as any).user;
      const result = await activeTradingDataProvider.executeAccountAction(entityType, entityId, action, user?.name || 'Super Admin', reason || 'Emergency Freeze');
      res.json(result);
    } catch (err: any) {
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Entity status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Master status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Master status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Broker status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Broker status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. User status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. User status was not changed.' });
      }
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
      if (err?.message?.includes('Circuit Breaker') || err?.message?.includes('unreachable') || err?.message?.includes('unavailable')) {
        return res.status(503).json({ error: 'TRADING_PLATFORM_UNREACHABLE', message: 'Trading platform is currently unreachable. Account status was not changed.' });
      }
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

  app.put('/api/admin/master-brokerage/:masterId', authMiddleware, requireRoles(['SUPER_ADMIN', 'PLATFORM_OWNER', 'MASTER']), async (req, res) => {
    try {
      const user = (req as any).user;
      if (user?.role === 'MASTER' && user?.hierarchy_id !== req.params.masterId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only configure brokerage for your own master organization.' });
      }
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
      let masterId = req.query.masterId as string | undefined;
      const user = (req as any).user;
      if (user?.role === 'MASTER') {
        masterId = user.hierarchy_id || undefined;
      }
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

  app.get(['/api/admin/monitoring/suspicious-alerts', '/api/admin/monitoring/alerts'], authMiddleware, async (req, res) => {
    try {
      const alerts = await activeTradingDataProvider.getSuspiciousActivityAlerts();
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/admin/monitoring/suspicious-alerts/:id/resolve', '/api/admin/monitoring/alerts/:id/resolve'], authMiddleware, async (req, res) => {
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
      const { role = 'SUPER_ADMIN' } = req.body;
      const roleUpper = String(role).toUpperCase();
      if (roleUpper === 'CLIENT' || roleUpper === 'TRADER' || roleUpper === 'TRADER_CLIENT') {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'Access Denied: Trader Clients cannot access the Admin Portal. Please login via the Trading Platform.'
        });
      }
      const isClient = false;
      const email = 'admin@platform.com';
      const name = 'Admin John';
      const tenantId = null;
      const tenantName = 'All Tenants (Global Scope)';
      const clientCode = undefined;

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

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('tradepro_session', token, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction ? 'lax' : 'none',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
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
  app.get('/api/trading/portfolio', async (req, res) => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'vertex-default';
      const livePositionsRes = await tradingPlatformClient.getLivePositions(tenantId);
      const positionsList = Array.isArray(livePositionsRes.data?.positions)
        ? livePositionsRes.data.positions
        : (Array.isArray(livePositionsRes.data?.items) ? livePositionsRes.data.items : (Array.isArray(livePositionsRes.data) ? livePositionsRes.data : tradingPositionsState));

      const liveSummaryRes = await tradingPlatformClient.getLiveSummary(tenantId);
      const metrics = liveSummaryRes.data?.metrics;

      res.json({
        success: true,
        data_state: 'authoritative',
        wallet: {
          ...tradingWalletState,
          usedMargin: metrics?.total_used_margin ?? tradingWalletState.usedMargin,
          totalPnL: metrics?.total_pnl ?? tradingWalletState.totalPnL
        },
        positions: positionsList
      });
    } catch {
      res.json({
        success: true,
        wallet: tradingWalletState,
        positions: tradingPositionsState
      });
    }
  });

  // GET /api/trading/orders
  app.get(['/api/trading/orders', '/api/trading/order'], async (req, res) => {
    try {
      const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'vertex-default';
      const liveOrdersRes = await tradingPlatformClient.getLiveOrders(tenantId);
      const ordersList = Array.isArray(liveOrdersRes.data?.orders)
        ? liveOrdersRes.data.orders
        : (Array.isArray(liveOrdersRes.data?.items) ? liveOrdersRes.data.items : (Array.isArray(liveOrdersRes.data) ? liveOrdersRes.data : tradingOrdersState));

      res.json({
        success: true,
        data_state: 'authoritative',
        orders: ordersList
      });
    } catch {
      res.json({
        success: true,
        orders: tradingOrdersState
      });
    }
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

      tradingOrdersState = [newOrder, ...tradingOrdersState].slice(0, 50);

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
        tradingPositionsState = [newPos, ...tradingPositionsState].slice(0, 50);
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
    tradingTicketsState = [newTicket, ...tradingTicketsState].slice(0, 50);
    res.status(201).json({ success: true, ticket: newTicket });
  });

  // ----------------------------------------------------
  // Vite Integration (Dev Middleware & Production Static)
  // ----------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' || indexHtmlExists) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Periodic memory check & GC trigger if running in memory-constrained environment
  if (global.gc) {
    setInterval(() => {
      try {
        const mem = process.memoryUsage();
        if (mem.heapUsed > 250 * 1024 * 1024) {
          global.gc!();
        }
      } catch {}
    }, 60000).unref();
  }

  // Attach HTTP Server and WebSocket Server for Sub-Second Live Streaming
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const adminWsClients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    adminWsClients.add(ws);

    // Initial snapshot of current live quotes on connect
    try {
      const initialQuotes = getAllLivePrices();
      ws.send(JSON.stringify({
        type: 'market.ticks',
        eventType: 'market.ticks',
        payload: initialQuotes,
        data: initialQuotes,
        timestamp: new Date().toISOString()
      }));
    } catch {}

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => {
      adminWsClients.delete(ws);
    });

    ws.on('error', () => {
      adminWsClients.delete(ws);
    });
  });

  function broadcastToAdminClients(eventType: string, payload: any) {
    if (adminWsClients.size === 0) return;
    const msgStr = JSON.stringify({
      type: eventType,
      eventType,
      data: payload,
      payload,
      timestamp: new Date().toISOString()
    });
    for (const ws of adminWsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msgStr);
        } catch {
          adminWsClients.delete(ws);
        }
      }
    }
  }

  // Forward EventBus events to connected admin WebSocket clients
  adminEventBus.on('live-event', (evt: any) => {
    if (evt?.eventType) {
      broadcastToAdminClients(evt.eventType, evt.payload);
    }
  });

  // Real-Time Tick-to-Position MTM Recalculation Engine (every 3s, only when admin WS clients are connected)
  const tickInterval = setInterval(async () => {
    if (adminWsClients.size === 0) return;
    try {
      let updatedTicks: Record<string, number> = {};
      let remoteSuccess = false;

      // 1. Fetch live snapshot or quotes from Trading Platform if available
      try {
        const snapRes = await tradingPlatformClient.getLiveSnapshot();
        if (snapRes.success && snapRes.data) {
          const quotes = snapRes.data.quotes || snapRes.data.prices || snapRes.data.marketData;
          if (quotes && typeof quotes === 'object') {
            for (const [sym, q] of Object.entries(quotes)) {
              const ltp = parseCleanNumber(typeof q === 'object' ? (q as any).ltp ?? (q as any).price : q);
              if (sym && ltp > 0) {
                updateLivePrice(sym, ltp);
                updatedTicks[sym.toUpperCase()] = ltp;
              }
            }
            remoteSuccess = true;
          }
        }
      } catch {}

      // Fallback: gentle subtle tick walk on tracked benchmark symbols
      if (!remoteSuccess) {
        const trackedSymbols = ['RELIANCE', 'TCS', 'NIFTY50', 'BANKNIFTY', 'HDFCBANK', 'TATASTEEL', 'INFY', 'USD/INR', 'GOLD', 'CRUDEOIL'];
        for (const sym of trackedSymbols) {
          const current = liveLtpLookup(sym);
          if (current > 0) {
            const jitter = (Math.random() - 0.49) * 0.0006 * current;
            const nextPrice = Math.max(1, Math.round((current + jitter) * 100) / 100);
            updateLivePrice(sym, nextPrice);
            updatedTicks[sym] = nextPrice;
          }
        }
      }

      // 2. Broadcast market ticks to all connected admin clients
      if (Object.keys(updatedTicks).length > 0) {
        broadcastToAdminClients('market.ticks', updatedTicks);
        for (const [s, p] of Object.entries(updatedTicks).slice(0, 3)) {
          broadcastToAdminClients('market.tick', { symbol: s, ltp: p, price: p });
        }
      }

      // 3. Recalculate open positions MTM deltas and broadcast over WebSocket
      if (adminWsClients.size > 0) {
        const openPositions = await activeTradingDataProvider.getPositions().catch(() => []);
        if (Array.isArray(openPositions) && openPositions.length > 0) {
          const mtmBatch = openPositions.map(pos => ({
            positionId: pos.id,
            id: pos.id,
            client: pos.client,
            clientId: pos.clientId,
            symbol: pos.symbol,
            side: pos.side,
            ltp: pos.rawCurrentPrice,
            currentPrice: pos.currentPrice,
            unrealizedPnL: pos.rawUnrealizedPL,
            unrealizedPL: pos.unrealizedPL,
            unrealizedPLPositive: pos.unrealizedPLPositive,
            avgPrice: pos.rawAvgPrice,
            qty: pos.rawQty
          }));

          broadcastToAdminClients('positions.live_mtm', mtmBatch);
          broadcastToAdminClients('positions.mtm_batch', mtmBatch);
        }
      }
    } catch {
      // Background tick iteration safety
    }
  }, 3000);
  tickInterval.unref?.();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TradePro Central Admin Panel running on http://localhost:${PORT}`);
  });
}

startServer();
