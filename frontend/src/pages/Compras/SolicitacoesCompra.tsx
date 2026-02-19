import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, CheckCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import FormattedDate from '../../components/FormattedDate';
import { usePermissions } from '../../contexts/PermissionsContext';
import { apiService } from '../../services/api';

interface SolicitacaoCompra {
  id: number;
  numero_solicitacao: string;
  descricao: string;
  status: string;
  prioridade: string;
  valor_total: number;
  created_at: string;
  solicitante?: {
    id: number;
    name: string;
    email: string;
  };
}

const SolicitacoesCompra: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSolicitacoes();
  }, [currentPage, statusFilter]);

  const fetchSolicitacoes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`/api/solicitacoes-compra?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar solicitações');

      const data = await response.json();
      setSolicitacoes(data.data.data || []);
      setTotalPages(data.data.total_pages || 1);
    } catch (error) {
      toast.error('Erro ao carregar solicitações de compra');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSolicitacoes();
  };

  const handleDeleteSolicitacao = async (solicitacaoId: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta solicitação de compra? Esta ação não pode ser desfeita.')) {
      try {
        await apiService.deleteSolicitacaoCompra(solicitacaoId);
        toast.success('Solicitação excluída com sucesso');
        fetchSolicitacoes(); // Recarregar a lista
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erro ao excluir solicitação');
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'rascunho':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'pendente_aprovacao':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'aprovada':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejeitada':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'em_cotacao':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'comprada':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      rascunho: 'Rascunho',
      pendente_aprovacao: 'Pendente Aprovação',
      aprovada: 'Aprovada',
      rejeitada: 'Rejeitada',
      em_cotacao: 'Em Cotação',
      cotacao_recebida: 'Cotação Recebida',
      orcamento_aprovado: 'Orçamento Aprovado',
      orcamento_rejeitado: 'Orçamento Rejeitado',
      em_compra: 'Em Compra',
      comprada: 'Comprada',
      cancelada: 'Cancelada',
      devolvida: 'Devolvida'
    };
    return statusMap[status] || status;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'alta':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300';
      case 'normal':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'baixa':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  };

  const getPriorityText = (priority: string) => {
    const priorityMap: Record<string, string> = {
      urgente: 'Urgente',
      alta: 'Alta',
      normal: 'Normal',
      baixa: 'Baixa'
    };
    return priorityMap[priority] || priority;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitações de Compra</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie todas as solicitações de compra</p>
        </div>
        <Link
          to="/compras/solicitacoes/nova"
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Solicitação</span>
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por número ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="input"
          >
            <option value="all">Todos os Status</option>
            <option value="rascunho">Rascunho</option>
            <option value="pendente_aprovacao">Pendente Aprovação</option>
            <option value="aprovada">Aprovada</option>
            <option value="rejeitada">Rejeitada</option>
            <option value="em_cotacao">Em Cotação</option>
            <option value="comprada">Comprada</option>
          </select>
          <button type="submit" className="btn btn-primary">
            Buscar
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prioridade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {solicitacoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma solicitação encontrada
                  </td>
                </tr>
              ) : (
                solicitacoes.map((solicitacao) => (
                  <tr key={solicitacao.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {solicitacao.numero_solicitacao}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {solicitacao.descricao.substring(0, 50)}
                      {solicitacao.descricao.length > 50 ? '...' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(solicitacao.status)}
                        <span className="text-sm text-gray-900 dark:text-white">
                          {getStatusText(solicitacao.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(solicitacao.prioridade)}`}>
                        {getPriorityText(solicitacao.prioridade)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      R$ {solicitacao.valor_total.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <FormattedDate date={solicitacao.created_at} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/compras/solicitacoes/${solicitacao.id}`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </Link>
                        {hasPermission('compras.solicitacoes.delete') && (
                          <button
                            onClick={() => handleDeleteSolicitacao(solicitacao.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Excluir solicitação"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-outline"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-outline"
              >
                Próxima
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Página <span className="font-medium">{currentPage}</span> de{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolicitacoesCompra;

