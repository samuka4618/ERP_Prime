import { dbGet, dbAll } from '../database/connection';
import { sqlDatetimeGeParam, sqlDatetimeLeParam } from '../database/sql-dialect';

export interface AuditLogRow {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  userId?: number;
  action?: string;
  resource?: string;
}

export interface AuditLogListResult {
  rows: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function findAll(filters: AuditLogFilters = {}): Promise<AuditLogListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.dateFrom) {
    conditions.push(sqlDatetimeGeParam('created_at'));
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(sqlDatetimeLeParam('created_at'));
    params.push(filters.dateTo);
  }
  if (filters.userId != null) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }
  if (filters.action) {
    conditions.push("action = ?");
    params.push(filters.action);
  }
  if (filters.resource) {
    conditions.push("resource = ?");
    params.push(filters.resource);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_log ${where}`;
  const countRow = await dbGet(countSql, params) as { total: number };
  const total = countRow?.total ?? 0;

  const sql = `SELECT id, user_id, user_name, action, resource, resource_id, details, ip_address, created_at
               FROM audit_log ${where}
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?`;
  const rows = (await dbAll(sql, [...params, limit, offset])) as AuditLogRow[];

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1
  };
}
