import * as sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const sqlConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'consultas',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

async function runMigration() {
  try {
    console.log('🚀 Iniciando migration para cnpj_query_status...');
    
    // Conectar ao banco
    const pool = await sql.connect(sqlConfig);
    console.log('✅ Conectado ao banco de dados');
    
    const request = pool.request();
    
    // Verificar se a tabela já existe
    const checkResult = await request.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'cnpj_query_status'
    `);
    
    if (checkResult.recordset[0].count > 0) {
      console.log('⚠️  Tabela cnpj_query_status já existe, pulando criação...');
      await pool.close();
      process.exit(0);
    }
    
    // Criar tabela
    console.log('📊 Criando tabela cnpj_query_status...');
    await request.query(`
      CREATE TABLE cnpj_query_status (
        id INT IDENTITY(1,1) PRIMARY KEY,
        registration_id INT NOT NULL,
        cnpj VARCHAR(18) NOT NULL,
        status VARCHAR(50) NOT NULL,
        current_step NVARCHAR(255) NULL,
        spc_status VARCHAR(50) NULL,
        tess_status VARCHAR(50) NULL,
        cnpja_status VARCHAR(50) NULL,
        database_status VARCHAR(50) NULL,
        error_message NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        
        CONSTRAINT FK_cnpj_query_status_registration 
            FOREIGN KEY (registration_id) 
            REFERENCES client_registrations(id)
            ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela criada com sucesso!');
    
    // Criar índices
    console.log('📊 Criando índices...');
    await request.query(`
      CREATE INDEX IX_cnpj_query_status_registration_id 
      ON cnpj_query_status(registration_id)
    `);
    
    await request.query(`
      CREATE INDEX IX_cnpj_query_status_cnpj 
      ON cnpj_query_status(cnpj)
    `);
    console.log('✅ Índices criados com sucesso!');
    
    // Verificar se a tabela foi criada
    const result = await request.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'cnpj_query_status'
    `);
    
    if (result.recordset[0].count > 0) {
      console.log('✅ Tabela verificada e existe no banco de dados');
    }
    
    await pool.close();
    console.log('🎉 Migration concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na migration:', error);
    
    // Se já existe, não é problema
    if (error instanceof sql.RequestError) {
      if (error.number === 2714) {
        console.log('⚠️  Tabela já existe, pulando...');
        process.exit(0);
      } else if (error.number === 1913) {
        console.log('⚠️  Índice já existe, pulando...');
        process.exit(0);
      }
    }
    
    process.exit(1);
  }
}

runMigration();

