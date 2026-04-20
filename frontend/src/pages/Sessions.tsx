import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Laptop, LogOut, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AuthSession } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function getDeviceLabel(userAgent: string | null): string {
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return 'Dispositivo não identificado';
  if (ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) return 'Dispositivo móvel';
  return 'Computador';
}

function getBrowserLabel(userAgent: string | null): string {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('edg/')) return 'Microsoft Edge';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Google Chrome';
  if (ua.includes('firefox/')) return 'Mozilla Firefox';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  return 'Navegador não identificado';
}

function formatDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'Data inválida';
  return parsed.toLocaleString('pt-BR');
}

const Sessions: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningSessionId, setActioningSessionId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAuthSessions();
      setSessions(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const activeSessions = useMemo(
    () => sessions.filter((session) => !session.revokedAt),
    [sessions]
  );

  const hasOtherActiveSessions = activeSessions.some((session) => !session.current);

  const handleRevokeSession = async (session: AuthSession) => {
    const isCurrent = session.current;
    const confirmMessage = isCurrent
      ? 'Deseja encerrar a sessão atual neste dispositivo?'
      : 'Deseja encerrar esta sessão?';

    if (!window.confirm(confirmMessage)) return;

    setActioningSessionId(session.sessionId);
    try {
      await apiService.revokeAuthSession(session.sessionId);
      toast.success('Sessão encerrada com sucesso');

      if (isCurrent) {
        await logout();
        navigate('/login', { replace: true });
        return;
      }

      await loadSessions();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erro ao encerrar sessão');
    } finally {
      setActioningSessionId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm('Deseja encerrar todas as outras sessões ativas?')) return;

    setRevokingOthers(true);
    try {
      const revokedCount = await apiService.revokeOtherAuthSessions();
      toast.success(
        revokedCount > 0
          ? `${revokedCount} sessão(ões) encerrada(s)`
          : 'Não havia outras sessões ativas'
      );
      await loadSessions();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Erro ao encerrar outras sessões');
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sessões Ativas</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie os dispositivos logados na sua conta.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadSessions}
            disabled={loading}
            className="btn btn-outline flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokingOthers || !hasOtherActiveSessions}
            className="btn btn-danger flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            Encerrar outras sessões
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dispositivos conectados</h2>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando sessões...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma sessão ativa encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Dispositivo</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Criada em</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Último uso</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Expira em</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Lembrar de mim</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {activeSessions.map((session) => {
                  const isMobile = getDeviceLabel(session.userAgent) === 'Dispositivo móvel';
                  const isActioning = actioningSessionId === session.sessionId;

                  return (
                    <tr key={session.sessionId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {user?.name || 'Usuário não identificado'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {user?.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isMobile ? (
                            <Smartphone className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Laptop className="w-4 h-4 text-gray-500" />
                          )}
                          <span>{getDeviceLabel(session.userAgent)} - {getBrowserLabel(session.userAgent)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {session.ipAddress || 'não informado'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(session.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(session.lastUsedAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatDate(session.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {session.rememberMe ? 'Sim' : 'Não'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {session.current ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Sessão atual
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Ativa
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRevokeSession(session)}
                          disabled={isActioning}
                          className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                          {session.current ? 'Encerrar esta sessão' : 'Encerrar sessão'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
