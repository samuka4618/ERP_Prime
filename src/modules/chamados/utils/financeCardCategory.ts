import type {
  Category,
  CategoryField,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '../../../shared/types';

/** Campo técnico padrão usado como valor de referência na abertura (faixa do aprovador). */
export const DEFAULT_FINANCE_APPROVAL_VALUE_FIELD = 'valor_mensal';

const DEFAULT_LABEL = 'Valor da assinatura (referência na abertura)';
const DEFAULT_DESCRIPTION =
  'Informado pelo solicitante ao abrir o chamado. Define a faixa do aprovador financeiro. O plano, valor efetivo, moeda e ciclo contratados serão registrados pelo atendente ao finalizar o chamado.';

function stableFieldId(existingId: string | undefined, fieldName: string): string {
  if (existingId && String(existingId).trim()) return existingId;
  return `fc_ref_${fieldName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
}

/**
 * Ao guardar uma categoria com fluxo cartão / assinatura digital, força requires_approval,
 * garante `approval_value_field` e acrescenta ou ajusta o campo numérico obrigatório em custom_fields.
 */
export function normalizeFinanceCardCategoryPayload(
  resolvedApprovalType: string | undefined,
  base: {
    requires_approval: boolean;
    approval_value_field: string | null;
    custom_fields: CategoryField[];
  }
): {
  requires_approval: boolean;
  approval_value_field: string | null;
  custom_fields: CategoryField[];
} {
  if (resolvedApprovalType !== 'finance_card') {
    return base;
  }
  const fieldName =
    (base.approval_value_field && String(base.approval_value_field).trim()) ||
    DEFAULT_FINANCE_APPROVAL_VALUE_FIELD;

  const fields = [...base.custom_fields];
  const idx = fields.findIndex((f) => f.name === fieldName);

  const merged = (existing: CategoryField | undefined): CategoryField => ({
    id: stableFieldId(existing?.id, fieldName),
    name: fieldName,
    label: existing?.label && existing.label.trim() ? existing.label : DEFAULT_LABEL,
    type: 'number',
    required: true,
    description:
      existing?.description && existing.description.trim() ? existing.description : DEFAULT_DESCRIPTION,
    placeholder: existing?.placeholder
  });

  if (idx >= 0) {
    fields[idx] = merged(fields[idx]);
  } else {
    fields.push(merged(undefined));
  }

  return {
    requires_approval: true,
    approval_value_field: fieldName,
    custom_fields: fields
  };
}

export function applyFinanceCardNormalizationToCreate(data: CreateCategoryRequest): CreateCategoryRequest {
  if ((data.approval_type ?? 'none') !== 'finance_card') return data;
  const n = normalizeFinanceCardCategoryPayload(data.approval_type, {
    requires_approval: data.requires_approval ?? false,
    approval_value_field: data.approval_value_field ?? null,
    custom_fields: data.custom_fields ?? []
  });
  return {
    ...data,
    requires_approval: n.requires_approval,
    approval_value_field: n.approval_value_field,
    custom_fields: n.custom_fields
  };
}

export function applyFinanceCardNormalizationToUpdate(
  existing: Category,
  patch: UpdateCategoryRequest
): UpdateCategoryRequest {
  const nextType = patch.approval_type ?? existing.approval_type ?? 'none';
  if (nextType !== 'finance_card') return patch;

  const nextRequires = patch.requires_approval ?? existing.requires_approval ?? false;
  const nextField =
    patch.approval_value_field !== undefined
      ? patch.approval_value_field
      : existing.approval_value_field ?? null;
  const nextFields = patch.custom_fields !== undefined ? patch.custom_fields : existing.custom_fields ?? [];

  const n = normalizeFinanceCardCategoryPayload('finance_card', {
    requires_approval: nextRequires,
    approval_value_field: nextField,
    custom_fields: nextFields
  });

  return {
    ...patch,
    requires_approval: n.requires_approval,
    approval_value_field: n.approval_value_field,
    custom_fields: n.custom_fields
  };
}
