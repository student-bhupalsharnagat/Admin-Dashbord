import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.ts';
import { UserRole } from '../../src/types.ts';
import { AuthenticatedUser, HierarchyLevel, JwtPayload, Permission } from './types.ts';
import { getPermissionsForRole } from './rbac.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'tradepro_production_secure_jwt_secret_signing_key_2026';
const JWT_EXPIRES_IN = '24h';
const BCRYPT_SALT_ROUNDS = 10;

export async function hashPassword(plainText: string): Promise<string> {
  return await bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return await bcrypt.compare(plainText, hash);
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function writeSecurityAuditLog(params: {
  tenantId?: string | null;
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    const id = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO audit_logs (id, tenant_id, user_name, action, module, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        params.tenantId || null,
        params.userName || 'System',
        params.action,
        params.module || 'SECURITY',
        params.details,
        params.ipAddress || '127.0.0.1'
      ]
    );
  } catch (err) {
    console.error('[SecurityAudit] Failed to write audit log:', err);
  }
}

export async function createAuthenticatedSession(params: {
  userId: string;
  tenantId: string | null;
  userName: string;
  role: UserRole;
  hierarchyLevel: HierarchyLevel;
  hierarchyId?: string | null;
  email: string;
  ipAddress: string;
  device?: string;
}): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const token = signAccessToken({
    sub: params.userId,
    email: params.email,
    role: params.role,
    tenantId: params.tenantId,
    hierarchyLevel: params.hierarchyLevel,
    hierarchyId: params.hierarchyId,
    sessionId
  });

  // Store active session in database
  await query(
    `INSERT INTO sessions (
      id, tenant_id, user_id, user_name, role, ip_address, device,
      status, token_hash, expires_at, login_time, last_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      sessionId,
      params.tenantId || null,
      params.userId,
      params.userName,
      params.role,
      params.ipAddress || '127.0.0.1',
      params.device || 'Desktop Browser',
      sessionId, // Session key reference
      expiresAt
    ]
  );

  return { token, sessionId, expiresAt };
}

export async function validateSessionAndUser(token: string): Promise<AuthenticatedUser | null> {
  const payload = verifyAccessToken(token);
  if (!payload || !payload.sessionId) {
    return null;
  }

  // Verify session in database
  const { rows: sessionRows } = await query<{
    id: string;
    tenant_id: string | null;
    user_id: string;
    user_name: string;
    role: string;
    status: string;
    revoked_at: Date | null;
    expires_at: Date;
  }>(
    `SELECT id, tenant_id, user_id, user_name, role, status, revoked_at, expires_at
     FROM sessions
     WHERE id = $1 LIMIT 1`,
    [payload.sessionId]
  );

  if (sessionRows.length === 0) {
    return null;
  }

  const session = sessionRows[0];
  if (session.status !== 'ACTIVE' || session.revoked_at !== null) {
    return null;
  }

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  // Verify user in database
  const { rows: userRows } = await query<{
    id: string;
    tenant_id: string | null;
    name: string;
    email: string;
    role: string;
    status: string;
    hierarchy_level: string | null;
    hierarchy_id: string | null;
    is_suspended: boolean | null;
  }>(
    `SELECT id, tenant_id, name, email, role, status, hierarchy_level, hierarchy_id, is_suspended
     FROM users
     WHERE id = $1 LIMIT 1`,
    [session.user_id]
  );

  if (userRows.length === 0) {
    return null;
  }

  const user = userRows[0];
  if (user.status !== 'ACTIVE' || user.is_suspended === true) {
    return null;
  }

  // Check tenant status if assigned to tenant
  let tenantName: string | undefined;
  if (user.tenant_id) {
    const { rows: tenantRows } = await query<{ name: string; status: string }>(
      `SELECT name, status FROM tenants WHERE id = $1 LIMIT 1`,
      [user.tenant_id]
    );
    if (tenantRows.length > 0) {
      if (tenantRows[0].status === 'SUSPENDED' && user.role !== 'SUPER_ADMIN') {
        return null;
      }
      tenantName = tenantRows[0].name;
    }
  }

  // Update last_active timestamp asynchronously
  query(`UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = $1`, [session.id]).catch(() => {});

  const permissions = await getPermissionsForRole(user.role as UserRole);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    tenant_id: user.tenant_id,
    tenant_name: tenantName,
    hierarchy_level: (user.hierarchy_level as HierarchyLevel) || (user.tenant_id ? 'TENANT' : 'PLATFORM'),
    hierarchy_id: user.hierarchy_id,
    status: user.status as 'ACTIVE' | 'SUSPENDED' | 'INACTIVE',
    permissions,
    session_id: session.id
  };
}

export async function invalidateSession(sessionId: string, revokedBy: string): Promise<boolean> {
  const result = await query(
    `UPDATE sessions
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, revokedBy]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function invalidateAllUserSessions(userId: string, revokedBy: string): Promise<number> {
  const result = await query(
    `UPDATE sessions
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $2
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, revokedBy]
  );
  return result.rowCount ?? 0;
}
