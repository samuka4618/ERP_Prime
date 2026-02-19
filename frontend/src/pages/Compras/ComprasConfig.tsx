import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, X, User, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormattedDate from '../../components/FormattedDate';

interface Comprador {
  id: number;
  user_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

interface Usuario {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

const ComprasConfig: React.FC = () => {
  const [compradores, setCompradores] = useState<Comprador[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCompradores();
    fetchUsuarios();
  }, []);

  const fetchCompradores = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/compradores', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompradores(data.data.compradores || []);
      } else {
        toast.error('Erro ao carregar compradores');
      }
    } catch (error) {
      console.error('Erro ao carregar compradores:', error);
      toast.error('Erro ao carregar compradores');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      setLoadingUsuarios(true);
      const token = localStorage.getItem('token');
      const allUsers: Usuario[] = [];
      let page = 1;
      let hasMore = true;
      const limit = 100; // Limite máximo da API

      // Buscar todos os usuários fazendo múltiplas requisições paginadas
      while (hasMore) {
        const response = await fetch(`/api/users?page=${page}&limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Erro ao buscar usuários: ${response.status}`);
        }

        const data = await response.json();
        const users = data.data?.data || [];
        allUsers.push(...users.filter((u: Usuario) => u.is_active));

        // Verificar se há mais páginas
        const totalPages = data.data?.total_pages || 1;
        hasMore = page < totalPages;
        page++;
      }

      setUsuarios(allUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar lista de usuários');
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleAddComprador = async () => {
    if (!usuarioSelecionado) {
      toast.error('Selecione um usuário');
      return;
    }

    // Verificar se o usuário já é comprador
    const jaEhComprador = compradores.some(c => c.user_id === usuarioSelecionado);
    if (jaEhComprador) {
      toast.error('Este usuário já é um comprador');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/compradores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: usuarioSelecionado
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar comprador');
      }

      toast.success('Comprador adicionado com sucesso!');
      setShowAddModal(false);
      setUsuarioSelecionado('');
      fetchCompradores();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar comprador');
    }
  };

  const handleToggleStatus = async (compradorId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/compradores/${compradorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar comprador');
      }

      toast.success(`Comprador ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      fetchCompradores();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar comprador');
    }
  };

  const handleDelete = async (compradorId: number) => {
    if (!confirm('Tem certeza que deseja remover este comprador?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/compradores/${compradorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao remover comprador');
      }

      toast.success('Comprador removido com sucesso!');
      fetchCompradores();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover comprador');
    }
  };

  // Filtrar usuários que ainda não são compradores e aplicar busca
  const usuariosDisponiveis = usuarios
    .filter(usuario => !compradores.some(comprador => comprador.user_id === usuario.id))
    .filter(usuario => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        usuario.name.toLowerCase().includes(term) ||
        usuario.email.toLowerCase().includes(term)
      );
    });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <ShoppingCart className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Configurações de Compras
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie os compradores do sistema de compras
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Compradores
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Comprador</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : compradores.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                Nenhum comprador cadastrado
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Adicione compradores para gerenciar as solicitações de compra
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Cadastrado em
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {compradores.map((comprador) => (
                    <tr key={comprador.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-2" />
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {comprador.usuario?.name || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {comprador.usuario?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            comprador.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                          }`}
                        >
                          {comprador.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <FormattedDate date={comprador.created_at} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleToggleStatus(comprador.id, comprador.is_active)}
                            className={`${
                              comprador.is_active
                                ? 'text-yellow-600 hover:text-yellow-900'
                                : 'text-green-600 hover:text-green-900'
                            }`}
                            title={comprador.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {comprador.is_active ? (
                              <XCircle className="w-5 h-5" />
                            ) : (
                              <CheckCircle className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(comprador.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remover"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Adicionar Comprador */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Adicionar Comprador
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Usuário *
                </label>
                {loadingUsuarios ? (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Carregando usuários...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nome ou email..."
                        className="input w-full pl-10"
                      />
                    </div>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-64 overflow-y-auto bg-white dark:bg-gray-700">
                      {usuariosDisponiveis.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          {searchTerm ? (
                            <>Nenhum usuário encontrado com "{searchTerm}"</>
                          ) : (
                            <>Todos os usuários já são compradores</>
                          )}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-600">
                          {usuariosDisponiveis.map((usuario) => (
                            <button
                              key={usuario.id}
                              type="button"
                              onClick={() => setUsuarioSelecionado(usuario.id)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${
                                usuarioSelecionado === usuario.id
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                                  : ''
                              }`}
                            >
                              <div className="font-medium text-gray-900 dark:text-white">
                                {usuario.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {usuario.email}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {usuariosDisponiveis.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {usuariosDisponiveis.length} usuário(s) disponível(is)
                        {usuarioSelecionado && (
                          <span className="ml-2 text-blue-600 dark:text-blue-400">
                            • Selecionado
                          </span>
                        )}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setUsuarioSelecionado('');
                    setSearchTerm('');
                  }}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddComprador}
                  disabled={!usuarioSelecionado || loadingUsuarios}
                  className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprasConfig;

