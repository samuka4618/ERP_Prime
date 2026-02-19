import React from 'react';

interface ClientStatusBadgeProps {
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
}

export const ClientStatusBadge: React.FC<ClientStatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'cadastro_enviado':
        return {
          label: 'Cadastro Enviado',
          className: 'bg-blue-100 text-blue-800',
          dotClassName: 'bg-blue-400'
        };
      case 'aguardando_analise_credito':
        return {
          label: 'Aguardando Análise de Crédito',
          className: 'bg-yellow-100 text-yellow-800',
          dotClassName: 'bg-yellow-400'
        };
      case 'cadastro_finalizado':
        return {
          label: 'Cadastro Finalizado',
          className: 'bg-green-100 text-green-800',
          dotClassName: 'bg-green-400'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800',
          dotClassName: 'bg-gray-400'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dotClassName}`}></span>
      {config.label}
    </span>
  );
};
