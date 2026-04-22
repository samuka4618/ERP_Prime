import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Package,
  Phone,
  Search,
  Truck,
  User,
  Warehouse,
  X,
  ExternalLink,
  ClipboardList
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormattedDate from '../../components/FormattedDate';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionsContext';
import { apiUrl } from '../../utils/apiUrl';

type TabId = 'chegadas' | 'agendamentos';

interface FormResponseAgendamentoSnapshot {
  id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  status: string;
  notes?: string;
}

interface FormResponseRow {
  id: number;
  driver_name: string;
  phone_number?: string;
  fornecedor?: { id: number; name: string; category: string };
  agendamento_id?: number;
  agendamento?: FormResponseAgendamentoSnapshot;
  is_in_yard: boolean;
  submitted_at: string;
  checked_out_at?: string;
  discharge_started_at?: string;
  discharge_duration_minutes?: number;
  tracking_code?: string;
  satellite_submission_id?: string;
  responses: Record<string, unknown>;
}

interface AgendamentoRow {
  id: number;
  fornecedor_id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  status: string;
  notes?: string;
  fornecedor?: { id: number; name: string; category: string };
}

interface StatusHistoryEntry {
  id: number;
  agendamento_id: number;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by_user?: { id: number; name: string; email: string };
}

interface FornecedorOption {
  id: number;
  name: string;
  category: string;
}

function parseBackendDateTime(s?: string | null): Date | null {
  if (!s) return null;
  let dateStr = String(s).trim().replace(' ', 'T');
  if (!/Z$|[-+]\d{2}/.test(dateStr)) dateStr += 'Z';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatMinutesLabel(totalMin: number | null): string {
  if (totalMin == null || totalMin < 0 || !Number.isFinite(totalMin)) return '—';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function agendamentoStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pendente: 'Pendente',
    motorista_pronto: 'Motorista pronto',
    em_andamento: 'Em andamento',
    concluido: 'Concluído'
  };
  return map[status] || status;
}

