import * as sql from 'mssql';
import { getSqlConnection, executeSqlQuery, executeSqlTransaction } from '../config/sqlserver';

export interface ClientConfigOption {
  id: number;
  nome: string;
  descricao?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ClientConfigOptions {
  ramo_atividade: ClientConfigOption[];
  vendedor: ClientConfigOption[];
  gestor: ClientConfigOption[];
  codigo_carteira: ClientConfigOption[];
  lista_preco: ClientConfigOption[];
  forma_pagamento_desejada: ClientConfigOption[];
}

export interface CreateClientConfigRequest {
  nome: string;
  descricao?: string;
}

export interface UpdateClientConfigRequest {
  nome?: string;
  descricao?: string;
  is_active?: boolean;
}

export type ConfigType = 'ramo_atividade' | 'vendedor' | 'gestor' | 'codigo_carteira' | 'lista_preco' | 'forma_pagamento_desejada';

export class ClientConfigModel {
  private static getTableName(type: ConfigType): string {
    const tableMap: Record<ConfigType, string> = {
      'ramo_atividade': 'client_config_ramo_atividade',
      'vendedor': 'client_config_vendedor',
      'gestor': 'client_config_gestor',
      'codigo_carteira': 'client_config_codigo_carteira',
      'lista_preco': 'client_config_lista_preco',
      'forma_pagamento_desejada': 'client_config_forma_pagamento_desejada'
    };
    return tableMap[type];
  }

  static async getConfigByType(type: ConfigType): Promise<ClientConfigOption[]> {
    const tableName = this.getTableName(type);
    const result = await executeSqlQuery(`
      SELECT id, nome, descricao, is_active, created_at, updated_at
      FROM ${tableName}
      WHERE is_active = 1
      ORDER BY nome
    `);

    return result.map(row => this.mapToConfigOption(row));
  }

  static async getAllConfigs(): Promise<ClientConfigOptions> {
    const [ramo_atividade, vendedor, gestor, codigo_carteira, lista_preco, forma_pagamento_desejada] = await Promise.all([
      this.getConfigByType('ramo_atividade'),
      this.getConfigByType('vendedor'),
      this.getConfigByType('gestor'),
      this.getConfigByType('codigo_carteira'),
      this.getConfigByType('lista_preco'),
      this.getConfigByType('forma_pagamento_desejada')
    ]);

    return {
      ramo_atividade,
      vendedor,
      gestor,
      codigo_carteira,
      lista_preco,
      forma_pagamento_desejada
    };
  }

  static async getConfigsByType(type: ConfigType, includeInactive: boolean = false): Promise<ClientConfigOption[]> {
    const tableName = this.getTableName(type);
    const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
    
    const result = await executeSqlQuery(`
      SELECT id, nome, descricao, is_active, created_at, updated_at
      FROM ${tableName}
      ${whereClause}
      ORDER BY nome
    `);

    return result.map(row => this.mapToConfigOption(row));
  }

  static async getConfigById(type: ConfigType, id: number): Promise<ClientConfigOption | null> {
    const tableName = this.getTableName(type);
    const result = await executeSqlQuery(`
      SELECT id, nome, descricao, is_active, created_at, updated_at
      FROM ${tableName}
      WHERE id = @id
    `, { id });

    if (result.length === 0) {
      return null;
    }

    return this.mapToConfigOption(result[0]);
  }

  static async createConfig(type: ConfigType, data: CreateClientConfigRequest): Promise<ClientConfigOption> {
    const tableName = this.getTableName(type);
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('nome', sql.NVarChar(255), data.nome);
    request.input('descricao', sql.NVarChar(500), data.descricao || null);

    const result = await request.query(`
      INSERT INTO ${tableName} (nome, descricao)
      OUTPUT INSERTED.*
      VALUES (@nome, @descricao)
    `);

    return this.mapToConfigOption(result.recordset[0]);
  }

