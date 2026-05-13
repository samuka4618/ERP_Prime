import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { Category, CategoryField, User } from '../types';
import { Tag, Plus, Edit, Trash2, X, Download, Upload, FileCheck, AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

interface NewCategory {
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  /** Se false, a categoria fica oculta na abertura de chamados até ativar na edição. */
  is_active?: boolean;
  custom_fields?: CategoryField[];
  requires_approval?: boolean;
  approval_value_field?: string;
  approval_type?: string;
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
    is_active: true,
    custom_fields: [],
    requires_approval: false,
    approval_value_field: 'valor_mensal',
    approval_type: 'none'
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const editFormRef = useRef<HTMLDivElement>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    invalid: number;
    validRows: Array<{ rowIndex: number; data: Record<string, unknown> }>;
    invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
  } | null>(null);
  const [importUpdateExisting, setImportUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    invalidCount: number;
    invalidRows: Array<{ rowIndex: number; errors: string[] }>;
  } | null>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const [categoryApprovers, setCategoryApprovers] = useState<
    Array<{ id: number; user_id: number; valor_minimo: number; valor_maximo: number; priority: number; user_name?: string }>
  >([]);
  const [approverDraft, setApproverDraft] = useState({
    user_id: '',
    valor_minimo: '0',
    valor_maximo: '999999999.99',
    priority: '0'
  });
  const [approverSearch, setApproverSearch] = useState('');
  const [approverSuggestions, setApproverSuggestions] = useState<User[]>([]);
  const [approverSuggestionsOpen, setApproverSuggestionsOpen] = useState(false);
  const [approverUsersLoading, setApproverUsersLoading] = useState(false);
  const [selectedApproverUser, setSelectedApproverUser] = useState<User | null>(null);
  const approverComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (showEditCategory && editingCategory?.id) {
      apiService
        .getCategoryApprovers(editingCategory.id)
        .then((rows) => setCategoryApprovers(rows as any))
        .catch(() => setCategoryApprovers([]));
    } else {
      setCategoryApprovers([]);
    }
  }, [showEditCategory, editingCategory?.id]);

  useEffect(() => {
    setApproverSearch('');
    setApproverSuggestions([]);
    setApproverSuggestionsOpen(false);
    setSelectedApproverUser(null);
    setApproverDraft({
      user_id: '',
      valor_minimo: '0',
      valor_maximo: '999999999.99',
      priority: '0'
    });
  }, [editingCategory?.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (approverComboRef.current && !approverComboRef.current.contains(e.target as Node)) {
        setApproverSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!showEditCategory || !editingCategory?.requires_approval) return;
    let cancelled = false;
    setApproverUsersLoading(true);
    const timer = window.setTimeout(() => {
      apiService
        .getUsers(1, 100, approverSearch.trim() ? { search: approverSearch } : undefined)
        .then((r) => {
          if (!cancelled) setApproverSuggestions(r.data);
        })
        .catch(() => {
          if (!cancelled) setApproverSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setApproverUsersLoading(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [approverSearch, showEditCategory, editingCategory?.requires_approval, editingCategory?.id]);

  // Quando abrir o formulário de edição, rolar até ele para ficar visível
  useEffect(() => {
    if (showEditCategory && editingCategory && editFormRef.current) {
      editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showEditCategory, editingCategory?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      /** Incluir inativas: backend não filtra por is_active; usar limit alto para não “perder” categorias seed. */
      const response = await apiService.get('/categories?page=1&limit=500');
      // axios body após apiService.get: { message?, data: { data: [...], total, ... } }
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

  const removeApproverRow = async (approverId: number) => {
    if (!window.confirm('Remover este aprovador?')) return;
    try {
      await apiService.deleteCategoryApprover(approverId);
      setCategoryApprovers((prev) => prev.filter((a) => a.id !== approverId));
      toast.success('Aprovador removido');
    } catch {
      toast.error('Erro ao remover aprovador');
    }
  };

  const pickApproverUser = (u: User) => {
    setApproverDraft((d) => ({ ...d, user_id: String(u.id) }));
    setSelectedApproverUser(u);
    setApproverSearch('');
    setApproverSuggestionsOpen(false);
  };

  const clearApproverUser = () => {
    setApproverDraft((d) => ({ ...d, user_id: '' }));
    setSelectedApproverUser(null);
  };

  const addApproverRow = async () => {
    if (!editingCategory?.id) return;
    const uid = parseInt(approverDraft.user_id, 10);
    if (isNaN(uid)) {
      toast.error('Selecione um utilizador aprovador na lista (pesquise por nome ou e-mail).');
      return;
    }
    try {
      await apiService.createCategoryApprover(editingCategory.id, {
        user_id: uid,
        valor_minimo: parseFloat(approverDraft.valor_minimo) || 0,
        valor_maximo: parseFloat(approverDraft.valor_maximo) || 0,
        priority: parseInt(approverDraft.priority, 10) || 0
      });
      const rows = await apiService.getCategoryApprovers(editingCategory.id);
      setCategoryApprovers(rows as any);
      toast.success('Aprovador adicionado');
      setApproverDraft({
        user_id: '',
        valor_minimo: '0',
        valor_maximo: '999999999.99',
        priority: '0'
      });
      setSelectedApproverUser(null);
      setApproverSearch('');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao adicionar aprovador');
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
        is_active: true,
        custom_fields: [],
        requires_approval: false,
        approval_value_field: 'valor_mensal',
        approval_type: 'none'
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
        is_active: editingCategory.is_active,
        custom_fields: cleanCustomFields,
        requires_approval: Boolean(editingCategory.requires_approval),
        approval_value_field: editingCategory.approval_value_field || null,
        approval_type: editingCategory.approval_type || 'none'
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

  const handleExportCategories = async () => {
    setLoadingExport(true);
    try {
      await apiService.exportCategories();
      toast.success('Exportação concluída');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao exportar categorias');
    } finally {
      setLoadingExport(false);
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo JSON');
      return;
    }
    setLoadingPreview(true);
    setImportResult(null);
    try {
      const data = await apiService.importCategoriesPreview(importFile);
      setImportPreview(data);
      toast.success(`Pré-visualização: ${data.valid} válida(s), ${data.invalid} inválida(s)`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao analisar arquivo');
      setImportPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImportCategories = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo JSON');
      return;
    }
    setLoadingImport(true);
    try {
      const data = await apiService.importCategories(importFile, importUpdateExisting);
      setImportResult(data);
      const parts = [];
      if (data.created) parts.push(`${data.created} criada(s)`);
      if (data.updated) parts.push(`${data.updated} atualizada(s)`);
      if (data.skipped) parts.push(`${data.skipped} ignorada(s)`);
      toast.success(`Importação concluída: ${parts.length ? parts.join(', ') : 'nenhuma alteração'}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao importar');
    } finally {
      setLoadingImport(false);
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

        {/* Exportar / Importar categorias */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Exportar / Importar categorias
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Exporte todas as categorias (SLA, perguntas personalizadas e configurações) em JSON. Na importação, as atribuições de técnicos ficam a seu cargo após a importação.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exportar</h4>
              <button
                type="button"
                onClick={handleExportCategories}
                disabled={loadingExport}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-1.5" />
                {loadingExport ? 'Exportando...' : 'Baixar JSON'}
              </button>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Importar</h4>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportPreview(null);
                  setImportResult(null);
                }}
                className="block w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300 mb-2"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                <input
                  type="checkbox"
                  checked={importUpdateExisting}
                  onChange={(e) => setImportUpdateExisting(e.target.checked)}
                />
                Atualizar categorias existentes (por nome)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleImportPreview}
                  disabled={!importFile || loadingPreview}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <FileCheck className="w-4 h-4 mr-1" />
                  {loadingPreview ? 'Analisando...' : 'Pré-visualizar'}
                </button>
                <button
                  type="button"
                  onClick={handleImportCategories}
                  disabled={!importFile || loadingImport}
                  className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {loadingImport ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
          {importPreview && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pré-visualização</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Total: {importPreview.total} — Válidas: {importPreview.valid} — Inválidas: {importPreview.invalid}
              </p>
              {importPreview.invalidRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left py-1 pr-2">Linha</th>
                        <th className="text-left py-1 pr-2">Dados</th>
                        <th className="text-left py-1">Erros</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.invalidRows.map((inv, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-1 pr-2 text-red-600 dark:text-red-400">{inv.rowIndex}</td>
                          <td className="py-1 pr-2 text-gray-600 dark:text-gray-400 font-mono text-xs max-w-xs truncate">
                            {JSON.stringify(inv.raw).slice(0, 80)}…
                          </td>
                          <td className="py-1 text-red-600 dark:text-red-400">{inv.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {importResult && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Resultado da importação
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Criadas: {importResult.created} — Atualizadas: {importResult.updated} — Ignoradas (já existem): {importResult.skipped} — Linhas inválidas: {importResult.invalidCount}
              </p>
              {importResult.invalidRows.length > 0 && (
                <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                  {importResult.invalidRows.map((inv, i) => (
                    <li key={i}>Linha {inv.rowIndex}: {inv.errors.join('; ')}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Criar Nova Categoria
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/95 mb-4 rounded-md border border-amber-300/70 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-3 py-2">
                Logo abaixo dos SLAs aparece a secção{' '}
                <strong>Aprovação financeira</strong>: marque se o chamado precisa de aprovador antes de ir para atendimento.
                As <strong>faixas e utilizadores</strong> aprovadores configuram-se <strong>depois</strong>, ao editar esta categoria.
              </p>
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

              <div className="mt-4">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600"
                    checked={newCategory.is_active !== false}
                    onChange={(e) =>
                      setNewCategory((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  Categoria ativa (aparece ao abrir novo chamado; desmarque para rascunho / ativar mais tarde)
                </label>
              </div>

              <div className="mt-6 rounded-lg border-2 border-amber-500/70 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 p-4 shadow-sm">
                <h4 className="text-md font-semibold text-amber-950 dark:text-amber-50 mb-1">
                  Aprovação financeira (opcional)
                </h4>
                <p className="text-xs text-amber-900/85 dark:text-amber-100/85 mb-3">
                  Necessário para fluxo despesa cartão / assinatura digital.
                </p>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={Boolean(newCategory.requires_approval)}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, requires_approval: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Exigir aprovação financeira ao abrir chamado</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Campo numérico para faixa (nome interno)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                      value={newCategory.approval_value_field || ''}
                      onChange={(e) => setNewCategory((p) => ({ ...p, approval_value_field: e.target.value }))}
                      placeholder="ex: valor_mensal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tipo de fluxo</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                      value={newCategory.approval_type || 'none'}
                      onChange={(e) => {
                        const approval_type = e.target.value;
                        setNewCategory((p) =>
                          approval_type === 'finance_card'
                            ? {
                                ...p,
                                approval_type,
                                requires_approval: true,
                                approval_value_field: (p.approval_value_field || '').trim() || 'valor_mensal'
                              }
                            : { ...p, approval_type }
                        );
                      }}
                    >
                      <option value="none">Nenhum</option>
                      <option value="finance_card">Cartão / assinatura digital</option>
                    </select>
                  </div>
                </div>
                {(newCategory.approval_type || 'none') === 'finance_card' && (
                  <p className="text-xs text-amber-950/90 dark:text-amber-100/90 mt-3">
                    Ao guardar com este fluxo, o sistema garante um campo numérico <strong>obrigatório</strong> (nome
                    configurado acima ou <span className="font-mono">valor_mensal</span>). O solicitante informa esse
                    valor na abertura para escolher a faixa do aprovador; o contrato efetivo é registrado pelo
                    atendente ao finalizar o chamado.
                  </p>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                  Configure <strong>aprovadores por faixa</strong> ao <strong>editar</strong> esta categoria (após criar).
                </p>
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
                          <option value="password">Senha (oculta)</option>
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
                    <div className="font-medium text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                      {category.name}
                      {!category.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                          Inativa
                        </span>
                      )}
                      {category.requires_approval && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                          Aprovação financeira
                        </span>
                      )}
                      {category.approval_type === 'finance_card' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Cartão / assinatura
                        </span>
                      )}
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

                    <div className="md:col-span-2 mt-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600"
                          checked={Boolean(editingCategory.is_active)}
                          onChange={(e) =>
                            setEditingCategory((prev) =>
                              prev ? { ...prev, is_active: e.target.checked } : null
                            )
                          }
                        />
                        Categoria ativa (disponível para novos chamados)
                      </label>
                    </div>

                    <div className="mt-6 border-t pt-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Aprovação financeira</h4>
                      <label className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={Boolean(editingCategory.requires_approval)}
                          onChange={(e) =>
                            setEditingCategory((prev) =>
                              prev ? { ...prev, requires_approval: e.target.checked } : null
                            )
                          }
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Exigir aprovação financeira ao abrir chamado nesta categoria
                        </span>
                      </label>
                      {editingCategory.requires_approval && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">
                                Campo numérico (nome interno) para faixa
                              </label>
                              <select
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                                value={editingCategory.approval_value_field || ''}
                                onChange={(e) =>
                                  setEditingCategory((prev) =>
                                    prev ? { ...prev, approval_value_field: e.target.value } : null
                                  )
                                }
                              >
                                <option value="">Selecione</option>
                                {(editingCategory.custom_fields || [])
                                  .filter((f) => f.type === 'number' && f.name)
                                  .map((f) => (
                                    <option key={f.id} value={f.name}>
                                      {f.label} ({f.name})
                                    </option>
                                  ))}
                              </select>
                              <p className="text-xs text-gray-500 mt-1">Use um campo numérico já definido acima (ex.: valor_mensal).</p>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Tipo de fluxo</label>
                              <select
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                                value={editingCategory.approval_type || 'none'}
                                onChange={(e) => {
                                  const approval_type = e.target.value;
                                  setEditingCategory((prev) => {
                                    if (!prev) return null;
                                    if (approval_type === 'finance_card') {
                                      const field = (prev.approval_value_field || '').trim() || 'valor_mensal';
                                      return {
                                        ...prev,
                                        approval_type,
                                        requires_approval: true,
                                        approval_value_field: field
                                      };
                                    }
                                    return { ...prev, approval_type };
                                  });
                                }}
                              >
                                <option value="none">Nenhum</option>
                                <option value="finance_card">Cartão / assinatura digital</option>
                              </select>
                            </div>
                          </div>

                          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h5 className="text-sm font-medium mb-1">Aprovadores por faixa</h5>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                              O valor informado pelo <strong>solicitante na abertura</strong> (ex.: campo{' '}
                              <strong>valor_mensal</strong>) é comparado com o intervalo; o aprovador com menor{' '}
                              <strong>prioridade</strong> (número mais baixo) é considerado primeiro. O aprovador não
                              define valor; na finalização, o atendente registra plano efetivo, valor, moeda e ciclo.
                            </p>
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
                              <div className="lg:col-span-5 relative" ref={approverComboRef}>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                  Utilizador aprovador
                                </label>
                                {selectedApproverUser ? (
                                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm">
                                    <span className="truncate flex-1 text-gray-900 dark:text-gray-100">
                                      {selectedApproverUser.name}{' '}
                                      <span className="text-gray-500 dark:text-gray-400">
                                        ({selectedApproverUser.email})
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      className="shrink-0 text-xs text-primary-600 hover:underline"
                                      onClick={() => {
                                        clearApproverUser();
                                        setApproverSuggestionsOpen(true);
                                      }}
                                    >
                                      Alterar
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <input
                                      type="text"
                                      autoComplete="off"
                                      aria-label="Pesquisar utilizador por nome ou e-mail"
                                      placeholder="Comece a escrever o nome ou o e-mail…"
                                      className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-900"
                                      value={approverSearch}
                                      onChange={(e) => {
                                        setApproverSearch(e.target.value);
                                        setApproverSuggestionsOpen(true);
                                      }}
                                      onFocus={() => setApproverSuggestionsOpen(true)}
                                    />
                                    {approverSuggestionsOpen && (
                                      <ul
                                        className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg text-sm"
                                        role="listbox"
                                      >
                                        {approverUsersLoading && (
                                          <li className="px-3 py-2 text-gray-500">A carregar…</li>
                                        )}
                                        {!approverUsersLoading && approverSuggestions.length === 0 && (
                                          <li className="px-3 py-2 text-gray-500">Sem resultados.</li>
                                        )}
                                        {!approverUsersLoading &&
                                          approverSuggestions.map((u) => (
                                            <li key={u.id}>
                                              <button
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-gray-800"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => pickApproverUser(u)}
                                              >
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                  {u.name}
                                                </span>
                                                <span className="block text-xs text-gray-500 dark:text-gray-400">
                                                  {u.email}
                                                </span>
                                              </button>
                                            </li>
                                          ))}
                                      </ul>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                  Valor mínimo da faixa
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-900"
                                  value={approverDraft.valor_minimo}
                                  onChange={(e) => setApproverDraft((d) => ({ ...d, valor_minimo: e.target.value }))}
                                />
                                <p className="text-[10px] text-gray-500 mt-0.5">Inclusivo — ex.: 0</p>
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                  Valor máximo da faixa
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-900"
                                  value={approverDraft.valor_maximo}
                                  onChange={(e) => setApproverDraft((d) => ({ ...d, valor_maximo: e.target.value }))}
                                />
                                <p className="text-[10px] text-gray-500 mt-0.5">Inclusivo — ex.: 999999</p>
                              </div>
                              <div className="lg:col-span-2">
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                  Prioridade
                                </label>
                                <input
                                  type="number"
                                  className="w-full border rounded-md px-3 py-2 text-sm dark:bg-gray-900"
                                  value={approverDraft.priority}
                                  onChange={(e) => setApproverDraft((d) => ({ ...d, priority: e.target.value }))}
                                />
                                <p className="text-[10px] text-gray-500 mt-0.5">Menor = avaliado primeiro</p>
                              </div>
                              <div className="lg:col-span-1 flex items-end">
                                <button
                                  type="button"
                                  onClick={addApproverRow}
                                  className="w-full px-3 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                                >
                                  Adicionar
                                </button>
                              </div>
                            </div>
                            <ul className="text-sm space-y-1">
                              {categoryApprovers.map((a) => (
                                <li key={a.id} className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 py-1">
                                  <span>
                                    {a.user_name || `Usuário #${a.user_id}`} — {a.valor_minimo} a {a.valor_maximo} (prioridade{' '}
                                    {a.priority})
                                  </span>
                                  <button
                                    type="button"
                                    className="text-red-600 text-xs"
                                    onClick={() => removeApproverRow(a.id)}
                                  >
                                    remover
                                  </button>
                                </li>
                              ))}
                              {categoryApprovers.length === 0 && (
                                <li className="text-gray-500 text-xs">Nenhum aprovador configurado.</li>
                              )}
                            </ul>
                          </div>
                        </>
                      )}
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
                                <option value="password">Senha (oculta)</option>
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

