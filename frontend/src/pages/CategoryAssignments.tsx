import React, { useState, useEffect } from 'react';
import { Users, Plus, X, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { AssignmentSummary } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from 'react-hot-toast';

const CategoryAssignments: React.FC = () => {
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [allAttendants, setAllAttendants] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
                        className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3"
                      >
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                            <Users className="w-4 h-4 text-green-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {attendant.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeAssignment(assignment.category.id, attendant.id)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
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

