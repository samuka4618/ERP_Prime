import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { Shield, Save, Users, UserCheck } from 'lucide-react';

interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  description: string | null;
  granted: boolean;
}

interface PermissionsByModule {
  [module: string]: Permission[];
}

const PermissionsPage: React.FC = () => {
  const { } = useAuth();
  const { refreshPermissions } = usePermissions();
  const [permissionsByModule, setPermissionsByModule] = useState<PermissionsByModule>({});
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>({});
  const [selectedRole, setSelectedRole] = useState<'user' | 'attendant' | 'admin'>('user');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'role' | 'user'>('role');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (viewMode === 'role') {
      fetchRolePermissions(selectedRole);
    } else if (selectedUserId) {
      fetchUserPermissions(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, selectedUserId, viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [modulesData, usersData] = await Promise.all([
        apiService.getPermissionsByModule(),
        apiService.get('/users')
      ]);

      // Garantir que modulesData é um objeto válido com arrays
      const modules: PermissionsByModule = {};
      if (modulesData && typeof modulesData === 'object') {
        Object.entries(modulesData).forEach(([module, perms]) => {
          if (Array.isArray(perms)) {
            modules[module] = perms;
          }
        });
      }
      setPermissionsByModule(modules);
      
      // A API retorna { message, data: { data: [...], total, page, total_pages } }
      let users: any[] = [];
      if (usersData) {
        if (usersData.data && usersData.data.data && Array.isArray(usersData.data.data)) {
          // Estrutura: { data: { data: [...] } }
          users = usersData.data.data;
        } else if (Array.isArray(usersData.data)) {
          // Estrutura: { data: [...] }
          users = usersData.data;
        } else if (Array.isArray(usersData)) {
          // Estrutura: [...]
          users = usersData;
        }
      }
      setUserList(Array.isArray(users) ? users : []);

      // Carregar permissões de todos os roles
      const roles: ('user' | 'attendant' | 'admin')[] = ['user', 'attendant', 'admin'];
      const rolePerms: Record<string, Permission[]> = {};
      
      for (const role of roles) {
        const perms = await apiService.getRolePermissions(role);
        // Garantir que perms é um array
        rolePerms[role] = Array.isArray(perms) ? perms : [];
      }
      
      setRolePermissions(rolePerms);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar permissões');
      setPermissionsByModule({});
      setRolePermissions({});
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (role: 'user' | 'attendant' | 'admin') => {
    try {
      const permissions = await apiService.getRolePermissions(role);
      // Garantir que permissions é um array
      const permsArray = Array.isArray(permissions) ? permissions : [];
      setRolePermissions(prev => ({ ...prev, [role]: permsArray }));
    } catch (error) {
      console.error('Erro ao carregar permissões do role:', error);
      toast.error('Erro ao carregar permissões do role');
      setRolePermissions(prev => ({ ...prev, [role]: [] }));
    }
  };

  const fetchUserPermissions = async (userId: number) => {
    try {
      // Buscar permissões do usuário
      // O backend retorna TODAS as permissões do sistema com o status correto (granted: true/false)
      const response = await apiService.getUserPermissions(userId);
      let userPermissions: Permission[] = [];
      
      if (Array.isArray(response)) {
        userPermissions = response;
      } else if (response && Array.isArray(response.data)) {
        userPermissions = response.data;
      } else if (response && response.data && Array.isArray(response.data.data)) {
        userPermissions = response.data.data;
      } else {
        console.error('Resposta da API não é um array:', response);
        toast.error('Formato de resposta inválido');
        return;
      }

      // Organizar permissões por módulo diretamente do que o backend retornou
      // O backend já retorna todas as permissões com o status correto, então não precisamos fazer merge
      const updated: PermissionsByModule = {};
      console.log('[fetchUserPermissions] Processando permissões do usuário:', userPermissions.length);
      userPermissions.forEach((perm: Permission) => {
        if (perm && perm.id !== undefined && perm.module) {
          if (!updated[perm.module]) {
            updated[perm.module] = [];
          }
          const grantedValue = perm.granted === true; // Garantir que é boolean
          console.log(`[fetchUserPermissions] Permissão ${perm.id} (${perm.code}): granted=${perm.granted} (tipo: ${typeof perm.granted}) -> ${grantedValue}`);
          updated[perm.module].push({
            id: perm.id,
            name: perm.name,
            code: perm.code,
            module: perm.module,
            description: perm.description,
            granted: grantedValue
          });
        }
      });
      console.log('[fetchUserPermissions] Permissões organizadas por módulo:', Object.keys(updated).map(m => ({ module: m, count: updated[m].length })));

      // Ordenar permissões dentro de cada módulo por nome
      Object.keys(updated).forEach(module => {
        updated[module].sort((a, b) => a.name.localeCompare(b.name));
      });

      setPermissionsByModule(updated);
    } catch (error) {
      console.error('Erro ao carregar permissões do usuário:', error);
      toast.error('Erro ao carregar permissões do usuário');
    }
  };

  const handlePermissionToggle = (permissionId: number, granted: boolean) => {
    console.log(`[handlePermissionToggle] permissionId=${permissionId}, granted=${granted}, viewMode=${viewMode}`);
    if (viewMode === 'role') {
      const currentRolePerms = rolePermissions[selectedRole];
      if (Array.isArray(currentRolePerms)) {
        const updated = currentRolePerms.map(p =>
          p.id === permissionId ? { ...p, granted } : p
        );
        setRolePermissions(prev => ({ ...prev, [selectedRole]: updated }));
      }
    } else {
      // Para usuário, atualizar permissionsByModule
      const updated: PermissionsByModule = {};
      let found = false;
      Object.keys(permissionsByModule).forEach(module => {
        const perms = permissionsByModule[module];
        if (Array.isArray(perms)) {
          updated[module] = perms.map(p => {
            if (p.id === permissionId) {
              found = true;
              console.log(`  → Atualizando permissão ${p.id} (${p.code}) de ${p.granted} para ${granted}`);
              return { ...p, granted };
            }
            return p;
          });
        } else {
          updated[module] = [];
        }
      });
      
      if (!found) {
        console.warn(`[handlePermissionToggle] Permissão ${permissionId} não encontrada no permissionsByModule!`);
        console.log(`[handlePermissionToggle] Módulos disponíveis:`, Object.keys(permissionsByModule));
        Object.keys(permissionsByModule).forEach(module => {
          console.log(`[handlePermissionToggle] Módulo ${module}:`, permissionsByModule[module]?.map(p => ({ id: p.id, code: p.code })));
        });
      }
      
      console.log(`[handlePermissionToggle] Estado atualizado, novo permissionsByModule:`, updated);
      setPermissionsByModule(updated);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (viewMode === 'role') {
        const currentRolePerms = rolePermissions[selectedRole];
        if (Array.isArray(currentRolePerms)) {
          const permissions = currentRolePerms.map(p => ({
            permissionId: p.id,
            granted: p.granted
          }));
          await apiService.updateRolePermissions(selectedRole, permissions);
          toast.success(`Permissões do role ${selectedRole} atualizadas com sucesso`);
        }
      } else if (selectedUserId) {
        // Buscar permissões do role do usuário para comparar
        const user = userList.find(u => u.id === selectedUserId);
        if (!user) {
          toast.error('Usuário não encontrado');
          return;
        }

        // Buscar permissões padrão do role
        const rolePerms = await apiService.getRolePermissions(user.role);
        const rolePermsMap = new Map<number, boolean>();
        if (Array.isArray(rolePerms)) {
          rolePerms.forEach(p => {
            if (p && p.id) {
              rolePermsMap.set(p.id, p.granted === true);
            }
          });
        }

        // Para admin: se não há permissão explícita no role, o padrão é true
        const isAdmin = user.role === 'admin';
        const getDefaultGranted = (permissionId: number): boolean => {
          if (isAdmin) {
            // Admin tem tudo por padrão, a menos que esteja explicitamente negado no role
            return rolePermsMap.has(permissionId) ? rolePermsMap.get(permissionId)! : true;
          } else {
            // Outros roles: padrão é false, a menos que esteja explicitamente permitido
            return rolePermsMap.get(permissionId) || false;
          }
        };

        // Buscar permissões atuais do usuário para comparar
        const currentUserPerms = await apiService.getUserPermissions(selectedUserId);
        let currentUserPermsArray: Permission[] = [];
        if (Array.isArray(currentUserPerms)) {
          currentUserPermsArray = currentUserPerms;
        } else if (currentUserPerms && Array.isArray(currentUserPerms.data)) {
          currentUserPermsArray = currentUserPerms.data;
        }
        
        const currentUserPermsMap = new Map<number, { granted: boolean; source: string }>();
        currentUserPermsArray.forEach((p: any) => {
          if (p && p.id !== undefined) {
            currentUserPermsMap.set(p.id, {
              granted: p.granted === true,
              source: p.source || 'role'
            });
          }
        });

        // Converter permissionsByModule para array
        // Estratégia: Comparar o estado atual na UI com o estado atual no backend
        // Se diferente, criar/atualizar permissão individual
        const allPermissions: Array<{ permissionId: number; granted: boolean | null }> = [];
        
        console.log('[handleSave] permissionsByModule:', Object.keys(permissionsByModule).map(m => ({ 
          module: m, 
          count: permissionsByModule[m]?.length || 0,
          permissionIds: permissionsByModule[m]?.map(p => p.id) || []
        })));
        
        // Verificar se a permissão 24 está no permissionsByModule
        let hasPermission24 = false;
        Object.values(permissionsByModule).forEach(perms => {
          if (Array.isArray(perms)) {
            perms.forEach(perm => {
              if (perm && perm.id === 24) {
                hasPermission24 = true;
                console.log(`[handleSave] Permissão 24 encontrada no módulo:`, perm);
              }
            });
          }
        });
        
        if (!hasPermission24) {
          console.error('[handleSave] PERMISSÃO 24 NÃO ENCONTRADA NO permissionsByModule!');
        }
        
        Object.values(permissionsByModule).forEach(perms => {
          if (Array.isArray(perms)) {
            perms.forEach(perm => {
              if (perm && perm.id) {
                const defaultGranted = getDefaultGranted(perm.id);
                const currentPerm = currentUserPermsMap.get(perm.id);
                
                // IMPORTANTE: Converter explicitamente para boolean ANTES de qualquer comparação
                const uiGranted = Boolean(perm.granted);
                const defaultGrantedBool = Boolean(defaultGranted);
                
                // Determinar o estado atual efetivo no backend
                // Se há permissão individual, usar ela; senão, usar o padrão do role
                let backendGranted: boolean;
                if (currentPerm && currentPerm.source === 'user') {
                  // Há permissão individual explícita
                  backendGranted = Boolean(currentPerm.granted);
                } else {
                  // Não há permissão individual, usar o padrão do role
                  backendGranted = defaultGrantedBool;
                }
                
                // Log especial para permissão 24
                if (perm.id === 24) {
                  console.log(`[handleSave] ⚠️ PERMISSÃO 24 - ANTES DA LÓGICA:`, {
                    uiGranted,
                    uiGrantedRaw: perm.granted,
                    backendGranted,
                    defaultGrantedBool,
                    currentPerm: currentPerm ? { source: currentPerm.source, granted: currentPerm.granted } : null,
                    uiVsBackend: uiGranted !== backendGranted
                  });
                }
                
                // Se o valor na UI mudou em relação ao estado atual no backend
                if (uiGranted !== backendGranted) {
                  // LÓGICA SIMPLIFICADA:
                  // 1. Se o novo valor é igual ao padrão do role E já existe permissão individual → remover
                  // 2. Caso contrário → criar/atualizar permissão individual com o valor da UI
                  
                  const hasIndividualPermission = currentPerm && currentPerm.source === 'user';
                  const wantsToReturnToDefault = uiGranted === defaultGrantedBool;
                  
                  if (perm.id === 24) {
                    console.log(`[handleSave] ⚠️ PERMISSÃO 24 - DECISÃO:`, {
                      hasIndividualPermission,
                      wantsToReturnToDefault,
                      willRemove: wantsToReturnToDefault && hasIndividualPermission,
                      willCreate: !(wantsToReturnToDefault && hasIndividualPermission)
                    });
                  }
                  
                  if (wantsToReturnToDefault && hasIndividualPermission) {
                    // O usuário quer voltar ao padrão do role, remover permissão individual
                    allPermissions.push({
                      permissionId: perm.id,
                      granted: null // null remove permissão individual
                    });
                    if (perm.id === 24) {
                      console.log(`[handleSave] ⚠️ PERMISSÃO 24: REMOVENDO (UI=${uiGranted} === Default=${defaultGrantedBool} e há permissão individual)`);
                    }
                  } else {
                    // Criar ou atualizar permissão individual com o valor da UI
                    // IMPORTANTE: Sempre enviar false ou true, nunca null aqui
                    allPermissions.push({
                      permissionId: perm.id,
                      granted: uiGranted // false ou true
                    });
                    if (perm.id === 24) {
                      console.log(`[handleSave] ⚠️ PERMISSÃO 24: CRIANDO/ATUALIZANDO com granted=${uiGranted}`);
                    }
                  }
                } else {
                  if (perm.id === 24) {
                    console.log(`[handleSave] ⚠️ PERMISSÃO 24: SEM MUDANÇAS (UI=${uiGranted} === Backend=${backendGranted})`);
                  }
                }
              } else {
                console.warn(`[handleSave] Permissão inválida encontrada:`, perm);
              }
            });
          } else {
            console.warn(`[handleSave] Array de permissões inválido:`, perms);
          }
        });
        
        console.log('[handleSave] Permissões a serem salvas:', allPermissions);
        console.log('[handleSave] Total de permissões a salvar:', allPermissions.length);
        console.log('[handleSave] Permissão 24 está no array?', allPermissions.some(p => p.permissionId === 24));
        
        // Só fazer a requisição se houver mudanças
        if (allPermissions.length > 0) {
          await apiService.updateUserPermissions(selectedUserId, allPermissions);
          toast.success('Permissões do usuário atualizadas com sucesso');
        } else {
          toast('Nenhuma alteração para salvar', { icon: 'ℹ️' });
        }
        
        // Recarregar permissões do usuário para refletir as mudanças
        await fetchUserPermissions(selectedUserId);
        
        // Se o usuário editado é o usuário logado, atualizar permissões no contexto
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser.id === selectedUserId) {
          await refreshPermissions();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Calcular permissões atuais de forma segura
  const currentPermissions: Permission[] = (() => {
    if (viewMode === 'role') {
      const rolePerms = rolePermissions[selectedRole];
      return Array.isArray(rolePerms) ? rolePerms : [];
    } else {
      const allPerms: Permission[] = [];
      Object.values(permissionsByModule).forEach(perms => {
        if (Array.isArray(perms)) {
          perms.forEach(perm => {
            if (perm && perm.id) {
              allPerms.push(perm);
            }
          });
        }
      });
      return allPerms;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Shield className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Gerenciamento de Permissões
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Configure as permissões de acesso para roles e usuários individuais
          </p>
        </div>

        {/* Seleção de modo e target */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Modo de Visualização
              </label>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setViewMode('role');
                    setSelectedUserId(null);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'role'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Por Role</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode('user');
                    setSelectedUserId(null);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    viewMode === 'user'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Por Usuário</span>
                </button>
              </div>
            </div>

            {viewMode === 'role' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'user' | 'attendant' | 'admin')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="user">Usuário</option>
                  <option value="attendant">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Usuário
                </label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Selecione um usuário</option>
                  {Array.isArray(userList) && userList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Lista de permissões por módulo */}
        {((viewMode === 'role' && Array.isArray(rolePermissions[selectedRole])) || (viewMode === 'user' && selectedUserId)) && (
          <>
            <div className="space-y-6">
              {Object.entries(permissionsByModule)
                .filter(([_, permissions]) => Array.isArray(permissions) && permissions.length > 0)
                .map(([module, permissions]) => {
                  const permsArray = Array.isArray(permissions) ? (permissions as Permission[]) : [];
                  const modulePermissions = permsArray
                    .filter(perm => perm && perm.id) // Garantir que não há undefined
                    .map(perm => {
                      // currentPermissions já é garantido como array pela função acima
                      const current = currentPermissions.find(p => p && p.id === perm.id);
                      return current || perm;
                    });

                return (
                  <div key={module} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                      {module === 'tickets' ? 'Sistema de Chamados' :
                       module === 'registrations' ? 'Sistema de Cadastros' :
                       module === 'compras' ? 'Sistema de Compras' :
                       module === 'notifications' ? 'Notificações' :
                       module === 'administration' ? 'Administração' : module}
                    </h2>
                    
                    <div className="space-y-3">
                      {modulePermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {permission.name}
                            </div>
                            {permission.description && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {permission.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                              {permission.code}
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer ml-4">
                            <input
                              type="checkbox"
                              checked={permission.granted}
                              onChange={(e) => handlePermissionToggle(permission.id, e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botão Salvar */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Salvando...' : 'Salvar Permissões'}</span>
              </button>
            </div>
          </>
        )}

        {viewMode === 'user' && !selectedUserId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
            <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Selecione um usuário para gerenciar suas permissões individuais
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionsPage;

