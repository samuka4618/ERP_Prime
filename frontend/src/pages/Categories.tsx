import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { Category, CategoryField } from '../types';
import { Tag, Plus, Edit, Trash2, X } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface NewCategory {
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  custom_fields?: CategoryField[];
}

/** Gera nome interno (slug) a partir do label: minúsculas, sem acentos, espaços → underscore. */
function toSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || '';
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
  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Quando abrir o formulário de edição, rolar até ele para ficar visível
  useEffect(() => {
    if (showEditCategory && editingCategory && editFormRef.current) {
      editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showEditCategory, editingCategory?.id]);

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

  /** Adiciona uma nova opção ao campo do tipo seleção */
  const addSelectOption = (fieldId: string, isNew: boolean) => {
    const getOptions = (f: CategoryField) => (f.options || []);
    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => 
          f.id === fieldId ? { ...f, options: [...getOptions(f), ''] } : f
        )
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => 
          f.id === fieldId ? { ...f, options: [...getOptions(f), ''] } : f
        )
      } : null);
    }
  };

  /** Remove uma opção pelo índice */
  const removeSelectOption = (fieldId: string, index: number, isNew: boolean) => {
    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => {
          if (f.id !== fieldId || !f.options?.length) return f;
          const next = f.options.filter((_, i) => i !== index);
          return { ...f, options: next };
        })
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => {
          if (f.id !== fieldId || !f.options?.length) return f;
          const next = f.options.filter((_, i) => i !== index);
          return { ...f, options: next };
        })
      } : null);
    }
  };

  /** Atualiza o texto de uma opção pelo índice */
  const updateSelectOption = (fieldId: string, index: number, value: string, isNew: boolean) => {
    if (isNew) {
      setNewCategory(prev => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => {
          if (f.id !== fieldId) return f;
          const opts = [...(f.options || [])];
          if (index >= opts.length) opts.length = index + 1;
          opts[index] = value;
          return { ...f, options: opts };
        })
      }));
    } else {
      setEditingCategory(prev => prev ? {
        ...prev,
        custom_fields: (prev.custom_fields || []).map(f => {
          if (f.id !== fieldId) return f;
          const opts = [...(f.options || [])];
          if (index >= opts.length) opts.length = index + 1;
          opts[index] = value;
          return { ...f, options: opts };
        })
      } : null);
    }
  };

  const handleCreateCategory = async () => {
    if (!validateCategory(newCategory)) {
      return;
    }

    try {
      const cleanCustomFields = (newCategory.custom_fields || [])
        .filter(f => f.name && f.label)
        .map(f => f.type === 'select' && f.options?.length
          ? { ...f, options: f.options.map(o => String(o).trim()).filter(Boolean) }
          : f);
      const categoryData = {
        ...newCategory,
        custom_fields: cleanCustomFields
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
      const cleanCustomFields = (editingCategory.custom_fields || [])
        .filter(f => f.name && f.label)
        .map(f => f.type === 'select' && f.options?.length
          ? { ...f, options: f.options.map(o => String(o).trim()).filter(Boolean) }
          : f);
      const categoryData = {
        name: editingCategory.name,
        description: editingCategory.description,
        sla_first_response_hours: editingCategory.sla_first_response_hours,
        sla_resolution_hours: editingCategory.sla_resolution_hours,
        custom_fields: cleanCustomFields
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
          <LoadingSpinner size="lg" className="mx-auto" />
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
                          Label (Exibido) *
                        </label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            updateCustomField(field.id, { label, name: toSlug(label) }, true);
                          }}
                          placeholder="ex: Dados de Pagamento"
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nome interno (automático)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={field.name}
                          placeholder="Preencha o label acima"
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 dark:text-gray-400 text-gray-600 cursor-not-allowed"
                        />
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Gerado pelo sistema a partir do label. Usado internamente em regras e integrações.
                        </p>
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
                            Opções de escolha
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            Adicione cada opção que aparecerá no campo. O usuário verá essas opções ao abrir um chamado.
                          </p>
                          <div className="space-y-2">
                            {(field.options || []).map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => updateSelectOption(field.id, idx, e.target.value, true)}
                                  placeholder={`Opção ${idx + 1}`}
                                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSelectOption(field.id, idx, true)}
                                  className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Remover opção"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addSelectOption(field.id, true)}
                              className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar opção
                            </button>
                          </div>
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

          {/* Lista de Categorias */}
          <div className="space-y-3">
            {Array.isArray(categories) && categories.length > 0 ? categories.map((category) => (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
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

                {/* Formulário de edição inline - aparece logo abaixo da categoria clicada */}
                {showEditCategory && editingCategory?.id === category.id && (
                  <div ref={editFormRef} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800" role="form" aria-label="Editar categoria">
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

                    {/* Campos Customizados - Edição */}
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
                                Label (Exibido) *
                              </label>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => {
                                  const label = e.target.value;
                                  updateCustomField(field.id, { label, name: toSlug(label) }, false);
                                }}
                                placeholder="ex: Dados de Pagamento"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Nome interno (automático)
                              </label>
                              <input
                                type="text"
                                readOnly
                                value={field.name}
                                placeholder="Preencha o label acima"
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 dark:text-gray-400 text-gray-600 cursor-not-allowed"
                              />
                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                Gerado pelo sistema a partir do label. Usado internamente em regras e integrações.
                              </p>
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
                                  Opções de escolha
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                  Adicione cada opção que aparecerá no campo. O usuário verá essas opções ao abrir um chamado.
                                </p>
                                <div className="space-y-2">
                                  {(field.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => updateSelectOption(field.id, idx, e.target.value, false)}
                                        placeholder={`Opção ${idx + 1}`}
                                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeSelectOption(field.id, idx, false)}
                                        className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="Remover opção"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addSelectOption(field.id, false)}
                                    className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Adicionar opção
                                  </button>
                                </div>
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

