import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../src/types.ts';
import { AuthenticatedUser, Permission } from './types.ts';
import { validateSessionAndUser, writeSecurityAuditLog } from './authService.ts';
import { checkHasPermission } from './rbac.ts';
import { query } from '../db/connection.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = (req.query?.token as string) || req.cookies?.tradepro_session || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please sign in to access this resource.'
    });
  }

  try {
    const user = await validateSessionAndUser(token);
    if (!user) {
      // Clear stale cookie
      res.clearCookie('tradepro_session');
      return res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'Your session has expired or been revoked. Please sign in again.'
      });
    }

    req.user = user;
    next();
  } catch (err: any) {
    console.error('[AuthMiddleware] Error validating session:', err);
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid session token'
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (user.role === 'PLATFORM_OWNER' || allowedRoles.includes(user.role)) {
      return next();
    }

    // Security audit log for forbidden access
    writeSecurityAuditLog({
      tenantId: user.tenant_id,
      userName: user.name,
      action: 'UNAUTHORIZED_ROLE_ACCESS',
      module: 'SECURITY',
      details: `Role '${user.role}' attempted to access route restricted to [${allowedRoles.join(', ')}]`,
      ipAddress: req.ip || req.socket.remoteAddress
    }).catch(() => {});

    return res.status(403).json({
      error: 'FORBIDDEN',
      message: `Access denied. Role '${user.role}' is not authorized for this operation.`
    });
  };
}

export function requirePermission(permissionOrPermissions: Permission | Permission[]) {
  const requiredList = Array.isArray(permissionOrPermissions) ? permissionOrPermissions : [permissionOrPermissions];

  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (user.role === 'PLATFORM_OWNER') {
      return next();
    }

    let hasAll = true;
    for (const perm of requiredList) {
      const allowed = await checkHasPermission(user.role, perm, user.permissions);
      if (!allowed) {
        hasAll = false;
        break;
      }
    }

    if (hasAll) {
      return next();
    }

    // Security audit log for permission denied
    writeSecurityAuditLog({
      tenantId: user.tenant_id,
      userName: user.name,
      action: 'PERMISSION_DENIED',
      module: 'RBAC',
      details: `User ${user.email} (Role: ${user.role}) denied required permissions: [${requiredList.join(', ')}]`,
      ipAddress: req.ip || req.socket.remoteAddress
    }).catch(() => {});

    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied: You do not have the required permissions to perform this action.'
    });
  };
}

export function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  // Super admins and Platform owners can access all tenants
  if (user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_OWNER') {
    return next();
  }

  const requestedTenantId =
    req.params.tenantId ||
    (req.body && req.body.tenant_id) ||
    (req.query && typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined);

  const defaultGroup = new Set(['vertex-default', 'default', 'TNT-001']);
  const isEquivalent = requestedTenantId && user.tenant_id && defaultGroup.has(requestedTenantId) && defaultGroup.has(user.tenant_id);

  if (requestedTenantId && requestedTenantId !== 'ALL' && requestedTenantId !== user.tenant_id && !isEquivalent) {
    writeSecurityAuditLog({
      tenantId: user.tenant_id,
      userName: user.name,
      action: 'CROSS_TENANT_ACCESS_BLOCKED',
      module: 'SECURITY',
      details: `User belonging to tenant '${user.tenant_id}' attempted cross-tenant access to '${requestedTenantId}' on ${req.method} ${req.path}`,
      ipAddress: req.ip || req.socket.remoteAddress
    }).catch(() => {});

    return res.status(403).json({
      error: 'CROSS_TENANT_FORBIDDEN',
      message: 'Access denied. You cannot access or modify resources belonging to another tenant.'
    });
  }

  next();
}

/**
 * Derives the tenant context strictly from verified authentication.
 * Non-super-admins CANNOT override or spoof tenant via query params or headers.
 */
