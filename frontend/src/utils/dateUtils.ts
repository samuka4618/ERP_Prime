/**
 * Utilitários para formatação de datas
 * Versão: 2025-10-01T10:00:00Z - Corrigido timezone dinâmico
 */

import { apiUrl } from './apiUrl';

const DEFAULT_TZ = 'America/Sao_Paulo';

// Cache do timezone do sistema
let systemTimezone: string | null = null;
// Promessa única em andamento para evitar várias requisições paralelas
let timezonePromise: Promise<string> | null = null;

/**
 * Obtém o timezone configurado no sistema.
 * Se a resposta for HTML (ex.: front em outro domínio sem VITE_API_URL), usa o padrão.
 */
const getSystemTimezone = async (): Promise<string> => {
  if (systemTimezone) {
    return systemTimezone;
  }
  if (timezonePromise) {
    return timezonePromise;
  }

  timezonePromise = (async () => {
    try {
      const response = await fetch(apiUrl('system-config/timezone'), { credentials: 'include' });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        systemTimezone = DEFAULT_TZ;
        return DEFAULT_TZ;
      }
      const text = await response.text();
      if (!text || text.trim().startsWith('<')) {
        systemTimezone = DEFAULT_TZ;
        return DEFAULT_TZ;
      }
      const data = JSON.parse(text) as { data?: { timezone?: string }; timezone?: string };
      const tz = (data?.data?.timezone ?? data?.timezone) || DEFAULT_TZ;
      systemTimezone = tz;
      return tz;
    } catch (error) {
      systemTimezone = DEFAULT_TZ;
      return DEFAULT_TZ;
    } finally {
      timezonePromise = null;
    }
  })();

  return timezonePromise;
};

/**
 * Formata uma data para exibição em português brasileiro
 * @param dateString - String da data ou objeto Date
 * @param includeTime - Se deve incluir horário (padrão: true)
 * @returns String formatada da data
 */
export const formatDate = async (dateString: string | Date | null | undefined, includeTime: boolean = true): Promise<string> => {
  if (!dateString) {
    return 'N/A';
  }

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Data inválida recebida:', dateString);
      return 'Data inválida';
    }

    const timezone = await getSystemTimezone();
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: timezone,
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

/**
 * Formata uma data para exibição apenas da data (sem horário)
 * @param dateString - String da data ou objeto Date
 * @returns String formatada da data
 */
export const formatDateOnly = async (dateString: string | Date | null | undefined): Promise<string> => {
  return await formatDate(dateString, false);
};

/**
 * Formata uma data para exibição completa (com horário)
 * @param dateString - String da data ou objeto Date
 * @returns String formatada da data
 */
export const formatDateTime = async (dateString: string | Date | null | undefined): Promise<string> => {
  return await formatDate(dateString, true);
};

/**
 * Verifica se uma data é válida
 * @param dateString - String da data ou objeto Date
 * @returns true se a data é válida
 */
export const isValidDate = (dateString: string | Date | null | undefined): boolean => {
  if (!dateString) return false;
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};

/**
 * Converte data de agendamento/calendário (YYYY-MM-DD ou ISO com hora) para chave YYYY-MM-DD.
 * Usar ao comparar com datas locais da UI (evita grade vazia quando a API retorna ISO completo).
 */
export function toYyyyMmDd(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return '';
}

/** Data de hoje no fuso local (YYYY-MM-DD), sem usar UTC como toISOString(). */
export function localTodayYmd(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
