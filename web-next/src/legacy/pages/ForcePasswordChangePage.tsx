import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import { Lock, Loader2 } from 'lucide-react';

const ForcePasswordChangePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { config } = useSystemConfig();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const reason = user?.passwordExpiredReason === 'max_age'
    ? 'A sua senha ultrapassou o prazo definido pela organização.'
    : 'O administrador exige que defina uma nova senha antes de continuar.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('A confirmação não coincide com a nova senha');
      return;
    }
    setLoading(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      toast.success('Senha alterada com sucesso');
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Erro ao alterar senha');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const systemName = config?.system_name || 'ERP PRIME';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
          <Lock className="w-6 h-6" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Alteração de senha obrigatória</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{systemName}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">{reason}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cpw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Senha atual
            </label>
            <input
              id="cpw"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="npw" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nova senha
            </label>
            <input
              id="npw"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="cnf" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirmar nova senha
            </label>
            <input
              id="cnf"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Guardar nova senha
          </button>
        </form>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Sair
        </button>
      </div>
    </div>
  );
};

export default ForcePasswordChangePage;
