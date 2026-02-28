/**
 * Adapter PostgreSQL para o ERP Prime.
 * Usado quando USE_POSTGRES=true e DATABASE_URL está definido (ex.: Railway).
 * Converte placeholders ? para $1, $2, ... e retorna lastID via RETURNING id quando aplicável.
 */

import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/database';

if (!config.database.databaseUrl) {
  throw new Error('DATABASE_URL é obrigatório quando USE_POSTGRES=true');
}

const pool = new Pool({
  connectionString: config.database.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err: Error) => {
  console.error('Erro inesperado no pool PostgreSQL:', err.message);
});

/** Converte SQL com placeholders ? para $1, $2, ... (ordem dos params preservada). */
function toPgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Para INSERT sem RETURNING, adiciona RETURNING id apenas se a tabela tiver coluna id. */
function ensureReturning(sql: string): string {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  if (!upper.startsWith('INSERT') || /\bRETURNING\b/i.test(trimmed)) {
    return sql;
  }
  // Só adicionar RETURNING id se a lista de colunas do INSERT incluir "id" (evita erro em tabelas com PK não-id, ex.: notification_email_templates)
  const colListMatch = trimmed.match(/INSERT\s+INTO\s+\S+\s*\(([^)]+)\)/i);
  const hasIdColumn = colListMatch
    ? colListMatch[1].split(',').some((c) => c.trim().toLowerCase() === 'id')
    : false;
  if (!hasIdColumn) {
    return sql;
  }
  const lastParen = trimmed.lastIndexOf(')');
  if (lastParen === -1) return sql;
  const afterValues = trimmed.slice(lastParen + 1).trim();
  if (afterValues && !afterValues.startsWith(';')) return sql;
  return trimmed.slice(0, lastParen + 1) + ' RETURNING id' + trimmed.slice(lastParen + 1);
}

export const dbRun = async (
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> => {
  const pgSql = toPgParams(sql);
  const withReturning = ensureReturning(pgSql);
  const client = await pool.connect();
  try {
    const res = await client.query(withReturning, params);
    const lastID =
      res.rows && res.rows.length > 0 && res.rows[0].id != null
        ? Number(res.rows[0].id)
        : 0;
    const changes = res.rowCount ?? 0;
    return { lastID, changes };
  } finally {
    client.release();
  }
};

export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  const pgSql = toPgParams(sql);
  const client = await pool.connect();
  try {
    const res = await client.query(pgSql, params);
    return res.rows && res.rows.length > 0 ? res.rows[0] : undefined;
  } finally {
    client.release();
  }
};

export const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  const pgSql = toPgParams(sql);
  const client = await pool.connect();
  try {
    const res = await client.query(pgSql, params);
    return res.rows ?? [];
  } finally {
    client.release();
  }
};

/** Objeto compatível com código que usa db.run/db.get/db.prepare (ex.: TicketHistory). Não usar em novo código. */
export const db = {
  run: (sql: string, params?: any[], callback?: (err: Error | null) => void) => {
    const p = Array.isArray(params) ? params : [];
    pool.query(toPgParams(sql), p)
      .then(() => callback?.(null))
      .catch((err: Error) => callback?.(err));
  },
  get: (sql: string, params: any[], callback: (err: Error | null, row?: any) => void) => {
    dbGet(sql, params)
      .then((row) => callback(null, row))
      .catch((err: Error) => callback(err));
  },
  serialize: (fn: () => void) => fn(),
  prepare: (sql: string) => ({
    run: (params: any[], callback?: (this: { lastID: number }, err: Error | null) => void) => {
      const pgSql = toPgParams(ensureReturning(sql));
      pool.query(pgSql, params)
        .then((res: { rows?: { id?: unknown }[] }) => {
          const lastID = res.rows?.[0]?.id != null ? Number(res.rows[0].id) : 0;
          if (callback) callback.call({ lastID }, null);
        })
        .catch((err: Error) => callback?.call({ lastID: 0 }, err));
    }
  }),
  close: (callback: (err: Error | null) => void) => {
    pool.end().then(() => callback(null)).catch((err: Error) => callback(err));
  }
};

/** Remove linhas de comentário (-- ...) do início do statement, mantendo o SQL. */
function stripLeadingComments(stmt: string): string {
  return stmt.replace(/^(\s*--[^\r\n]*(?:\r?\n)?)+/gm, '').trim();
}

/** Split SQL em statements, sem cortar em ; dentro de strings literais (') */
function splitSqlStatements(schema: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let i = 0;
  const n = schema.length;
  while (i < n) {
    const c = schema[i];
    if (inString) {
      if (c === "'" && schema[i + 1] === "'") {
        current += "''";
        i += 2;
        continue;
      }
      if (c === "'") {
        inString = false;
        current += c;
        i++;
        continue;
      }
      current += c;
      i++;
      continue;
    }
    if (c === "'") {
      inString = true;
      current += c;
      i++;
      continue;
    }
    if (c === ';') {
      const raw = current.trim();
      const stmt = stripLeadingComments(raw);
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
      i++;
      continue;
    }
    current += c;
    i++;
  }
  const rawLast = current.trim();
  const last = stripLeadingComments(rawLast);
  if (last.length > 0) {
    statements.push(last);
  }
  return statements;
}

/** Executa o schema inicial: preferência schema-full.postgres.sql (completo), senão schema.postgres.sql. */
export const executeSchema = async (): Promise<void> => {
  const candidates = [
    path.join(__dirname, 'schema-full.postgres.sql'),
    path.join(process.cwd(), 'src', 'core', 'database', 'schema-full.postgres.sql'),
    path.join(__dirname, 'schema.postgres.sql'),
    path.join(process.cwd(), 'src', 'core', 'database', 'schema.postgres.sql')
  ];
  let schemaPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      schemaPath = p;
      break;
    }
  }
  if (!schemaPath) {
    throw new Error('Nenhum schema PostgreSQL encontrado (schema-full.postgres.sql ou schema.postgres.sql)');
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(schema);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const sql = statement.endsWith(';') ? statement : statement + ';';
      const upper = statement.toUpperCase();
      try {
        if (upper.startsWith('CREATE INDEX')) {
          await client.query(sql);
        } else if (upper.startsWith('CREATE TABLE')) {
          await client.query(sql);
        } else {
          await client.query(sql);
        }
      } catch (e: any) {
        if (e.code === '42P07') {
          // relation already exists (table or index) - ignorar
        } else {
          console.error(`Erro no statement ${i + 1}/${statements.length}:`, sql.slice(0, 150));
          await client.query('ROLLBACK');
          throw e;
        }
      }
    }
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  await runSchemaMigrationsPostgres();
  console.log('Schema PostgreSQL executado com sucesso');
};

/** Migrações específicas para Postgres (tabelas/colunas adicionais). Por ora no-op; expandir conforme necessário. */
async function runSchemaMigrationsPostgres(): Promise<void> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_tracking'"
    );
    if (!r.rows?.length) {
      await client.query(`
        CREATE TABLE user_activity_tracking (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          activity VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          session_id VARCHAR(255)
        )
      `);
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id ON user_activity_tracking(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_timestamp ON user_activity_tracking(timestamp)');
      console.log('Migração Postgres: user_activity_tracking criada');
    }
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_activity'"
    );
    if (!cols.rows?.length) {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP');
      console.log('Migração Postgres: coluna last_activity em users');
    }
  } finally {
    client.release();
  }
}

export const closeDatabase = (): Promise<void> => pool.end();
