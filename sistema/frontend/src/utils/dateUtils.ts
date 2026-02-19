/**
 * Utilitários para formatação de datas
 * Versão: 2025-10-01T10:00:00Z - Corrigido timezone dinâmico
 */

// Cache do timezone do sistema
let systemTimezone: string | null = null;

/**
 * Obtém o timezone configurado no sistema
 */
const getSystemTimezone = async (): Promise<string> => {
  if (systemTimezone) {
    return systemTimezone;
  }

  try {
    const response = await fetch('/api/system-config/timezone');
    const data = await response.json();
    systemTimezone = data.data?.timezone || 'America/Sao_Paulo';
    return systemTimezone || 'America/Sao_Paulo';
  } catch (error) {
    console.warn('Erro ao obter timezone do sistema, usando padrão:', error);
    systemTimezone = 'America/Sao_Paulo';
    return systemTimezone;
  }
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
