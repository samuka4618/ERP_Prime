import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { Category, CategoryField } from '../types';
import { Tag, Plus, Edit, Trash2, X } from 'lucide-react';

interface NewCategory {
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  custom_fields?: CategoryField[];
}

const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/categories');
      // A API retorna { data: { data: [...], total: 7, page: 1, ... } } ou { data: [...] }
      const categoriesArray = response.data?.data || response.data || [];
      setCategories(Array.isArray(categoriesArray) ? categoriesArray : []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
      setCategories([]);
    } finally {
      setLoading(false);
    }
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando categorias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Tag className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Categorias de Chamados
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie as categorias de chamados do sistema
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Lista de Categorias
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
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomField(field.id, { required: e.target.checked }, true)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Campo obrigatório</span>
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

              {/* Campos Customizados - Mesmo código do formulário de criação */}
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white">
                      Perguntas do Formulário de Chamados
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Defina quais perguntas aparecerão quando o usuário criar um chamado nesta categoria.
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
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomField(field.id, { required: e.target.checked }, false)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Campo obrigatório</span>
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
      </div>
    </div>
  );
};

export default Categories;

