import { dbRun } from '../database/connection';
import { logger } from '../../shared/utils/logger';

export interface AuditLogEntry {
  userId?: number;
  userName?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  ip?: string;
}

/** Sanitiza details para não gravar senhas ou tokens. */
function sanitizeDetails(details: unknown): string | null {
  if (details == null) return null;
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    const obj = details as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    const skip = new Set(['password', 'senha', 'token', 'secret', 'authorization']);
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (skip.has(lower) || lower.includes('password') || lower.includes('token')) continue;
      safe[k] = v;
    }
    return JSON.stringify(safe);
  }
  return String(details);
}

/**
 * Registra um evento de auditoria. Execução não-bloqueante: falhas no insert
 * são apenas logadas e não afetam a requisição.
 */
export function log(entry: AuditLogEntry): void {
  const details = entry.details != null ? sanitizeDetails(entry.details) : null;
  const sql = `INSERT INTO audit_log (user_id, user_name, action, resource, resource_id, details, ip_address)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    entry.userId ?? null,
    entry.userName ?? null,
    entry.action,
    entry.resource ?? null,
    entry.resourceId ?? null,
    details,
    entry.ip ?? null
  ];
  setImmediate(() => {
    dbRun(sql, params).catch((err) => {
      logger.error('Falha ao gravar auditoria', { err: (err as Error).message, action: entry.action }, 'AUDIT');
    });
  });
}
