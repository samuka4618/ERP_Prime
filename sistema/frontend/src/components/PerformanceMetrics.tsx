import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, MessageSquare, Clock, Activity, Server, RefreshCw } from 'lucide-react';

interface PerformanceMetrics {
  uptime: {
    percentage: number;
    hours: number;
    days: number;
    status: 'excellent' | 'good' | 'warning';
  };
  users: {
    peak: number;
    peakDate: string;
    current: number;
  };
  attendants: {
    peak: number;
    peakDate: string;
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
    avgResolutionTime: number;
  };
  messages: {
    total: number;
    today: number;
    avgPerTicket: number;
  };
  system: {
    startTime: string;
    lastActivity: string;
    activeConnections: number;
  };
}

const PerformanceMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchMetrics();
    
    // Atualizar dados a cada 1 minuto (igual ao dashboard administrativo)
    const dataInterval = setInterval(() => {
      fetchMetrics(true); // true indica que é um refresh automático
    }, 60000); // 1 minuto
    
    return () => {
      clearInterval(dataInterval);
    };
  }, []);

  const fetchMetrics = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const response = await fetch('/api/performance/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erro ao carregar métricas');
      }
      
      const data = await response.json();
      setMetrics(data.data);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center">
          <Activity className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-red-800 dark:text-red-200 font-medium">Erro ao carregar métricas</h3>
        </div>
        <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
        <button 
          onClick={() => fetchMetrics(false)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance do Sistema
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Visão completa do sistema e monitoramento em tempo real
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Última atualização: {lastUpdate}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchMetrics(false)}
          disabled={isRefreshing}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Uptime */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Server className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Uptime do Sistema
              </h3>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(metrics.uptime.status)}`}>
              {metrics.uptime.status === 'excellent' ? 'Excelente' : 
               metrics.uptime.status === 'good' ? 'Bom' : 'Atenção'}
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.uptime.percentage}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {metrics.uptime.days} dias ({metrics.uptime.hours}h)
          </div>
        </div>

        {/* Pico de Usuários */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Users className="w-5 h-5 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pico de Usuários
            </h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.users.peak}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(metrics.users.peakDate)} • {metrics.users.current} ativos
          </div>
        </div>

        {/* Pico de Atendentes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <TrendingUp className="w-5 h-5 text-purple-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pico de Atendentes
            </h3>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {metrics.attendants.peak}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(metrics.attendants.peakDate)}
          </div>
        </div>

        {/* Tickets */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <MessageSquare className="w-5 h-5 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tickets
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{metrics.tickets.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Abertos:</span>
              <span className="font-semibold text-orange-600">{metrics.tickets.open}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Fechados:</span>
              <span className="font-semibold text-green-600">{metrics.tickets.closed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Tempo médio:</span>
              <span className="font-semibold">{metrics.tickets.avgResolutionTime}h</span>
            </div>
          </div>
        </div>

        {/* Mensagens */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mensagens
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{metrics.messages.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Hoje:</span>
              <span className="font-semibold text-blue-600">{metrics.messages.today}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Média/ticket:</span>
              <span className="font-semibold">{metrics.messages.avgPerTicket}</span>
            </div>
          </div>
        </div>

        {/* Sistema */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center mb-4">
            <Clock className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Sistema
            </h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Início:</span>
              <span className="font-semibold text-xs">{formatDate(metrics.system.startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Última atividade:</span>
              <span className="font-semibold text-xs">{formatDate(metrics.system.lastActivity)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Conexões ativas:</span>
              <span className="font-semibold text-green-600">{metrics.system.activeConnections}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;
