import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

export interface CachedCNPJ {
  cnpj: string;
  fileName: string;
  filePath: string;
  consultedAt: Date;
  expiresAt: Date;
  success: boolean;
  error?: string;
}

export class CNPJCache {
  private static cacheFile = './cache/cnpj-cache.json';
  private static cacheDir = './cache';

  /**
   * Inicializa o sistema de cache
   */
  static initialize(): void {
    // Cria o diretório de cache se não existir
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Cria o arquivo de cache se não existir
    if (!fs.existsSync(this.cacheFile)) {
      this.saveCache({});
    }
  }

  /**
   * Verifica se um CNPJ já foi consultado e ainda é válido
   */
  static isCached(cnpj: string, expirationHours: number): CachedCNPJ | null {
    try {
      const cache = this.loadCache();
      const cached = cache[cnpj];

      if (!cached) {
        return null;
      }

      // Verifica se o cache ainda é válido
      const now = new Date();
      const expiresAt = new Date(cached.expiresAt);

      if (now > expiresAt) {
        // Cache expirado, remove
        delete cache[cnpj];
        this.saveCache(cache);
        Logger.info(`Cache expirado para CNPJ ${cnpj}`, { expiresAt });
        return null;
      }

      Logger.info(`CNPJ ${cnpj} encontrado no cache (válido até ${expiresAt.toLocaleString('pt-BR')})`);
      return cached;
    } catch (error) {
      Logger.error('Erro ao verificar cache de CNPJ', { cnpj, error });
      return null;
    }
  }

  /**
   * Adiciona um CNPJ ao cache
   */
  static addToCache(
    cnpj: string, 
    fileName: string, 
    filePath: string, 
    success: boolean, 
    expirationHours: number,
    error?: string
  ): void {
    try {
      const cache = this.loadCache();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (expirationHours * 60 * 60 * 1000));

      const cachedCNPJ: CachedCNPJ = {
        cnpj,
        fileName,
        filePath,
        consultedAt: now,
        expiresAt,
        success,
        error
      };

      cache[cnpj] = cachedCNPJ;
      this.saveCache(cache);

      Logger.success(`CNPJ ${cnpj} adicionado ao cache (expira em ${expirationHours}h)`, {
        fileName,
        success,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error) {
      Logger.error('Erro ao adicionar CNPJ ao cache', { cnpj, error });
    }
  }

  /**
   * Remove um CNPJ do cache
   */
  static removeFromCache(cnpj: string): void {
    try {
      const cache = this.loadCache();
      if (cache[cnpj]) {
        delete cache[cnpj];
        this.saveCache(cache);
        Logger.info(`CNPJ ${cnpj} removido do cache`);
      }
    } catch (error) {
      Logger.error('Erro ao remover CNPJ do cache', { cnpj, error });
    }
  }

  /**
   * Limpa cache expirado
   */
  static cleanExpiredCache(): number {
    try {
      const cache = this.loadCache();
      const now = new Date();
      let removedCount = 0;

      for (const cnpj in cache) {
        const expiresAt = new Date(cache[cnpj].expiresAt);
        if (now > expiresAt) {
          delete cache[cnpj];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        this.saveCache(cache);
        Logger.info(`Cache limpo: ${removedCount} CNPJs expirados removidos`);
      }

      return removedCount;
    } catch (error) {
      Logger.error('Erro ao limpar cache expirado', { error });
      return 0;
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  static getCacheStats(): {
    total: number;
    valid: number;
    expired: number;
    successful: number;
    failed: number;
  } {
    try {
      const cache = this.loadCache();
      const now = new Date();
      let valid = 0;
      let expired = 0;
      let successful = 0;
      let failed = 0;

      for (const cnpj in cache) {
        const expiresAt = new Date(cache[cnpj].expiresAt);
        if (now > expiresAt) {
          expired++;
        } else {
          valid++;
        }

        if (cache[cnpj].success) {
          successful++;
        } else {
          failed++;
        }
      }

      return {
        total: Object.keys(cache).length,
        valid,
        expired,
        successful,
        failed
      };
    } catch (error) {
      Logger.error('Erro ao obter estatísticas do cache', { error });
      return { total: 0, valid: 0, expired: 0, successful: 0, failed: 0 };
    }
  }

  /**
   * Lista CNPJs no cache
   */
  static listCachedCNPJs(): CachedCNPJ[] {
    try {
      const cache = this.loadCache();
      const now = new Date();
      const validCNPJs: CachedCNPJ[] = [];

      for (const cnpj in cache) {
        const expiresAt = new Date(cache[cnpj].expiresAt);
        if (now <= expiresAt) {
          validCNPJs.push(cache[cnpj]);
        }
      }

      // Ordena por data de consulta (mais recente primeiro)
      return validCNPJs.sort((a, b) => 
        new Date(b.consultedAt).getTime() - new Date(a.consultedAt).getTime()
      );
    } catch (error) {
      Logger.error('Erro ao listar CNPJs em cache', { error });
      return [];
    }
  }

  /**
   * Carrega o cache do arquivo
   */
  private static loadCache(): Record<string, CachedCNPJ> {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return {};
      }

      const content = fs.readFileSync(this.cacheFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      Logger.error('Erro ao carregar cache', { error });
      return {};
    }
  }

  /**
   * Salva o cache no arquivo
   */
  private static saveCache(cache: Record<string, CachedCNPJ>): void {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      Logger.error('Erro ao salvar cache', { error });
    }
  }

  /**
   * Força a limpeza de todo o cache
   */
  static clearAllCache(): void {
    try {
      this.saveCache({});
      Logger.info('Todo o cache foi limpo');
    } catch (error) {
      Logger.error('Erro ao limpar todo o cache', { error });
    }
  }
}
