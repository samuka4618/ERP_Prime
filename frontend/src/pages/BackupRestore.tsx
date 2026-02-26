import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { Database, Download, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const BackupRestore: React.FC = () => {
  const { hasPermission, loading: loadingPermissions } = usePermissions();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const canCreate = hasPermission('system.backup.create') || user?.role === 'admin';
  const canRestore = hasPermission('system.backup.restore') || user?.role === 'admin';

  const handleDownloadBackup = async () => {
    if (!canCreate) return;
    setGenerating(true);
    try {
      const baseURL = '/api';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token && token !== 'cookie') headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${baseURL}/system/backup`, {
        method: 'GET',
        credentials: 'include',
        headers
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
      const baseURL = '/api';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token && token !== 'cookie') headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${baseURL}/system/restore`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      toast.success(data.message || 'Restauração concluída.');
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

  if (loadingPermissions) return <LoadingSpinner />;
  if (!canCreate && !canRestore) {
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
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
