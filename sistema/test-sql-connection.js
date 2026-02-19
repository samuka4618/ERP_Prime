const sql = require('mssql');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com SQL Server...');
    console.log('Servidor:', process.env.DB_SERVER);
    console.log('Banco:', process.env.DB_DATABASE);
    console.log('Usuário:', process.env.DB_USER);
    console.log('Porta:', process.env.DB_PORT);
    
    const config = {
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '1433'),
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      },
      requestTimeout: 30000,
      connectionTimeout: 30000
    };

    console.log('📡 Conectando...');
    const pool = await sql.connect(config);
    
    console.log('✅ Conectado com sucesso!');
    
    // Testar se as tabelas existem
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE 'client_%'
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 Tabelas encontradas:');
    result.recordset.forEach(table => {
      console.log('  -', table.TABLE_NAME);
    });
    
    await pool.close();
    console.log('🔌 Conexão fechada.');
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('Detalhes:', error);
  }
}

testConnection();
