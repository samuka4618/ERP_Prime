/**
 * Exportação e importação de usuários (CSV/JSON).
 * Senha nunca é exportada nem alterada na importação.
 * Limites: 10 MB, 20.000 linhas (boas práticas de mercado).
 */

export const IMPORT_EXPORT = {
  MAX_FILE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_ROWS: 20000
} as const;

export const EXPORT_COLUMNS = [
  'id',
  'name',
  'email',
  'role',
  'is_active',
  'phone',
  'department',
  'position',
  'created_at',
  'updated_at'
] as const;

export type ExportColumn = typeof EXPORT_COLUMNS[number];

export interface ExportUserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone?: string;
  department?: string;
  position?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportUserRow {
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  phone?: string;
  department?: string;
  position?: string;
}

export interface ValidatedImportRow {
  rowIndex: number;
  data: {
    name: string;
    email: string;
    role: 'user' | 'attendant' | 'admin';
    is_active: boolean;
    phone?: string;
    department?: string;
    position?: string;
  };
  existingId?: number; // se email já existe
}

export interface InvalidImportRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  errors: string[];
}

export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^\s*"\s*|\s*"\s*$/g, ''));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    header.forEach((h, j) => {
      row[h] = values[j] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

export function parseJson(content: string): Record<string, unknown>[] {
  const data = JSON.parse(content);
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object' && Array.isArray(data.users)) return data.users as Record<string, unknown>[];
  return [];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['user', 'attendant', 'admin'] as const;

export function validateImportRow(
  raw: Record<string, unknown>,
  rowIndex: number
): { valid: ValidatedImportRow } | { invalid: InvalidImportRow } {
  const errors: string[] = [];
  const getStr = (key: string): string => {
    const v = raw[key] ?? raw[key.toLowerCase()];
    if (v == null) return '';
    return String(v).trim();
  };
  const getBool = (key: string): boolean => {
    const v = raw[key] ?? raw[key.toLowerCase()];
    if (v == null) return true;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'sim' || s === 'yes' || s === 's';
  };

  const name = getStr('name');
  const email = getStr('email');
  const role = getStr('role').toLowerCase() || 'user';

  if (!name) errors.push('Nome é obrigatório');
  if (!email) errors.push('Email é obrigatório');
  else if (!EMAIL_REGEX.test(email)) errors.push('Email inválido');
  if (!ROLES.includes(role as any)) errors.push('Perfil deve ser: user, attendant ou admin');

  if (errors.length > 0) {
    return {
      invalid: {
        rowIndex,
        raw: raw as Record<string, unknown>,
        errors
      }
    };
  }

  return {
    valid: {
      rowIndex,
      data: {
        name,
        email,
        role: role as 'user' | 'attendant' | 'admin',
        is_active: getBool('is_active'),
        phone: getStr('phone') || undefined,
        department: getStr('department') || undefined,
        position: getStr('position') || undefined
      }
    }
  };
}

export function toCsv(rows: ExportUserRow[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((r) =>
    EXPORT_COLUMNS.map((c) => {
      const v = (r as any)[c];
      if (v === undefined || v === null) return '';
      const s = String(v);
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  return [header, ...lines].join('\r\n');
}

export function toExportRow(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone?: string;
  department?: string;
  position?: string;
  created_at: unknown;
  updated_at: unknown;
}): ExportUserRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    phone: user.phone,
    department: user.department,
    position: user.position,
    created_at: user.created_at != null ? String(user.created_at) : '',
    updated_at: user.updated_at != null ? String(user.updated_at) : ''
  };
}
