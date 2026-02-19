import * as sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testConnection() {
  console.log('\n🔍 Testando conexão com SQL Server...\n');
  
  // Mostrar configurações (sem senha)
  console.log('📋 Configurações:');
  console.log('  Servidor:', process.env.DB_SERVER || '(não configurado)');
  console.log('  Banco de Dados:', process.env.DB_DATABASE || '(não configurado)');
  console.log('  Usuário:', process.env.DB_USER || '(não configurado)');
  console.log('  Porta:', process.env.DB_PORT || '1433');
  console.log('  Encrypt:', process.env.DB_ENCRYPT || 'false');
  console.log('  Trust Certificate:', process.env.DB_TRUST_CERT || 'true');
  console.log('');

  // Verificar se todas as variáveis estão configuradas
  if (!process.env.DB_SERVER || !process.env.DB_DATABASE || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    console.error('❌ ERRO: Variáveis de ambiente não configuradas!');
    console.error('\nConfigure as seguintes variáveis no arquivo .env:');
    console.error('  DB_SERVER=<IP ou hostname do servidor>');
    console.error('  DB_DATABASE=<nome do banco de dados>');
    console.error('  DB_USER=<usuário>');
    console.error('  DB_PASSWORD=<senha>');
    console.error('  DB_PORT=1433 (opcional)');
    console.error('  DB_ENCRYPT=false (opcional)');
    console.error('  DB_TRUST_CERT=true (opcional)');
    process.exit(1);
  }

  const sqlConfig: sql.config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false', // default true
      enableArithAbort: true,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    requestTimeout: 30000,
    connectionTimeout: 15000, // 15 segundos para timeout
  };

  let pool: sql.ConnectionPool | null = null;

  try {
    console.log('🔄 Tentando conectar...');
    pool = new sql.ConnectionPool(sqlConfig);
    
    // Tentar conectar com timeout
    await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Conexão demorou mais de 15 segundos')), 15000)
      )
    ]);

    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Testar uma query simples
    console.log('🔄 Testando query...');
    const request = new sql.Request(pool);
    const result = await request.query('SELECT @@VERSION as version, DB_NAME() as current_database, @@SERVERNAME as server_name');
    
    if (result.recordset && result.recordset.length > 0) {
      const info = result.recordset[0];
      console.log('\n📊 Informações do Servidor:');
      console.log('  Servidor:', info.server_name);
      console.log('  Banco Atual:', info.current_database);
      console.log('  Versão SQL:', info.version?.substring(0, 50) + '...');
    }

    // Testar se o banco de dados existe
    console.log('\n🔄 Verificando banco de dados...');
    const dbCheck = await request.query(`
      SELECT name FROM sys.databases WHERE name = '${process.env.DB_DATABASE}'
    `);
    
    if (dbCheck.recordset.length === 0) {
      console.warn('⚠️  AVISO: O banco de dados especificado não foi encontrado!');
      console.warn(`   Procurado: ${process.env.DB_DATABASE}`);
    } else {
      console.log(`✅ Banco de dados "${process.env.DB_DATABASE}" encontrado!`);
    }

    console.log('\n✅ Teste de conexão concluído com sucesso!');
    
  } catch (error: any) {
    console.error('\n❌ ERRO ao conectar ao SQL Server:');
    console.error('   Mensagem:', error.message);
    
    if (error.code) {
      console.error('   Código:', error.code);
    }
    
    // Mensagens de erro mais específicas
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      console.error('\n💡 Possíveis causas:');
      console.error('   1. O IP/hostname do servidor está incorreto');
      console.error('   2. O SQL Server não está acessível na rede');
      console.error('   3. Firewall bloqueando a porta 1433');
      console.error('   4. O SQL Server não está configurado para aceitar conexões TCP/IP');
    } else if (error.message.includes('Login failed') || error.message.includes('authentication')) {
      console.error('\n💡 Possíveis causas:');
      console.error('   1. Usuário ou senha incorretos');
      console.error('   2. O usuário não tem permissão para acessar o banco');
      console.error('   3. Autenticação SQL Server não está habilitada');
    } else if (error.message.includes('Cannot find server') || error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Possíveis causas:');
      console.error('   1. O IP/hostname do servidor está incorreto');
      console.error('   2. O servidor não está acessível na rede');
      console.error('   3. Verifique se o IP está correto no arquivo .env');
    } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
      console.error('\n💡 Solução:');
      console.error('   Adicione DB_TRUST_CERT=true no arquivo .env');
    } else {
      console.error('\n💡 Verifique:');
      console.error('   1. O SQL Server está rodando');
      console.error('   2. As credenciais estão corretas');
      console.error('   3. O SQL Server está configurado para aceitar conexões remotas');
      console.error('   4. O firewall permite conexões na porta 1433');
      console.error('   5. O SQL Server Browser está rodando (se usar instância nomeada)');
    }
    
    process.exit(1);
  } finally {
    if (pool && pool.connected) {
      await pool.close();
      console.log('\n🔌 Conexão fechada.');
    }
  }
}

// Executar teste
testConnection().catch(console.error);

