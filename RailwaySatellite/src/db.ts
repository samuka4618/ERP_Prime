import { Pool, PoolClient } from 'pg';
import { config } from './config';

let pool: Pool | null = null;

function sslOption(): boolean | { rejectUnauthorized: boolean } {
  if (process.env.DATABASE_SSL === '0') return false;
  try {
    const raw = config.databaseUrl.replace(/^postgresql:\/\//i, 'postgres://');
    const u = new URL(raw);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
  } catch {
    /* ignore */
  }
  return { rejectUnauthorized: false };
}

export function getPool(): Pool {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL não configurada');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: sslOption()
    });
  }
  return pool;
}

export async function runMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS form_snapshots (
      id UUID PRIMARY KEY,
      source_form_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      schema_json JSONB NOT NULL,
      public_slug TEXT NOT NULL UNIQUE,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id UUID PRIMARY KEY,
      snapshot_id UUID NOT NULL REFERENCES form_snapshots(id) ON DELETE CASCADE,
      tracking_token TEXT NOT NULL UNIQUE,
      driver_name TEXT NOT NULL,
      phone TEXT,
      fornecedor_id INTEGER NOT NULL,
      responses JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      erp_ack_at TIMESTAMPTZ
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_submissions_erp_ack ON submissions(erp_ack_at);
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS driver_states (
      submission_id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
      phase TEXT NOT NULL DEFAULT 'submitted',
      message TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
