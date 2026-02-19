import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Settings } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import { Category, CategoryField } from '../types';

const CreateTicket: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category_id: '',
    subject: '',
    description: '',
    priority: 'medium'
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiService.get('/categories/active');
      
      // A estrutura real é: response.data.categories
      if (response && response.data && response.data.categories && Array.isArray(response.data.categories)) {
        setCategories(response.data.categories);
      } else if (response && response.data && Array.isArray(response.data)) {
        setCategories(response.data);
      } else if (Array.isArray(response)) {
        setCategories(response);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'category_id') {
      // Quando a categoria muda, buscar os campos customizados
      const category = categories.find(c => c.id.toString() === value);
      setSelectedCategory(category || null);
      // Limpar dados dos campos customizados anteriores
      setCustomFieldsData({});
      
      setFormData({
        ...formData,
        [name]: value
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldsData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category_id || !formData.subject || !formData.description) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar se category_id é um número válido
    const categoryId = parseInt(formData.category_id);
    if (isNaN(categoryId) || categoryId <= 0) {
      toast.error('Selecione uma categoria válida');
      return;
    }

    // Validação de tamanho mínimo
    if (formData.description.trim().length < 10) {
      toast.error('A descrição deve ter pelo menos 10 caracteres');
      return;
    }

    if (formData.subject.trim().length < 5) {
      toast.error('O assunto deve ter pelo menos 5 caracteres');
      return;
    }

    // Validar campos customizados obrigatórios
    if (selectedCategory?.custom_fields) {
      const missingRequiredFields = selectedCategory.custom_fields
        .filter(field => field.required && !customFieldsData[field.name])
        .map(field => field.label);
      
      if (missingRequiredFields.length > 0) {
        toast.error(`Preencha os campos obrigatórios: ${missingRequiredFields.join(', ')}`);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      // Criar o chamado primeiro
      const ticketData = {
        category_id: categoryId,
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        custom_data: Object.keys(customFieldsData).length > 0 ? customFieldsData : undefined
      };
      
      console.log('🔍 DEBUG - Dados do chamado:', ticketData);
      console.log('🔍 DEBUG - Tipo do category_id:', typeof ticketData.category_id);
      console.log('🔍 DEBUG - Criando chamado...');
      const ticket = await apiService.createTicket(ticketData);
      console.log('✅ DEBUG - Chamado criado:', ticket);
      console.log('✅ DEBUG - Tipo do ticket:', typeof ticket);
      console.log('✅ DEBUG - Ticket.id:', ticket?.id);
      console.log('✅ DEBUG - Ticket.id tipo:', typeof ticket?.id);
      
      // Se há arquivos selecionados, fazer upload
      if (selectedFiles.length > 0) {
        console.log('🔍 DEBUG - Fazendo upload de arquivos...');
        console.log('🔍 DEBUG - ticket.id:', ticket.id);
        console.log('🔍 DEBUG - selectedFiles:', selectedFiles);
        
        if (!ticket || !ticket.id) {
          console.error('❌ ERRO - Ticket ou ticket.id é undefined');
          throw new Error('Erro: ID do chamado não foi retornado');
        }
        
        await apiService.uploadAttachments(ticket.id, selectedFiles);
        console.log('✅ DEBUG - Upload concluído');
      }
      
      console.log('🔍 DEBUG - Redirecionando...');
      toast.success('Chamado criado com sucesso!');
      navigate('/tickets');
    } catch (error: any) {
      console.error('❌ ERRO - Detalhes:', error);
      console.error('❌ ERRO - Response:', error.response);
      console.error('❌ ERRO - Message:', error.message);
      toast.error(error.response?.data?.message || 'Erro ao criar chamado');
    } finally {
      setLoading(false);
    }
  };

  // Categorias são carregadas dinamicamente do backend

  const priorities = [
    { value: 'low', label: 'Baixa' },
    { value: 'medium', label: 'Média' },
    { value: 'high', label: 'Alta' },
    { value: 'urgent', label: 'Urgente' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/tickets')}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Novo Chamado</h1>
              <p className="text-gray-600 dark:text-gray-400">Crie um novo chamado no sistema</p>
            </div>
          </div>
          <Link
            to="/system-config"
            className="btn btn-outline flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Informações do Chamado</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoria *
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  required
                  disabled={loadingCategories}
                  className="input w-full"
                >
                  <option value="">
                    {loadingCategories ? 'Carregando categorias...' : 'Selecione uma categoria'}
                  </option>
                  {Array.isArray(categories) && categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prioridade
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="input w-full"
                >
                  {priorities.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assunto * <span className="text-gray-500 text-sm">(mínimo 5 caracteres)</span>
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="Digite o assunto do chamado"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.subject.length}/5 caracteres mínimos
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrição * <span className="text-gray-500 text-sm">(mínimo 10 caracteres)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                value={formData.description}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="Descreva detalhadamente o problema ou solicitação"
              />
              <div className="text-xs text-gray-500 mt-1">
                {formData.description.length}/10 caracteres mínimos
              </div>
            </div>

            {/* Campos Customizados */}
            {selectedCategory?.custom_fields && selectedCategory.custom_fields.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                  Informações Adicionais
                </h4>
                <div className="space-y-4">
                  {selectedCategory.custom_fields.map((field) => (
                    <div key={field.id}>
                      <label 
                        htmlFor={`custom_${field.name}`} 
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {field.description}
                        </p>
                      )}
                      
                      {field.type === 'text' && (
                        <input
                          type="text"
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="input w-full"
                        />
                      )}
                      
                      {field.type === 'textarea' && (
                        <textarea
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          rows={4}
                          className="input w-full"
                        />
                      )}
                      
                      {field.type === 'number' && (
                        <input
                          type="number"
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value ? parseFloat(e.target.value) : '')}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="input w-full"
                        />
                      )}
                      
                      {field.type === 'email' && (
                        <input
                          type="email"
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="input w-full"
                        />
                      )}
                      
                      {field.type === 'date' && (
                        <input
                          type="date"
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          required={field.required}
                          className="input w-full"
                        />
                      )}
                      
                      {field.type === 'select' && (
                        <select
                          id={`custom_${field.name}`}
                          value={customFieldsData[field.name] || ''}
                          onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                          required={field.required}
                          className="input w-full"
                        >
                          <option value="">Selecione uma opção</option>
                          {field.options?.map((option, index) => (
                            <option key={index} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {field.type === 'file' && (
                        <input
                          type="file"
                          id={`custom_${field.name}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              // Para arquivos, podemos armazenar o nome ou fazer upload separado
                              // Por enquanto, vamos armazenar o nome do arquivo
                              handleCustomFieldChange(field.name, file.name);
                            }
                          }}
                          required={field.required}
                          className="input w-full"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Anexos (Opcional)</h3>
            <FileUpload
              onFilesSelect={handleFilesSelect}
              onFileRemove={handleFileRemove}
              selectedFiles={selectedFiles}
              maxFiles={5}
              maxSize={10}
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="btn btn-outline flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Cancelar</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Criando...' : 'Criar Chamado'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
