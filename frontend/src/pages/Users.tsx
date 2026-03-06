import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  User as UserIcon,
  Shield,
  UserCheck,
  Settings,
  Download,
  Upload,
  FileCheck,
  AlertCircle,
  Building2
} from 'lucide-react';
import { User } from '../types';
import { apiService, EntraUserListItem } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import UserAvatar from '../components/UserAvatar';
import { toast } from 'react-hot-toast';
import FormattedDate from '../components/FormattedDate';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'attendant' | 'admin',
    is_active: true
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'user' as 'user' | 'attendant' | 'admin',
    is_active: true
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDefaultPassword, setImportDefaultPassword] = useState('');
  const [importUpdateExisting, setImportUpdateExisting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    invalid: number;
    validRows: Array<{ rowIndex: number; data: Record<string, unknown> }>;
    invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    invalidCount: number;
    invalidRows: Array<{ rowIndex: number; errors: string[] }>;
  } | null>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);

  const [showEntraModal, setShowEntraModal] = useState(false);
  const [entraUsers, setEntraUsers] = useState<EntraUserListItem[]>([]);
  const [entraSearch, setEntraSearch] = useState('');
  const [entraPage, setEntraPage] = useState(1);
  const [loadingEntraList, setLoadingEntraList] = useState(false);
  const [loadingEntraImport, setLoadingEntraImport] = useState(false);
  const [selectedEntraIds, setSelectedEntraIds] = useState<Set<string>>(new Set());
  const [entraImportRole, setEntraImportRole] = useState<'user' | 'attendant' | 'admin'>('user');

  useEffect(() => {
    fetchUsers();
  }, [currentPage]);

  const fetchEntraUsers = async () => {
    setLoadingEntraList(true);
    try {
      const data = await apiService.getEntraUsersList({ page: entraPage, limit: 20, search: entraSearch || undefined });
      setEntraUsers(data.users);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Erro ao listar usuários do Entra ID');
      setEntraUsers([]);
    } finally {
      setLoadingEntraList(false);
    }
  };

  useEffect(() => {
    if (showEntraModal) fetchEntraUsers();
  }, [showEntraModal, entraPage, entraSearch]);

  const handleEntraSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setEntraPage(1);
    fetchEntraUsers();
  };

  const toggleEntraSelect = (id: string) => {
    setSelectedEntraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImportEntra = async () => {
    if (selectedEntraIds.size === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }
    setLoadingEntraImport(true);
    let ok = 0;
    let err = 0;
    for (const id of selectedEntraIds) {
      const u = entraUsers.find((x) => x.id === id);
      if (!u) continue;
      try {
        await apiService.importEntraUser({
          microsoft_id: u.id,
          email: u.mail || u.userPrincipalName,
          name: u.displayName,
          job_title: u.jobTitle || undefined,
          role: entraImportRole
        });
        ok++;
      } catch {
        err++;
      }
    }
    setLoadingEntraImport(false);
    if (ok) {
      toast.success(`${ok} usuário(s) importado(s)`);
      setShowEntraModal(false);
      setSelectedEntraIds(new Set());
      fetchUsers();
    }
    if (err) toast.error(`${err} falha(s) na importação`);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsers(currentPage, 10);
      setUsers(response.data);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      console.log('🔍 DEBUG FRONTEND - Dados sendo enviados:', createForm);
      
      // Garantir que is_active seja boolean
      const userData = {
        ...createForm,
        is_active: Boolean(createForm.is_active)
      };
      
      console.log('🔍 DEBUG FRONTEND - Dados processados:', userData);
      
      await apiService.createUser(userData);
      toast.success('Usuário criado com sucesso!');
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
        is_active: true
      });
      fetchUsers();
    } catch (error: any) {
      console.error('❌ ERRO FRONTEND:', error);
      toast.error(error.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setCreateForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setLoadingExport(true);
    try {
      await apiService.exportUsers(format);
      toast.success(`Exportação ${format.toUpperCase()} concluída`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Sem permissão ou erro ao exportar');
    } finally {
      setLoadingExport(false);
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo CSV ou JSON');
      return;
    }
    setLoadingPreview(true);
    setImportResult(null);
    try {
      const data = await apiService.importUsersPreview(importFile);
      setImportPreview(data);
      toast.success(`Pré-visualização: ${data.valid} válida(s), ${data.invalid} inválida(s)`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Erro ao analisar arquivo');
      setImportPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo');
      return;
    }
    if (!importDefaultPassword.trim() || importDefaultPassword.length < 6) {
      toast.error('Senha padrão obrigatória (mín. 6 caracteres) para novos usuários');
      return;
    }
    setLoadingImport(true);
    try {
      const data = await apiService.importUsers(importFile, importDefaultPassword, importUpdateExisting);
      setImportResult(data);
      toast.success(`Importação concluída: ${data.created} criado(s), ${data.updated} atualizado(s)`);
      fetchUsers();
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.details?.join?.(' ') || 'Erro ao importar';
      toast.error(msg);
    } finally {
      setLoadingImport(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: Boolean(user.is_active)
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setEditLoading(true);
    try {
      // Garantir que os dados estão no formato correto
      const updateData = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        is_active: Boolean(editForm.is_active)
      };
      
      await apiService.updateUser(editingUser.id, updateData);
      toast.success('Usuário atualizado com sucesso!');
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar usuário');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
      try {
        await apiService.deleteUser(userId);
        toast.success('Usuário excluído com sucesso!');
        fetchUsers();
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
      }
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'attendant':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getRoleText = (role: string) => {
    const roleMap = {
      admin: 'Administrador',
      attendant: 'Atendente',
      user: 'Usuário'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'attendant':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuários</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie todos os usuários do sistema</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/system-config"
            className="btn btn-outline flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </Link>
          <button
            type="button"
            onClick={() => { setShowEntraModal(true); setEntraPage(1); setEntraSearch(''); setSelectedEntraIds(new Set()); }}
            className="btn btn-outline flex items-center space-x-2"
          >
            <Building2 className="w-4 h-4" />
            <span>Importar do Entra ID</span>
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            <Search className="w-4 h-4 mr-2" />
            Buscar
          </button>
        </form>
      </div>

      {/* Exportar / Importar usuários */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2" />
          Exportar / Importar usuários
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Exporte em CSV ou JSON. Na importação, use o mesmo formato; senha nunca é alterada — defina uma senha padrão para novos usuários.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Exportar</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={loadingExport}
                className="btn btn-outline btn-sm"
              >
                {loadingExport ? '...' : 'CSV'}
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                disabled={loadingExport}
                className="btn btn-outline btn-sm"
              >
                {loadingExport ? '...' : 'JSON'}
              </button>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Importar</h4>
            <div className="space-y-2">
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportPreview(null);
                  setImportResult(null);
                }}
                className="block w-full text-sm text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary-50 file:text-primary-700 dark:file:bg-primary-900/30 dark:file:text-primary-300"
              />
              <input
                type="password"
                placeholder="Senha padrão (novos usuários)"
                value={importDefaultPassword}
                onChange={(e) => setImportDefaultPassword(e.target.value)}
                className="input w-full text-sm"
                minLength={6}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={importUpdateExisting}
                  onChange={(e) => setImportUpdateExisting(e.target.checked)}
                />
                Atualizar usuários existentes (por email)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleImportPreview}
                  disabled={!importFile || loadingPreview}
                  className="btn btn-outline btn-sm flex items-center"
                >
                  <FileCheck className="w-4 h-4 mr-1" />
                  {loadingPreview ? 'Analisando...' : 'Pré-visualizar'}
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!importFile || !importDefaultPassword || loadingImport}
                  className="btn btn-primary btn-sm flex items-center"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {loadingImport ? 'Importando...' : 'Importar'}
                </button>
              </div>
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
                        <td className="py-1 pr-2 text-gray-600 dark:text-gray-400 font-mono text-xs">
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
              Criados: {importResult.created} — Atualizados: {importResult.updated} — Linhas inválidas: {importResult.invalidCount}
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

      {/* Modal Importar do Entra ID */}
      {showEntraModal && (
      <Modal
        title="Importar usuários do Entra ID"
        onClose={() => { setShowEntraModal(false); setSelectedEntraIds(new Set()); }}
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Liste os usuários do seu diretório Microsoft e importe para o sistema. Apenas usuários importados poderão fazer login com Microsoft.
          </p>
          <form onSubmit={handleEntraSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={entraSearch}
              onChange={(e) => setEntraSearch(e.target.value)}
              className="input flex-1"
            />
            <button type="submit" className="btn btn-primary" disabled={loadingEntraList}>
              {loadingEntraList ? '...' : 'Buscar'}
            </button>
          </form>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              Papel para importação:
              <select
                value={entraImportRole}
                onChange={(e) => setEntraImportRole(e.target.value as 'user' | 'attendant' | 'admin')}
                className="input ml-2 py-1"
              >
                <option value="user">Usuário</option>
                <option value="attendant">Atendente</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          </div>
          <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
            {loadingEntraList ? (
              <div className="p-4 text-center text-gray-500">Carregando...</div>
            ) : entraUsers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Nenhum usuário encontrado. Ajuste a busca ou verifique a configuração do Entra ID.</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="w-10 px-2 py-2" />
                    <th className="text-left px-2 py-2">Nome</th>
                    <th className="text-left px-2 py-2">E-mail</th>
                    <th className="text-left px-2 py-2">Cargo</th>
                    <th className="text-left px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {entraUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedEntraIds.has(u.id)}
                          onChange={() => toggleEntraSelect(u.id)}
                          disabled={u.alreadyImported}
                        />
                      </td>
                      <td className="px-2 py-2 font-medium">{u.displayName}</td>
                      <td className="px-2 py-2 text-gray-600 dark:text-gray-400">{u.mail || u.userPrincipalName}</td>
                      <td className="px-2 py-2 text-gray-500">{u.jobTitle || '—'}</td>
                      <td className="px-2 py-2">
                        {u.alreadyImported ? (
                          <span className="text-green-600 dark:text-green-400 text-xs">Já importado</span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowEntraModal(false)} className="btn btn-outline">
              Fechar
            </button>
            <button
              type="button"
              onClick={handleImportEntra}
              disabled={selectedEntraIds.size === 0 || loadingEntraImport}
              className="btn btn-primary"
            >
              {loadingEntraImport ? 'Importando...' : `Importar (${selectedEntraIds.size})`}
            </button>
          </div>
        </div>
      </Modal>
      )}

      {/* Users List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cargo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users && users.length > 0 ? users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <UserAvatar user={user} size="md" />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.job_title || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(user.role)}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {getRoleText(user.role)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <FormattedDate date={user.created_at} includeTime={false} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Editar usuário"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn btn-outline btn-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-sm"
              >
                Próximo
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Página <span className="font-medium">{currentPage}</span> de{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-outline btn-sm rounded-l-md"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-outline btn-sm rounded-r-md"
                  >
                    Próximo
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Usuário */}
      {showEditModal && editingUser && (
        <Modal title="Editar Usuário" size="sm" onClose={() => setShowEditModal(false)}>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label htmlFor="edit_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  id="edit_name"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditInputChange}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit_email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="edit_email"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditInputChange}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit_role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Função *
                </label>
                <select
                  id="edit_role"
                  name="role"
                  value={editForm.role}
                  onChange={handleEditInputChange}
                  className="input w-full"
                  required
                >
                  <option value="user">Usuário</option>
                  <option value="attendant">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={editForm.is_active}
                  onChange={handleEditInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded flex-shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Usuário ativo</span>
              </label>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn btn-primary"
                >
                  {editLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* Modal de Criação de Usuário */}
      {showCreateModal && (
        <Modal title="Novo Usuário" size="sm" onClose={() => setShowCreateModal(false)}>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={createForm.name}
                  onChange={handleInputChange}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={createForm.email}
                  onChange={handleInputChange}
                  className="input w-full"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Senha *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={createForm.password}
                  onChange={handleInputChange}
                  className="input w-full"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1">
                  Função *
                </label>
                <select
                  id="role"
                  name="role"
                  value={createForm.role}
                  onChange={handleInputChange}
                  className="input w-full"
                  required
                >
                  <option value="user">Usuário</option>
                  <option value="attendant">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 w-fit transition-colors">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={createForm.is_active}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded flex-shrink-0"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 select-none">Usuário ativo</span>
              </label>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn btn-primary"
                >
                  {createLoading ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
};

export default Users;
