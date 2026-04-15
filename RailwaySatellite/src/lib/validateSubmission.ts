export type FormField = {
  id: string;
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  default?: unknown;
};

export type SchemaJson = {
  title?: string;
  description?: string;
  fields?: FormField[];
  fornecedores?: Array<{ id: number; name: string; category: string }>;
};

export function validateSubmissionBody(
  schema: SchemaJson,
  body: {
    driver_name?: string;
    phone_number?: string;
    fornecedor_id?: number;
    responses?: Record<string, unknown>;
  }
): { ok: true; value: { driver_name: string; phone: string | null; fornecedor_id: number; responses: Record<string, unknown> } } | { ok: false; error: string } {
  const driver_name = (body.driver_name || '').trim();
  if (!driver_name) {
    return { ok: false, error: 'driver_name é obrigatório' };
  }
  const fornecedor_id = Number(body.fornecedor_id);
  if (!Number.isInteger(fornecedor_id) || fornecedor_id <= 0) {
    return { ok: false, error: 'fornecedor_id inválido' };
  }
  if (schema.fornecedores && schema.fornecedores.length > 0) {
    const ok = schema.fornecedores.some((f) => f.id === fornecedor_id);
    if (!ok) {
      return { ok: false, error: 'fornecedor_id não permitido para este formulário' };
    }
  }
  const phone = body.phone_number != null && String(body.phone_number).trim() !== '' ? String(body.phone_number).trim().slice(0, 40) : null;
  const responses: Record<string, unknown> = body.responses && typeof body.responses === 'object' ? { ...body.responses } : {};
  const fields = schema.fields || [];
  for (const field of fields) {
    const v = responses[field.name];
    if (field.required && (v === undefined || v === null || v === '')) {
      return { ok: false, error: `Campo obrigatório: ${field.label || field.name}` };
    }
    if (v === undefined || v === null) continue;
    switch (field.type) {
      case 'number': {
        const n = Number(v);
        if (Number.isNaN(n)) return { ok: false, error: `Número inválido: ${field.name}` };
        if (field.min !== undefined && n < field.min) return { ok: false, error: `${field.name} abaixo do mínimo` };
        if (field.max !== undefined && n > field.max) return { ok: false, error: `${field.name} acima do máximo` };
        responses[field.name] = n;
        break;
      }
      case 'checkbox': {
        responses[field.name] = Boolean(v);
        break;
      }
      default:
        responses[field.name] = typeof v === 'string' ? v.slice(0, 8000) : v;
    }
  }
  return { ok: true, value: { driver_name, phone, fornecedor_id, responses } };
}
