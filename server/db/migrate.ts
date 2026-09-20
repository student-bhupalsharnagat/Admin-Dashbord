import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { query, withTransaction } from './connection.ts';

function resolveMigrationsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'server', 'db', 'migrations'),
    typeof __dirname !== 'undefined' ? path.join(__dirname, 'migrations') : '',
    typeof __dirname !== 'undefined' ? path.join(__dirname, '..', 'server', 'db', 'migrations') : ''
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'server', 'db', 'migrations');
}

export interface MigrationResult {
  version: string;
  status: 'APPLIED' | 'SKIPPED' | 'FAILED';
  durationMs?: number;
  error?: string;
}

export async function runMigrations(customPool?: pg.Pool): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  const migrationsDir = resolveMigrationsDir();
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  // 1. Ensure schema_migrations table exists
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `, [], customPool);

  // 2. Fetch applied migrations
  const { rows: appliedRows } = await query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY id ASC',
    [],
    customPool
  );
  const appliedSet = new Set(appliedRows.map(r => r.version));

  // 3. Read migration files sorted by name
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log(`[Migration Runner] Found ${files.length} migration files. ${appliedSet.size} already applied.`);

  for (const file of files) {
    if (appliedSet.has(file)) {
      results.push({ version: file, status: 'SKIPPED' });
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`[Migration Runner] Applying migration: ${file}...`);
    const startTime = Date.now();

    try {
      await withTransaction(async (client) => {
        // Execute SQL script
        if ((client as any).exec) {
          await (client as any).exec(sql);
        } else {
          await client.query(sql);
        }
        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
      }, customPool);

      const durationMs = Date.now() - startTime;
      console.log(`[Migration Runner] Successfully applied ${file} (${durationMs}ms)`);
      results.push({ version: file, status: 'APPLIED', durationMs });
    } catch (err: any) {
      console.error(`[Migration Runner] Failed to apply ${file}: ${err.message}`);
      results.push({ version: file, status: 'FAILED', error: err.message });
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  return results;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(async (results) => {
      console.log('[Migration Runner] Migration execution summary:');
      console.table(results);
      const { closePool } = await import('./connection.ts');
      await closePool();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration Runner] Fatal error:', err);
      process.exit(1);
    });
}
