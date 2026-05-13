import type { Category, CategoryField } from '../types';

const DEFAULT_APPROVAL_FIELD = 'valor_mensal';

/** Se faltar no JSON guardado mas o fluxo for cartão/assinatura, garante o campo para o formulário. */
function syntheticFinanceValorField(fieldName: string): CategoryField {
  return {
    id: `_synthetic_fc_${fieldName}`,
    name: fieldName,
    label: 'Valor da assinatura (referência na abertura)',
    type: 'number',
    required: true,
    description:
      'Valor estimado informado pelo solicitante na abertura; define a faixa do aprovador financeiro. O contrato efetivo (plano, valor final, moeda, ciclo) será registrado pelo atendente ao finalizar.'
  };
}

/** Campos a apresentar no novo chamado: mescla API + regra finance_card quando o servidor ainda não devolve JSON completo. */
export function customFieldsForNewTicketForm(category: Category | null): CategoryField[] {
  if (!category) return [];
  const base = [...(category.custom_fields || [])];
  const at = category.approval_type || 'none';
  if (at !== 'finance_card') return base;

  const fieldName =
    (category.approval_value_field && String(category.approval_value_field).trim()) || DEFAULT_APPROVAL_FIELD;
  if (base.some((f) => f.name === fieldName)) return base;

  return [...base, syntheticFinanceValorField(fieldName)];
}

export function isMissingRequiredCustom(field: CategoryField, value: unknown): boolean {
  if (!field.required) return false;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}
