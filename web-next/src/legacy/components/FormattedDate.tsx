import React, { useState, useEffect } from 'react';
import { useTimezone } from '../hooks/useTimezone';

interface FormattedDateProps {
  date: string | Date | null | undefined;
  includeTime?: boolean;
  className?: string;
}

const FormattedDate: React.FC<FormattedDateProps> = ({ 
  date, 
  includeTime = true, 
  className = '' 
}) => {
  const [formattedDate, setFormattedDate] = useState<string>('Carregando...');
  const { formatDateTime, formatDateOnly } = useTimezone();

  useEffect(() => {
    const formatDate = async () => {
      if (!date) {
        setFormattedDate('N/A');
        return;
      }

      try {
        const formatted = includeTime 
          ? await formatDateTime(date)
          : await formatDateOnly(date);
        setFormattedDate(formatted);
      } catch (error) {
        console.error('Erro ao formatar data:', error);
        setFormattedDate('Data inválida');
      }
    };

    formatDate();
  }, [date, includeTime, formatDateTime, formatDateOnly]);

  return <span className={className}>{formattedDate}</span>;
};

export default FormattedDate;
