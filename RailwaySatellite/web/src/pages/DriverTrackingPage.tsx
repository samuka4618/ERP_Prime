import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle, AlertCircle, Truck, Phone, Calendar, User } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import FormattedDate from '../components/FormattedDate';

interface FornecedorInfo {
  id: number;
  name: string;
  category: string;
}

interface TrackingResponse {
  id: string;
  driver_name: string;
  phone_number?: string;
  fornecedor?: FornecedorInfo;
  submitted_at: string;
  tracking_code?: string;
  phase?: string;
  message?: string | null;
}

const DriverTrackingPage: React.FC = () => {
  const { trackingToken } = useParams<{ trackingToken: string }>();
  const token = trackingToken || '';
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<TrackingResponse | null>(null);
  /** Momento em que o último status foi obtido com sucesso no servidor. */
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  /** Atualizado a cada 1s para o relógio e o contador “há X s” fluírem em tempo real. */
  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/public/tracking/${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Registro não encontrado');
          throw new Error('Erro ao buscar status');
        }
        const data = (await res.json()) as { data?: { response?: TrackingResponse } };
        setResponse(data.data?.response || null);
        setLastSyncAt(new Date());
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erro ao buscar status';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const getStatus = (): {
    type: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    message: string;
    description: string;
  } | null => {
    if (!response) return null;
    const phase = response.phase || 'submitted';
    if (phase === 'completed') {
      return {
        type: 'recebido',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        message: 'RECEBIDO',
        description: 'Descarregamento concluído. Obrigado!'
      };
    }
    if (phase === 'dock_released') {
      return {
        type: 'liberado',
        icon: Truck,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        message: 'LIBERADO PARA DESCARREGAMENTO',
        description:
          'Você foi liberado para a doca. Dirija-se ao local indicado e proceda com o descarregamento.'
      };
    }
    return {
      type: 'aguardando',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      message: 'AGUARDANDO LIBERAÇÃO',
      description: 'Aguarde a liberação para ir à doca e iniciar o descarregamento.'
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!response) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Registro não encontrado</h2>
          <p className="text-gray-600">O código de rastreamento informado não foi encontrado.</p>
        </div>
      </div>
    );
  }

  const status = getStatus();
  if (!status) return null;
  const StatusIcon = status.icon;
  const phase = response.phase || 'submitted';

  const agoraStr = new Date(clockMs).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const secDesdeSync =
    lastSyncAt !== null ? Math.max(0, Math.floor((clockMs - lastSyncAt.getTime()) / 1000)) : null;
  const ultimaLeituraStr =
    lastSyncAt !== null
      ? lastSyncAt.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className={`${status.bgColor} rounded-lg p-6 mb-6 text-center`}>
            <StatusIcon className={`w-16 h-16 ${status.color} mx-auto mb-4`} />
            <h1 className={`text-2xl font-bold ${status.color} mb-2`}>{status.message}</h1>
            <p className="text-gray-700">{status.description}</p>
            {response.message && phase !== 'submitted' && (
              <p className="text-gray-600 text-sm mt-3">{response.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Registro</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Fornecedor</div>
                    <div className="font-medium text-gray-900">{response.fornecedor?.name || 'N/A'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Motorista</div>
                    <div className="font-medium text-gray-900">{response.driver_name}</div>
                  </div>
                </div>

                {response.phone_number && (
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Phone className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Telefone</div>
                      <div className="font-medium text-gray-900">{response.phone_number}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Chegada</div>
                    <div className="font-medium text-gray-900">
                      <FormattedDate date={response.submitted_at} />
                    </div>
                  </div>
                </div>

                {phase === 'completed' && (
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Descarregamento concluído</div>
                      <div className="font-medium text-gray-900">Registro finalizado.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-gray-600 space-y-1">
              <div className="font-mono text-base text-gray-800 tabular-nums">Agora: {agoraStr}</div>
              {ultimaLeituraStr !== null && secDesdeSync !== null && (
                <div className="text-sm">
                  Última leitura no servidor:{' '}
                  <span className="font-mono font-medium tabular-nums">{ultimaLeituraStr}</span>
                  <span className="text-gray-500">
                    {' '}
                    (há <span className="font-mono font-semibold text-blue-700 tabular-nums">{secDesdeSync}</span>s)
                  </span>
                </div>
              )}
              <div className="text-xs text-gray-500 pt-1">
                O status é consultado no servidor a cada 10 segundos; o relógio e o contador atualizam a cada
                segundo.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverTrackingPage;
