import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import FormattedDate from '../../components/FormattedDate';

interface Orcamento {
  id: number;
  solicitacao_id: number;
  fornecedor_nome: string;
  valor_total: number;
  status: string;
  created_at: string;
  solicitacao?: {
    id: number;
    numero_solicitacao: string;
  };
}

const OrcamentosRecebidos: React.FC = () => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchOrcamentos();
  }, [currentPage, statusFilter]);

  const fetchOrcamentos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(statusFilter && { status: statusFilter })
      });

      const response = await fetch(`/api/orcamentos?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Erro ao carregar orçamentos');

      const result = await response.json();
      const data = result.data;
      setOrcamentos(data.data || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' },
      aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' },
      rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' },
      devolvido: { label: 'Devolvido', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' },
      cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }
    };
    const s = map[status] || { label: status, className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${s.className}`}>{s.label}</span>;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orçamentos Recebidos</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize e abra os detalhes de todos os orçamentos, independente do status.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovado">Aprovado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="devolvido">Devolvido</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {total} orçamento(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Solicitação</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {orcamentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhum orçamento encontrado.
                    </td>
                  </tr>
                ) : (
                  orcamentos.map((orc) => (
                    <tr key={orc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {orc.solicitacao?.numero_solicitacao || `#${orc.solicitacao_id}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{orc.fornecedor_nome}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        R$ {Number(orc.valor_total).toFixed(2).replace('.', ',')}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(orc.status)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        <FormattedDate date={orc.created_at} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/compras/orcamentos/${orc.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrcamentosRecebidos;
