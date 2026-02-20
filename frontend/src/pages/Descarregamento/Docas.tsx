import React, { useState, useEffect } from 'react';
import { Warehouse, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-hot-toast';
import { usePermissions } from '../../contexts/PermissionsContext';
import { apiService } from '../../services/api';

interface Doca {
  id: number;
  numero: string;
  nome?: string;
  is_active: boolean;
}

const Docas: React.FC = () => {
  const { hasPermission } = usePermissions();
  const [docas, setDocas] = useState<Doca[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ numero: '', nome: '', is_active: true });

  const canManage = hasPermission('descarregamento.docas.manage') || hasPermission('descarregamento.formularios.manage');

  useEffect(() => {
    fetchDocas();
  }, []);

  const fetchDocas = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDocasDescarregamento();
      setDocas(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Erro ao carregar docas');
      setDocas([]);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ numero: '', nome: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (d: Doca) => {
    setEditingId(d.id);
    setFormData({
      numero: d.numero,
      nome: d.nome || '',
      is_active: d.is_active
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numero.trim()) {
      toast.error('Número da doca é obrigatório');
      return;
    }
    try {
      if (editingId) {
        await apiService.updateDocaDescarregamento(editingId, {
          numero: formData.numero.trim(),
          nome: formData.nome.trim() || undefined,
          is_active: formData.is_active
        });
        toast.success('Doca atualizada com sucesso');
      } else {
        await apiService.createDocaDescarregamento({
          numero: formData.numero.trim(),
          nome: formData.nome.trim() || undefined,
          is_active: formData.is_active
        });
        toast.success('Doca criada com sucesso');
      }
      closeModal();
      fetchDocas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar doca');
    }
  };

  const handleDelete = async (id: number, numero: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a doca "${numero}"?`)) return;
    try {
      await apiService.deleteDocaDescarregamento(id);
      toast.success('Doca excluída com sucesso');
      fetchDocas();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir doca');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Docas</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure as docas de descarregamento</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova Doca
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                {canManage && (
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {docas.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-full mb-4">
                        <Warehouse className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Nenhuma doca cadastrada
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {canManage ? 'Clique em "Nova Doca" para começar' : 'Aguarde o administrador cadastrar docas.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                docas.map((doca) => (
                  <tr
                    key={doca.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                          <Warehouse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          Doca {doca.numero}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {doca.nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          doca.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {doca.is_active ? (
                          <><CheckCircle className="w-3 h-3" /> Ativa</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Inativa</>
                        )}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(doca)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(doca.id, doca.numero)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Editar Doca' : 'Nova Doca'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número *</label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => setFormData((p) => ({ ...p, numero: e.target.value }))}
                  className="input w-full"
                  placeholder="Ex: 1"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                  className="input w-full"
                  placeholder="Ex: Doca principal"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">Doca ativa</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn border border-gray-300 dark:border-gray-600">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Docas;
