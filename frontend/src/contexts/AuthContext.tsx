/**
 * Contexto de autenticação.
 * Usa cookie httpOnly para o token (segurança); usuário pode ser cacheado em localStorage.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, LoginRequest } from '../types';
import { apiService } from '../services/api';
import { logger } from '../utils/logger';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserDirectly: (updatedUser: User) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAttendant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      logger.debug('Inicializando autenticação (cookie httpOnly)', {}, 'AUTH');
      try {
        const profile = await apiService.getProfile();
        setUser(profile);
        setToken('cookie');
        localStorage.setItem('user', JSON.stringify(profile));
        logger.success('Sessão validada via cookie', { userId: profile.id }, 'AUTH');
      } catch {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        logger.debug('Sem sessão válida (cookie)', {}, 'AUTH');
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    logger.info('Iniciando processo de login no contexto', { email: credentials.email }, 'AUTH');
    
    try {
      const response = await apiService.login(credentials);
      setToken('cookie');
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
      if (response.token) localStorage.setItem('token', response.token);
      
      logger.success('Login concluído (cookie httpOnly)', { 
        userId: response.user.id,
        email: response.user.email,
        role: response.user.role
      }, 'AUTH');
      
      await trackActivity('login');
    } catch (error) {
      logger.error('Falha no login no contexto', { 
        email: credentials.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AUTH');
      throw error;
    }
  };

  const logout = async () => {
    logger.info('Iniciando processo de logout no contexto', { userId: user?.id }, 'AUTH');
    
    try {
      await apiService.logout();
    } catch (error) {
      logger.warn('Erro ao fazer logout no servidor, continuando com limpeza local', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'AUTH');
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      logger.success('Logout concluído no contexto', {}, 'AUTH');
    }
  };

  const refreshUser = async () => {
    if (!user && !token) return;
    
    try {
      const updatedUser = await apiService.getProfile();
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      logger.debug('Dados do usuário atualizados', { userId: updatedUser.id }, 'AUTH');
    } catch (error) {
      logger.warn('Erro ao atualizar dados do usuário', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'AUTH');
    }
  };

  // Função para atualizar o usuário diretamente (sem fazer nova requisição)
  const updateUserDirectly = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    logger.debug('Dados do usuário atualizados diretamente', { userId: updatedUser.id }, 'AUTH');
  };

  const trackActivity = async (activity: string) => {
    if (!user) return;
    
    try {
      await apiService.trackActivity(user.id, activity);
    } catch (error) {
      console.warn('Erro ao rastrear atividade:', error);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isAttendant = user?.role === 'attendant' || user?.role === 'admin';

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    refreshUser,
    updateUserDirectly,
    isAuthenticated,
    isAdmin,
    isAttendant,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
