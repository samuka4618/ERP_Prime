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
        const missing = [];
        if (!sqlServerConfig.server) missing.push('DB_SERVER');
        if (!sqlServerConfig.database) missing.push('DB_DATABASE');
        if (!sqlServerConfig.user) missing.push('DB_USER');
        if (!sqlServerConfig.password) missing.push('DB_PASSWORD');
        
        throw new Error(
          `Variáveis de ambiente do SQL Server não configuradas: ${missing.join(', ')}. ` +
          `Verifique o arquivo .env na raiz do projeto.`
        );
      }

      // Log das configurações (sem senha)
      console.log('🔌 Tentando conectar ao SQL Server...');
      console.log(`   Servidor: ${sqlServerConfig.server}`);
      console.log(`   Banco: ${sqlServerConfig.database}`);
      console.log(`   Usuário: ${sqlServerConfig.user}`);
      console.log(`   Porta: ${sqlServerConfig.port || 1433}`);

      const sqlConfig: sql.config = {
        server: sqlServerConfig.server,
        database: sqlServerConfig.database,
        user: sqlServerConfig.user,
        password: sqlServerConfig.password,
        port: sqlServerConfig.port || 1433,
        options: {
          encrypt: sqlServerConfig.options?.encrypt || false,
          trustServerCertificate: sqlServerConfig.options?.trustServerCertificate !== false, // default true
          enableArithAbort: true,
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        requestTimeout: 30000,
        connectionTimeout: 15000, // 15 segundos
      };

      this.pool = new sql.ConnectionPool(sqlConfig);
      
      // Tentar conectar com timeout
      await Promise.race([
        this.pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: Conexão demorou mais de 15 segundos. Verifique se o IP do servidor está correto e se o SQL Server está acessível.')), 15000)
        )
      ]);
      
      console.log('✅ Conectado ao banco de dados SQL Server');
    } catch (error: any) {
      console.error('❌ Erro ao conectar ao banco de dados SQL Server');
      console.error(`   Mensagem: ${error.message || error}`);
      
      if (error.code) {
        console.error(`   Código: ${error.code}`);
      }

      // Dicas de diagnóstico em warn para não poluir erro em produção (Railway, etc.)
      const errorMsg = error.message?.toLowerCase() || '';
      
      if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        console.warn('\n💡 Possíveis causas:');
        console.warn('   1. O IP/hostname do servidor (DB_SERVER) está incorreto');
        console.warn('   2. O SQL Server não está acessível na rede');
        console.warn('   3. Firewall bloqueando a porta 1433');
        console.warn('   4. O SQL Server não está configurado para aceitar conexões TCP/IP');
        console.warn('\n   Verifique:');
        console.warn(`   - DB_SERVER=${sqlServerConfig.server || '(não configurado)'}`);
        console.warn('   - Se o IP está correto no arquivo .env');
        console.warn('   - Se consegue fazer ping no servidor SQL');
      } else if (errorMsg.includes('login failed') || errorMsg.includes('authentication')) {
        console.warn('\n💡 Possíveis causas:');
        console.warn('   1. Usuário ou senha incorretos');
        console.warn('   2. O usuário não tem permissão para acessar o banco');
        console.warn('   3. Autenticação SQL Server não está habilitada');
        console.warn('\n   Verifique:');
        console.warn(`   - DB_USER=${sqlServerConfig.user || '(não configurado)'}`);
        console.warn('   - DB_PASSWORD está correto');
      } else if (errorMsg.includes('cannot find server') || errorMsg.includes('enotfound') || errorMsg.includes('getaddrinfo')) {
        console.warn('\n💡 Possíveis causas:');
        console.warn('   1. O IP/hostname do servidor está incorreto');
        console.warn('   2. O servidor não está acessível na rede');
        console.warn('   3. DNS não resolve o hostname');
        console.warn('\n   Verifique:');
        console.warn(`   - DB_SERVER=${sqlServerConfig.server || '(não configurado)'}`);
        console.warn('   - Se o IP está correto no arquivo .env');
        console.warn('   - Se consegue fazer ping no servidor SQL');
      } else if (errorMsg.includes('certificate') || errorMsg.includes('ssl')) {
        console.warn('\n💡 Solução:');
        console.warn('   Adicione DB_TRUST_CERT=true no arquivo .env');
      } else {
        console.warn('\n💡 Verifique:');
        console.warn('   1. O SQL Server está rodando');
        console.warn('   2. As credenciais estão corretas no arquivo .env');
        console.warn('   3. O SQL Server está configurado para aceitar conexões remotas');
        console.warn('   4. O firewall permite conexões na porta 1433');
        console.warn('   5. O SQL Server Browser está rodando (se usar instância nomeada)');
      }
      
      console.warn('\n📝 Variáveis de ambiente necessárias no arquivo .env:');
      console.warn('   DB_SERVER=<IP ou hostname do servidor>');
      console.warn('   DB_DATABASE=<nome do banco de dados>');
      console.warn('   DB_USER=<usuário>');
      console.warn('   DB_PASSWORD=<senha>');
      console.warn('   DB_PORT=1433 (opcional)');
      console.warn('   DB_TRUST_CERT=true (recomendado)');
      
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
