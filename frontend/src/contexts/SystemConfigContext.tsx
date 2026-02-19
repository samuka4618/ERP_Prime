import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface SystemConfig {
  system_name?: string;
  system_subtitle?: string;
  system_logo?: string;
  system_version?: string;
  [key: string]: any;
}

interface SystemConfigContextType {
  config: SystemConfig | null;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined);

// Valores padrão
const defaultConfig: SystemConfig = {
  system_name: 'ERP PRIME',
  system_subtitle: 'Sistema de Gestão Empresarial',
  system_logo: '',
  system_version: '1.0.0'
};

export const SystemConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<SystemConfig | null>(defaultConfig);
  const [loading, setLoading] = useState(false);
  const [hasTriedLoad, setHasTriedLoad] = useState(false);

  const refreshConfig = async () => {
    // Verificar se há token antes de tentar buscar
    const token = localStorage.getItem('token');
    if (!token) {
      setConfig(defaultConfig);
      setLoading(false);
      setHasTriedLoad(true);
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.get('/system/config');
      setConfig(response.data || defaultConfig);
      setHasTriedLoad(true);
    } catch (error: any) {
      // Se for erro 401 (não autenticado), usar valores padrão silenciosamente
      if (error.response?.status === 401) {
        setConfig(defaultConfig);
      } else {
        console.error('Erro ao carregar configurações do sistema:', error);
        setConfig(defaultConfig);
      }
      setHasTriedLoad(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só tentar carregar uma vez, e só se houver token
    if (!hasTriedLoad) {
      const token = localStorage.getItem('token');
      if (token) {
        refreshConfig();
      } else {
        setConfig(defaultConfig);
        setLoading(false);
        setHasTriedLoad(true);
      }
    }
  }, [hasTriedLoad]);

  return (
    <SystemConfigContext.Provider value={{ config, loading, refreshConfig }}>
      {children}
    </SystemConfigContext.Provider>
  );
};

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (context === undefined) {
    throw new Error('useSystemConfig deve ser usado dentro de um SystemConfigProvider');
  }
  return context;
};

