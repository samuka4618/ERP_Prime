import React, { useState, useEffect } from 'react';
import { Users, Plus, X, AlertCircle, GitBranch } from 'lucide-react';
import { apiService } from '../services/api';
import { AssignmentSummary, AssignmentRuleOperator } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-hot-toast';

const OPERATOR_LABELS: Record<AssignmentRuleOperator, string> = {
  equals: 'igual a',
  not_equals: 'diferente de',
  contains: 'contém',
  gt: 'maior que',
  gte: 'maior ou igual a',
  lt: 'menor que',
  lte: 'menor ou igual a'
};

const CategoryAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [allAttendants, setAllAttendants] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRuleByCategory, setNewRuleByCategory] = useState<Record<number, { field_name: string; operator: AssignmentRuleOperator; value: string; attendant_id: string; priority: number }>>({});

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const data = await apiService.getAssignmentSummary();
      setAssignments(data.categories);
      setAllAttendants(data.all_attendants);
    } catch (error) {
      toast.error('Erro ao carregar atribuições');
    } finally {
      setLoading(false);
    }
  };

  const addAssignment = async (categoryId: number, attendantId: number) => {
    try {
      setSaving(true);
      await apiService.createAssignment(categoryId, attendantId);
      
      // Atualizar estado local
      setAssignments(prev => prev.map(cat => {
        if (cat.category.id === categoryId) {
          const attendant = allAttendants.find(a => a.id === attendantId);
          if (attendant) {
            return {
              ...cat,
              assigned_attendants: [...cat.assigned_attendants, { id: attendantId, name: attendant.name }],
              available_attendants: cat.available_attendants.filter(a => a.id !== attendantId)
            };
          }
        }
        return cat;
      }));
      
      toast.success('Atribuição adicionada com sucesso');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao adicionar atribuição');
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (categoryId: number, attendantId: number) => {
    try {
      setSaving(true);
      await apiService.deleteAssignment(categoryId, attendantId);
      
      // Atualizar estado local
      setAssignments(prev => prev.map(cat => {
        if (cat.category.id === categoryId) {
          const attendant = cat.assigned_attendants.find(a => a.id === attendantId);
          if (attendant) {
            return {
              ...cat,
              assigned_attendants: cat.assigned_attendants.filter(a => a.id !== attendantId),
              available_attendants: [...cat.available_attendants, { id: attendantId, name: attendant.name }]
            };
          }
        }
        return cat;
      }));
      
      toast.success('Atribuição removida com sucesso');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao remover atribuição');
    } finally {
      setSaving(false);
    }
  };

  const addAssignmentRule = async (categoryId: number) => {
    const form = newRuleByCategory[categoryId];
    if (!form || !form.field_name || !form.value.trim() || !form.attendant_id) {
      toast.error('Preencha campo, valor e técnico para a regra');
      return;
    }
    const attendantId = parseInt(form.attendant_id, 10);
    if (Number.isNaN(attendantId)) {
      toast.error('Selecione um técnico');
      return;
    }
    try {
      setSaving(true);
      const rule = await apiService.createAssignmentRule(categoryId, {
        field_name: form.field_name,
        operator: form.operator,
        value: form.value.trim(),
        attendant_id: attendantId,
        priority: form.priority ?? 0
      });
      setAssignments(prev => prev.map(cat => {
        if (cat.category.id === categoryId) {
          const rules = cat.assignment_rules || [];
          return {
            ...cat,
            assignment_rules: [...rules, { id: rule.id, field_name: rule.field_name, operator: rule.operator, value: rule.value, attendant_id: rule.attendant_id, attendant_name: rule.attendant_name, priority: rule.priority }]
          };
        }
        return cat;
      }));
      setNewRuleByCategory(prev => ({ ...prev, [categoryId]: { field_name: '', operator: 'equals', value: '', attendant_id: '', priority: 0 } }));
      toast.success('Regra de atribuição adicionada');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao adicionar regra');
    } finally {
      setSaving(false);
    }
  };

  const removeAssignmentRule = async (categoryId: number, ruleId: number) => {
    try {
      setSaving(true);
      await apiService.deleteAssignmentRule(ruleId);
      setAssignments(prev => prev.map(cat => {
        if (cat.category.id === categoryId) {
          return {
            ...cat,
            assignment_rules: (cat.assignment_rules || []).filter(r => r.id !== ruleId)
          };
        }
        return cat;
      }));
      toast.success('Regra removida');
    } catch (error: any) {
      toast.error('Erro ao remover regra');
    } finally {
      setSaving(false);
    }
  };

  const setNewRuleField = (categoryId: number, field: string, value: string | number) => {
    setNewRuleByCategory(prev => ({
      ...prev,
      [categoryId]: {
        ...(prev[categoryId] || { field_name: '', operator: 'equals' as AssignmentRuleOperator, value: '', attendant_id: '', priority: 0 }),
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Atribuições de Categorias</h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-1">
            Configure quais técnicos são responsáveis por cada categoria de chamados
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-4 h-4" />
          <span>Categorias sem atribuição aparecem para todos os técnicos</span>
        </div>
      </div>

      {/* Aviso sobre categoria "Outros" */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">Como funciona a atribuição automática</h3>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• <strong>1 técnico atribuído:</strong> Chamados são atribuídos automaticamente</li>
              <li>• <strong>Múltiplos técnicos:</strong> Chamados ficam disponíveis para escolha</li>
              <li>• <strong>Sem atribuição:</strong> Aparecem para todos os técnicos (categoria "Outros")</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Lista de categorias */}
      <div className="space-y-6">
        {assignments.map((assignment) => (
          <div key={assignment.category.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {assignment.category.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">
                  {assignment.category.description}
                </p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {assignment.assigned_attendants.length} técnico(s) atribuído(s)
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Técnicos atribuídos */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Técnicos Atribuídos
                </h4>
                <div className="space-y-2">
                  {assignment.assigned_attendants.length > 0 ? (
                    assignment.assigned_attendants.map((attendant) => (
                      <div
                        key={attendant.id}
                        className="flex items-center justify-between bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded-lg p-3"
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-800/60 rounded-full flex items-center justify-center mr-3">
                            <Users className="w-4 h-4 text-green-600 dark:text-green-300" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-green-100">
                            {attendant.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeAssignment(assignment.category.id, attendant.id)}
                          disabled={saving}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum técnico atribuído
                    </div>
                  )}
                </div>
              </div>

              {/* Técnicos disponíveis */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Técnico
                </h4>
                <div className="space-y-2">
                  {assignment.available_attendants.length > 0 ? (
                    assignment.available_attendants.map((attendant) => (
                      <div
                        key={attendant.id}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center mr-3">
                            <Users className="w-4 h-4 text-gray-600 dark:text-gray-400 dark:text-gray-400" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {attendant.name}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Atendente</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addAssignment(assignment.category.id, attendant.id)}
                          disabled={saving}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Todos os técnicos já estão atribuídos
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Regras de atribuição por resposta */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <GitBranch className="w-4 h-4 mr-2" />
                Atribuição por resposta do formulário
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Se a categoria tiver campos no formulário de abertura, você pode definir regras: conforme a resposta, o chamado será atribuído a um técnico específico. A primeira regra que coincidir será usada.
              </p>
              {(assignment.assignment_rules || []).length > 0 && (
                <div className="space-y-2 mb-4">
                  {(assignment.assignment_rules || []).map((rule) => {
                    const fieldLabel = assignment.category.custom_fields?.find(f => f.name === rule.field_name)?.label || rule.field_name;
                    return (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded-lg p-3"
                      >
                        <span className="text-sm text-gray-800 dark:text-amber-100">
                          Se <strong>{fieldLabel}</strong> {OPERATOR_LABELS[rule.operator]} <strong>&quot;{rule.value}&quot;</strong> → {rule.attendant_name || allAttendants.find(a => a.id === rule.attendant_id)?.name || rule.attendant_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAssignmentRule(assignment.category.id, rule.id)}
                          disabled={saving}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {(assignment.category.custom_fields && assignment.category.custom_fields.length > 0) && (
                <>
                  {assignment.assigned_attendants.length === 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                      Atribua pelo menos um técnico a esta categoria (acima) para poder criar regras de atribuição por resposta.
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Campo</label>
                      <select
                        value={newRuleByCategory[assignment.category.id]?.field_name || ''}
                        onChange={(e) => setNewRuleField(assignment.category.id, 'field_name', e.target.value)}
                        className="input py-1.5 text-sm min-w-[140px]"
                        disabled={assignment.assigned_attendants.length === 0}
                      >
                        <option value="">Selecione</option>
                        {assignment.category.custom_fields.map((f) => (
                          <option key={f.id || f.name} value={f.name}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Condição</label>
                      <select
                        value={newRuleByCategory[assignment.category.id]?.operator || 'equals'}
                        onChange={(e) => setNewRuleField(assignment.category.id, 'operator', e.target.value as AssignmentRuleOperator)}
                        className="input py-1.5 text-sm min-w-[160px]"
                        disabled={assignment.assigned_attendants.length === 0}
                      >
                        {(Object.entries(OPERATOR_LABELS) as [AssignmentRuleOperator, string][]).map(([op, label]) => (
                          <option key={op} value={op}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Valor</label>
                      <input
                        type="text"
                        value={newRuleByCategory[assignment.category.id]?.value || ''}
                        onChange={(e) => setNewRuleField(assignment.category.id, 'value', e.target.value)}
                        placeholder="Ex: Urgente ou 10"
                        className="input py-1.5 text-sm w-32"
                        disabled={assignment.assigned_attendants.length === 0}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Técnico</label>
                      <select
                        value={newRuleByCategory[assignment.category.id]?.attendant_id || ''}
                        onChange={(e) => setNewRuleField(assignment.category.id, 'attendant_id', e.target.value)}
                        className="input py-1.5 text-sm min-w-[160px]"
                        disabled={assignment.assigned_attendants.length === 0}
                      >
                        <option value="">
                          {assignment.assigned_attendants.length === 0 ? 'Atribua um técnico primeiro' : 'Selecione'}
                        </option>
                        {assignment.assigned_attendants.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ordem</label>
                      <input
                        type="number"
                        min={0}
                        value={newRuleByCategory[assignment.category.id]?.priority ?? 0}
                        onChange={(e) => setNewRuleField(assignment.category.id, 'priority', parseInt(e.target.value, 10) || 0)}
                        className="input py-1.5 text-sm w-16"
                        disabled={assignment.assigned_attendants.length === 0}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addAssignmentRule(assignment.category.id)}
                      disabled={saving || assignment.assigned_attendants.length === 0}
                      className="btn btn-primary py-1.5 text-sm"
                    >
                      <Plus className="w-4 h-4 inline mr-1" />
                      Adicionar regra
                    </button>
                  </div>
                </>
              )}
              {(!assignment.category.custom_fields || assignment.category.custom_fields.length === 0) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Adicione campos personalizados na categoria (em Cadastros → Categorias) para usar regras por resposta.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resumo */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Resumo das Atribuições</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Total de categorias:</span>
            <span className="ml-2 font-medium">{assignments.length}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Total de técnicos:</span>
            <span className="ml-2 font-medium">{allAttendants.length}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Atribuições ativas:</span>
            <span className="ml-2 font-medium">
              {assignments.reduce((sum, cat) => sum + cat.assigned_attendants.length, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryAssignments;

