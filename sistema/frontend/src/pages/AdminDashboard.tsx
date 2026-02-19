import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  UsersIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface SystemOverview {
  total_users: number;
  online_users: number;
  total_attendants: number;
  online_attendants: number;
  active_tickets: number;
  resolved_today: number;
  created_today: number;
  avg_resolution_time: number;
  system_uptime: number;
  peak_concurrent_users: number;
  peak_concurrent_attendants: number;
}

interface UserActivity {
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  last_activity: string;
  is_online: boolean;
  session_duration: number;
  total_sessions_today: number;
  total_sessions_this_week: number;
  total_sessions_this_month: number;
}

interface AttendantMetrics {
  attendant_id: number;
  attendant_name: string;
  attendant_email: string;
  is_online: boolean;
  last_activity: string;
  active_tickets: number;
  total_tickets_today: number;
  total_tickets_this_week: number;
  total_tickets_this_month: number;
  avg_resolution_time: number;
  tickets_resolved_today: number;
  tickets_resolved_this_week: number;
  tickets_resolved_this_month: number;
  response_time_avg: number;
  customer_satisfaction: number;
}

const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserActivity[]>([]);
  const [attendantMetrics, setAttendantMetrics] = useState<AttendantMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'attendants'>('overview');

  useEffect(() => {
    fetchData();
    
    // Atualizar dados a cada 1 minuto (mais leve)
    const dataInterval = setInterval(() => {
      fetchData(true); // true indica que é um refresh
    }, 60000); // 1 minuto
    
    // Rastrear atividade periódica para manter usuário como online
    const activityInterval = setInterval(() => {
      trackUserActivity('heartbeat');
    }, 60000); // A cada 1 minuto
    
    return () => {
      clearInterval(dataInterval);
      clearInterval(activityInterval);
    };
  }, []);

  const trackUserActivity = async (activity: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/admin-metrics/track-activity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: JSON.parse(localStorage.getItem('user') || '{}').id,
          activity
        })
      });
    } catch (error) {
      // Falha silenciosa
    }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      const token = localStorage.getItem('token');
      if (!token) return;

      const [overviewRes, usersRes, attendantsRes] = await Promise.all([
        fetch('/api/admin-metrics/overview', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin-metrics/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin-metrics/attendants', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        setOverview(overviewData.data);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUserMetrics(usersData.data);
      }

      if (attendantsRes.ok) {
        const attendantsData = await attendantsRes.json();
        setAttendantMetrics(attendantsData.data);
      }

      // Atualizar timestamp da última atualização
      setLastUpdate(new Date());
      
      // Mostrar notificação sutil para refresh automático
      if (isRefresh) {
        toast.success('Dados atualizados', {
          duration: 2000,
          position: 'top-right',
          style: {
            background: '#10B981',
            color: 'white',
            fontSize: '14px'
          }
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      if (isRefresh) {
        toast.error('Erro ao atualizar dados', {
          duration: 3000,
          position: 'top-right'
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusColor = (isOnline: boolean): string => {
    return isOnline ? 'text-green-600 bg-green-100 dark:bg-green-900/20' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
  };

  const getSatisfactionColor = (satisfaction: number): string => {
    if (satisfaction >= 90) return 'text-green-600';
    if (satisfaction >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Administrativo</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Visão completa do sistema e monitoramento em tempo real</p>
            {lastUpdate && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {refreshing && (
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Atualizando...</span>
              </div>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Visão Geral', icon: ChartBarIcon },
            { id: 'users', name: 'Usuários', icon: UsersIcon },
            { id: 'attendants', name: 'Atendentes', icon: UserGroupIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Visão Geral */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <UsersIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Usuários</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_users}</p>
                  <p className="text-sm text-green-600">
                    {overview.online_users} online
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <UserGroupIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Atendentes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.total_attendants}</p>
                  <p className="text-sm text-green-600">
                    {overview.online_attendants} online
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Chamados Ativos</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.active_tickets}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {overview.created_today} criados hoje
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolvidos Hoje</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{overview.resolved_today}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatTime(overview.avg_resolution_time)} tempo médio
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas Adicionais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance do Sistema</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Uptime do Sistema</span>
                  <span className="font-semibold text-green-600">{overview.system_uptime}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pico de Usuários</span>
                  <span className="font-semibold">{overview.peak_concurrent_users}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Pico de Atendentes</span>
                  <span className="font-semibold">{overview.peak_concurrent_attendants}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Atividade de Hoje</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Chamados Criados</span>
                  <span className="font-semibold text-blue-600">{overview.created_today}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Chamados Resolvidos</span>
                  <span className="font-semibold text-green-600">{overview.resolved_today}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Taxa de Resolução</span>
                  <span className="font-semibold">
                    {overview.created_today > 0 
                      ? Math.round((overview.resolved_today / overview.created_today) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usuários */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Atividade dos Usuários</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Monitoramento em tempo real da atividade dos usuários</p>
                </div>
                {refreshing && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Atualizando...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Última Atividade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessões Hoje</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessões Esta Semana</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tempo Médio Sessão</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {userMetrics.map((user) => (
                    <tr key={user.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{user.user_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.user_email}</div>
                          <div className="text-xs text-gray-400">{user.user_role}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.is_online)}`}>
                          {user.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(user.last_activity)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.total_sessions_today}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.total_sessions_this_week}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatTime(user.session_duration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Atendentes */}
      {activeTab === 'attendants' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance dos Atendentes</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Métricas detalhadas de performance e produtividade</p>
                </div>
                {refreshing && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Atualizando...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Atendente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chamados Ativos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resolvidos Hoje</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tempo Médio Resolução</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Satisfação</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {attendantMetrics.map((attendant) => (
                    <tr key={attendant.attendant_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{attendant.attendant_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{attendant.attendant_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(attendant.is_online)}`}>
                          {attendant.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {attendant.active_tickets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {attendant.tickets_resolved_today}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatTime(attendant.avg_resolution_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-semibold ${getSatisfactionColor(attendant.customer_satisfaction)}`}>
                          {attendant.customer_satisfaction}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
