/**
 * Exportação e importação de categorias (JSON).
 * Inclui: name, description, SLA, is_active, custom_fields (perguntas personalizadas e configurações).
 * Atribuições de categoria ficam a cargo do usuário após a importação.
 */

import type { Category, CategoryField } from '../../shared/types';

export const CATEGORY_IMPORT_EXPORT = {
  MAX_FILE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_CATEGORIES: 500
} as const;

export interface ExportCategoryRow {
  id?: number;
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  is_active: boolean;
  custom_fields?: CategoryField[];
  created_at?: string;
  updated_at?: string;
}

export interface ValidatedCategoryRow {
  rowIndex: number;
  data: {
    name: string;
    description: string;
    sla_first_response_hours: number;
    sla_resolution_hours: number;
    is_active: boolean;
    custom_fields?: CategoryField[];
  };
}

export interface InvalidCategoryRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  errors: string[];
}

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'select', 'file'] as const;

function normalizeCategoryField(f: any): CategoryField | null {
  if (!f || typeof f !== 'object') return null;
  const name = String(f.name ?? '').trim();
  const label = String(f.label ?? '').trim();
  const type = String(f.type ?? 'text').toLowerCase();
  if (!name || !label) return null;
  if (!FIELD_TYPES.includes(type as any)) return null;
  const field: CategoryField = {
    id: typeof f.id === 'string' ? f.id : `field_${name}_${Date.now()}`,
    name,
    label,
    type: type as CategoryField['type'],
    required: Boolean(f.required),
    placeholder: f.placeholder != null ? String(f.placeholder) : undefined,
    options: Array.isArray(f.options) ? f.options.map((o: any) => String(o).trim()).filter(Boolean) : undefined,
    description: f.description != null ? String(f.description) : undefined
  };
  if (field.type === 'select' && (!field.options || field.options.length === 0)) {
    field.options = [];
  }
  return field;
}

function validateCustomFields(arr: unknown): { valid: CategoryField[]; errors: string[] } {
  const errors: string[] = [];
  const valid: CategoryField[] = [];
  if (arr == null || !Array.isArray(arr)) {
    return { valid: [], errors: arr != null ? ['custom_fields deve ser um array'] : [] };
  }
  arr.forEach((item, i) => {
    const f = normalizeCategoryField(item);
    if (f) valid.push(f);
    else if (item != null && typeof item === 'object') errors.push(`Campo personalizado ${i + 1}: nome e label são obrigatórios, type deve ser um de: ${FIELD_TYPES.join(', ')}`);
  });
  return { valid, errors };
}

export function validateCategoryRow(
  raw: Record<string, unknown>,
  rowIndex: number
): { valid: ValidatedCategoryRow } | { invalid: InvalidCategoryRow } {
  const errors: string[] = [];

  const name = raw.name != null ? String(raw.name).trim() : '';
  const description = raw.description != null ? String(raw.description) : '';
  const slaFirst = raw.sla_first_response_hours != null ? Number(raw.sla_first_response_hours) : NaN;
  const slaResolution = raw.sla_resolution_hours != null ? Number(raw.sla_resolution_hours) : NaN;
  let isActive = true;
  if (raw.is_active !== undefined && raw.is_active !== null) {
    if (typeof raw.is_active === 'boolean') isActive = raw.is_active;
    else isActive = ['1', 'true', 'sim', 's', 'yes'].includes(String(raw.is_active).toLowerCase());
  }

  if (!name || name.length < 2) errors.push('Nome é obrigatório (mín. 2 caracteres)');
  if (name.length > 100) errors.push('Nome deve ter no máximo 100 caracteres');
  if (description.length > 500) errors.push('Descrição deve ter no máximo 500 caracteres');
  if (!Number.isInteger(slaFirst) || slaFirst < 1 || slaFirst > 168) errors.push('SLA primeira resposta deve ser um número entre 1 e 168 (horas)');
  if (!Number.isInteger(slaResolution) || slaResolution < 1 || slaResolution > 720) errors.push('SLA resolução deve ser um número entre 1 e 720 (horas)');

  const { valid: customFields, errors: cfErrors } = validateCustomFields(raw.custom_fields);
  errors.push(...cfErrors);

  if (errors.length > 0) {
    return { invalid: { rowIndex, raw, errors } };
  }

  return {
    valid: {
      rowIndex,
      data: {
        name,
        description: description || '',
        sla_first_response_hours: slaFirst,
        sla_resolution_hours: slaResolution,
        is_active: isActive,
        custom_fields: customFields.length > 0 ? customFields : undefined
      }
    }
  };
}

export function toExportRow(category: Category): ExportCategoryRow {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    sla_first_response_hours: category.sla_first_response_hours,
    sla_resolution_hours: category.sla_resolution_hours,
    is_active: category.is_active,
    custom_fields: category.custom_fields,
    created_at: category.created_at != null ? String(category.created_at) : undefined,
    updated_at: category.updated_at != null ? String(category.updated_at) : undefined
  };
}

export function parseCategoriesJson(content: string): Record<string, unknown>[] {
  const data = JSON.parse(content);
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object' && Array.isArray(data.categories)) return data.categories as Record<string, unknown>[];
  return [];
}
