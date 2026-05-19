import './env.js';

let poolPromise = null;

export function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getSslConfig() {
  if (process.env.PGSSL !== 'true') return undefined;
  return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' };
}

async function loadPg() {
  try {
    return await import('pg');
  } catch (err) {
    throw new Error(
      'DATABASE_URL is set, but the "pg" package is not installed. Run: pnpm --filter backend add pg',
      { cause: err },
    );
  }
}

export async function getPool() {
  if (!isDatabaseEnabled()) return null;

  if (!poolPromise) {
    poolPromise = (async () => {
      const pg = await loadPg();
      const Pool = pg.Pool || pg.default?.Pool;

      return new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.PG_POOL_SIZE || 10),
        connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000),
        ssl: getSslConfig(),
      });
    })();
  }

  return poolPromise;
}

export async function query(text, params = []) {
  const pool = await getPool();
  if (!pool) throw new Error('DATABASE_URL is not set');
  return pool.query(text, params);
}

export async function checkDatabaseHealth() {
  if (!isDatabaseEnabled()) {
    return { enabled: false, ok: true };
  }

  try {
    await query('SELECT 1');
    return { enabled: true, ok: true };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      error: err.message || 'Unknown database error',
      code: err.code || null,
    };
  }
}

export async function withTransaction(callback) {
  const pool = await getPool();
  if (!pool) throw new Error('DATABASE_URL is not set');

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
}

export async function closePool() {
  if (!poolPromise) return;

  const pool = await poolPromise;
  await pool.end();
  poolPromise = null;
}
