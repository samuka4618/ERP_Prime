import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Ticket, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Activity,
  Settings,
  UserPlus,
  CreditCard,
  Send,
  FileCheck,
  Filter,
  ShoppingCart,
  Package,
  BarChart3,
  FileText
} from 'lucide-react';
import { DashboardStats } from '../types';
import { apiService } from '../services/api';
import { useActivityTracking } from '../hooks/useActivityTracking';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface RecentActivity {
  id: number;
  type: 'ticket_created' | 'ticket_updated' | 'ticket_resolved' | 'ticket_reopened' | 'ticket_closed';
  title: string;
  description: string;
  timestamp: Date;
  user_name: string;
  ticket_id: number;
  ticket_subject: string;
}

type DatePreset = 'all' | 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

const Dashboard: React.FC = () => {
  const { config } = useSystemConfig();
  const systemName = config?.system_name || 'ERP PRIME';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [registrationStats, setRegistrationStats] = useState<any>(null);
  const [comprasStats, setComprasStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  
  // Rastrear atividade do usuário
  useActivityTracking();

  // Função para formatar data no formato YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Função para calcular períodos padrões
  const getDateRange = (preset: DatePreset): { startDate?: string; endDate?: string } => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const endDateStr = formatDate(today);

    switch (preset) {
      case 'all':
        return {};
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return { startDate: formatDate(todayStart), endDate: endDateStr };
      case 'last7days':
        const last7Days = new Date(today);
        last7Days.setDate(today.getDate() - 7);
        return { startDate: formatDate(last7Days), endDate: endDateStr };
      case 'last30days':
        const last30Days = new Date(today);
        last30Days.setDate(today.getDate() - 30);
        return { startDate: formatDate(last30Days), endDate: endDateStr };
      case 'thisMonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatDate(thisMonthStart), endDate: endDateStr };
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) };
      case 'custom':
        return { startDate, endDate };
      default:
        return {};
    }
  };

  useEffect(() => {
    // Só buscar dados automaticamente se não for período personalizado
    if (datePreset !== 'custom') {
      fetchData();
    }
  }, [datePreset]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const dateRange = getDateRange(datePreset);
      
      const [statsData, activityData, regStatsData, comprasStatsData] = await Promise.all([
        apiService.getDashboardStats(dateRange.startDate, dateRange.endDate),
        apiService.getRecentActivity(),
        apiService.getClientRegistrationStatistics(dateRange.startDate, dateRange.endDate).catch(() => null),
        apiService.getComprasStatistics(dateRange.startDate, dateRange.endDate).catch(() => null)
      ]);
      setStats(statsData);
      setRegistrationStats(regStatsData);
      setComprasStats(comprasStatsData);
      
      // Converter timestamps de string para Date
      const activitiesWithDates = activityData.map(activity => ({
        ...activity,
        timestamp: new Date(activity.timestamp)
      }));
      
      setRecentActivity(activitiesWithDates);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      // Não mostrar toast de erro durante inicialização
      // toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total de Chamados',
      value: stats?.total_tickets || 0,
      icon: Ticket,
      color: 'bg-blue-500',
      change: `${stats?.sla_first_response_rate || 0}%`,
      changeType: 'info',
      subtitle: 'Taxa SLA 1ª Resposta'
    },
    {
      title: 'Chamados Abertos',
      value: stats?.open_tickets || 0,
      icon: AlertCircle,
      color: 'bg-yellow-500',
      change: `${stats?.pending_user_tickets || 0}`,
      changeType: 'info',
      subtitle: 'Pendentes Usuário'
    },
    {
      title: 'Em Atendimento',
      value: stats?.in_progress_tickets || 0,
      icon: Clock,
      color: 'bg-orange-500',
      change: `${stats?.pending_third_party_tickets || 0}`,
      changeType: 'info',
      subtitle: 'Pendentes Terceiro'
    },
    {
      title: 'Aguardando Aprovação',
      value: stats?.pending_approval_tickets || 0,
      icon: CheckCircle,
      color: 'bg-yellow-500',
      change: `${stats?.pending_approval_tickets || 0}`,
      changeType: 'warning',
      subtitle: 'Finalizados - Aguardando Confirmação'
    },
    {
      title: 'Resolvidos',
      value: stats?.resolved_tickets || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: `${stats?.sla_resolution_rate || 0}%`,
      changeType: 'info',
      subtitle: 'Taxa SLA Resolução'
    },
    {
      title: 'Fechados',
      value: stats?.closed_tickets || 0,
      icon: CheckCircle,
      color: 'bg-gray-500',
      change: `${stats?.sla_violations || 0}`,
      changeType: (stats?.sla_violations || 0) > 0 ? 'negative' : 'positive',
      subtitle: 'Violações SLA'
    },
    {
      title: 'Tempo Médio (h)',
      value: Math.round(stats?.avg_resolution_time || 0),
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: `${stats?.total_users || 0}`,
      changeType: 'info',
      subtitle: 'Total Usuários'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Visão geral do {systemName}</p>
        </div>
        <Link
          to="/system-config"
          className="btn btn-outline flex items-center space-x-2"
        >
          <Settings className="w-4 h-4" />
          <span>Configurações</span>
        </Link>
      </div>

      {/* Filtro de Data */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">Filtrar por Período:</span>
          </div>
          
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'today'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => handlePresetChange('last7days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'last7days'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Últimos 7 dias
            </button>
            <button
              onClick={() => handlePresetChange('last30days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'last30days'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Últimos 30 dias
            </button>
            <button
              onClick={() => handlePresetChange('thisMonth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'thisMonth'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => handlePresetChange('lastMonth')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'lastMonth'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Mês Passado
            </button>
            <button
              onClick={() => handlePresetChange('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                datePreset === 'custom'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>

        {showCustomDates && (
          <div className="mt-4 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <button
                onClick={() => {
                  if (startDate && endDate) {
                    fetchData();
                  }
                }}
                disabled={!startDate || !endDate || startDate > endDate}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Aplicar Filtro
              </button>
            </div>
            {startDate && endDate && startDate > endDate && (
              <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                A data inicial deve ser menor ou igual à data final
              </div>
            )}
          </div>
        )}

        {datePreset !== 'all' && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 inline mr-1" />
            Período selecionado: {(() => {
              const range = getDateRange(datePreset);
              if (range.startDate && range.endDate) {
                return `${new Date(range.startDate).toLocaleDateString('pt-BR')} até ${new Date(range.endDate).toLocaleDateString('pt-BR')}`;
              }
              return 'Período completo';
            })()}
          </div>
        )}
      </div>

      {/* Ticket Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                  <div className="flex items-center mt-2">
                    <span className={`text-xs font-medium ${
                      card.changeType === 'positive' ? 'text-green-600' : 
                      card.changeType === 'negative' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {card.change}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{card.subtitle}</span>
                  </div>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Client Registrations Stats */}
      {registrationStats && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cadastros de Clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total de Cadastros */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Cadastros</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.totalRegistrations || 0}</p>
                </div>
                <div className="bg-blue-500 p-3 rounded-lg">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Cadastros Hoje */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cadastros Hoje</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.todayCount || 0}</p>
                </div>
                <div className="bg-green-500 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Aguardando Análise de Crédito */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Aguardando Análise</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.pendingAnalysisCount || 0}</p>
                </div>
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Cadastros Enviados */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Cadastros Enviados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.sentCount || 0}</p>
                </div>
                <div className="bg-orange-500 p-3 rounded-lg">
                  <Send className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Em Análise */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Em Análise</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.inAnalysisCount || 0}</p>
                </div>
                <div className="bg-purple-500 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Aprovados */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Aprovados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.approvedCount || 0}</p>
                </div>
                <div className="bg-green-600 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {/* Finalizados */}
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Finalizados</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{registrationStats.completedCount || 0}</p>
                </div>
                <div className="bg-gray-500 p-3 rounded-lg">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts and Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Atividade Recente</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => {
                const getActivityColor = (type: string) => {
                  switch (type) {
                    case 'ticket_created': return 'bg-green-500';
                    case 'ticket_resolved': return 'bg-blue-500';
                    case 'ticket_closed': return 'bg-gray-500';
                    case 'ticket_reopened': return 'bg-yellow-500';
                    case 'ticket_updated': return 'bg-purple-500';
                    default: return 'bg-gray-400';
                  }
                };

                const getTimeAgo = (timestamp: Date) => {
                  // Verificar se timestamp é válido
                  if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
                    return 'Data inválida';
                  }
                  
                  const now = new Date();
                  const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
                  
                  if (diffInMinutes < 1) return 'Agora mesmo';
                  if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;
                  
                  const diffInHours = Math.floor(diffInMinutes / 60);
                  if (diffInHours < 24) return `Há ${diffInHours}h`;
                  
                  const diffInDays = Math.floor(diffInHours / 24);
                  return `Há ${diffInDays} dias`;
                };

                return (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${getActivityColor(activity.type)}`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{activity.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{getTimeAgo(activity.timestamp)} • {activity.user_name}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </div>

        {/* SLA Status */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Status do SLA</h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Primeira Resposta</span>
                <span>{stats?.sla_first_response_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (stats?.sla_first_response_rate || 0) >= 90 ? 'bg-green-500' : 
                    (stats?.sla_first_response_rate || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${stats?.sla_first_response_rate || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Resolução</span>
                <span>{stats?.sla_resolution_rate || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    (stats?.sla_resolution_rate || 0) >= 90 ? 'bg-green-500' : 
                    (stats?.sla_resolution_rate || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${stats?.sla_resolution_rate || 0}%` }}
                ></div>
              </div>
            </div>
            <div className="pt-2">
              <p className={`text-sm font-medium ${
                (stats?.sla_violations || 0) > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {stats?.sla_violations || 0} violações de SLA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution by Category */}
      {stats?.tickets_by_category && stats.tickets_by_category.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Chamados por Categoria</h3>
          <div className="space-y-3">
            {stats.tickets_by_category.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{category.category_name}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${(category.count / stats.total_tickets) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{category.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compras Stats */}
      {comprasStats && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sistema de Compras</h2>
            <Link to="/compras/solicitacoes" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de Solicitações</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{comprasStats.total || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Valor Total: R$ {(comprasStats.total_value || 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div className="bg-blue-500 p-3 rounded-lg">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendentes Aprovação</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{comprasStats.pending_approval || 0}</p>
                </div>
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Em Cotação</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{comprasStats.in_quotation || 0}</p>
                </div>
                <div className="bg-orange-500 p-3 rounded-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="card p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Aprovadas</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{comprasStats.approved || 0}</p>
                </div>
                <div className="bg-green-500 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relatórios Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Relatórios</h2>
          <Link to="/reports" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link to="/reports" className="card p-6 hover:shadow-lg transition-shadow hover:border-blue-500 border-2 border-transparent">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Relatórios de Chamados</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">SLA, volume, desempenho e mais</p>
              </div>
            </div>
          </Link>

          <Link to="/reports" className="card p-6 hover:shadow-lg transition-shadow hover:border-green-500 border-2 border-transparent">
            <div className="flex items-center space-x-4">
              <div className="bg-green-500 p-3 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Relatórios de Compras</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Solicitações, orçamentos e aprovações</p>
              </div>
            </div>
          </Link>

          <Link to="/reports" className="card p-6 hover:shadow-lg transition-shadow hover:border-purple-500 border-2 border-transparent">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-500 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Relatórios Personalizados</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Crie e agende relatórios customizados</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ações Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/tickets/new" className="btn btn-primary flex items-center justify-center space-x-2">
            <Ticket className="w-4 h-4" />
            <span>Novo Chamado</span>
          </Link>
          <Link to="/compras/solicitacoes/nova" className="btn btn-primary flex items-center justify-center space-x-2">
            <ShoppingCart className="w-4 h-4" />
            <span>Nova Solicitação</span>
          </Link>
          <Link to="/reports" className="btn btn-secondary flex items-center justify-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Relatórios</span>
          </Link>
          <Link to="/users" className="btn btn-secondary flex items-center justify-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Usuários</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
