import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import axios from 'axios';
import { Category, CategoryField } from '../types';
import ThemeDemo from '../components/ThemeDemo';
import { ClientConfigManager } from '../components/ClientConfigManager';
import { Settings, Save, Plus, Edit, Trash2, Globe, Building2, X, Upload } from 'lucide-react';
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

interface TicketStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

interface NewCategory {
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  custom_fields?: CategoryField[];
}

const SystemConfig: React.FC = () => {
  // Hook para atualizar o contexto global de configurações
  const { refreshConfig } = useSystemConfig();

  // Scroll para seção quando há hash na URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, []);

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

  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState<NewCategory>({
    name: '',
    description: '',
    sla_first_response_hours: 4,
    sla_resolution_hours: 24,
    custom_fields: []
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoPreview, setSelectedLogoPreview] = useState<string | null>(null);

  // Statuses padrão do sistema
  const defaultStatuses: TicketStatus[] = [
    { id: 'open', name: 'Aberto', description: 'Chamado recém-criado', color: '#ef4444', is_active: true },
    { id: 'in_progress', name: 'Em Andamento', description: 'Chamado sendo atendido', color: '#f59e0b', is_active: true },
    { id: 'pending_user', name: 'Aguardando Usuário', description: 'Aguardando resposta do usuário', color: '#3b82f6', is_active: true },
    { id: 'pending_attendant', name: 'Aguardando Atendente', description: 'Aguardando resposta do atendente', color: '#8b5cf6', is_active: true },
    { id: 'resolved', name: 'Resolvido', description: 'Chamado resolvido', color: '#10b981', is_active: true },
    { id: 'closed', name: 'Fechado', description: 'Chamado fechado', color: '#6b7280', is_active: true }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsData, categoriesData] = await Promise.all([
        apiService.get('/system/config'),
        apiService.get('/categories')
      ]);
      
      setSettings(settingsData.data || settings);
      // A API retorna { data: { data: [...], total: 7, page: 1, ... } }
      const categoriesArray = categoriesData.data?.data || categoriesData.data || [];
      setCategories(Array.isArray(categoriesArray) ? categoriesArray : []);
      setStatuses(defaultStatuses);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações');
      // Manter valores padrão em caso de erro
      setCategories([]);
      setStatuses(defaultStatuses);
    } finally {
      setLoading(false);
    }
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

      console.log('Resposta do upload:', response.data);

      // A API retorna { message: '...', data: { logo_path: '...', logo_url: '...' } }
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
      // Limpar o input
      event.target.value = '';
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateCategory = (category: NewCategory | Category) => {
    const newErrors: {[key: string]: string} = {};

    if (!category.name.trim()) {
      newErrors.name = 'Nome da categoria é obrigatório';
    }

    if (!category.description.trim()) {
      newErrors.description = 'Descrição da categoria é obrigatória';
    }

    if (category.sla_first_response_hours < 1 || category.sla_first_response_hours > 168) {
      newErrors.sla_first_response_hours = 'SLA primeira resposta deve estar entre 1 e 168 horas';
    }

    if (category.sla_resolution_hours < 1 || category.sla_resolution_hours > 720) {
      newErrors.sla_resolution_hours = 'SLA resolução deve estar entre 1 e 720 horas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Funções para gerenciar campos customizados
  const addCustomField = (_category: NewCategory | Category, isNew: boolean) => {
    const newField: CategoryField = {
      id: `field_${Date.now()}`,
      name: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      description: ''
    };

    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: [...(prev.custom_fields || []), newField]
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: [...(prev.custom_fields || []), newField]
      } : null);
    }
  };

  const removeCustomField = (fieldId: string, isNew: boolean) => {
    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).filter(f => f.id !== fieldId)
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: (prev.custom_fields || []).filter(f => f.id !== fieldId)
      } : null);
    }
  };

  const updateCustomField = (fieldId: string, updates: Partial<CategoryField>, isNew: boolean) => {
    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => 
          f.id === fieldId ? { ...f, ...updates } : f
        )
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => 
          f.id === fieldId ? { ...f, ...updates } : f
        )
      } : null);
    }
  };

  const handleCreateCategory = async () => {
    if (!validateCategory(newCategory)) {
      return;
    }

    try {
      const categoryData = {
        ...newCategory,
        custom_fields: newCategory.custom_fields?.filter(f => f.name && f.label) || []
      };
      await apiService.post('/categories', categoryData);
      toast.success('Categoria criada com sucesso');
      setNewCategory({
        name: '',
        description: '',
        sla_first_response_hours: 4,
        sla_resolution_hours: 24,
        custom_fields: []
      });
      setShowNewCategory(false);
      setErrors({});
      fetchData();
    } catch (error: any) {
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.join(', ');
        toast.error(`Erro de validação: ${errorMessages}`);
      } else {
        toast.error('Erro ao criar categoria');
      }
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowEditCategory(true);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    if (!validateCategory(editingCategory)) {
      return;
    }

    try {
      const categoryData = {
        name: editingCategory.name,
        description: editingCategory.description,
        sla_first_response_hours: editingCategory.sla_first_response_hours,
        sla_resolution_hours: editingCategory.sla_resolution_hours,
        custom_fields: editingCategory.custom_fields?.filter(f => f.name && f.label) || []
      };
      await apiService.put(`/categories/${editingCategory.id}`, categoryData);
      
      toast.success('Categoria atualizada com sucesso');
      setShowEditCategory(false);
      setEditingCategory(null);
      setErrors({});
      fetchData();
    } catch (error: any) {
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.join(', ');
        toast.error(`Erro de validação: ${errorMessages}`);
      } else {
        toast.error('Erro ao atualizar categoria');
      }
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta categoria?')) {
      return;
    }

    try {
      await apiService.delete(`/categories/${id}`);
      toast.success('Categoria excluída com sucesso');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir categoria');
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
                  {/* Preview da imagem selecionada (antes do upload) */}
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

                  {/* Logo atual configurado */}
                  {settings.system_logo && !selectedLogoPreview && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <img 
                        src={`/${settings.system_logo}`} 
                        alt="Logo atual"
                        className="w-16 h-16 object-contain rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center';
                            fallback.textContent = 'Logo';
                            parent.insertBefore(fallback, target);
                          }
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

                  {/* Área de upload */}
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

        {/* Categorias */}
        <div id="categorias" className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 scroll-mt-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Categorias de Chamados
            </h2>
            <button
              onClick={() => setShowNewCategory(!showNewCategory)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Categoria</span>
            </button>
          </div>

          {/* Formulário de Nova Categoria */}
          {showNewCategory && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Criar Nova Categoria
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newCategory.name}
                    onChange={(e) => {
                      setNewCategory(prev => ({ ...prev, name: e.target.value }));
                      if (errors.name) {
                        setErrors(prev => ({ ...prev, name: '' }));
                      }
                    }}
                    rows={2}
                    placeholder="Digite o nome da categoria..."
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white resize-vertical ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descrição <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newCategory.description}
                    onChange={(e) => {
                      setNewCategory(prev => ({ ...prev, description: e.target.value }));
                      if (errors.description) {
                        setErrors(prev => ({ ...prev, description: '' }));
                      }
                    }}
                    rows={3}
                    placeholder="Digite uma descrição detalhada da categoria..."
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white resize-vertical ${
                      errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SLA Primeira Resposta (horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={newCategory.sla_first_response_hours}
                    onChange={(e) => {
                      setNewCategory(prev => ({ ...prev, sla_first_response_hours: parseInt(e.target.value) }));
                      if (errors.sla_first_response_hours) {
                        setErrors(prev => ({ ...prev, sla_first_response_hours: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white ${
                      errors.sla_first_response_hours ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.sla_first_response_hours && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sla_first_response_hours}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SLA Resolução (horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={newCategory.sla_resolution_hours}
                    onChange={(e) => {
                      setNewCategory(prev => ({ ...prev, sla_resolution_hours: parseInt(e.target.value) }));
                      if (errors.sla_resolution_hours) {
                        setErrors(prev => ({ ...prev, sla_resolution_hours: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white ${
                      errors.sla_resolution_hours ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.sla_resolution_hours && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sla_resolution_hours}</p>
                  )}
                </div>
              </div>

              {/* Campos Customizados */}
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">
                      Perguntas do Formulário de Chamados
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Defina quais perguntas aparecerão quando o usuário criar um chamado nesta categoria. 
                      Você pode escolher quais campos exibir, quais são obrigatórios e adicionar novos campos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCustomField(newCategory, true)}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Pergunta</span>
                  </button>
                </div>
                
                {(newCategory.custom_fields || []).map((field, index) => (
                  <div key={field.id} className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pergunta {index + 1}
                        </span>
                        {field.required && (
                          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">
                            Obrigatória
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id, true)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Remover pergunta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nome Interno *
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateCustomField(field.id, { name: e.target.value }, true)}
                          placeholder="ex: payment_data"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Label (Exibido) *
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.id, { label: e.target.value }, true)}
                          placeholder="ex: Dados de Pagamento"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tipo *
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) => updateCustomField(field.id, { type: e.target.value as CategoryField['type'] }, true)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        >
                          <option value="text">Texto</option>
                          <option value="textarea">Área de Texto</option>
                          <option value="number">Número</option>
                          <option value="email">Email</option>
                          <option value="date">Data</option>
                          <option value="select">Seleção</option>
                          <option value="file">Arquivo</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomField(field.id, { required: e.target.checked }, true)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300 select-none">Campo obrigatório</span>
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Opções (separadas por vírgula)
                          </label>
                          <input
                            type="text"
                            value={field.options?.join(', ') || ''}
                            onChange={(e) => updateCustomField(field.id, { 
                              options: e.target.value.split(',').map(o => o.trim()).filter(o => o) 
                            }, true)}
                            placeholder="ex: Opção 1, Opção 2, Opção 3"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateCustomField(field.id, { placeholder: e.target.value }, true)}
                          placeholder="Texto de exemplo no campo"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Descrição/Ajuda
                        </label>
                        <input
                          type="text"
                          value={field.description || ''}
                          onChange={(e) => updateCustomField(field.id, { description: e.target.value }, true)}
                          placeholder="Texto de ajuda para o usuário"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(!newCategory.custom_fields || newCategory.custom_fields.length === 0) && (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Nenhuma pergunta customizada adicionada ainda.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Os campos padrão (Assunto, Descrição, Prioridade) serão exibidos. 
                      Clique em "Adicionar Pergunta" para criar campos personalizados.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setShowNewCategory(false);
                    setErrors({});
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCategory}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Criar Categoria
                </button>
              </div>
            </div>
          )}

          {/* Modal de Edição de Categoria */}
          {showEditCategory && editingCategory && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Editar Categoria
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingCategory.name}
                    onChange={(e) => {
                      setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null);
                      if (errors.name) {
                        setErrors(prev => ({ ...prev, name: '' }));
                      }
                    }}
                    rows={2}
                    placeholder="Digite o nome da categoria..."
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white resize-vertical ${
                      errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descrição <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingCategory.description}
                    onChange={(e) => {
                      setEditingCategory(prev => prev ? { ...prev, description: e.target.value } : null);
                      if (errors.description) {
                        setErrors(prev => ({ ...prev, description: '' }));
                      }
                    }}
                    rows={3}
                    placeholder="Digite uma descrição detalhada da categoria..."
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white resize-vertical ${
                      errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SLA Primeira Resposta (horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={editingCategory.sla_first_response_hours}
                    onChange={(e) => {
                      setEditingCategory(prev => prev ? { ...prev, sla_first_response_hours: parseInt(e.target.value) } : null);
                      if (errors.sla_first_response_hours) {
                        setErrors(prev => ({ ...prev, sla_first_response_hours: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white ${
                      errors.sla_first_response_hours ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.sla_first_response_hours && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sla_first_response_hours}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SLA Resolução (horas)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={editingCategory.sla_resolution_hours}
                    onChange={(e) => {
                      setEditingCategory(prev => prev ? { ...prev, sla_resolution_hours: parseInt(e.target.value) } : null);
                      if (errors.sla_resolution_hours) {
                        setErrors(prev => ({ ...prev, sla_resolution_hours: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-white ${
                      errors.sla_resolution_hours ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors.sla_resolution_hours && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.sla_resolution_hours}</p>
                  )}
                </div>
              </div>

              {/* Campos Customizados */}
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">
                      Perguntas do Formulário de Chamados
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Defina quais perguntas aparecerão quando o usuário criar um chamado nesta categoria. 
                      Você pode escolher quais campos exibir, quais são obrigatórios e adicionar novos campos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCustomField(editingCategory, false)}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Pergunta</span>
                  </button>
                </div>
                
                {(editingCategory.custom_fields || []).map((field, index) => (
                  <div key={field.id} className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Pergunta {index + 1}
                        </span>
                        {field.required && (
                          <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">
                            Obrigatória
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomField(field.id, false)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Remover pergunta"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nome Interno *
                        </label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateCustomField(field.id, { name: e.target.value }, false)}
                          placeholder="ex: payment_data"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Label (Exibido) *
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateCustomField(field.id, { label: e.target.value }, false)}
                          placeholder="ex: Dados de Pagamento"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tipo *
                        </label>
                        <select
                          value={field.type}
                          onChange={(e) => updateCustomField(field.id, { type: e.target.value as CategoryField['type'] }, false)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        >
                          <option value="text">Texto</option>
                          <option value="textarea">Área de Texto</option>
                          <option value="number">Número</option>
                          <option value="email">Email</option>
                          <option value="date">Data</option>
                          <option value="select">Seleção</option>
                          <option value="file">Arquivo</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomField(field.id, { required: e.target.checked }, false)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 flex-shrink-0"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300 select-none">Campo obrigatório</span>
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Opções (separadas por vírgula)
                          </label>
                          <input
                            type="text"
                            value={field.options?.join(', ') || ''}
                            onChange={(e) => updateCustomField(field.id, { 
                              options: e.target.value.split(',').map(o => o.trim()).filter(o => o) 
                            }, false)}
                            placeholder="ex: Opção 1, Opção 2, Opção 3"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Placeholder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateCustomField(field.id, { placeholder: e.target.value }, false)}
                          placeholder="Texto de exemplo no campo"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Descrição/Ajuda
                        </label>
                        <input
                          type="text"
                          value={field.description || ''}
                          onChange={(e) => updateCustomField(field.id, { description: e.target.value }, false)}
                          placeholder="Texto de ajuda para o usuário"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {(!editingCategory.custom_fields || editingCategory.custom_fields.length === 0) && (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Nenhuma pergunta customizada adicionada ainda.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Os campos padrão (Assunto, Descrição, Prioridade) serão exibidos. 
                      Clique em "Adicionar Pergunta" para criar campos personalizados.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => {
                    setShowEditCategory(false);
                    setEditingCategory(null);
                    setErrors({});
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateCategory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Atualizar Categoria
                </button>
              </div>
            </div>
          )}

          {/* Lista de Categorias */}
          <div className="space-y-3">
            {Array.isArray(categories) && categories.length > 0 ? categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {category.description}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    SLA: {category.sla_first_response_hours}h primeira resposta, {category.sla_resolution_hours}h resolução
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleEditCategory(category)}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Editar categoria"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nenhuma categoria encontrada</p>
                <p className="text-sm">Clique em "Nova Categoria" para criar uma</p>
              </div>
            )}
          </div>
        </div>

        {/* Statuses do Sistema */}
        <div id="status" className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 scroll-mt-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Status de Chamados
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statuses.map((status) => (
              <div key={status.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: status.color }}
                ></div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {status.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {status.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configurações de Cadastro de Clientes */}
        <div id="cadastros" className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 scroll-mt-4">
          <div className="flex items-center space-x-3 mb-6">
            <Building2 className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurações de Cadastro de Clientes
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClientConfigManager
              type="ramo_atividade"
              title="Ramos de Atividade"
              placeholder="Adicionar novo ramo de atividade..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="vendedor"
              title="Vendedores"
              placeholder="Adicionar novo vendedor..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="gestor"
              title="Gestores"
              placeholder="Adicionar novo gestor..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="codigo_carteira"
              title="Códigos de Carteira"
              placeholder="Adicionar novo código..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="lista_preco"
              title="Listas de Preço"
              placeholder="Adicionar nova lista..."
              onUpdate={() => {}}
            />

            <ClientConfigManager
              type="forma_pagamento_desejada"
              title="Formas de Pagamento"
              placeholder="Adicionar nova forma..."
              onUpdate={() => {}}
            />
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

        {/* Demo do Tema */}
        <div className="mt-8">
          <ThemeDemo />
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;