import { readFile } from 'fs/promises';
import { closePool, getPool, isDatabaseEnabled } from '../src/db.js';

if (!isDatabaseEnabled()) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

try {
  const pool = await getPool();
  const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');

  await pool.query(sql);
  console.log('Database migration completed.');
} finally {
  await closePool();
}
