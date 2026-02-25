import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

/**
 * Converte string de data do backend (UTC, formato SQLite "YYYY-MM-DD HH:MM:SS")
 * para Date interpretado como UTC. Evita que o navegador interprete como hora local.
 * Só aplica quando a string está em formato ISO (YYYY-MM-DD); caso contrário usa new Date() normal.
 */
function parseDateAsUTC(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  const str = String(dateString).trim();
  if (!str) return new Date(NaN);
  // Formato ISO do backend/SQLite (UTC): "YYYY-MM-DD HH:MM:SS" ou "YYYY-MM-DDTHH:MM:SS"
  if (/^\d{4}-\d{2}-\d{2}[\sT]/.test(str)) {
    const iso = str.includes('T') ? str.replace(/\s/g, '') : str.replace(' ', 'T');
    const asUtc = /Z$|[-+]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
    return new Date(asUtc);
  }
  return new Date(str);
}

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
        const tz = response?.data?.data?.timezone ?? response?.data?.timezone ?? 'America/Sao_Paulo';
        setTimezone(tz);
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
      const date = parseDateAsUTC(dateString as string | Date);
      
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
