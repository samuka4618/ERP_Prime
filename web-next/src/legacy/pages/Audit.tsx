import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';
import { apiService, AuditLogEntry } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, ChevronLeft, ChevronRight, Filter, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';

/** Formata data/hora do log. Valores vindos do backend (SQLite) são UTC sem 'Z'; tratamos como UTC para exibir no fuso local. */
const formatDateTime = (iso: string | null) => {
  if (!iso) return '-';
  const asUtc = iso && !/Z$/i.test(iso) ? iso.replace(' ', 'T') + 'Z' : iso;
  const d = new Date(asUtc);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const Audit: React.FC = () => {
  const { hasPermission, loading: loadingPermissions } = usePermissions();
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      const { data } = await apiService.getAuditLogs(params);
      setRows(data.rows);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        toast.error('Sem permissão para visualizar auditoria.');
        return;
      }
      toast.error('Erro ao carregar logs de auditoria.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, dateFrom, dateTo, actionFilter, resourceFilter]);

  useEffect(() => {
    if (!loadingPermissions) fetchLogs();
  }, [loadingPermissions, fetchLogs]);

  const escapeCsv = (v: string | null | undefined): string => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params: Record<string, string | number> = { page: 1, limit: 5000 };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      const { data } = await apiService.getAuditLogs(params);
      const headers = ['Data/Hora', 'Usuário', 'Ação', 'Recurso', 'ID Recurso', 'Detalhes', 'IP'];
      const lines = [headers.join(',')];
      for (const row of data.rows) {
        lines.push([
          escapeCsv(formatDateTime(row.created_at)),
          escapeCsv(row.user_name),
          escapeCsv(row.action),
          escapeCsv(row.resource),
          escapeCsv(row.resource_id),
          escapeCsv(row.details),
          escapeCsv(row.ip_address)
        ].join(','));
      }
      const csv = lines.join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportados ${data.rows.length} registro(s).`);
    } catch (e: any) {
      if (e?.response?.status === 403) toast.error('Sem permissão para exportar.');
      else toast.error('Erro ao exportar CSV.');
    } finally {
      setExporting(false);
    }
  };

  if (loadingPermissions) {
    return <LoadingSpinner />;
  }
  if (!hasPermission('system.audit.view')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-7 h-7" />
          Auditoria do sistema
        </h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Registro de quem fez o quê e quando (logins, exclusões e outras ações relevantes).
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Até</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Ação</label>
            <input
              type="text"
              placeholder="ex: login.success"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="input border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-40 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recurso</label>
            <input
              type="text"
              placeholder="ex: descarregamento"
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="input border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm w-40 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => { setPage(1); fetchLogs(); }}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-sm font-medium"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || total === 0}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ação</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recurso</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalhes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum registro de auditoria no período.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200">
                          {row.user_name ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200">
                          {row.action}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {row.resource ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={row.details ?? undefined}>
                          {row.details ?? '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {row.ip_address ?? '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Total: {total} registro(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Audit;
