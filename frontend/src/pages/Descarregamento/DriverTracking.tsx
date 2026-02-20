import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle, AlertCircle, Truck, Phone, Calendar, User } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import FormattedDate from '../../components/FormattedDate';

interface FormResponse {
  id: number;
  driver_name: string;
  phone_number?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
  submitted_at: string;
  checked_out_at?: string;
  is_in_yard: boolean;
  tracking_code?: string;
}

const DriverTracking: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<FormResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (trackingCode) {
      fetchStatus();
      // Atualizar a cada 10 segundos
      const interval = setInterval(() => {
        fetchStatus();
        setLastUpdate(new Date());
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [trackingCode]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/descarregamento/form-responses/public/tracking/${trackingCode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Registro não encontrado');
        }
        throw new Error('Erro ao buscar status');
      }

      const data = await response.json();
      setResponse(data.data?.response || null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar status');
    } finally {
      setLoading(false);
    }
  };

  const getStatus = () => {
    if (!response) return null;
    
    if (response.checked_out_at || !response.is_in_yard) {
      return {
        type: 'liberado',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        message: 'LIBERADO PARA DESCARREGAMENTO!',
        description: 'Você pode proceder com o descarregamento.'
      };
    }
    
    return {
      type: 'aguardando',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      message: 'AGUARDANDO LIBERAÇÃO',
      description: 'Aguarde a liberação para iniciar o descarregamento.'
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
          <p className="text-gray-600">
            O código de rastreamento informado não foi encontrado.
          </p>
        </div>
      </div>
    );
  }

  const status = getStatus();
  if (!status) return null;

  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Status Card */}
          <div className={`${status.bgColor} rounded-lg p-6 mb-6 text-center`}>
            <StatusIcon className={`w-16 h-16 ${status.color} mx-auto mb-4`} />
            <h1 className={`text-2xl font-bold ${status.color} mb-2`}>
              {status.message}
            </h1>
            <p className="text-gray-700">{status.description}</p>
          </div>

          {/* Informações */}
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
                    <div className="font-medium text-gray-900">
                      {response.fornecedor?.name || 'N/A'}
                    </div>
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

                {response.checked_out_at && (
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500">Liberado em</div>
                      <div className="font-medium text-gray-900">
                        <FormattedDate date={response.checked_out_at} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Informação de atualização */}
            <div className="text-center text-sm text-gray-500">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
              <br />
              <span className="text-xs">Atualização automática a cada 10 segundos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverTracking;
