import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/**
 * Hook para gerenciar timezone do sistema
 */
export const useTimezone = () => {
  const [timezone, setTimezone] = useState<string>('America/Sao_Paulo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimezone = async () => {
      try {
        const response = await apiService.get('/system-config/timezone');
        setTimezone(response.data.timezone || 'America/Sao_Paulo');
      } catch (error) {
        console.warn('Erro ao obter timezone do sistema, usando padrão:', error);
        setTimezone('America/Sao_Paulo');
      } finally {
        setLoading(false);
      }
    };

    fetchTimezone();
  }, []);

  const formatDate = (dateString: string | Date | null | undefined, includeTime: boolean = true): string => {
    if (!dateString) {
      return 'N/A';
    }

    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      
      if (isNaN(date.getTime())) {
        console.warn('Data inválida recebida:', dateString);
        return 'Data inválida';
      }

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