const HistoricoDescarregamento: React.FC = () => {
  const { hasPermission } = usePermissions();
  const canChegadas = hasPermission('descarregamento.formularios.view_responses');
  const canAgendamentos = hasPermission('descarregamento.agendamentos.view');

  const [tab, setTab] = useState<TabId>(() => (canChegadas ? 'chegadas' : 'agendamentos'));

  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const toYmd = (d: Date) => d.toISOString().split('T')[0];
    return { start: toYmd(start), end: toYmd(end) };
  }, []);

  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [fornecedorId, setFornecedorId] = useState<string>('');
  const [searchChegadasInput, setSearchChegadasInput] = useState('');
  const [appliedSearchChegadas, setAppliedSearchChegadas] = useState('');
  const [yardFilter, setYardFilter] = useState<'all' | 'yes' | 'no'>('all');

  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);

  const [chegadas, setChegadas] = useState<FormResponseRow[]>([]);
  const [chegadasPage, setChegadasPage] = useState(1);
  const [chegadasTotalPages, setChegadasTotalPages] = useState(1);
  const [chegadasLoading, setChegadasLoading] = useState(false);

  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
  const [agPage, setAgPage] = useState(1);
  const [agTotalPages, setAgTotalPages] = useState(1);
  const [agLoading, setAgLoading] = useState(false);
  const [agSearchInput, setAgSearchInput] = useState('');
  const [appliedAgSearch, setAppliedAgSearch] = useState('');
  const [agStatus, setAgStatus] = useState<string>('all');

  const [detail, setDetail] = useState<FormResponseRow | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!canChegadas && canAgendamentos) setTab('agendamentos');
  }, [canChegadas, canAgendamentos]);

  useEffect(() => {
    const loadFornecedores = async () => {
      try {
        const res = await fetch(apiUrl('descarregamento/fornecedores?page=1&limit=500'), {
          credentials: 'include',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) return;
        const json = await res.json();
        setFornecedores(json.data?.data || []);
      } catch {
        /* silencioso: filtro opcional */
      }
    };
    loadFornecedores();
  }, []);

  const fetchChegadas = useCallback(async () => {
    if (!canChegadas) return;
    setChegadasLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(chegadasPage),
        limit: '25',
        start_date: startDate,
        end_date: endDate
      });
      if (fornecedorId) params.set('fornecedor_id', fornecedorId);
      if (appliedSearchChegadas) params.set('search', appliedSearchChegadas);
      if (yardFilter === 'yes') params.set('is_in_yard', 'true');
      if (yardFilter === 'no') params.set('is_in_yard', 'false');

      const res = await fetch(apiUrl(`descarregamento/form-responses?${params}`), {
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar chegadas');
      const json = await res.json();
      setChegadas(json.data?.data || []);
      setChegadasTotalPages(json.data?.total_pages || 1);
    } catch {
      toast.error('Erro ao carregar histórico de chegadas');
    } finally {
      setChegadasLoading(false);
    }
  }, [canChegadas, chegadasPage, startDate, endDate, fornecedorId, appliedSearchChegadas, yardFilter]);

  const fetchAgendamentos = useCallback(async () => {
    if (!canAgendamentos) return;
    setAgLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(agPage),
        limit: '50',
        start_date: startDate,
        end_date: endDate
      });
      if (fornecedorId) params.set('fornecedor_id', fornecedorId);
      if (appliedAgSearch) params.set('search', appliedAgSearch);
      if (agStatus !== 'all') params.set('status', agStatus);

      const res = await fetch(apiUrl(`descarregamento/agendamentos?${params}`), {
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar agendamentos');
      const json = await res.json();
      setAgendamentos(json.data?.data || []);
      setAgTotalPages(json.data?.total_pages || 1);
    } catch {
      toast.error('Erro ao carregar agendamentos');
    } finally {
      setAgLoading(false);
    }
  }, [canAgendamentos, agPage, startDate, endDate, fornecedorId, appliedAgSearch, agStatus]);

  useEffect(() => {
    if (tab === 'chegadas') fetchChegadas();
  }, [tab, fetchChegadas]);

  useEffect(() => {
    if (tab === 'agendamentos') fetchAgendamentos();
  }, [tab, fetchAgendamentos]);

  const openDetail = async (row: FormResponseRow) => {
    setDetail(row);
    setStatusHistory([]);
    if (!row.agendamento_id || !hasPermission('descarregamento.agendamentos.view')) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(apiUrl(`descarregamento/agendamentos/${row.agendamento_id}/status-history`), {
        credentials: 'include',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const json = await res.json();
        setStatusHistory(json.data?.history || []);
      }
    } catch {
      toast.error('Não foi possível carregar o histórico de status do agendamento');
    } finally {
      setHistoryLoading(false);
    }
  };

  const yardTimeLabel = (row: FormResponseRow): string => {
    const sub = parseBackendDateTime(row.submitted_at);
    if (!sub) return '—';
    const end = row.checked_out_at ? parseBackendDateTime(row.checked_out_at) : row.is_in_yard ? new Date() : null;
    if (!end) return '—';
    return formatMinutesLabel(diffMinutes(sub, end));
  };

  const waitDockLabel = (row: FormResponseRow): string => {
    const sub = parseBackendDateTime(row.submitted_at);
    const dock = parseBackendDateTime(row.discharge_started_at || null);
    if (!sub || !dock) return '—';
    return formatMinutesLabel(diffMinutes(sub, dock));
  };

  const dischargeLabel = (row: FormResponseRow): string => {
    if (row.discharge_duration_minutes != null) return formatMinutesLabel(row.discharge_duration_minutes);
    const dock = parseBackendDateTime(row.discharge_started_at || null);
    const out = parseBackendDateTime(row.checked_out_at || null);
    if (!dock || !out) return '—';
    return formatMinutesLabel(diffMinutes(dock, out));
  };

  const applyFiltersChegadas = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchChegadas(searchChegadasInput.trim());
    setChegadasPage(1);
  };

  const applyFiltersAg = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedAgSearch(agSearchInput.trim());
    setAgPage(1);
  };

  if (!canChegadas && !canAgendamentos) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white dark:bg-gray-800 rounded-lg shadow text-center">
        <p className="text-gray-700 dark:text-gray-300">Você não tem permissão para visualizar o histórico de descarregamento.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            Histórico — Descarregamento
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Chegadas de motoristas, tempos no pátio e na doca, e dados dos agendamentos vinculados.
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1">
        {canChegadas && (
          <button
            type="button"
            onClick={() => setTab('chegadas')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === 'chegadas'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Chegadas
          </button>
        )}
        {canAgendamentos && (
          <button
            type="button"
            onClick={() => setTab('agendamentos')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === 'agendamentos'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-white dark:bg-gray-800'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Agendamentos
          </button>
        )}
      </div>

      {tab === 'chegadas' && canChegadas && (
        <>
          <form
            onSubmit={applyFiltersChegadas}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 flex flex-col xl:flex-row flex-wrap gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data inicial (chegada)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data final (chegada)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fornecedor</label>
              <select
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Busca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Motorista, telefone ou fornecedor"
                  value={searchChegadasInput}
                  onChange={(e) => setSearchChegadasInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">No pátio</label>
              <select
                value={yardFilter}
                onChange={(e) => setYardFilter(e.target.value as typeof yardFilter)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">Todos</option>
                <option value="yes">Ainda no pátio</option>
                <option value="no">Já saíram</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Aplicar
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            {chegadasLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Chegada</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Motorista</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fornecedor</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Agendamento</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Doca</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Saída</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Pátio</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Espera doca</th>
                      <th className="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Descarga</th>
                      <th className="px-3 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {chegadas.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          Nenhuma chegada no período.
                        </td>
                      </tr>
                    ) : (
                      chegadas.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                            <FormattedDate date={row.submitted_at} includeTime />
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{row.driver_name}</div>
                            {row.phone_number && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {row.phone_number}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{row.fornecedor?.name || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {row.agendamento ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 shrink-0" />
                                  {new Date(row.agendamento.scheduled_date).toLocaleDateString('pt-BR')}
                                </div>
                                <div className="text-xs text-gray-500">{row.agendamento.scheduled_time || '—'}</div>
                                <span className="text-xs text-indigo-600 dark:text-indigo-400">
                                  {agendamentoStatusLabel(row.agendamento.status)}
                                </span>
                              </>
                            ) : row.agendamento_id ? (
                              <span className="text-xs text-amber-600">ID {row.agendamento_id} (registro removido)</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {row.agendamento ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 text-xs">
                                <Warehouse className="w-3 h-3" />
                                {row.agendamento.dock}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {row.checked_out_at ? <FormattedDate date={row.checked_out_at} includeTime /> : row.is_in_yard ? 'No pátio' : '—'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{yardTimeLabel(row)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{waitDockLabel(row)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{dischargeLabel(row)}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openDetail(row)}
                              className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {chegadasTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  disabled={chegadasPage <= 1}
                  onClick={() => setChegadasPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Página {chegadasPage} de {chegadasTotalPages}
                </span>
                <button
                  type="button"
                  disabled={chegadasPage >= chegadasTotalPages}
                  onClick={() => setChegadasPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'agendamentos' && canAgendamentos && (
        <>
          <form
            onSubmit={applyFiltersAg}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 md:p-6 flex flex-col xl:flex-row flex-wrap gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fornecedor</label>
              <select
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select
                value={agStatus}
                onChange={(e) => setAgStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="motorista_pronto">Motorista pronto</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Busca</label>
              <input
                type="text"
                placeholder="Fornecedor ou doca"
                value={agSearchInput}
                onChange={(e) => setAgSearchInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Aplicar
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
            {agLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Data / hora</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fornecedor</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Doca</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Obs.</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {agendamentos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                          Nenhum agendamento no período.
                        </td>
                      </tr>
                    ) : (
                      agendamentos.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {new Date(a.scheduled_date).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">{a.scheduled_time || '—'}</div>
                          </td>
                          <td className="px-4 py-3">{a.fornecedor?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                              <Warehouse className="w-3 h-3" />
                              {a.dock}
                            </span>
                          </td>
                          <td className="px-4 py-3">{agendamentoStatusLabel(a.status)}</td>
                          <td className="px-4 py-3 max-w-xs truncate text-gray-600 dark:text-gray-400">{a.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {hasPermission('descarregamento.agendamentos.view') && (
                              <Link
                                to={`/descarregamento/agendamentos/${a.id}`}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 text-sm font-medium"
                              >
                                Abrir
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {agTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  disabled={agPage <= 1}
                  onClick={() => setAgPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Página {agPage} de {agTotalPages}
                </span>
                <button
                  type="button"
                  disabled={agPage >= agTotalPages}
                  onClick={() => setAgPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Detalhe da chegada #{detail.id}
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-6">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Motorista</h3>
                <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                  <User className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{detail.driver_name}</p>
                    {detail.phone_number && <p className="text-sm text-gray-600 dark:text-gray-300">{detail.phone_number}</p>}
                    {detail.tracking_code && (
                      <p className="text-xs text-gray-500 mt-1">
                        Código: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{detail.tracking_code}</code>
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Linha do tempo</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Chegada:</strong> <FormattedDate date={detail.submitted_at} includeTime />
                    </span>
                  </li>
                  {detail.discharge_started_at && (
                    <li className="flex gap-2">
                      <Truck className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Liberado para doca:</strong> <FormattedDate date={detail.discharge_started_at} includeTime />
                      </span>
                    </li>
                  )}
                  {detail.checked_out_at && (
                    <li className="flex gap-2">
                      <Package className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Saída / conclusão:</strong> <FormattedDate date={detail.checked_out_at} includeTime />
                      </span>
                    </li>
                  )}
                  <li className="text-gray-700 dark:text-gray-300">
                    <strong>Tempo no pátio:</strong> {yardTimeLabel(detail)} &nbsp;|&nbsp; <strong>Espera até doca:</strong>{' '}
                    {waitDockLabel(detail)} &nbsp;|&nbsp; <strong>Descarga:</strong> {dischargeLabel(detail)}
                  </li>
                </ul>
              </section>

              {detail.fornecedor && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fornecedor</h3>
                  <p className="text-gray-900 dark:text-white">
                    {detail.fornecedor.name}{' '}
                    <span className="text-gray-500 text-sm">({detail.fornecedor.category})</span>
                  </p>
                </section>
              )}

              {detail.agendamento && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Agendamento vinculado</h3>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-sm space-y-1">
                    <p>
                      <strong>Data/hora prevista:</strong> {new Date(detail.agendamento.scheduled_date).toLocaleDateString('pt-BR')}{' '}
                      {detail.agendamento.scheduled_time}
                    </p>
                    <p>
                      <strong>Doca:</strong> {detail.agendamento.dock} &nbsp;|&nbsp; <strong>Status:</strong>{' '}
                      {agendamentoStatusLabel(detail.agendamento.status)}
                    </p>
                    {detail.agendamento.notes && (
                      <p>
                        <strong>Obs. do agendamento:</strong> {detail.agendamento.notes}
                      </p>
                    )}
                    {hasPermission('descarregamento.agendamentos.view') && (
                      <Link
                        to={`/descarregamento/agendamentos/${detail.agendamento.id}`}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium mt-2"
                      >
                        Ver agendamento
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {detail.agendamento_id && hasPermission('descarregamento.agendamentos.view') && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Histórico de status do agendamento
                  </h3>
                  {historyLoading ? (
                    <LoadingSpinner />
                  ) : statusHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum registro ou sem permissão para carregar.</p>
                  ) : (
                    <ul className="space-y-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-600">
                      {statusHistory.map((h) => (
                        <li key={h.id} className="px-3 py-2">
                          <div className="text-gray-900 dark:text-white">
                            {h.previous_status ? `${agendamentoStatusLabel(h.previous_status)} → ` : ''}
                            <strong>{agendamentoStatusLabel(h.new_status)}</strong>
                          </div>
                          <div className="text-xs text-gray-500">
                            <FormattedDate date={h.changed_at} includeTime />
                            {h.changed_by_user?.name && ` · ${h.changed_by_user.name}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Respostas do formulário</h3>
                <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(detail.responses ?? {}, null, 2)}
                </pre>
              </section>

              {detail.satellite_submission_id && (
                <p className="text-xs text-gray-500">
                  Satélite: <code>{detail.satellite_submission_id}</code>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoDescarregamento;
