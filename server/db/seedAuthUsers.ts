import bcrypt from 'bcryptjs';
import { query, withTransaction } from './connection.ts';
import { ALL_SYSTEM_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS_MAP } from '../auth/rbac.ts';
import { UserRole } from '../../src/types.ts';

export async function seedAuthAndRbac(skipTenantCheck = false): Promise<void> {
  console.log('[Auth Seed] Initializing production roles, permissions and administrative users...');

  if (!skipTenantCheck) {
    try {
      const tenantCheck = await query('SELECT count(*) as count FROM tenants');
      if (parseInt((tenantCheck.rows[0] as any)?.count || '0', 10) === 0) {
        const { seedDatabase } = await import('./seed.ts');
        await seedDatabase();
        return;
      }
    } catch {
      // Proceed with seeding if check fails
    }
  }

  // 1. Seed permissions
  for (const perm of ALL_SYSTEM_PERMISSIONS) {
    const parts = perm.split('.');
    const moduleName = parts[0];
    const actionName = parts.slice(1).join('_') || 'ACCESS';
    try {
      await query(
        `INSERT INTO permissions (id, module, action, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [perm, moduleName.toUpperCase(), actionName, `Allows access to ${perm}`]
      );
    } catch (permErr: any) {
      // Non-fatal if permission already present
    }
  }

  // 2. Seed roles with JSONB permissions
  const roleEntries = Object.entries(DEFAULT_ROLE_PERMISSIONS_MAP) as [UserRole, string[]][];
  for (const [roleName, perms] of roleEntries) {
    await query(
      `INSERT INTO roles (id, name, description, permissions, is_system)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         permissions = EXCLUDED.permissions,
         name = EXCLUDED.name`,
      [roleName, roleName, `System role for ${roleName}`, JSON.stringify(perms)]
    );
  }

  // 3. Compute password hash for seed users
  const isProduction = process.env.NODE_ENV === 'production';
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (isProduction && !seedAdminPassword) {
    console.warn('[Auth Seed] Production mode: SEED_ADMIN_PASSWORD is not set. Refusing to seed administrative users with default password.');
    return;
  }

  const effectivePassword = seedAdminPassword || 'password123';
  const defaultPasswordHash = await bcrypt.hash(effectivePassword, 10);

  const adminUsers = [
    {
      id: 'usr_superadmin_01',
      tenant_id: null,
      name: 'Admin John',
      email: 'admin@platform.com',
      role: 'SUPER_ADMIN' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'PLATFORM',
      hierarchy_id: null,
      phone: '+91 98200 11223'
    },
    {
      id: 'usr_superadmin_02',
      tenant_id: null,
      name: 'TradePro Admin',
      email: 'admin@tradepro.io',
      role: 'SUPER_ADMIN' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'PLATFORM',
      hierarchy_id: null,
      phone: '+91 98200 11224'
    },
    {
      id: 'usr_platformowner_01',
      tenant_id: null,
      name: 'Platform Founder',
      email: 'owner@tradepro.io',
      role: 'PLATFORM_OWNER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'PLATFORM',
      hierarchy_id: null,
      phone: '+91 98200 99999'
    }
  ];

  const demoAccounts = [
    {
      id: 'usr_tenantadmin_01',
      tenant_id: 'TNT-001',
      name: 'Aditya Birla',
      email: 'tenantadmin@alphaprime.com',
      role: 'TENANT_ADMIN' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'TENANT',
      hierarchy_id: 'TNT-001',
      phone: '+91 98111 55667'
    },
    {
      id: 'usr_master_01',
      tenant_id: 'TNT-001',
      name: 'Suresh Nambiar',
      email: 'master@alphaprime.com',
      role: 'MASTER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'MASTER',
      hierarchy_id: 'MST-001',
      phone: '+91 98222 33445'
    },
    {
      id: 'usr_broker_01',
      tenant_id: 'TNT-001',
      name: 'Rajesh Mehta',
      email: 'broker@alphaprime.com',
      role: 'BROKER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'BROKER',
      hierarchy_id: 'BRK-001',
      phone: '+91 98333 44556'
    },
    {
      id: 'usr_subbroker_01',
      tenant_id: 'TNT-001',
      name: 'Vikram Singhania',
      email: 'subbroker@alphaprime.com',
      role: 'SUB_BROKER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'SUB_BROKER',
      hierarchy_id: 'SBRK-001',
      phone: '+91 98444 55667'
    },
    {
      id: 'usr_client_01',
      tenant_id: 'TNT-001',
      name: 'Arjun Patel',
      email: 'client@alphaprime.com',
      role: 'CLIENT' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'CLIENT',
      hierarchy_id: 'CLT-001',
      phone: '+91 98111 22334'
    },
    {
      id: 'usr_compliance_01',
      tenant_id: 'TNT-001',
      name: 'Sunita Rao',
      email: 'compliance@alphaprime.com',
      role: 'COMPLIANCE_OFFICER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'TENANT',
      hierarchy_id: 'TNT-001',
      phone: '+91 98555 66778'
    },
    {
      id: 'usr_risk_01',
      tenant_id: 'TNT-001',
      name: 'Rakesh Verma',
      email: 'risk@alphaprime.com',
      role: 'RISK_MANAGER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'TENANT',
      hierarchy_id: 'TNT-001',
      phone: '+91 98666 77889'
    },
    // Second tenant user for cross-tenant testing
    {
      id: 'usr_master_tnt2',
      tenant_id: 'TNT-002',
      name: 'Kavita Menon',
      email: 'master2@horizonsec.in',
      role: 'MASTER' as UserRole,
      status: 'ACTIVE',
      hierarchy_level: 'MASTER',
      hierarchy_id: 'MST-003',
      phone: '+91 98777 88990'
    },
    // Suspended account for negative testing
    {
      id: 'usr_suspended_01',
      tenant_id: 'TNT-001',
      name: 'Suspended Trader',
      email: 'suspended@alphaprime.com',
      role: 'CLIENT' as UserRole,
      status: 'SUSPENDED',
      hierarchy_level: 'CLIENT',
      hierarchy_id: 'CLT-009',
      phone: '+91 98000 00000',
      is_suspended: true
    }
  ];

  const shouldSeedDemoUsers = isProduction ? process.env.SEED_DEMO_USERS === 'true' : true;
  const usersToSeed = shouldSeedDemoUsers ? [...adminUsers, ...demoAccounts] : adminUsers;

  for (const u of usersToSeed) {
    await query(
      `INSERT INTO users (
        id, tenant_id, name, email, role, status, password_hash,
        phone, hierarchy_level, hierarchy_id, is_suspended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id,
        hierarchy_level = EXCLUDED.hierarchy_level,
        hierarchy_id = EXCLUDED.hierarchy_id,
        status = EXCLUDED.status,
        is_suspended = EXCLUDED.is_suspended,
        password_hash = EXCLUDED.password_hash`,
      [
        u.id,
        u.tenant_id,
        u.name,
        u.email,
        u.role,
        u.status,
        defaultPasswordHash,
        u.phone,
        u.hierarchy_level,
        u.hierarchy_id,
        (u as any).is_suspended || false
      ]
    );
  }

  console.log('[Auth Seed] Initialized administrative users, roles and permissions successfully.');
}
