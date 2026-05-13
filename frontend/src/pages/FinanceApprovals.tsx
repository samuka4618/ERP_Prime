import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { PaginatedResponse, Ticket } from '../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { approvalValueFromTicket } from '../utils/approvalAmount';

const FinanceApprovals: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<Ticket> | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPendingFinanceApprovals(page, 20);
      setResult(data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao carregar pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const approve = async (t: Ticket) => {
    try {
      await apiService.financeApproveTicket(t.id);
      toast.success('Chamado aprovado');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao aprovar');
    }
  };

  const reject = async (t: Ticket) => {
    const reason = window.prompt('Motivo da rejeição?');
    if (!reason || reason.length < 3) {
      toast.error('Informe um motivo (mín. 3 caracteres)');
      return;
    }

    try {
      await apiService.financeRejectTicket(t.id, reason);
      toast.success('Chamado rejeitado');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao rejeitar');
    }
  };

  if (loading && !result) return <LoadingSpinner />;

  const tickets = result?.data || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aprovações financeiras</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
        Chamados em <strong>aprovação financeira</strong> atribuídos à sua faixa de valor (ou todos, se administrador).
      </p>
      <div className="space-y-4">
        {tickets.length === 0 && <p className="text-gray-500">Nenhum chamado pendente.</p>}
        {tickets.map((t) => {
          const valorRefParsed = approvalValueFromTicket(t);
          return (
          <div
            key={t.id}
            className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-gray-200 dark:border-gray-700"
          >
            <div>
              <Link to={`/tickets/${t.id}`} className="font-semibold text-primary-600 hover:underline">
                #{t.id}
              </Link>
              <span className="ml-2 text-gray-900 dark:text-white">{t.subject}</span>
              <p className="text-sm text-gray-500 mt-1">
                {t.custom_data?.plataforma && <>Plataforma: {String(t.custom_data.plataforma)} · </>}
                Valor ref.:{' '}
                {valorRefParsed != null ? valorRefParsed.toLocaleString('pt-BR') : '— (valor em falta na abertura)'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => approve(t)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                Aprovar
              </button>
              <button
                type="button"
                onClick={() => reject(t)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Rejeitar
              </button>
              <Link
                to={`/tickets/${t.id}`}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200"
              >
                Abrir
              </Link>
            </div>
          </div>
          );
        })}
      </div>
      {result && result.total_pages > 1 && (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {page} / {result.total_pages}
          </span>
          <button
            type="button"
            disabled={page >= result.total_pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};

export default FinanceApprovals;
