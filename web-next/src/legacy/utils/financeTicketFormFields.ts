import type { Category, CategoryField } from '../types';

const DEFAULT_APPROVAL_FIELD = 'valor_mensal';

/** Nomes técnicos reconhecidos como «plataforma» (alinha com extração na aprovação). */
const FINANCE_CARD_PLATFORM_NAMES = ['plataforma', 'servico', 'serviço', 'platform', 'nome_servico', 'servico_online'];
const FINANCE_CARD_LOGIN_NAMES = ['login_plataforma', 'usuario_plataforma', 'email_na_plataforma', 'usuario_login', 'login'];
const FINANCE_CARD_PASSWORD_NAMES = ['senha_plataforma', 'senha_servico', 'credential_password'];

/** Se faltar no JSON guardado mas o fluxo for cartão/assinatura, garante o campo para o formulário. */
function syntheticFinanceValorField(fieldName: string): CategoryField {
  return {
    id: `_synthetic_fc_${fieldName}`,
    name: fieldName,
    label: 'Valor da assinatura (referência na abertura)',
    type: 'number',
    required: true,
    description:
      'Valor estimado informado pelo solicitante na abertura; define a faixa do aprovador financeiro. O valor efetivo contratado e o ciclo de faturamento serão definidos pelo aprovador financeiro ao aprovar.'
  };
}

function syntheticPlataforma(): CategoryField {
  return {
    id: '_synthetic_fc_plataforma',
    name: 'plataforma',
    label: 'Plataforma / serviço',
    type: 'text',
    required: true,
    description: 'Ex.: Figma, Salesforce, ferramenta em que ficará a conta da assinatura.'
  };
}

function syntheticLoginPlataforma(): CategoryField {
  return {
    id: '_synthetic_fc_login_plataforma',
    name: 'login_plataforma',
    label: 'Usuário / e-mail na plataforma',
    type: 'text',
    required: true,
    description: 'Conta utilizada para aceder ao serviço (será registada na assinatura ao aprovar o chamado).'
  };
}

function syntheticSenhaPlataforma(): CategoryField {
  return {
    id: '_synthetic_fc_senha_plataforma',
    name: 'senha_plataforma',
    label: 'Senha na plataforma',
    type: 'password',
    required: true,
    description:
      'Será gravada apenas de forma encriptada após o aprovador financeiro concluir a aprovação. Este campo não volta a aparecer em texto na interface.'
  };
}

/** Campos a apresentar no novo chamado: mescla API + regra finance_card quando o servidor ainda não devolve JSON completo. */
export function customFieldsForNewTicketForm(category: Category | null): CategoryField[] {
  if (!category) return [];
  const base = [...(category.custom_fields || [])];
  const at = category.approval_type || 'none';
  if (at !== 'finance_card') return base;

  const merged = [...base];
  const hasPlatform = merged.some((f) => FINANCE_CARD_PLATFORM_NAMES.includes(f.name));
  if (!hasPlatform) merged.push(syntheticPlataforma());
  const hasLogin = merged.some((f) => FINANCE_CARD_LOGIN_NAMES.includes(f.name));
  if (!hasLogin) merged.push(syntheticLoginPlataforma());
  const hasPwd = merged.some((f) => FINANCE_CARD_PASSWORD_NAMES.includes(f.name));
  if (!hasPwd) merged.push(syntheticSenhaPlataforma());

  const fieldName =
    (category.approval_value_field && String(category.approval_value_field).trim()) || DEFAULT_APPROVAL_FIELD;
  if (!merged.some((f) => f.name === fieldName)) merged.push(syntheticFinanceValorField(fieldName));

  return merged;
}

export function isMissingRequiredCustom(field: CategoryField, value: unknown): boolean {
  if (!field.required) return false;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  return false;
}
