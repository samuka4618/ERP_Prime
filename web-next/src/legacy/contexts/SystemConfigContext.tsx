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
    try {
      setLoading(true);
      // Sempre carregar config pública primeiro (nome, logo, subtítulo) - não requer login
      const publicConfig = await apiService.getPublicSystemConfig();
      setConfig(prev => ({ ...defaultConfig, ...prev, ...publicConfig }));

      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await apiService.get('/system/config');
          const data = response.data as { message?: string; data?: SystemConfig };
          const fullConfig = data?.data ?? data;
          if (fullConfig) {
            setConfig(prev => ({ ...defaultConfig, ...prev, ...fullConfig }));
          }
        } catch {
          // Mantém a config pública já definida
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do sistema:', error);
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
      setHasTriedLoad(true);
    }
  };

  useEffect(() => {
    if (!hasTriedLoad) {
      refreshConfig();
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

