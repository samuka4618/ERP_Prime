import { dbGet, dbAll, dbRun } from '../database/connection';

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export class SystemConfigService {
  private static cache: Map<string, string> = new Map();
  private static cacheExpiry: number = 0;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  /**
   * Busca uma configuração específica
   */
  static async get(key: string): Promise<string | null> {
    // Verificar cache primeiro
    if (this.cache.has(key) && Date.now() < this.cacheExpiry) {
      return this.cache.get(key) || null;
    }

    try {
      const config = await dbGet(
        'SELECT value FROM system_config WHERE key = ?',
        [key]
      ) as any;

      const value = config?.value || null;
      
      // Atualizar cache
      if (value) {
        this.cache.set(key, value);
        this.cacheExpiry = Date.now() + this.CACHE_DURATION;
      }

      return value;
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      return null;
    }
  }

  /**
   * Define uma configuração
   */
  static async set(key: string, value: string, description?: string): Promise<boolean> {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO system_config (key, value, description, updated_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [key, value, description || null]
      );

      // Atualizar cache
      this.cache.set(key, value);
      this.cacheExpiry = Date.now() + this.CACHE_DURATION;

      return true;
    } catch (error) {
      console.error('Erro ao definir configuração:', error);
      return false;
    }
  }

  /**
   * Busca todas as configurações
   */
  static async getAll(): Promise<SystemConfig[]> {
    try {
      const configs = await dbAll(
        'SELECT * FROM system_config ORDER BY key'
      ) as any[];

      return configs.map(config => ({
        id: config.id,
        key: config.key,
        value: config.value,
        description: config.description,
        updated_at: config.updated_at
      }));
    } catch (error) {
      console.error('Erro ao buscar todas as configurações:', error);
      return [];
    }
  }

  /**
   * Busca o timezone configurado
   */
  static async getTimezone(): Promise<string> {
    const timezone = await this.get('timezone');
    return timezone || 'America/Sao_Paulo'; // Fallback para Brasil
  }

  /**
   * Busca o formato de data configurado
   */
  static async getDateFormat(): Promise<string> {
    const format = await this.get('date_format');
    return format || 'DD/MM/YYYY HH:mm'; // Fallback
  }

  /**
   * Limpa o cache
   */
  static clearCache(): void {
    this.cache.clear();
    this.cacheExpiry = 0;
  }
}


