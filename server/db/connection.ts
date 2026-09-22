import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const { Pool } = pg;

function getAllMigrationFiles(): string[] {
  const dirs = [
    path.join(process.cwd(), 'server', 'db', 'migrations'),
    typeof __dirname !== 'undefined' ? path.join(__dirname, 'migrations') : '',
    typeof __dirname !== 'undefined' ? path.join(__dirname, '..', 'server', 'db', 'migrations') : ''
  ].filter(Boolean);

  for (const d of dirs) {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d)
        .filter(f => f.endsWith('.sql'))
        .sort();
      if (files.length > 0) {
        return files.map(f => path.join(d, f));
      }
    }
  }
  return [];
}

export interface DbConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

let globalPool: pg.Pool | null = null;
let embeddedPglite: PGlite | null = null;
let isEmbeddedInitialized = false;
let embeddedInitPromise: Promise<PGlite> | null = null;
let remoteFailed = false;

export function getDbConfig(): DbConfig {
  const connectionString = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';
  const requiresSsl = connectionString?.includes('sslmode=require') || isProduction;

  return {
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined
  };
}

export function isUsingRemotePostgres(): boolean {
  if (remoteFailed) return false;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;
  // In containerized sandbox without local PostgreSQL server daemon, localhost:5432 will fail
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return false;
  }
  return true;
}

export function getPool(customPool?: pg.Pool): pg.Pool {
  if (customPool) return customPool;
  if (globalPool) return globalPool;

  const config = getDbConfig();
  if (!config.connectionString) {
    throw new Error('DATABASE_URL is not defined.');
  }

  globalPool = new Pool({
    connectionString: config.connectionString,
    max: config.max,
    idleTimeoutMillis: config.idleTimeoutMillis,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    ssl: config.ssl
  });

  globalPool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error] Unexpected idle client error:', err.message);
  });

  return globalPool;
}

export function setGlobalPool(pool: pg.Pool | null): void {
  globalPool = pool;
}

export async function getEmbeddedDb(): Promise<PGlite> {
  if (embeddedPglite && isEmbeddedInitialized) return embeddedPglite;
  if (embeddedInitPromise) return embeddedInitPromise;

  embeddedInitPromise = (async () => {
    if (!embeddedPglite) {
      try {
        embeddedPglite = new PGlite();
        await embeddedPglite.waitReady;
      } catch (err: any) {
        console.error('[PostgreSQL Engine] PGlite init error:', err?.message);
        embeddedPglite = new PGlite();
        await embeddedPglite.waitReady;
      }
    }

    if (!isEmbeddedInitialized) {
      isEmbeddedInitialized = true;
      console.log('[PostgreSQL Engine] Initializing schema migrations and seed...');
      const migrationFiles = getAllMigrationFiles();
      for (const migrationFile of migrationFiles) {
        try {
          const sql = fs.readFileSync(migrationFile, 'utf-8');
          await embeddedPglite.exec(sql);
          console.log(`[PostgreSQL Engine] Migration executed: ${path.basename(migrationFile)}`);
        } catch (migErr: any) {
          console.warn(`[PostgreSQL Engine] Migration warning (${path.basename(migrationFile)}):`, migErr?.message);
        }
      }
      console.log('[PostgreSQL Engine] Schema initialized successfully.');

      try {
        const countRes = await embeddedPglite.query('SELECT count(*) as count FROM tenants');
        if (parseInt((countRes.rows[0] as any)?.count || '0', 10) === 0) {
          const { seedDatabase } = await import('./seed.ts');
          await seedDatabase();
        }
      } catch (seedErr: any) {
        console.warn('[PostgreSQL Engine] Initial seed warning:', seedErr?.message);
      }
    }

    return embeddedPglite;
  })();

  return embeddedInitPromise;
}

export async function testConnection(pool?: pg.Pool): Promise<boolean> {
  if (isUsingRemotePostgres()) {
    try {
      const activePool = pool || getPool();
      const client = await activePool.connect();
      try {
        const res = await client.query('SELECT NOW() as current_time, current_database() as db_name');
        console.log(`[PostgreSQL Remote] Connected to "${res.rows[0].db_name}" at ${res.rows[0].current_time}`);
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[PostgreSQL Remote] Connection failed in testConnection, falling back to embedded engine:', err.message);
      remoteFailed = true;
    }
  }

  const db = await getEmbeddedDb();
  const res = await db.query('SELECT NOW() as current_time');
  console.log(`[PostgreSQL Embedded Engine] Active at ${(res.rows[0] as any).current_time}`);
  return true;
}

export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
    console.log('[PostgreSQL] Remote pool closed.');
  }
  if (embeddedPglite) {
    try {
      await Promise.race([
        embeddedPglite.close(),
        new Promise((resolve) => setTimeout(resolve, 300))
      ]);
    } catch {
      // ignore
    }
    embeddedPglite = null;
    isEmbeddedInitialized = false;
    embeddedInitPromise = null;
    console.log('[PostgreSQL] Embedded engine closed.');
  }
}

/**
 * Universal query runner for both Remote PostgreSQL Pool and Embedded Engine
 */
export async function query<T = any>(
  text: string,
  params?: any[],
  customPool?: pg.Pool
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    if (isUsingRemotePostgres() || customPool) {
      try {
        const pool = getPool(customPool);
        const res = await pool.query<T>(text, params);
        const duration = Date.now() - start;
        if (process.env.DEBUG_SQL === 'true') {
          console.log(`[Remote SQL ${duration}ms]: ${text.slice(0, 100)}`);
        }
        return res;
      } catch (remoteErr: any) {
        if (!customPool && (remoteErr.code === 'ECONNREFUSED' || remoteErr.code === 'ENOTFOUND' || remoteErr.code === 'ETIMEDOUT' || remoteErr.message?.includes('timeout') || remoteErr.message?.includes('Connection terminated'))) {
          console.warn('[PostgreSQL Remote] Query failed with connection error, falling back to embedded engine:', remoteErr.message);
          remoteFailed = true;
        } else {
          throw remoteErr;
        }
      }
    }

    const db = await getEmbeddedDb();
    const res = await db.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log(`[Embedded SQL ${duration}ms]: ${text.slice(0, 100)}`);
    }
    return {
      rows: res.rows,
      command: 'SELECT',
      rowCount: res.rows.length,
      oid: 0,
      fields: (res.fields || []) as any[]
    };
  } catch (err: any) {
    console.error(`[PostgreSQL Query Error]: ${err.message}`, {
      query: text.slice(0, 200),
      params: params ? params.slice(0, 10) : []
    });
    throw err;
  }
}

/**
 * Universal transaction runner
 */
export async function withTransaction<T>(
  callback: (client: { query: (text: string, params?: any[]) => Promise<any> }) => Promise<T>,
  customPool?: pg.Pool
): Promise<T> {
  if (isUsingRemotePostgres() || customPool) {
    try {
      const pool = getPool(customPool);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (remoteErr: any) {
      if (!customPool && (remoteErr.code === 'ECONNREFUSED' || remoteErr.code === 'ENOTFOUND' || remoteErr.code === 'ETIMEDOUT' || remoteErr.message?.includes('timeout'))) {
        console.warn('[PostgreSQL Remote] Transaction connection failed, falling back to embedded engine:', remoteErr.message);
        remoteFailed = true;
      } else {
        throw remoteErr;
      }
    }
  }

  const db = await getEmbeddedDb();
  await db.query('BEGIN');
  try {
    const result = await callback(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
