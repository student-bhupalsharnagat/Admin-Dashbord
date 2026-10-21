const { PGlite } = require('@electric-sql/pglite');

async function inspect() {
  const pglite = new PGlite('C:\\Users\\HP\\OneDrive\\Desktop\\Trading- Platform\\Trading-Platform-1\\.vertex_pg_data');
  await pglite.waitReady;

  const tables = await pglite.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
  console.log('Tables:', tables.rows.map(r => r.tablename));

  for (const t of tables.rows) {
    try {
      const count = await pglite.query(`SELECT count(*) as count FROM "${t.tablename}"`);
      console.log(`Table ${t.tablename}: ${count.rows[0].count} rows`);
    } catch (e) {
      console.log(`Table ${t.tablename} error:`, e.message);
    }
  }

  // Check users roles
  try {
    const roles = await pglite.query('SELECT role, count(*) FROM users GROUP BY role');
    console.log('Users by role:', roles.rows);
  } catch (e) {}

  await pglite.close();
}

inspect().catch(console.error);
