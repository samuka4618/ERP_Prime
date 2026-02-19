import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Shield, 
  Calendar, 
  Edit, 
  Save, 
  X,
  Eye,
  EyeOff,
  Phone,
  Building2,
  Briefcase,
  FileText,
  Linkedin,
  MessageCircle,
  Camera,
  UserCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import FormattedDate from '../components/FormattedDate';
import axios from 'axios';
import clsx from 'clsx';

const Profile: React.FC = () => {
  const { user, refreshUser, updateUserDirectly } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarKey, setAvatarKey] = useState(0); // Para forçar re-render da imagem
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
    position: user?.position || '',
    extension: user?.extension || '',
    bio: user?.bio || '',
    linkedin: user?.linkedin || '',
    skype: user?.skype || '',
    hire_date: user?.hire_date 
      ? (typeof user.hire_date === 'string' 
          ? user.hire_date.split('T')[0] 
          : user.hire_date instanceof Date 
            ? user.hire_date.toISOString().split('T')[0]
            : '')
      : '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Função para carregar dados do usuário no formData
  const loadUserData = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
        position: user.position || '',
        extension: user.extension || '',
        bio: user.bio || '',
        linkedin: user.linkedin || '',
        skype: user.skype || '',
        hire_date: user.hire_date 
          ? (typeof user.hire_date === 'string' 
              ? user.hire_date.split('T')[0] 
              : user.hire_date instanceof Date 
                ? user.hire_date.toISOString().split('T')[0]
                : '')
          : '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    }
  };

  // Atualizar formData quando user mudar
  useEffect(() => {
    loadUserData();
    // Forçar re-render da imagem quando o avatar mudar
    if (user?.avatar) {
      setAvatarKey(prev => prev + 1);
    }
  }, [user, user?.avatar]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se o usuário está carregado
    if (!user || !user.id) {
      toast.error('Erro: Usuário não encontrado. Por favor, faça login novamente.');
      return;
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Apenas imagens são aceitas.');
      return;
    }

    // Validar tamanho (máximo 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Tamanho máximo: 2MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append('attachment', file);

      const hostname = window.location.hostname;
      const port = window.location.port || '3004'; // Usar porta atual ou padrão 3004
      const baseURL = hostname === 'localhost' || hostname === '127.0.0.1' 
        ? '/api' 
        : `${window.location.protocol}//${hostname}:${port}/api`;
      
      const response = await axios.post(`${baseURL}/users/${user.id}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });

      if (response.data?.data?.user) {
        const updatedUser = response.data.data.user;
        
        console.log('📸 Avatar upload response:', {
          user: updatedUser,
          avatar: updatedUser.avatar,
          avatar_url: response.data?.data?.avatar_url
        });
        
        // Atualizar o contexto diretamente com os dados retornados (evita perda de autenticação)
        updateUserDirectly(updatedUser);
        
        // Forçar re-render da imagem
        setAvatarKey(prev => prev + 1);
        
        toast.success('Foto de perfil atualizada com sucesso!');
        
        // Atualizar formData com os novos dados
        setTimeout(() => {
          loadUserData();
        }, 100);
      } else {
        toast.error('Resposta inválida do servidor');
      }
    } catch (error: any) {
      console.error('Erro ao fazer upload do avatar:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao fazer upload da foto';
      toast.error(errorMessage);
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
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
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        department: formData.department.trim() || undefined,
        position: formData.position.trim() || undefined,
        extension: formData.extension.trim() || undefined,
        bio: formData.bio.trim() || undefined,
        linkedin: formData.linkedin.trim() || undefined,
        skype: formData.skype.trim() || undefined,
        hire_date: formData.hire_date || undefined,
        // Preservar o avatar atual se não estiver sendo alterado
        avatar: user?.avatar || undefined
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      if (!user || !user.id) {
        toast.error('Erro: Usuário não encontrado. Por favor, faça login novamente.');
        return;
      }

      const response = await apiService.updateUser(user.id, updateData);
      
      // Atualizar o contexto diretamente com os dados retornados (evita perda de autenticação)
      if (response) {
        updateUserDirectly(response);
      } else {
        // Se não retornar dados, fazer refresh
        await refreshUser();
      }
      
      toast.success('Perfil atualizado com sucesso');
      
      // Atualizar formData e sair do modo de edição
      setTimeout(() => {
        loadUserData();
        setIsEditing(false);
      }, 100);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar perfil');
    }
  };

  const handleEdit = () => {
    // Carregar dados atuais do usuário antes de entrar em modo de edição
    loadUserData();
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Restaurar dados originais do usuário
    loadUserData();
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
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'attendant':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie suas informações pessoais e corporativas</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="btn btn-primary flex items-center space-x-2"
          >
            <Edit className="w-4 h-4" />
            <span>Editar Perfil</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Pessoais */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Informações Pessoais</h3>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                    className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                    className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="(00) 00000-0000"
                    className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                  />
                </div>

                <div>
                  <label htmlFor="extension" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Ramal
                  </label>
                  <input
                    type="text"
                    id="extension"
                    name="extension"
                    value={formData.extension}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Ex: 1234"
                    maxLength={10}
                    className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                  />
                </div>
              </div>

              {/* Informações Corporativas */}
              <div className="border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Informações Corporativas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      Departamento
                    </label>
                    <input
                      type="text"
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Ex: TI, Financeiro, RH"
                      className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>

                  <div>
                    <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Briefcase className="w-4 h-4 inline mr-1" />
                      Cargo/Posição
                    </label>
                    <input
                      type="text"
                      id="position"
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Ex: Desenvolvedor, Analista, Gerente"
                      className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Data de Admissão
                    </label>
                    <input
                      type="date"
                      id="hire_date"
                      name="hire_date"
                      value={formData.hire_date || ''}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Biografia/Descrição
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      disabled={!isEditing}
                      rows={3}
                      placeholder="Descreva brevemente sua função e responsabilidades..."
                      className={clsx("input mt-1 resize-none", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>
                </div>
              </div>

              {/* Redes Sociais e Contatos */}
              <div className="border-t pt-6">
                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Redes Sociais e Contatos</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="linkedin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Linkedin className="w-4 h-4 inline mr-1" />
                      LinkedIn
                    </label>
                    <input
                      type="url"
                      id="linkedin"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="https://linkedin.com/in/seu-perfil"
                      className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>

                  <div>
                    <label htmlFor="skype" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      <MessageCircle className="w-4 h-4 inline mr-1" />
                      Skype/Teams
                    </label>
                    <input
                      type="text"
                      id="skype"
                      name="skype"
                      value={formData.skype}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Seu usuário do Skype ou Teams"
                      className={clsx("input mt-1", !isEditing && 'bg-gray-50 dark:bg-gray-800')}
                    />
                  </div>
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
                          placeholder="Digite sua senha atual (opcional)"
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
                          placeholder="Deixe em branco para não alterar"
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
            <div className="relative inline-block mb-4">
              {user?.avatar ? (
                <img 
                  key={`avatar-${user.id}-${user.avatar}-${avatarKey}`} // Forçar re-render quando avatar mudar
                  src={`/${user.avatar}?v=${Date.now()}`} 
                  alt={user.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary-200 dark:border-primary-800 shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const attemptedSrc = target.src;
                    const avatarPath = user?.avatar || '';
                    console.error('❌ Erro ao carregar avatar:', {
                      avatar: avatarPath,
                      attemptedSrc: attemptedSrc,
                      userId: user?.id,
                      fullPath: window.location.origin + `/${avatarPath}`,
                      expectedPath: `/${avatarPath}`,
                      staticPath: '/storage/avatars/' + avatarPath.replace('storage/avatars/', '')
                    });
                    // Tentar caminho alternativo se o primeiro falhar
                    if (!attemptedSrc.includes('retry') && avatarPath) {
                      const altSrc = avatarPath.startsWith('storage/avatars/') 
                        ? `/${avatarPath}` 
                        : `/storage/avatars/${avatarPath.replace('storage/avatars/', '')}`;
                      console.log('🔄 Tentando caminho alternativo:', altSrc);
                      target.src = altSrc + `?v=${Date.now()}&retry=1`;
                    } else {
                      // Se já tentou alternativo, mostrar fallback
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }
                  }}
                  onLoad={() => {
                    console.log('✅ Avatar carregado com sucesso:', {
                      avatar: user.avatar,
                      src: `/${user.avatar}`
                    });
                  }}
                />
              ) : null}
              <div 
                className={clsx(
                  "w-32 h-32 rounded-full flex items-center justify-center mx-auto border-4 border-primary-200 dark:border-primary-800 shadow-lg",
                  user?.avatar ? 'hidden' : 'flex',
                  "bg-gradient-to-br from-primary-500 to-primary-700"
                )}
              >
                {user?.avatar ? null : (
                  <UserCircle className="w-16 h-16 text-white" />
                )}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-2 cursor-pointer hover:bg-primary-700 transition-colors shadow-lg">
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</h3>
            {user?.position && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.position}</p>
            )}
            {user?.department && (
              <p className="text-xs text-gray-500 dark:text-gray-500">{user.department}</p>
            )}
            <span className={clsx("inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2", getRoleColor(user?.role || 'user'))}>
              {getRoleText(user?.role || 'user')}
            </span>
            {isEditing && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Clique no ícone da câmera para alterar a foto
              </p>
            )}
          </div>

          {/* Account Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informações da Conta</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Função</p>
                  <p className="text-sm text-gray-500 truncate">{getRoleText(user?.role || 'user')}</p>
                </div>
              </div>
              
              {user?.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Telefone</p>
                    <p className="text-sm text-gray-500 truncate">{user.phone}</p>
                  </div>
                </div>
              )}

              {user?.extension && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Ramal</p>
                    <p className="text-sm text-gray-500 truncate">{user.extension}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Membro desde</p>
                  <p className="text-sm text-gray-500 truncate">
                    {user?.created_at ? <FormattedDate date={user.created_at} /> : 'N/A'}
                  </p>
                </div>
              </div>

              {user?.hire_date && (
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Admissão</p>
                    <p className="text-sm text-gray-500 truncate">
                      {typeof user.hire_date === 'string' 
                        ? new Date(user.hire_date).toLocaleDateString('pt-BR')
                        : user.hire_date instanceof Date
                        ? user.hire_date.toLocaleDateString('pt-BR')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Status</p>
                  <p className="text-sm text-gray-500 truncate">
                    {user?.is_active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>

              {user?.linkedin && (
                <div className="flex items-center space-x-3">
                  <Linkedin className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">LinkedIn</p>
                    <a 
                      href={user.linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline truncate block"
                    >
                      Ver perfil
                    </a>
                  </div>
                </div>
              )}

              {user?.skype && (
                <div className="flex items-center space-x-3">
                  <MessageCircle className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Skype/Teams</p>
                    <p className="text-sm text-gray-500 truncate">{user.skype}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {user?.bio && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Sobre</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{user.bio}</p>
            </div>
          )}

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
