import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Edit, 
  Save, 
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import FormattedDate from '../components/FormattedDate';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    try {
      const updateData: any = {
        name: formData.name.trim(),
        email: formData.email.trim()
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      await apiService.updateUser(user!.id, updateData);
      toast.success('Perfil atualizado com sucesso');
      setIsEditing(false);
      setFormData({
        name: formData.name,
        email: formData.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar perfil');
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditing(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">Meu Perfil</h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Gerencie suas informações pessoais</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Edit className="w-4 h-4" />
            <span>Editar Perfil</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white mb-6">Informações Pessoais</h3>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input mt-1 ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`input mt-1 ${!isEditing ? 'bg-gray-50' : ''}`}
                  />
                </div>
              </div>

              {isEditing && (
                <div className="border-t pt-6">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Alterar Senha</h4>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Senha Atual
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          id="currentPassword"
                          name="currentPassword"
                          value={formData.currentPassword}
                          onChange={handleChange}
                          className="input pr-10"
                          placeholder="Digite sua senha atual"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Nova Senha
                        </label>
                        <input
                          type="password"
                          id="newPassword"
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          className="input mt-1"
                          placeholder="Digite a nova senha"
                        />
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Confirmar Nova Senha
                        </label>
                        <input
                          type="password"
                          id="confirmPassword"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="input mt-1"
                          placeholder="Confirme a nova senha"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="btn btn-outline flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancelar</span>
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Picture */}
          <div className="card p-6 text-center">
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</h3>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${getRoleColor(user?.role || 'user')}`}>
              {getRoleText(user?.role || 'user')}
            </span>
          </div>

          {/* Account Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações da Conta</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Função</p>
                  <p className="text-sm text-gray-500">{getRoleText(user?.role || 'user')}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Membro desde</p>
                  <p className="text-sm text-gray-500">
                    {user?.created_at ? <FormattedDate date={user.created_at} /> : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Status</p>
                  <p className="text-sm text-gray-500">
                    {user?.is_active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Tips */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dicas de Segurança</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• Use uma senha forte e única</li>
              <li>• Não compartilhe suas credenciais</li>
              <li>• Faça logout ao sair do sistema</li>
              <li>• Mantenha seus dados atualizados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
