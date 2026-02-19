// Cache em memória para configurações de clientes
// TODO: Substituir por banco de dados real quando SQL Server estiver configurado

interface ConfigItem {
  id: number;
  nome: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface ConfigCache {
  ramo_atividade: ConfigItem[];
  vendedor: ConfigItem[];
  gestor: ConfigItem[];
  codigo_carteira: ConfigItem[];
  lista_preco: ConfigItem[];
  forma_pagamento_desejada: ConfigItem[];
  condicao_pagamento: ConfigItem[];
}

class ClientConfigCacheService {
  private cache: ConfigCache = {
    ramo_atividade: [],
    vendedor: [],
    gestor: [],
    codigo_carteira: [],
    lista_preco: [],
    forma_pagamento_desejada: [],
    condicao_pagamento: []
  };

  private nextId = 1;

  getAllConfigs(): ConfigCache {
    return this.cache;
  }

  getConfigsByType(type: keyof ConfigCache): ConfigItem[] {
    return this.cache[type] || [];
  }

  addConfig(type: keyof ConfigCache, nome: string): ConfigItem {
    const newItem: ConfigItem = {
      id: this.nextId++,
      nome,
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.cache[type].push(newItem);
    return newItem;
  }

  deleteConfig(type: keyof ConfigCache, id: number): boolean {
    const index = this.cache[type].findIndex(item => item.id === id);
    if (index !== -1) {
      this.cache[type].splice(index, 1);
      return true;
    }
    return false;
  }

  updateConfig(type: keyof ConfigCache, id: number, nome: string): ConfigItem | null {
    const item = this.cache[type].find(item => item.id === id);
    if (item) {
      item.nome = nome;
      item.updated_at = new Date().toISOString();
      return item;
    }
    return null;
  }

  getConfigById(type: keyof ConfigCache, id: number): ConfigItem | null {
    return this.cache[type].find(item => item.id === id) || null;
  }
}

export const clientConfigCache = new ClientConfigCacheService();