  static async updateConfig(type: ConfigType, id: number, data: UpdateClientConfigRequest): Promise<ClientConfigOption> {
    const tableName = this.getTableName(type);
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    const fields: string[] = [];
    const values: any[] = [];

    if (data.nome !== undefined) {
      fields.push('nome = ?');
      values.push(data.nome);
    }
    if (data.descricao !== undefined) {
      fields.push('descricao = ?');
      values.push(data.descricao);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.getConfigById(type, id) as Promise<ClientConfigOption>;
    }

    fields.push('updated_at = GETDATE()');
    values.push(id);

    const result = await request.query(`
      UPDATE ${tableName}
      SET ${fields.join(', ')}
      WHERE id = @id
    `);

    return this.getConfigById(type, id) as Promise<ClientConfigOption>;
  }

  static async deleteConfig(type: ConfigType, id: number): Promise<void> {
    const tableName = this.getTableName(type);
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('id', sql.Int, id);

    // Soft delete - apenas marcar como inativo
    await request.query(`
      UPDATE ${tableName}
      SET is_active = 0, updated_at = GETDATE()
      WHERE id = @id
    `);
  }

  static async hardDeleteConfig(type: ConfigType, id: number): Promise<void> {
    const tableName = this.getTableName(type);
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('id', sql.Int, id);

    // Verificar se há registros dependentes
    const dependentTable = 'client_registrations';
    const dependentField = this.getDependentField(type);
    
    const checkResult = await request.query(`
      SELECT COUNT(*) as count
      FROM ${dependentTable}
      WHERE ${dependentField} = @id
    `);

    if (checkResult.recordset[0].count > 0) {
      throw new Error(`Não é possível excluir este item pois existem ${checkResult.recordset[0].count} cadastros de clientes vinculados a ele.`);
    }

    await request.query(`DELETE FROM ${tableName} WHERE id = @id`);
  }

  private static getDependentField(type: ConfigType): string {
    const fieldMap: Record<ConfigType, string> = {
      'ramo_atividade': 'ramo_atividade_id',
      'vendedor': 'vendedor_id',
      'gestor': 'gestor_id',
      'codigo_carteira': 'codigo_carteira_id',
      'lista_preco': 'lista_preco_id',
      'forma_pagamento_desejada': 'forma_pagamento_desejada_id'
    };
    return fieldMap[type];
  }

  static async getConfigStatistics(): Promise<{
    total_configs: Record<ConfigType, number>;
    active_configs: Record<ConfigType, number>;
    inactive_configs: Record<ConfigType, number>;
  }> {
    const types: ConfigType[] = ['ramo_atividade', 'vendedor', 'gestor', 'codigo_carteira', 'lista_preco', 'forma_pagamento_desejada'];
    
    const total_configs: Record<ConfigType, number> = {} as any;
    const active_configs: Record<ConfigType, number> = {} as any;
    const inactive_configs: Record<ConfigType, number> = {} as any;

    for (const type of types) {
      const tableName = this.getTableName(type);
      
      const totalResult = await executeSqlQuery(`SELECT COUNT(*) as count FROM ${tableName}`);
      const activeResult = await executeSqlQuery(`SELECT COUNT(*) as count FROM ${tableName} WHERE is_active = 1`);
      
      total_configs[type] = totalResult[0].count;
      active_configs[type] = activeResult[0].count;
      inactive_configs[type] = total_configs[type] - active_configs[type];
    }

    return {
      total_configs,
      active_configs,
      inactive_configs
    };
  }

  static async searchConfigs(type: ConfigType, searchTerm: string): Promise<ClientConfigOption[]> {
    const tableName = this.getTableName(type);
    const result = await executeSqlQuery(`
      SELECT id, nome, descricao, is_active, created_at, updated_at
      FROM ${tableName}
      WHERE (nome LIKE @searchTerm OR descricao LIKE @searchTerm)
      AND is_active = 1
      ORDER BY nome
    `, { searchTerm: `%${searchTerm}%` });

    return result.map(row => this.mapToConfigOption(row));
  }

  private static mapToConfigOption(row: any): ClientConfigOption {
    return {
      id: row.id,
      nome: row.nome,
      descricao: row.descricao,
      is_active: row.is_active,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}
