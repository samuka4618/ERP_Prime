import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import axios from 'axios';
import { Settings, Save, Upload, Globe } from 'lucide-react';
import clsx from 'clsx';
import { useSystemConfig } from '../contexts/SystemConfigContext';

interface SystemSettings {
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  reopen_days: number;
  system_name: string;
  system_subtitle: string;
  system_logo: string;
  system_version: string;
  email_notifications: boolean;
  max_file_size: number;
  allowed_file_types: string;
}

const SystemSettings: React.FC = () => {
  // Hook para atualizar o contexto global de configurações
  const { refreshConfig } = useSystemConfig();

  const [settings, setSettings] = useState<SystemSettings>({
    sla_first_response_hours: 4,
    sla_resolution_hours: 24,
    reopen_days: 7,
    system_name: 'ERP PRIME',
    system_subtitle: 'Sistema de Gestão Empresarial',
    system_logo: '',
    system_version: '1.0.0',
    email_notifications: true,
    max_file_size: 10485760,
    allowed_file_types: 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/system/config');
      setSettings(response.data || settings);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // As configurações são GLOBAIS e aplicadas para TODOS os usuários do sistema
      await apiService.put('/system/config', settings);
      
      // Atualizar o contexto global para que todos os componentes vejam as mudanças
      await refreshConfig();
      
      toast.success('Configurações globais salvas com sucesso! Todas as mudanças serão aplicadas para todos os usuários.');
      
      // Recarregar os dados da página
      await fetchData();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedLogoPreview(null);
      return;
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Apenas imagens são aceitas.');
      setSelectedLogoPreview(null);
      event.target.value = '';
      return;
    }

    // Validar tamanho (máximo 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Tamanho máximo: 2MB');
      setSelectedLogoPreview(null);
      event.target.value = '';
      return;
    }

    // Criar preview da imagem
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append('attachment', file);

      // Usar axios diretamente para FormData
      const hostname = window.location.hostname;
      const port = window.location.port || '3004'; // Usar porta atual ou padrão 3004
      const baseURL = hostname === 'localhost' || hostname === '127.0.0.1' 
        ? '/api' 
        : `${window.location.protocol}//${hostname}:${port}/api`;
      
      const response = await axios.post(`${baseURL}/system/logo`, formData, {
        headers: {
          // NÃO definir Content-Type manualmente - o axios/browser define automaticamente com o boundary correto
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      const logoPath = response.data?.data?.logo_path || response.data?.logo_path;
      
      if (logoPath) {
        setSettings(prev => ({
          ...prev,
          system_logo: logoPath
        }));
        
        // Atualizar o contexto global para que todos os componentes vejam o novo logo
        await refreshConfig();
        
        setSelectedLogoPreview(null);
        toast.success('Logo atualizado com sucesso! A mudança será aplicada para todos os usuários.');
      } else {
        console.warn('Resposta não contém logo_path:', response.data);
        toast.error('Resposta inesperada do servidor');
        setSelectedLogoPreview(null);
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload do logo:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Erro ao fazer upload do logo';
      toast.error(errorMessage);
      setSelectedLogoPreview(null);
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Configurações do Sistema
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie as configurações gerais do {settings.system_name || 'ERP PRIME'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configurações Gerais */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Configurações Gerais
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Sistema
                </label>
                <input
                  type="text"
                  value={settings.system_name}
                  onChange={(e) => handleInputChange('system_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: ERP PRIME"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subtítulo do Sistema
                </label>
                <input
                  type="text"
                  value={settings.system_subtitle || ''}
                  onChange={(e) => handleInputChange('system_subtitle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Sistema de Gestão Empresarial"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Logo do Sistema
                </label>
                <div className="space-y-3">
                  {selectedLogoPreview && !uploadingLogo && (
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <img 
                        src={selectedLogoPreview} 
                        alt="Preview do novo logo"
                        className="w-16 h-16 object-contain rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Nova imagem selecionada
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Clique em "Salvar Configurações" para aplicar
                        </p>
                      </div>
                    </div>
                  )}

                  {settings.system_logo && !selectedLogoPreview && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <img 
                        src={`/${settings.system_logo}`} 
                        alt="Logo atual"
                        className="w-16 h-16 object-contain rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Logo atual configurado
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                          {settings.system_logo}
                        </p>
                      </div>
                    </div>
                  )}

                  <label className={clsx(
                    "flex items-center justify-center w-full px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition-colors",
                    uploadingLogo 
                      ? "border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20" 
                      : "border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-500"
                  )}>
                    <div className="flex flex-col items-center">
                      {uploadingLogo ? (
                        <>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mb-2"></div>
                          <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">Enviando...</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Aguarde, não feche esta página</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {settings.system_logo ? 'Alterar Logo' : 'Enviar Logo'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            PNG, JPG, GIF ou SVG (máx. 2MB)
                          </span>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Versão do Sistema
                </label>
                <input
                  type="text"
                  value={settings.system_version}
                  onChange={(e) => handleInputChange('system_version', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                <input
                  type="checkbox"
                  checked={settings.email_notifications}
                  onChange={(e) => handleInputChange('email_notifications', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded flex-shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Notificações por email</span>
              </label>
            </div>
          </div>

          {/* Configurações de SLA */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Configurações de SLA
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Primeira Resposta (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={settings.sla_first_response_hours}
                  onChange={(e) => handleInputChange('sla_first_response_hours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tempo máximo para primeira resposta em horas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resolução (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={settings.sla_resolution_hours}
                  onChange={(e) => handleInputChange('sla_resolution_hours', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tempo máximo para resolução em horas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dias para Reabrir
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.reopen_days}
                  onChange={(e) => handleInputChange('reopen_days', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Dias para reabrir chamado após resolução
                </p>
              </div>
            </div>
          </div>

          {/* Configurações de Arquivos */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Configurações de Arquivos
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tamanho Máximo (bytes)
                </label>
                <input
                  type="number"
                  min="1048576"
                  max="104857600"
                  value={settings.max_file_size}
                  onChange={(e) => handleInputChange('max_file_size', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Tamanho máximo: {Math.round(settings.max_file_size / 1024 / 1024)} MB
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipos de Arquivo Permitidos
                </label>
                <input
                  type="text"
                  value={settings.allowed_file_types}
                  onChange={(e) => handleInputChange('allowed_file_types', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Separe os tipos por vírgula (ex: pdf,doc,docx)
                </p>
              </div>
            </div>
          </div>

          {/* Configurações de Timezone */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Configurações de Data e Hora
              </h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white">
                  <option value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</option>
                  <option value="America/New_York">America/New_York (Nova York)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Los Angeles)</option>
                  <option value="Europe/London">Europe/London (Londres)</option>
                  <option value="Europe/Paris">Europe/Paris (Paris)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (Tóquio)</option>
                  <option value="UTC">UTC</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Timezone padrão do sistema
                </p>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Horário atual do sistema:</p>
                <p className="font-mono">
                  {new Date().toLocaleString('pt-BR', { 
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
