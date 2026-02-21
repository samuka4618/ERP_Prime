import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Calendar, Truck, Clock, CheckCircle, AlertCircle, Package } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionsContext';

interface Agendamento {
  id: number;
  fornecedor_id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  status: 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';
  notes?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
}

const Agendamentos: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAgendamentos();
  }, [currentPage, statusFilter, dateFilter]);

  const fetchAgendamentos = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      // Se não houver filtro de data, buscar próximos 30 dias
      let startDate = dateFilter;
      let endDate = dateFilter;
      
      if (!dateFilter) {
        startDate = todayStr;
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 30);
        endDate = futureDate.toISOString().split('T')[0];
      }
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        start_date: startDate,
        end_date: endDate,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/descarregamento/agendamentos?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar agendamentos');

      const data = await response.json();
      setAgendamentos(data.data.data || []);
      setTotalPages(data.data.total_pages || 1);
    } catch (error) {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAgendamentos();
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      pendente: {
        badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        icon: Clock,
        iconColor: 'text-yellow-600',
        label: 'Pendente'
      },
      motorista_pronto: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Package,
        iconColor: 'text-blue-600',
        label: 'Motorista Pronto'
      },
      em_andamento: {
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: Truck,
        iconColor: 'text-purple-600',
        label: 'Em Andamento'
      },
      concluido: {
        badge: 'bg-green-50 text-green-700 border-green-200',
        icon: CheckCircle,
        iconColor: 'text-green-600',
        label: 'Concluído'
      }
    };
    return configs[status as keyof typeof configs] || {
      badge: 'bg-gray-50 text-gray-700 border-gray-200',
      icon: AlertCircle,
      iconColor: 'text-gray-600',
      label: status
    };
  };

  // Calcular estatísticas
  const stats = {
    total: agendamentos.length,
    pendente: agendamentos.filter(a => a.status === 'pendente').length,
    motorista_pronto: agendamentos.filter(a => a.status === 'motorista_pronto').length,
    em_andamento: agendamentos.filter(a => a.status === 'em_andamento').length,
    concluido: agendamentos.filter(a => a.status === 'concluido').length
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agendamentos de Descarregamento</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie os agendamentos de descarregamento</p>
        </div>
        {hasPermission('descarregamento.agendamentos.create') && (
          <Link
            to="/descarregamento/agendamentos/novo"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium focus-ring"
          >
            <Plus className="w-5 h-5" />
            Novo Agendamento
          </Link>
        )}
      </div>

      {/* Estatísticas */}
      {agendamentos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pendente</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendente}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Motorista Pronto</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.motorista_pronto}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Em Andamento</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.em_andamento}</p>
              </div>
              <Truck className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Concluído</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.concluido}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por fornecedor ou doca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Filtrar por data"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('');
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded focus-ring"
                  title="Limpar filtro de data"
                >
                  Limpar
                </button>
              )}
            </div>
            {!dateFilter && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Mostrando próximos 30 dias
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-[180px]"
            >
              <option value="all">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="motorista_pronto">Motorista Pronto</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium focus-ring"
            >
              <Search className="w-5 h-5" />
              Buscar
            </button>
          </div>
        </form>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Fornecedor
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Doca
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Observações
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {agendamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="w-16 h-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Nenhum agendamento encontrado
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchTerm || statusFilter !== 'all' || dateFilter
                          ? 'Tente ajustar os filtros de busca'
                          : 'Comece criando um novo agendamento'}
                      </p>
                      {!searchTerm && statusFilter === 'all' && !dateFilter && hasPermission('descarregamento.agendamentos.create') && (
                        <Link
                          to="/descarregamento/agendamentos/novo"
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <Plus className="w-5 h-5" />
                          Criar o primeiro agendamento
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                agendamentos.map((agendamento) => {
                  const statusConfig = getStatusConfig(agendamento.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <tr
                      key={agendamento.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {new Date(agendamento.scheduled_date).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{agendamento.scheduled_time}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                            <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {agendamento.fornecedor?.name || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {agendamento.fornecedor?.category || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                          Doca {agendamento.dock}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.badge}`}>
                          <StatusIcon className={`w-4 h-4 ${statusConfig.iconColor}`} />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {agendamento.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/descarregamento/agendamentos/${agendamento.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                          Ver Detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Agendamentos;
