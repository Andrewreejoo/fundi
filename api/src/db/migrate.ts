/* Minimal migration runner: applies migrations/*.sql in name order, once each, inside a transaction. */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { config } from '../config';

export async function migrate(databaseUrl = config.databaseUrl, log = console.log) {
  const dir = path.resolve(__dirname, '../../migrations');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
        log(`applied ${f}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrate().then(
    () => { console.log('migrations up to date'); process.exit(0); },
    (e) => { console.error(e); process.exit(1); },
  );
}
