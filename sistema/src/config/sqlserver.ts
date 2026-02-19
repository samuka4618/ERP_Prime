import * as sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

export interface SqlServerConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

export const sqlServerConfig: SqlServerConfig = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

class SqlServerConnection {
  private pool: sql.ConnectionPool | null = null;

  async connect(): Promise<void> {
    try {
      // Verificar se as variáveis de ambiente estão configuradas
      if (!sqlServerConfig.server || !sqlServerConfig.database || !sqlServerConfig.user || !sqlServerConfig.password) {
        throw new Error('Variáveis de ambiente do SQL Server não configuradas. Verifique DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD no arquivo .env');
      }

      const sqlConfig: sql.config = {
        server: sqlServerConfig.server,
        database: sqlServerConfig.database,
        user: sqlServerConfig.user,
        password: sqlServerConfig.password,
        port: sqlServerConfig.port || 1433,
        options: {
          encrypt: sqlServerConfig.options?.encrypt || false,
          trustServerCertificate: sqlServerConfig.options?.trustServerCertificate || true,
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        requestTimeout: 30000,
        connectionTimeout: 30000
      };

      this.pool = new sql.ConnectionPool(sqlConfig);
      await this.pool.connect();
      
      console.log('✅ Conectado ao banco de dados SQL Server');
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco de dados SQL Server:', error);
      console.error('Verifique se:');
      console.error('1. O SQL Server está rodando');
      console.error('2. As credenciais estão corretas no arquivo .env');
      console.error('3. O banco de dados "consultas_tess" existe');
      console.error('4. O schema foi executado (client_registrations_schema.sql)');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('🔌 Desconectado do banco de dados');
    }
  }

  isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }

  async getConnection(): Promise<sql.ConnectionPool> {
    if (!this.pool || !this.pool.connected) {
      await this.connect();
    }
    return this.pool!;
  }

  async executeQuery(query: string, params?: Record<string, any>): Promise<any[]> {
    const pool = await this.getConnection();
    const request = new sql.Request(pool);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });
    }
    
    const result = await request.query(query);
    return result.recordset;
  }

  async executeTransaction(operations: (transaction: sql.Transaction) => Promise<any>): Promise<any> {
    const pool = await this.getConnection();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const result = await operations(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const pool = await this.getConnection();
      const request = new sql.Request(pool);
      const result = await request.query('SELECT 1 as test');
      
      console.log('✅ Teste de conexão com banco de dados: OK');
      return true;
    } catch (error) {
      console.error('❌ Teste de conexão com banco de dados: FALHA', error);
      return false;
    }
  }
}

export const sqlServerConnection = new SqlServerConnection();

// Helper functions
export async function getSqlConnection(databaseName?: string): Promise<sql.ConnectionPool> {
  // Se especificou um banco diferente, criar conexão específica
  if (databaseName && databaseName !== sqlServerConfig.database) {
    const customConfig: sql.config = {
      server: sqlServerConfig.server,
      database: databaseName,
      user: sqlServerConfig.user,
      password: sqlServerConfig.password,
      port: sqlServerConfig.port || 1433,
      options: {
        encrypt: sqlServerConfig.options?.encrypt || false,
        trustServerCertificate: sqlServerConfig.options?.trustServerCertificate || true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      },
      requestTimeout: 30000,
      connectionTimeout: 30000
    };
    
    const pool = new sql.ConnectionPool(customConfig);
    await pool.connect();
    return pool;
  }
  
  return await sqlServerConnection.getConnection();
}

export async function executeSqlQuery(query: string, params?: Record<string, any>): Promise<any[]> {
  return await sqlServerConnection.executeQuery(query, params);
}

export async function executeSqlTransaction(operations: (transaction: sql.Transaction) => Promise<any>): Promise<any> {
  return await sqlServerConnection.executeTransaction(operations);
}
