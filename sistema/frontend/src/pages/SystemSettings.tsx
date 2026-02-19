import React, { useState, useEffect } from 'react';
import { Settings, Globe, Clock } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

interface SystemConfig {
  key: string;
  value: string;
  description?: string;
}

interface TimezoneConfig {
  timezone: string;
  dateFormat: string;
  availableTimezones: string[];
}

const SystemSettings: React.FC = () => {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [timezoneConfig, setTimezoneConfig] = useState<TimezoneConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const [configsData, timezoneData] = await Promise.all([
        apiService.get('/system-config'),
        apiService.get('/system-config/timezone')
      ]);
      
      setConfigs(configsData.data.configs);
      setTimezoneConfig(timezoneData.data);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: string) => {
    try {
      setSaving(true);
      await apiService.put('/system-config', {
        key,
        value,
        description: `Atualizado em ${new Date().toLocaleString('pt-BR')}`
      });
      
      toast.success('Configuração atualizada com sucesso');
      fetchConfigs(); // Recarregar configurações
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTimezoneChange = (newTimezone: string) => {
    updateConfig('timezone', newTimezone);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configurações do Sistema
            </h1>
          </div>

          {/* Configurações de Timezone */}
          {timezoneConfig && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações de Data e Hora
                </h2>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timezone Atual
                  </label>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {timezoneConfig.timezone}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Alterar Timezone
                  </label>
                  <select
                    value={timezoneConfig.timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white"
                  >
                    {timezoneConfig.availableTimezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <p>Formato de data: {timezoneConfig.dateFormat}</p>
                  <p>Exemplo: {new Date().toLocaleString('pt-BR', { 
                    timeZone: timezoneConfig.timezone,
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                </div>
              </div>
            </div>
          )}

          {/* Lista de todas as configurações */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Todas as Configurações
            </h2>
            
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {config.key}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {config.description || 'Sem descrição'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Valor: {config.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;


