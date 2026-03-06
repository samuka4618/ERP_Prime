import { useState, useEffect } from 'react';

/**
 * Converte string de data da API (sempre UTC em ISO 8601, ex.: "2024-01-15T10:30:00.000Z")
 * para Date. Garante que valores com Z ou offset sejam interpretados como UTC.
 */
function parseDateAsUTC(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  const str = String(dateString).trim();
  if (!str) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}[\sT]/.test(str)) {
    const iso = str.includes('T') ? str.replace(/\s/g, '') : str.replace(' ', 'T');
    const hasUtc = /Z$|[-+]\d{2}:?\d{2}$/.test(iso);
    return new Date(hasUtc ? iso : iso + 'Z');
  }
  return new Date(str);
}

/**
 * Obtém o timezone do navegador (ex.: "America/Sao_Paulo").
 * Melhor prática: exibir datas na hora local do usuário (Moesif, MDN).
 */
function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

/**
 * Hook para gerenciar timezone na exibição de datas.
 * Usa o timezone do navegador para que o usuário sempre veja "sua" hora local.
 */
export const useTimezone = () => {
  const [timezone, setTimezone] = useState<string>(() => getBrowserTimezone());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTimezone(getBrowserTimezone());
    setLoading(false);
  }, []);

  const formatDate = (dateString: string | Date | null | undefined, includeTime: boolean = true): string => {
    if (!dateString) {
      return 'N/A';
    }

    try {
      const date = parseDateAsUTC(dateString as string | Date);

      if (isNaN(date.getTime())) {
        console.warn('Data inválida recebida:', dateString);
        return 'Data inválida';
      }

      const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        // Não passar timeZone: o navegador usa o fuso do sistema (mesmo do console), evitando divergência.
      };

      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
      }

      return date.toLocaleString('pt-BR', options);
    } catch (error) {
      console.error('Erro ao formatar data:', error, 'Data original:', dateString);
      return 'Data inválida';
    }
  };

  const formatDateTime = (dateString: string | Date | null | undefined): string => {
    return formatDate(dateString, true);
  };

  const formatDateOnly = (dateString: string | Date | null | undefined): string => {
    return formatDate(dateString, false);
  };

  return {
    timezone,
    loading,
    formatDate,
    formatDateTime,
    formatDateOnly,
    setTimezone
  };
};
