import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { PaginatedResponse } from '../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { usePermissions } from '../contexts/PermissionsContext';

type SubRow = {
  id: number;
  ticket_id: number;
  platform: string;
  plan?: string | null;
  owner_name?: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_renewal_date?: string | null;
  status: string;
  approved_by_name?: string;
};

const CardSubscriptions: React.FC = () => {
  const { hasPermission } = usePermissions();
  const catalogMode = hasPermission('chamados.subscriptions.view');
  const canManageSubs = hasPermission('chamados.subscriptions.manage');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ totalMonthlyApprox: number; activeCount: number; renewals30d: number } | null>(
    null
  );
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<SubRow> | null>(null);
  const [filters, setFilters] = useState({ status: '', platform: '', owner: '', renewal_within_days: '' });

  const [revealId, setRevealId] = useState<number | null>(null);
  const [revealPwd, setRevealPwd] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubRow | null>(null);

  const loadSummary = async () => {
    try {
      const s = await apiService.getSubscriptionSummary();
      setSummary(s);
    } catch {
      /* opcional */
    }
  };

  const loadList = async (pageOverride?: number) => {
    try {
      setLoading(true);
      const p = pageOverride ?? page;
      const params: Record<string, unknown> = { page: p, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.platform) params.platform = filters.platform;
      if (catalogMode && filters.owner.trim()) params.owner = filters.owner;
      if (filters.renewal_within_days) params.renewal_within_days = parseInt(filters.renewal_within_days, 10);
      const data = await apiService.getSubscriptions(params);
      setResult(data as PaginatedResponse<SubRow>);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao listar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(1);
    void loadList(1);
  };

  const openReveal = (row: SubRow) => {
    setRevealId(row.id);
    setRevealPwd('');
    setRevealed(null);
    setDetail(row);
  };

  const doReveal = async () => {
    if (!revealId || !revealPwd) {
      toast.error('Informe sua senha do ERP');
      return;
    }
    try {
      const plain = await apiService.revealSubscriptionPassword(revealId, revealPwd);
      setRevealed(plain);
      toast.success('Senha revelada (evento auditado). Expira da tela em 30s.');
      setTimeout(() => setRevealed(null), 30000);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Falha ao revelar');
    }
  };

  const doCancel = async (id: number) => {
    const reason = window.prompt('Motivo do cancelamento?');
    if (!reason || reason.length < 3) {
      toast.error('Motivo obrigatório');
      return;
    }
    try {
      await apiService.cancelSubscription(id, reason);
      toast.success('Cancelada');
      loadList();
      loadSummary();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro');
    }
  };

  if (loading && !result) return <LoadingSpinner />;

  const rows = result?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {catalogMode ? 'Assinaturas digitais (cartão)' : 'Minhas assinaturas digitais'}
      </h1>
      {!catalogMode && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Aqui aparece somente o que você solicitou em chamados. O catálogo completo é restrito a quem opera as assinaturas.
        </p>
      )}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-4">
            <p className="text-sm text-gray-500">
              {catalogMode ? 'Total mensal (aprox.)' : 'Seu total mensal (aprox.)'}
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {summary.totalMonthlyApprox.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">{catalogMode ? 'Ativas (catálogo)' : 'Suas assinaturas ativas'}</p>
            <p className="text-2xl font-semibold">{summary.activeCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Renovações em 30 dias</p>
            <p className="text-2xl font-semibold">{summary.renewals30d}</p>
          </div>
        </div>
      )}

      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            className="border rounded px-2 py-1 dark:bg-gray-800"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="active">Ativa</option>
            <option value="cancelled">Cancelada</option>
            <option value="suspended">Suspensa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Plataforma</label>
          <input
            className="border rounded px-2 py-1 dark:bg-gray-800"
            value={filters.platform}
            onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value }))}
            placeholder="contém"
          />
        </div>
        {catalogMode && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Titular</label>
            <input
              className="border rounded px-2 py-1 dark:bg-gray-800"
              value={filters.owner}
              onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Renovação em (dias)</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24 dark:bg-gray-800"
            value={filters.renewal_within_days}
            onChange={(e) => setFilters((f) => ({ ...f, renewal_within_days: e.target.value }))}
            placeholder="ex: 30"
          />
        </div>
        <button type="button" onClick={applyFilters} className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm">
          Filtrar
        </button>
      </div>

      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="p-3">Plataforma</th>
              <th className="p-3">Plano</th>
              {catalogMode && <th className="p-3">Titular</th>}
              <th className="p-3">Valor</th>
              <th className="p-3">Ciclo</th>
              <th className="p-3">Próx. renovação</th>
              <th className="p-3">Status</th>
              <th className="p-3">Chamado</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="p-3 font-medium">{r.platform}</td>
                <td className="p-3">{r.plan || '—'}</td>
                {catalogMode && <td className="p-3">{r.owner_name || '—'}</td>}
                <td className="p-3">
                  {Number(r.amount).toLocaleString('pt-BR', { style: 'currency', currency: r.currency || 'BRL' })}
                </td>
                <td className="p-3">{r.billing_cycle}</td>
                <td className="p-3">{r.next_renewal_date || '—'}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">
                  <Link className="text-primary-600 hover:underline" to={`/tickets/${r.ticket_id}`}>
                    #{r.ticket_id}
                  </Link>
                </td>
                <td className="p-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openReveal(r)} className="text-primary-600 hover:underline text-xs">
                    Revelar senha
                  </button>
                  {r.status === 'active' && canManageSubs && (
                    <button type="button" onClick={() => doCancel(r.id)} className="text-red-600 hover:underline text-xs">
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-gray-500">Nenhuma assinatura encontrada.</p>}
      </div>

      {result && result.total_pages > 1 && (
        <div className="mt-4 flex gap-4 items-center">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm">
            Página {page} / {result.total_pages}
          </span>
          <button
            type="button"
            disabled={page >= result.total_pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}

      {revealId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Revelar senha da plataforma</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {detail?.platform} — confirme sua senha do ERP. O acesso é registrado em auditoria.
            </p>
            <input
              type="password"
              className="w-full border rounded px-3 py-2 mb-4 dark:bg-gray-800"
              placeholder="Senha atual do ERP"
              value={revealPwd}
              onChange={(e) => setRevealPwd(e.target.value)}
            />
            {revealed && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 text-sm break-all">
                Senha: <strong>{revealed}</strong>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 border rounded" onClick={() => setRevealId(null)}>
                Fechar
              </button>
              <button type="button" className="px-4 py-2 bg-primary-600 text-white rounded" onClick={doReveal}>
                Revelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardSubscriptions;
