import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';

export interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  description: string | null;
  granted: boolean;
  source: 'role' | 'user' | 'default';
  created_at: Date;
  updated_at: Date;
}

interface PermissionsContextType {
  permissions: Permission[];
  loading: boolean;
  loadingPermissions: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasAllPermissions: (...codes: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

interface PermissionsProviderProps {
  children: ReactNode;
}

export const PermissionsProvider: React.FC<PermissionsProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      logger.debug('Carregando permissões do usuário', { userId: user.id }, 'PERMISSIONS');
      
      // Usar o método getMyPermissions que já processa a resposta corretamente
      const response = await apiService.getMyPermissions();
      
      // A resposta já vem como array ou { data: Permission[] }
      let perms: Permission[] = [];
      if (Array.isArray(response)) {
        perms = response;
      } else if (response && response.data && Array.isArray(response.data)) {
        perms = response.data;
      } else if (response && Array.isArray(response)) {
        perms = response;
      }
      
      setPermissions(perms);
      
      // Log especial para permissão 24
      const perm24 = perms.find((p: Permission) => p.code === 'admin.dashboard.view');
      if (perm24) {
        console.log('[PermissionsContext] ⚠️ PERMISSÃO 24 carregada:', {
          code: perm24.code,
          granted: perm24.granted,
          source: perm24.source,
          grantedType: typeof perm24.granted,
          grantedValue: perm24.granted,
          willHaveAccess: perm24.granted === true
        });
      } else {
        console.warn('[PermissionsContext] ⚠️ PERMISSÃO 24 NÃO encontrada na lista!', {
          totalPerms: perms.length,
          codes: perms.map((p: Permission) => p.code).slice(0, 10)
        });
      }
      
      logger.success('Permissões carregadas', { count: perms.length }, 'PERMISSIONS');
    } catch (error) {
      logger.error('Erro ao carregar permissões', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'PERMISSIONS');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [isAuthenticated, user?.id]);

  const hasPermission = (code: string): boolean => {
    if (!user) {
      console.log(`[hasPermission] ${code}: false (sem usuário)`);
      return false;
    }
    
    const permission = permissions.find(p => p.code === code);
    
    // Se não encontrou a permissão na lista, retornar false
    if (!permission) {
      console.log(`[hasPermission] ${code}: false (permissão não encontrada)`);
      return false;
    }
    
    // IMPORTANTE: Verificar permissões individuais primeiro
    // Se há uma permissão individual (source === 'user'), ela prevalece sobre o role
    const result = permission.granted === true;
    
    // Log especial para permissão 24
    if (code === 'admin.dashboard.view') {
      console.log(`[hasPermission] ${code}:`, {
        granted: permission.granted,
        source: permission.source,
        result,
        permissionObject: permission
      });
    }
    
    return result;
  };

  const hasAnyPermission = (...codes: string[]): boolean => {
    return codes.some(code => hasPermission(code));
  };

  const hasAllPermissions = (...codes: string[]): boolean => {
    return codes.every(code => hasPermission(code));
  };

  const value: PermissionsContextType = {
    permissions,
    loading,
    loadingPermissions: loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: fetchPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

