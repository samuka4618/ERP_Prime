/**
 * Valores do formulário podem vir como number, string "99.99" (JSON), ou "99,99" / "1.234,56" (teclado PT-BR).
 */
export function parseApprovalAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string') return null;

  const t = raw.trim().replace(/\s/g, '');
  if (!t) return null;

  if (/^\d+$/.test(t)) return Number(t);

  // Vírgula como decimal brasileira: remover pontos de milhar antes
  if (t.includes(',')) {
    const noThousands = t.replace(/\./g, '');
    const n = Number(noThousands.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function valorFromTicketCustomField(
  customData: Record<string, unknown> | undefined | null,
  fieldName: string
): number | null {
  return parseApprovalAmount(customData?.[fieldName]);
}
