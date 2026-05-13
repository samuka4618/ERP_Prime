/**
 * Facade de conexão: delega para SQLite (padrão) ou PostgreSQL conforme USE_POSTGRES e DATABASE_URL.
 * Todos os módulos importam dbRun, dbGet, dbAll, db, executeSchema, closeDatabase daqui.
 */
import { config } from '../../config/database';

/** Cliente de transação: mesma conexão para run/get (obrigatório no Postgres em blocos BEGIN…COMMIT). */
export type TransactionClient = {
  run: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  get: (sql: string, params?: any[]) => Promise<any>;
};

type Backend = {
  dbRun: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  dbGet: (sql: string, params?: any[]) => Promise<any>;
  dbAll: (sql: string, params?: any[]) => Promise<any[]>;
  db: any;
  executeSchema: () => Promise<void>;
  closeDatabase: () => Promise<void>;
};

const backend: Backend = config.database.usePostgres
  ? (require('./connection-pg') as Backend)
  : (require('./connection-sqlite') as Backend);

export const dbRun = backend.dbRun;
export const dbGet = backend.dbGet;
export const dbAll = backend.dbAll;
export const db = backend.db;
export const executeSchema = backend.executeSchema;
export const closeDatabase = backend.closeDatabase;

/**
 * Agrupa várias operações numa única transação.
 * No Postgres usa uma conexão do pool; no SQLite usa BEGIN/COMMIT na mesma base (uma conexão).
 */
export async function runInTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  if (config.database.usePostgres) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { runInTransaction: pgRunInTransaction } = require('./connection-pg') as {
      runInTransaction: (f: (tx: TransactionClient) => Promise<T>) => Promise<T>;
    };
    return pgRunInTransaction(fn);
  }
  await dbRun('BEGIN TRANSACTION');
  try {
    const result = await fn({ run: dbRun, get: dbGet });
    await dbRun('COMMIT');
    return result;
  } catch (e) {
    await dbRun('ROLLBACK');
    throw e;
  }
}

export default db;
