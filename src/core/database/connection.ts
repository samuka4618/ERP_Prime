/**
 * Facade de conexão: delega para SQLite (padrão) ou PostgreSQL conforme USE_POSTGRES e DATABASE_URL.
 * Todos os módulos importam dbRun, dbGet, dbAll, db, executeSchema, closeDatabase daqui.
 */
import { config } from '../../config/database';

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

export default db;
