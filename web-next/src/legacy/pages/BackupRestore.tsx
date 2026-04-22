import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Database, Download, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/apiUrl';

interface BackupHealth {
  enabled: boolean;
  running: boolean;
  everyMinutes: number;
  retentionLocal: number;
  retentionOffsite: number;
  offsitePathConfigured: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastOutputFile: string | null;
  lastDurationMs: number | null;
  lastRetentionLocal: number | null;
  lastRetentionOffsite: number | null;
  lastLocalCount: number | null;
  lastOffsiteCount: number | null;
}

interface PostRestoreReport {
  executedAt: string;
  summary: {
    passed: number;
    failed: number;
  };
  items: Array<{
    name: string;
    ok: boolean;
    details?: string;
  }>;
}

const BackupRestore: React.FC = () => {
  const { hasPermission, loading: loadingPermissions } = usePermissions();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [checkingPostRestore, setCheckingPostRestore] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupHealth, setBackupHealth] = useState<BackupHealth | null>(null);
  const [postRestoreReport, setPostRestoreReport] = useState<PostRestoreReport | null>(null);

  const canCreate = hasPermission('system.backup.create') || user?.role === 'admin';
  const canRestore = hasPermission('system.backup.restore') || user?.role === 'admin';
  const canAccessPage = canCreate || canRestore;

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token && token !== 'cookie') headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '-';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString('pt-BR');
  };

  const handleDownloadBackup = async () => {
    if (!canCreate) return;
    setGenerating(true);
    try {
      const baseURL = getApiBaseUrl();
      const res = await fetch(`${baseURL}/system/backup`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const match = disposition && disposition.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `erp-backup-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup gerado e download iniciado.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar backup.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRestore || !selectedFile) {
      toast.error('Selecione um arquivo ZIP de backup.');
      return;
    }
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const baseURL = getApiBaseUrl();
      const res = await fetch(`${baseURL}/system/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      toast.success(data.message || 'Restauração concluída.');
      if (data?.data?.checks) {
        setPostRestoreReport(data.data.checks);
      }
      setSelectedFile(null);
      if ((document.getElementById('restore-file') as HTMLInputElement)) {
        (document.getElementById('restore-file') as HTMLInputElement).value = '';
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao restaurar backup.');
    } finally {
      setRestoring(false);
    }
  };

  const handleValidate = async () => {
    if (!canRestore || !selectedFile) {
      toast.error('Selecione um arquivo ZIP de backup.');
      return;
    }
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const baseURL = getApiBaseUrl();
      const res = await fetch(`${baseURL}/system/backup/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      const warnings = Array.isArray(data?.data?.warnings) ? data.data.warnings : [];
      if (warnings.length > 0) {
        toast.success(`Backup validado com alertas (${warnings.length}).`);
      } else {
        toast.success('Backup validado com sucesso. Pronto para restore.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao validar backup.');
    } finally {
      setValidating(false);
    }
  };

  const handleRefreshHealth = async () => {
    if (!canAccessPage) return;
    setLoadingHealth(true);
    try {
      const baseURL = getApiBaseUrl();
      const res = await fetch(`${baseURL}/system/backup/health`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setBackupHealth(data?.data || null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar saúde do backup.');
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleRunPostRestoreChecks = async () => {
    if (!canAccessPage) return;
    setCheckingPostRestore(true);
    try {
      const baseURL = getApiBaseUrl();
      const res = await fetch(`${baseURL}/system/backup/post-restore-checks`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setPostRestoreReport(data?.data || null);
      toast.success(data?.message || 'Checklist pós-restore executado.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao executar checklist pós-restore.');
    } finally {
      setCheckingPostRestore(false);
    }
  };

  useEffect(() => {
    if (!canAccessPage) return;
    handleRefreshHealth();
  }, [canAccessPage]);

  if (loadingPermissions) return <LoadingSpinner />;
  if (!canAccessPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-7 h-7" />
          Backup e Restore
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Gere um arquivo de backup do sistema (banco e arquivos) ou restaure a partir de um backup anterior.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {canCreate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Download className="w-5 h-5" />
              Gerar backup
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Baixe um arquivo ZIP contendo o banco de dados e o storage (uploads, imagens, logo). Use para cópia de segurança ou nova instalação.
            </p>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={generating}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? 'Gerando…' : 'Gerar e baixar backup'}
            </button>
          </div>
        )}

        {canRestore && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Upload className="w-5 h-5" />
              Restaurar backup
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Envie um arquivo ZIP de backup gerado por este sistema. O banco e o storage serão substituídos. Reinicie o servidor após a restauração.
            </p>
            <form onSubmit={handleRestore} className="space-y-3">
              <input
                id="restore-file"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300"
              />
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Após restaurar, reinicie o servidor para usar os dados restaurados.</span>
              </div>
              <button
                type="submit"
                disabled={restoring || !selectedFile}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {restoring ? 'Restaurando…' : 'Restaurar backup'}
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating || !selectedFile}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {validating ? 'Validando…' : 'Validar backup (pré-restore)'}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Saude do backup</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Mostra execucao automatica, retencao e ultimo erro do motor de backup.
          </p>
          <button
            type="button"
            onClick={handleRefreshHealth}
            disabled={loadingHealth}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loadingHealth ? 'Atualizando...' : 'Atualizar saude'}
          </button>
          <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <div><strong>Agendado:</strong> {backupHealth?.enabled ? 'Sim' : 'Nao'}</div>
            <div><strong>Em execucao:</strong> {backupHealth?.running ? 'Sim' : 'Nao'}</div>
            <div><strong>Intervalo:</strong> {backupHealth?.everyMinutes ?? '-'} min</div>
            <div><strong>Retencao local/off-site:</strong> {backupHealth?.retentionLocal ?? '-'} / {backupHealth?.retentionOffsite ?? '-'}</div>
            <div><strong>Ultima execucao:</strong> {formatDateTime(backupHealth?.lastRunAt)}</div>
            <div><strong>Ultimo sucesso:</strong> {formatDateTime(backupHealth?.lastSuccessAt)}</div>
            <div><strong>Duracao:</strong> {backupHealth?.lastDurationMs != null ? `${backupHealth.lastDurationMs} ms` : '-'}</div>
            <div><strong>ZIPs locais/off-site:</strong> {backupHealth?.lastLocalCount ?? '-'} / {backupHealth?.lastOffsiteCount ?? '-'}</div>
            <div><strong>Ultimo erro:</strong> {backupHealth?.lastError || '-'}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Checklist pos-restore</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Executa validacoes tecnicas apos restore para confirmar consistencia operacional.
          </p>
          <button
            type="button"
            onClick={handleRunPostRestoreChecks}
            disabled={checkingPostRestore}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {checkingPostRestore ? 'Executando...' : 'Executar checklist'}
          </button>
          <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <div><strong>Ultima execucao:</strong> {formatDateTime(postRestoreReport?.executedAt)}</div>
            <div><strong>Itens OK/Falha:</strong> {postRestoreReport?.summary.passed ?? '-'} / {postRestoreReport?.summary.failed ?? '-'}</div>
          </div>
          {postRestoreReport?.items?.length ? (
            <div className="mt-3 max-h-56 overflow-auto space-y-2">
              {postRestoreReport.items.map((item) => (
                <div
                  key={item.name}
                  className={`text-xs rounded border px-2 py-1 ${
                    item.ok
                      ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-300 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  <div className="font-medium">{item.name}</div>
                  {item.details ? <div>{item.details}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;
