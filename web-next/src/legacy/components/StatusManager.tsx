import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface StatusManagerProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  disabled?: boolean;
}

const statusOptions = [
  { value: 'open', label: 'Aberto', color: 'bg-red-100 text-red-800', description: 'Chamado recém-criado' },
  { value: 'in_progress', label: 'Em Andamento', color: 'bg-yellow-100 text-yellow-800', description: 'Chamado sendo atendido' },
  { value: 'pending_user', label: 'Aguardando Usuário', color: 'bg-blue-100 text-blue-800', description: 'Aguardando resposta do usuário' },
  { value: 'pending_third_party', label: 'Aguardando Terceiros', color: 'bg-purple-100 text-purple-800', description: 'Aguardando resposta de terceiros' },
  { value: 'pending_approval', label: 'Aguardando Aprovação', color: 'bg-yellow-200 text-yellow-900', description: 'Aguardando aprovação do solicitante' },
  { value: 'resolved', label: 'Resolvido', color: 'bg-green-100 text-green-800', description: 'Chamado resolvido' },
  { value: 'closed', label: 'Fechado', color: 'bg-gray-100 text-gray-800', description: 'Chamado fechado' },
  { value: 'overdue_first_response', label: 'Atrasado - Primeira Resposta', color: 'bg-red-200 text-red-900', description: 'Atrasado na primeira resposta' },
  { value: 'overdue_resolution', label: 'Atrasado - Resolução', color: 'bg-orange-200 text-orange-900', description: 'Atrasado na resolução' }
];

const StatusManager: React.FC<StatusManagerProps> = ({ 
  currentStatus, 
  onStatusChange, 
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentStatusOption = statusOptions.find(option => option.value === currentStatus);

  const handleStatusChange = (newStatus: string) => {
    if (newStatus !== currentStatus) {
      onStatusChange(newStatus);
      setIsOpen(false);
      toast.success('Status atualizado com sucesso!');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          currentStatusOption?.color || 'bg-gray-100 text-gray-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
      >
        {currentStatusOption?.label || currentStatus}
        {!disabled && (
          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && !disabled && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="py-1">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    option.value === currentStatus ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3 ${option.color}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-0">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StatusManager;