export function resolveStrictTenantScope(req: Request): string | undefined {
  const user = req.user;
  if (!user) return undefined;

  // Non-super-admins are strictly locked to their own tenant
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'PLATFORM_OWNER') {
    return user.tenant_id || undefined;
  }

  // For Super Admin: simulated tenant filter via session or explicit query param
  if (user.simulated_tenant_id) {
    return user.simulated_tenant_id;
  }

  if (req.query.tenantId && typeof req.query.tenantId === 'string' && req.query.tenantId !== 'ALL') {
    return req.query.tenantId;
  }

  return undefined;
}

/**
 * Validates downline hierarchy access for Master, Broker, Sub-Broker, Client
 */
export async function requireHierarchyAccess(
  entityType: 'master' | 'broker' | 'sub_broker' | 'client',
  targetEntityId: string,
  user: AuthenticatedUser
): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_OWNER' || user.role === 'TENANT_ADMIN' || user.role === 'COMPLIANCE_OFFICER') {
    return true;
  }

  if (!user.hierarchy_id) {
    return false;
  }

  try {
    if (user.role === 'MASTER') {
      if (entityType === 'master') {
        return targetEntityId === user.hierarchy_id;
      }
      if (entityType === 'broker') {
        const { rows } = await query('SELECT master_id FROM brokers WHERE id = $1', [targetEntityId]);
        return rows.length > 0 && rows[0].master_id === user.hierarchy_id;
      }
      if (entityType === 'sub_broker') {
        const { rows } = await query(
          `SELECT b.master_id FROM sub_brokers sb
           JOIN brokers b ON sb.broker_id = b.id
           WHERE sb.id = $1`,
          [targetEntityId]
        );
        return rows.length > 0 && rows[0].master_id === user.hierarchy_id;
      }
      if (entityType === 'client') {
        const { rows } = await query(
          `SELECT b.master_id FROM clients c
           JOIN sub_brokers sb ON c.sub_broker_id = sb.id
           JOIN brokers b ON sb.broker_id = b.id
           WHERE c.id = $1`,
          [targetEntityId]
        );
        return rows.length > 0 && rows[0].master_id === user.hierarchy_id;
      }
    }

    if (user.role === 'BROKER') {
      if (entityType === 'master') return false;
      if (entityType === 'broker') return targetEntityId === user.hierarchy_id;
      if (entityType === 'sub_broker') {
        const { rows } = await query('SELECT broker_id FROM sub_brokers WHERE id = $1', [targetEntityId]);
        return rows.length > 0 && rows[0].broker_id === user.hierarchy_id;
      }
      if (entityType === 'client') {
        const { rows } = await query(
          `SELECT sb.broker_id FROM clients c
           JOIN sub_brokers sb ON c.sub_broker_id = sb.id
           WHERE c.id = $1`,
          [targetEntityId]
        );
        return rows.length > 0 && rows[0].broker_id === user.hierarchy_id;
      }
    }

    if (user.role === 'SUB_BROKER') {
      if (entityType === 'master' || entityType === 'broker') return false;
      if (entityType === 'sub_broker') return targetEntityId === user.hierarchy_id;
      if (entityType === 'client') {
        const { rows } = await query('SELECT sub_broker_id FROM clients WHERE id = $1', [targetEntityId]);
        return rows.length > 0 && rows[0].sub_broker_id === user.hierarchy_id;
      }
    }

    if (user.role === 'CLIENT') {
      return entityType === 'client' && targetEntityId === user.hierarchy_id;
    }

    return false;
  } catch (err) {
    console.error('[requireHierarchyAccess] DB query error:', err);
    return false;
  }
}

/**
 * In-memory IP rate limiter for login and register endpoints (10 requests/min/IP).
 */
interface AuthRateLimitRecord {
  count: number;
  resetTime: number;
}

const authRateLimitMap = new Map<string, AuthRateLimitRecord>();

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = 10;

  const record = authRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    authRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= limit) {
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts from this IP address. Please try again after 1 minute.'
    });
  }

  record.count += 1;

  if (authRateLimitMap.size > 5000) {
    for (const [k, v] of authRateLimitMap.entries()) {
      if (now > v.resetTime) {
        authRateLimitMap.delete(k);
      }
    }
  }

  return next();
}

export function resetAuthRateLimit(ip?: string) {
  if (ip) {
    authRateLimitMap.delete(ip);
  } else {
    authRateLimitMap.clear();
  }
}
