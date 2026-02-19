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
      logger.debug('Inicializando autenticação', {}, 'AUTH');
      
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        logger.debug('Token e usuário encontrados no localStorage', { 
          hasToken: !!storedToken,
          hasUser: !!storedUser 
        }, 'AUTH');
        
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          logger.success('Autenticação inicial bem-sucedida', { 
            userId: JSON.parse(storedUser).id 
          }, 'AUTH');
        } catch (error) {
          logger.warn('Erro ao restaurar dados do usuário, limpando storage', { 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }, 'AUTH');
          
          // Erro ao restaurar dados, limpar storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      } else {
        logger.debug('Nenhum token ou usuário encontrado no localStorage', {}, 'AUTH');
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    logger.info('Iniciando processo de login no contexto', { email: credentials.email }, 'AUTH');
    
    try {
      const response = await apiService.login(credentials);
      
      setToken(response.token);
      setUser(response.user);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      logger.success('Login concluído no contexto', { 
        userId: response.user.id,
        email: response.user.email,
        role: response.user.role
      }, 'AUTH');
      
      // Rastrear atividade de login
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
      // Fazer logout no servidor primeiro (para remover token do cache)
      await apiService.logout();
    } catch (error) {
      // Falha silenciosa - mesmo se der erro, limpar o estado local
      logger.warn('Erro ao fazer logout no servidor, continuando com limpeza local', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'AUTH');
    } finally {
      // Sempre limpar o estado local
      setToken(null);
      setUser(null);
      logger.success('Logout concluído no contexto', {}, 'AUTH');
    }
  };

  const trackActivity = async (activity: string) => {
    if (!user || !token) return;
    
    try {
      await apiService.trackActivity(user.id, activity);
    } catch (error) {
      // Falha silenciosa - não interrompe o fluxo principal
      console.warn('Erro ao rastrear atividade:', error);
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin';
  const isAttendant = user?.role === 'attendant' || user?.role === 'admin';

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
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
