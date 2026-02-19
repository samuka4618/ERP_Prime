import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import { ClientRegistrationHistory } from '../types';

interface ClientStatusTimelineProps {
  history: ClientRegistrationHistory[];
}

export const ClientStatusTimeline: React.FC<ClientStatusTimelineProps> = ({ history }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cadastro_enviado':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'aguardando_analise_credito':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'cadastro_finalizado':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cadastro_enviado':
        return 'border-blue-200 bg-blue-50';
      case 'aguardando_analise_credito':
        return 'border-yellow-200 bg-yellow-50';
      case 'cadastro_finalizado':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'cadastro_enviado':
        return 'Cadastro Enviado';
      case 'aguardando_analise_credito':
        return 'Aguardando Análise de Crédito';
      case 'cadastro_finalizado':
        return 'Cadastro Finalizado';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-500">Nenhum histórico disponível</p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((item, index) => (
          <li key={item.id}>
            <div className="relative pb-8">
              {index !== history.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getStatusColor(item.status_novo)}`}>
                    {getStatusIcon(item.status_novo)}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getStatusLabel(item.status_novo)}
                    </p>
                    {item.observacoes && (
                      <p className="text-sm text-gray-500 mt-1">{item.observacoes}</p>
                    )}
                    {(item.prazo_aprovado || item.limite_aprovado) && (
                      <div className="mt-2 space-y-1">
                        {item.prazo_aprovado && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Prazo:</span> {item.prazo_aprovado}
                          </p>
                        )}
                        {item.limite_aprovado && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Limite:</span> {item.limite_aprovado}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                    <time dateTime={item.created_at}>
                      {formatDate(item.created_at)}
                    </time>
                    {item.user_name && (
                      <p className="text-xs text-gray-400 mt-1">
                        por {item.user_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
