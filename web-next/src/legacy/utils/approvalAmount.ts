/** Espelho do parsing do backend: números, strings com vírgula decimal (PT-BR), etc. */
export function parseApprovalAmountInput(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/\s/g, '');
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  if (t.includes(',')) {
    const noThousands = t.replace(/\./g, '');
    const n = Number(noThousands.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function approvalValueFromTicket(ticket: { custom_data?: Record<string, unknown>; category?: { approval_value_field?: string | null } }): number | null {
  const field = ticket.category?.approval_value_field || 'valor_mensal';
  return parseApprovalAmountInput(ticket.custom_data?.[field]);
}
