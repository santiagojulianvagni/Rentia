// Applies migrations/*.sql to Postgres in order, each one once, inside a
// transaction. Runs on every Vercel deploy (npm run vercel-build) and by hand
// with `npm run db:migrate`. Uses the direct (unpooled) Neon connection.
import {readFileSync,readdirSync} from 'node:fs';
import pg from 'pg';

// Same sslmode as db/client.ts: pg treats require as verify-full and warns otherwise.
const connectionString=(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL)?.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/,'$1verify-full');
if(!connectionString) {
  console.error('Falta DATABASE_URL (o DATABASE_URL_UNPOOLED). Conectá Neon al proyecto de Vercel o completalo en .env.local.');
  process.exit(1);
}

const client=new pg.Client({connectionString});
await client.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  // One deploy at a time: concurrent builds wait here instead of racing.
  await client.query('SELECT pg_advisory_lock(727274)');
  const applied=new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(row=>row.name));
  const pending=readdirSync('migrations').filter(name=>name.endsWith('.sql')).sort().filter(name=>!applied.has(name));
  for(const name of pending) {
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(`migrations/${name}`,'utf8'));
      await client.query('INSERT INTO schema_migrations (name,applied_at) VALUES ($1,$2)',[name,new Date().toISOString()]);
      await client.query('COMMIT');
      console.log(`Migración aplicada: ${name}`);
    } catch(error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  console.log(pending.length?`${pending.length} migraciones aplicadas.`:'La base ya está al día.');
} finally {
  await client.end();
}
