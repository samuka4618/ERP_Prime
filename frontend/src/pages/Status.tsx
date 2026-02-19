import React, { useState, useEffect } from 'react';
import { List } from 'lucide-react';

interface TicketStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

const Status: React.FC = () => {
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Statuses padrão do sistema
  const defaultStatuses: TicketStatus[] = [
    { id: 'open', name: 'Aberto', description: 'Chamado recém-criado', color: '#ef4444', is_active: true },
    { id: 'in_progress', name: 'Em Andamento', description: 'Chamado sendo atendido', color: '#f59e0b', is_active: true },
    { id: 'pending_user', name: 'Aguardando Usuário', description: 'Aguardando resposta do usuário', color: '#3b82f6', is_active: true },
    { id: 'pending_attendant', name: 'Aguardando Atendente', description: 'Aguardando resposta do atendente', color: '#8b5cf6', is_active: true },
    { id: 'resolved', name: 'Resolvido', description: 'Chamado resolvido', color: '#10b981', is_active: true },
    { id: 'closed', name: 'Fechado', description: 'Chamado fechado', color: '#6b7280', is_active: true }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Por enquanto, usar os status padrão
      // Quando houver API, fazer: const response = await apiService.get('/statuses');
      setStatuses(defaultStatuses);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
      setStatuses(defaultStatuses);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <List className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Status de Chamados
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize os status disponíveis para os chamados do sistema
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Lista de Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div 
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: status.color }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {status.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {status.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Status;

