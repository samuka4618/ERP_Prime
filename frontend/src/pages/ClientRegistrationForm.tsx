import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, X, Building, Phone, Briefcase, DollarSign } from 'lucide-react';
import { CreateClientRegistrationRequest, ClientConfigOptions } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const ClientRegistrationForm: React.FC = () => {
  const { } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configOptions, setConfigOptions] = useState<ClientConfigOptions | null>(null);
  const isEditing = !!id;
  
  const [formData, setFormData] = useState<Partial<CreateClientRegistrationRequest>>({
    nome_cliente: '',
    nome_fantasia: '',
    cnpj: '',
    email: '',
    ramo_atividade_id: 0,
    vendedor_id: 0,
    gestor_id: 0,
    codigo_carteira_id: 0,
    lista_preco_id: 0,
    forma_pagamento_desejada_id: 0,
    prazo_desejado: undefined,
    periodicidade_pedido: '',
    valor_estimado_pedido: undefined,
    forma_contato: '',
    whatsapp_cliente: '',
    rede_social: '',
    link_google_maps: ''
  });

  const [files, setFiles] = useState<{ 
    imagem_externa: File | null;
    imagem_interna: File | null;
    anexos: File[];
  }>({
    imagem_externa: null,
    imagem_interna: null,
    anexos: []
  });

  const [existingImages, setExistingImages] = useState<{ imagem_externa_path?: string; imagem_interna_path?: string }>({});

  const normalizePath = (p?: string) => {
    if (!p) return '';
    const s = p.replace(/\\/g, '/');
    return s.startsWith('/') ? s : `/${s}`;
  };

  const renderImagemExterna = () => {
    if (files.imagem_externa) {
      return (
        <div className="flex items-center justify-center">
          <img src={URL.createObjectURL(files.imagem_externa)} alt="Imagem externa" className="h-32 w-32 object-cover rounded-md" />
          <button type="button" onClick={() => handleFileChange('imagem_externa', null)} className="ml-2 p-1 text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    if (isEditing && !!existingImages.imagem_externa_path) {
      return (
        <div className="flex items-center justify-center">
          <img
            src={normalizePath(existingImages.imagem_externa_path)}
            alt="Imagem externa atual"
            className="h-32 w-32 object-cover rounded-md"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => setExistingImages(prev => ({ ...prev, imagem_externa_path: undefined }))}
            className="ml-2 p-1 text-yellow-600 hover:text-yellow-800"
            title="Substituir imagem"
          >
            <span>Substituir</span>
          </button>
        </div>
      );
    }
    return (
      <div>
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <div className="flex text-sm text-gray-600 dark:text-gray-400">
          <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
            <span>Selecionar arquivo</span>
            <input type="file" accept="image/*" onChange={(e) => handleFileChange('imagem_externa', e.target.files?.[0] || null)} className="sr-only" required={!isEditing} />
          </label>
          <p className="pl-1">ou arraste e solte</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF até 10MB</p>
      </div>
    );
  };

  const renderImagemInterna = () => {
    if (files.imagem_interna) {
      return (
        <div className="flex items-center justify-center">
          <img src={URL.createObjectURL(files.imagem_interna)} alt="Imagem interna" className="h-32 w-32 object-cover rounded-md" />
          <button type="button" onClick={() => handleFileChange('imagem_interna', null)} className="ml-2 p-1 text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    if (isEditing && !!existingImages.imagem_interna_path) {
      return (
        <div className="flex items-center justify-center">
          <img
            src={normalizePath(existingImages.imagem_interna_path)}
            alt="Imagem interna atual"
            className="h-32 w-32 object-cover rounded-md"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={() => setExistingImages(prev => ({ ...prev, imagem_interna_path: undefined }))}
            className="ml-2 p-1 text-yellow-600 hover:text-yellow-800"
            title="Substituir imagem"
          >
            <span>Substituir</span>
          </button>
        </div>
      );
    }
    return (
      <div>
        <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
        <div className="flex text-sm text-gray-600 dark:text-gray-400">
          <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
            <span>Selecionar arquivo</span>
            <input type="file" accept="image/*" onChange={(e) => handleFileChange('imagem_interna', e.target.files?.[0] || null)} className="sr-only" required={!isEditing} />
          </label>
          <p className="pl-1">ou arraste e solte</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF até 10MB</p>
      </div>
    );
  };


  useEffect(() => {
    loadConfigOptions();
    if (isEditing && id) {
      loadExistingData();
    }
  }, [id]);

  const loadExistingData = async () => {
    try {
      setLoading(true);
      const result = await apiService.getClientRegistration(parseInt(id!));
      const data = result.registration;
      
      // Preencher o formulário com os dados existentes
      setFormData({
        nome_cliente: data.nome_cliente,
        nome_fantasia: data.nome_fantasia || '',
        cnpj: data.cnpj,
        email: data.email,
        ramo_atividade_id: data.ramo_atividade_id,
        vendedor_id: data.vendedor_id,
        gestor_id: data.gestor_id,
        codigo_carteira_id: data.codigo_carteira_id,
        lista_preco_id: data.lista_preco_id,
        forma_pagamento_desejada_id: data.forma_pagamento_desejada_id,
        prazo_desejado: data.prazo_desejado,
        periodicidade_pedido: data.periodicidade_pedido || '',
        valor_estimado_pedido: data.valor_estimado_pedido,
        forma_contato: data.forma_contato || '',
        whatsapp_cliente: data.whatsapp_cliente || '',
        rede_social: data.rede_social || '',
        link_google_maps: data.link_google_maps || ''
      });
      setExistingImages({
        imagem_externa_path: data.imagem_externa_path,
        imagem_interna_path: data.imagem_interna_path
      });
    } catch (err) {
      setError('Erro ao carregar dados do cadastro');
      console.error('Erro ao carregar cadastro:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigOptions = async () => {
    try {
      const options = await apiService.getClientConfigOptions();
      console.log('Config options loaded:', options);
      setConfigOptions(options);
    } catch (err) {
      setError('Erro ao carregar opções de configuração');
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('_id') || name === 'prazo_desejado' || name === 'valor_estimado_pedido' 
        ? (value ? parseInt(value) : undefined)
        : value
    }));
  };

  const handleFileChange = (field: 'imagem_externa' | 'imagem_interna', file: File | null) => {
    setFiles(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleAnexosChange = (newFiles: File[]) => {
    setFiles(prev => ({
      ...prev,
      anexos: newFiles
    }));
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, '');
    if (cleaned.length <= 14) {
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setFormData(prev => ({
      ...prev,
      cnpj: formatted
    }));
  };

  const validateForm = (): string | null => {
    if (!formData.nome_cliente) return 'Nome do cliente é obrigatório';
    if (!formData.cnpj) return 'CNPJ é obrigatório';
    if (!formData.email) return 'Email é obrigatório';
    if (!formData.ramo_atividade_id) return 'Ramo de atividade é obrigatório';
    if (!formData.vendedor_id) return 'Vendedor é obrigatório';
    if (!formData.gestor_id) return 'Gestor é obrigatório';
    if (!formData.codigo_carteira_id) return 'Código da carteira é obrigatório';
    if (!formData.lista_preco_id) return 'Lista de preço é obrigatória';
    if (!formData.forma_pagamento_desejada_id) return 'Forma de pagamento desejada é obrigatória';
    if (!isEditing) {
      if (!files.imagem_externa) return 'Imagem externa é obrigatória';
      if (!files.imagem_interna) return 'Imagem interna é obrigatória';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 [FRONTEND] Formulário submetido, validando...');
    console.log('📝 [FRONTEND] Dados do formulário:', formData);
    console.log('📁 [FRONTEND] Arquivos:', files);
    
    const validationError = validateForm();
    if (validationError) {
      console.log('❌ [FRONTEND] Erro de validação:', validationError);
      setError(validationError);
      return;
    }
    
    console.log('✅ [FRONTEND] Validação passou, enviando dados...');

    try {
      setLoading(true);
      setError(null);

      const formDataToSend = new FormData();
      
      // Adicionar dados do formulário
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formDataToSend.append(key, String(value));
        }
      });

      // Adicionar arquivos
      if (files.imagem_externa) {
        formDataToSend.append('imagem_externa', files.imagem_externa);
      }
      if (files.imagem_interna) {
        formDataToSend.append('imagem_interna', files.imagem_interna);
      }
      files.anexos.forEach((file) => {
        formDataToSend.append('anexos', file);
      });

      if (isEditing && id) {
        await apiService.updateClientRegistration(parseInt(id), formDataToSend);
        navigate('/client-registrations', { 
          state: { message: 'Cadastro atualizado com sucesso!' }
        });
      } else {
        // Se estiver criando novo, fazer POST
        await apiService.createClientRegistration(formDataToSend);
        navigate('/client-registrations', { 
          state: { message: 'Cadastro de cliente criado com sucesso!' }
        });
      }
    } catch (err) {
      setError('Erro ao criar cadastro de cliente');
      console.error('Erro ao criar cadastro:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!configOptions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/client-registrations')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Editar Cadastro de Cliente' : 'Novo Cadastro de Cliente'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isEditing ? 'Edite os dados do cadastro' : 'Preencha os dados do cliente para enviar o cadastro'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Informações Básicas */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 dark:border dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Building className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Informações Básicas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nome do Cliente *
              </label>
              <input
                type="text"
                name="nome_cliente"
                value={formData.nome_cliente || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Nome Fantasia
              </label>
              <input
                type="text"
                name="nome_fantasia"
                value={formData.nome_fantasia || ''}
                onChange={handleInputChange}
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                CNPJ *
              </label>
              <input
                type="text"
                name="cnpj"
                value={formData.cnpj || ''}
                onChange={handleCNPJChange}
                placeholder="00.000.000/0000-00"
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* Configurações Comerciais */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 dark:border dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Briefcase className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Configurações Comerciais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Ramo de Atividade *
              </label>
              <select
                name="ramo_atividade_id"
                value={formData.ramo_atividade_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.ramo_atividade?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Vendedor *
              </label>
              <select
                name="vendedor_id"
                value={formData.vendedor_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.vendedor?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Gestor *
              </label>
              <select
                name="gestor_id"
                value={formData.gestor_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.gestor?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Código da Carteira *
              </label>
              <select
                name="codigo_carteira_id"
                value={formData.codigo_carteira_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.codigo_carteira?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Lista de Preço *
              </label>
              <select
                name="lista_preco_id"
                value={formData.lista_preco_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.lista_preco?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Forma de Pagamento Desejada *
              </label>
              <select
                name="forma_pagamento_desejada_id"
                value={formData.forma_pagamento_desejada_id || ''}
                onChange={handleInputChange}
                className="input w-full"
                required
              >
                <option value="">Selecione...</option>
                {configOptions?.forma_pagamento_desejada?.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.nome}
                  </option>
                )) || []}
              </select>
            </div>
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 dark:border dark:border-gray-700">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Informações Adicionais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Prazo Desejado (dias)
              </label>
              <input
                type="number"
                name="prazo_desejado"
                value={formData.prazo_desejado || ''}
                onChange={handleInputChange}
                min="1"
                max="365"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Periodicidade de Pedido
              </label>
              <input
                type="text"
                name="periodicidade_pedido"
                value={formData.periodicidade_pedido || ''}
                onChange={handleInputChange}
                placeholder="Ex: Mensal, Quinzenal, Semanal"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Valor Estimado de Pedido (R$)
              </label>
              <input
                type="number"
                name="valor_estimado_pedido"
                value={formData.valor_estimado_pedido || ''}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Forma de Contato
              </label>
              <input
                type="text"
                name="forma_contato"
                value={formData.forma_contato || ''}
                onChange={handleInputChange}
                placeholder="Ex: Telefone, Email, WhatsApp"
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Contato e Redes Sociais */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 dark:border dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Contato e Redes Sociais</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                WhatsApp do Cliente
              </label>
              <input
                type="text"
                name="whatsapp_cliente"
                value={formData.whatsapp_cliente || ''}
                onChange={handleInputChange}
                placeholder="(11) 99999-9999"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Rede Social
              </label>
              <input
                type="text"
                name="rede_social"
                value={formData.rede_social || ''}
                onChange={handleInputChange}
                placeholder="Instagram, Facebook, LinkedIn"
                className="input w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Link do Google Maps
              </label>
              <input
                type="url"
                name="link_google_maps"
                value={formData.link_google_maps || ''}
                onChange={handleInputChange}
                placeholder="https://maps.google.com/..."
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* Upload de Imagens */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 dark:border dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Imagens e Anexos</h2>
          </div>
          
          <div className="space-y-6">
            {/** Flags para simplificar condicionais */}
            {(() => { return null; })()}
            {/* Imagem Externa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Imagem Externa {isEditing ? '(Atual)' : '* (Obrigatória)'}
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">{renderImagemExterna()}</div>
              </div>
            </div>

            {/* Imagem Interna */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Imagem Interna {isEditing ? '(Atual)' : '* (Obrigatória)'}
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">{renderImagemInterna()}</div>
              </div>
            </div>

            {/* Anexos Opcionais */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Anexos (Opcional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                      <span>Selecionar arquivos</span>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleAnexosChange(Array.from(e.target.files || []))}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">ou arraste e solte</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF, DOC, XLS, imagens até 10MB cada</p>
                </div>
              </div>
              
              {files.anexos.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Arquivos selecionados:</h4>
                  <div className="space-y-2">
                    {files.anexos.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <span className="text-sm text-gray-700 dark:text-gray-200">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleAnexosChange(files.anexos.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/client-registrations')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isEditing ? 'Salvando...' : 'Enviando...') : (isEditing ? 'Salvar Alterações' : 'Enviar Cadastro')}
          </button>
        </div>
      </form>
    </div>
  );
};
