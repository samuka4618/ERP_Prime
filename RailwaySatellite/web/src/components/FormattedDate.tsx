import React, { useMemo } from 'react';

interface FormattedDateProps {
  date: string | Date | null | undefined;
  includeTime?: boolean;
  className?: string;
}

/** Formatação local (pt-BR), alinhada ao uso no ERP sem hook de timezone. */
const FormattedDate: React.FC<FormattedDateProps> = ({ date, includeTime = true, className = '' }) => {
  const text = useMemo(() => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (Number.isNaN(d.getTime())) return 'Data inválida';
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
      }).format(d);
    } catch {
      return 'Data inválida';
    }
  }, [date, includeTime]);

  return <span className={className}>{text}</span>;
};

export default FormattedDate;
