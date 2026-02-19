import { SystemConfigService } from '../../core/system/SystemConfigService';

/**
 * Utilitários para formatação de datas no backend
 * Usa configurações do sistema para timezone e formato
 */

/**
 * Converte string de data do banco para Date object
 * As datas do banco estão em UTC mas sem o 'Z' no final
 */
function parseDatabaseDate(dateString: string): Date {
  // Se a string não tem 'Z' no final, assumir que é UTC e adicionar
  const dateStr = dateString.includes('Z') ? dateString : dateString + 'Z';
  return new Date(dateStr);
}

/**
 * Formata uma data usando as configurações do sistema
 */
export async function formatSystemDate(dateString: string | Date | null | undefined): Promise<string> {
  if (!dateString) {
    return 'N/A';
  }

  try {
    let date: Date;
    
    if (typeof dateString === 'string') {
      date = parseDatabaseDate(dateString);
    } else if (dateString instanceof Date) {
      date = dateString;
    } else {
      // Se for um objeto que não é Date, tentar converter
      date = new Date(dateString as any);
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'Data inválida';
    }

    // Buscar timezone configurado
    const timezone = await SystemConfigService.getTimezone();
    
    // Formatar usando o timezone do sistema
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timezone
    };

    const result = date.toLocaleString('pt-BR', options);
    
    return result;
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
}

/**
 * Formata apenas a data (sem horário)
 */
export async function formatSystemDateOnly(dateString: string | Date | null | undefined): Promise<string> {
  if (!dateString) {
    return 'N/A';
  }

  try {
    let date: Date;
    
    if (typeof dateString === 'string') {
      date = parseDatabaseDate(dateString);
    } else if (dateString instanceof Date) {
      date = dateString;
    } else {
      // Se for um objeto que não é Date, tentar converter
      date = new Date(dateString as any);
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'Data inválida';
    }

    const timezone = await SystemConfigService.getTimezone();
    
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: timezone
    };

    return date.toLocaleDateString('pt-BR', options);
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data inválida';
  }
}

/**
 * Converte uma data para o timezone do sistema
 */
export async function convertToSystemTimezone(dateString: string | Date): Promise<Date> {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const timezone = await SystemConfigService.getTimezone();
  
  // A data já está em UTC no banco, apenas formatar para o timezone do sistema
  return date;
}

/**
 * Obtém o timezone atual do sistema
 */
export async function getSystemTimezone(): Promise<string> {
  return await SystemConfigService.getTimezone();
}


