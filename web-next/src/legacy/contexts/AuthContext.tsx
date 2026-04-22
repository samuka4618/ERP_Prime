/**
 * Contexto de autenticação.
 * Usa cookie httpOnly para o token (segurança); usuário pode ser cacheado em localStorage.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, LoginRequest } from '../types';
import { apiService } from '../services/api';
import { logger } from '../utils/logger';

const REMEMBER_ME_KEY = 'auth.rememberMe';
const USER_STORAGE_KEY = 'user';
const TOKEN_STORAGE_KEY = 'token';

const isRememberMeEnabled = (): boolean => localStorage.getItem(REMEMBER_ME_KEY) === '1';

const saveAuthUser = (user: User, rememberMe: boolean): void => {
  if (rememberMe) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    sessionStorage.removeItem(USER_STORAGE_KEY);
  } else {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.removeItem(USER_STORAGE_KEY);
  }
};

const clearAuthStorage = (): void => {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
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
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      const urlToken = params.get('token');
      const microsoft = params.get('microsoft');
      if (urlToken && microsoft === '1') {
        try {
          localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
          const profile = await apiService.getProfile();
          setUser(profile);
          setToken('cookie');
          // No login Microsoft, manter persistência longa por padrão.
          localStorage.setItem(REMEMBER_ME_KEY, '1');
          saveAuthUser(profile, true);
          logger.success('Login Microsoft concluído (token da URL)', { userId: profile.id }, 'AUTH');
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, '', window.location.pathname || '/');
          }
        } catch {
          setUser(null);
          setToken(null);
          clearAuthStorage();
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, '', `${window.location.pathname || '/'}?error=${encodeURIComponent('Falha ao validar token')}`);
          }
        }
        setLoading(false);
        return;
      }
      logger.debug('Inicializando autenticação (cookie httpOnly)', {}, 'AUTH');
      try {
        const profile = await apiService.getProfile();
        setUser(profile);
        setToken('cookie');
        saveAuthUser(profile, isRememberMeEnabled());
        logger.success('Sessão validada via cookie', { userId: profile.id }, 'AUTH');
      } catch {
        setUser(null);
        setToken(null);
        clearAuthStorage();
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
      const rememberMe = Boolean(credentials.rememberMe);
      setToken('cookie');
      setUser(response.user);
      localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? '1' : '0');
      saveAuthUser(response.user, rememberMe);
      // Login padrão usa cookie httpOnly; evita persistir JWT em storage.
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      
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

  const loginWithToken = async (token: string) => {
    logger.info('Login com token (ex.: callback Microsoft)', {}, 'AUTH');
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      const profile = await apiService.getProfile();
      setUser(profile);
      setToken('cookie');
      localStorage.setItem(REMEMBER_ME_KEY, '1');
      saveAuthUser(profile, true);
      logger.success('Login com token concluído', { userId: profile.id }, 'AUTH');
      try {
        await apiService.trackActivity(profile.id, 'login');
      } catch {
        // ignorar falha de rastreamento
      }
    } catch (error) {
      logger.error('Falha ao validar token', { error: error instanceof Error ? error.message : 'Unknown' }, 'AUTH');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
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
      clearAuthStorage();
      logger.success('Logout concluído no contexto', {}, 'AUTH');
    }
  };

  const refreshUser = async () => {
    if (!user && !token) return;
    
    try {
      const updatedUser = await apiService.getProfile();
      setUser(updatedUser);
      saveAuthUser(updatedUser, isRememberMeEnabled());
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
    saveAuthUser(updatedUser, isRememberMeEnabled());
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
    loginWithToken,
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
