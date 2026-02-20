import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Truck, Phone, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionsContext';
import FormattedDate from '../../components/FormattedDate';

interface FormResponse {
  id: number;
  driver_name: string;
  phone_number?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
  submitted_at: string;
  tracking_code?: string;
}

const MotoristasPatio: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [motoristas, setMotoristas] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchMotoristas();
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchMotoristas();
      setLastUpdate(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/descarregamento/form-responses/patio', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar motoristas');

      const data = await response.json();
      setMotoristas(data.data.responses || []);
      setLastUpdate(new Date());
    } catch (error) {
      toast.error('Erro ao carregar motoristas no pátio');
    } finally {
      setLoading(false);
    }
  };

  const handleLiberar = async (motoristaId: number, motoristaName: string) => {
    if (!window.confirm(`Tem certeza que deseja liberar ${motoristaName} para descarregamento?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/descarregamento/form-responses/${motoristaId}/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Erro ao liberar motorista');

      toast.success('Motorista liberado com sucesso!');
      fetchMotoristas();
    } catch (error) {
      toast.error('Erro ao liberar motorista');
    }
  };

  const getWaitTime = (submittedAt: string) => {
    if (!submittedAt) {
      return '0 min';
    }
    
    try {
      const now = new Date();
      
      // SQLite retorna datas no formato 'YYYY-MM-DD HH:MM:SS'
      // Converter para formato ISO (YYYY-MM-DDTHH:MM:SS) para garantir interpretação correta
      let dateStr = submittedAt.trim();
      if (dateStr && !dateStr.includes('T') && !dateStr.includes('Z')) {
        // Se for formato 'YYYY-MM-DD HH:MM:SS', converter para ISO sem timezone
        // JavaScript interpreta 'YYYY-MM-DDTHH:MM:SS' como hora local
        dateStr = dateStr.replace(' ', 'T');
      }
      
      const submitted = new Date(dateStr);
      
      // Verificar se a data é válida
      if (isNaN(submitted.getTime())) {
        console.warn('Data inválida recebida em getWaitTime:', submittedAt, 'Convertida:', dateStr);
        return '0 min';
      }
      
      const diffMs = now.getTime() - submitted.getTime();
      
      // Se a diferença for negativa (data futura), usar valor absoluto
      // Isso pode acontecer devido a pequenas diferenças de timezone
      const absDiffMs = Math.abs(diffMs);
      const diffMins = Math.floor(absDiffMs / 60000);
      
      // Se for menor que 1 minuto, retornar "< 1 min"
      if (diffMins < 1) {
        return '< 1 min';
      }
      
      if (diffMins < 60) {
        return `${diffMins} min`;
      }
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}min`;
    } catch (error) {
      console.error('Erro ao calcular tempo de espera:', error, 'Data:', submittedAt);
      return '0 min';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Motoristas no Pátio</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Lista de motoristas aguardando liberação para descarregamento
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              <div>
                <div className="text-sm opacity-90">Total no Pátio</div>
                <div className="text-2xl font-bold">{motoristas.length}</div>
              </div>
            </div>
          </div>
          <button
            onClick={fetchMotoristas}
            className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Atualizar lista"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Informação de atualização */}
      {motoristas.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          </div>
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Atualização automática a cada 30 segundos
          </span>
        </div>
      )}

      {/* Lista de Motoristas */}
      {motoristas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-full mb-4">
              <Truck className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum motorista no pátio
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Não há motoristas aguardando liberação no momento. Os motoristas aparecerão aqui assim que registrarem sua chegada.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {motoristas.map((motorista) => {
            const waitTime = getWaitTime(motorista.submitted_at);
            return (
              <div
                key={motorista.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1"
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-md">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                        {motorista.driver_name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {motorista.fornecedor?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full">
                    <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                      {waitTime}
                    </span>
                  </div>
                </div>

                {/* Informações */}
                <div className="space-y-3 mb-4">
                  {motorista.phone_number && (
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                        <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {motorista.phone_number}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Chegada</div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        <FormattedDate date={motorista.submitted_at} />
                      </div>
                    </div>
                  </div>
                  {motorista.fornecedor?.category && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Categoria:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {motorista.fornecedor.category}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertCircle className="w-4 h-4 animate-pulse" />
                    <span className="font-medium">Aguardando liberação</span>
                  </div>
                </div>

                {/* Botão de Ação */}
                {hasPermission('descarregamento.motoristas.liberar') && (
                  <button
                    onClick={() => handleLiberar(motorista.id, motorista.driver_name)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold transform hover:scale-105"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Liberar para Descarregamento
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MotoristasPatio;
