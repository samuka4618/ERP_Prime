import * as sql from 'mssql';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { databaseConfig } from './config';

dotenv.config();

/**
 * Script para executar a migração do Atak
 * Adiciona campos para armazenar resposta do Atak na tabela client_registrations
 * 
 * Uso:
 * npx ts-node src/run-atak-migration.ts
 */

async function runMigration() {
  let pool: sql.ConnectionPool | null = null;

  try {
    console.log('🚀 Iniciando migração do Atak...\n');

    // 1. Conectar ao banco de dados
    console.log('📡 Conectando ao banco de dados...');
    pool = new sql.ConnectionPool({
      server: databaseConfig.server,
      database: databaseConfig.database,
      user: databaseConfig.user,
      password: databaseConfig.password,
      port: databaseConfig.port,
      options: {
        encrypt: databaseConfig.options?.encrypt || false,
        trustServerCertificate: databaseConfig.options?.trustServerCertificate || true,
      },
    });

    await pool.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // 2. Ler arquivo SQL
    const sqlFilePath = path.join(__dirname, '../database/add_atak_response_fields.sql');
    console.log('📄 Lendo arquivo SQL:', sqlFilePath);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Arquivo SQL não encontrado: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
    console.log('✅ Arquivo SQL lido com sucesso\n');

    // 3. Executar migração
    console.log('⚙️  Executando migração...\n');
    
    // Remove comentários e instruções GO
    const statements = sqlContent
      .split('GO')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('USE'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement) {
        console.log(`📝 Executando statement ${i + 1}/${statements.length}...`);
        
        try {
          const result = await pool.request().query(statement);
          
          if (result.recordset) {
            console.log(`✅ Statement ${i + 1} executado com sucesso`);
            
            // Exibir mensagens do PRINT
            if (result.rowsAffected && result.rowsAffected[0] > 0) {
              console.log(`   Linhas afetadas: ${result.rowsAffected[0]}`);
            }
          }
        } catch (error: any) {
          // Ignorar erros de "já existe"
          if (error.message?.includes('já existe') || 
              error.message?.includes('already exists') ||
              error.message?.includes('duplicate key')) {
            console.log(`⚠️  Campo já existe: ${error.message.split('\n')[0]}`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');

    // 4. Verificar se os campos foram criados
    console.log('\n🔍 Verificando campos criados...');
    const checkResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'client_registrations'
        AND COLUMN_NAME IN (
          'atak_cliente_id',
          'atak_resposta_json',
          'atak_data_cadastro',
          'atak_erro'
        )
      ORDER BY ORDINAL_POSITION
    `);

    if (checkResult.recordset.length > 0) {
      console.log('\n📋 Campos encontrados:');
      checkResult.recordset.forEach((row: any) => {
        const maxLength = row.CHARACTER_MAXIMUM_LENGTH 
          ? `(${row.CHARACTER_MAXIMUM_LENGTH})` 
          : '';
        console.log(`   - ${row.COLUMN_NAME}: ${row.DATA_TYPE}${maxLength} ${row.IS_NULLABLE === 'YES' ? '(NULL)' : '(NOT NULL)'}`);
      });
    } else {
      console.warn('⚠️  Nenhum campo do Atak encontrado!');
    }

    // 5. Verificar índices criados
    console.log('\n🔍 Verificando índices criados...');
    const indexResult = await pool.request().query(`
      SELECT 
        i.name AS index_name,
        i.is_primary_key,
        i.is_unique,
        c.name AS column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('client_registrations')
        AND i.name LIKE '%atak%'
      ORDER BY i.name, ic.key_ordinal
    `);

    if (indexResult.recordset.length > 0) {
      console.log('\n📋 Índices encontrados:');
      const indexMap = new Map<string, string[]>();
      
      indexResult.recordset.forEach((row: any) => {
        if (!indexMap.has(row.index_name)) {
          indexMap.set(row.index_name, []);
        }
        indexMap.get(row.index_name)!.push(row.column_name);
      });

      indexMap.forEach((columns, indexName) => {
        console.log(`   - ${indexName} [${columns.join(', ')}]`);
      });
    } else {
      console.log('⚠️  Nenhum índice do Atak encontrado');
    }

    console.log('\n🎉 Migração executada com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('   1. O sistema agora salvará automaticamente as respostas do Atak');
    console.log('   2. Use a função buscarDadosClienteParaFrontend() para obter os dados');
    console.log('   3. Veja RESPOSTA_ATAK_FRONTEND.md para exemplos de uso\n');

  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error);
    
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Conexão com banco de dados fechada\n');
    }
  }
}

// Executar migração
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Script executado com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro ao executar script:', error);
      process.exit(1);
    });
}

export { runMigration };

