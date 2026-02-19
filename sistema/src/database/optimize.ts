import { dbRun, db } from './connection';
import fs from 'fs';
import path from 'path';

async function optimizeDatabase() {
  try {
    console.log('🚀 Iniciando otimização do banco de dados...');

    // Ler e executar o arquivo de índices
    const indexesPath = path.join(__dirname, 'performance_indexes.sql');
    const indexesSQL = fs.readFileSync(indexesPath, 'utf8');
    
    // Dividir por linhas e executar cada comando
    const commands = indexesSQL
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--'));

    console.log(`📊 Executando ${commands.length} comandos de otimização...`);

    for (const command of commands) {
      if (command) {
        try {
          await dbRun(command);
          console.log(`✅ Executado: ${command.substring(0, 50)}...`);
        } catch (error) {
          console.log(`⚠️  Aviso: ${command.substring(0, 50)}... - ${error}`);
        }
      }
    }

    // Executar VACUUM para otimizar o banco
    console.log('🧹 Executando VACUUM para otimizar o banco...');
    await dbRun('VACUUM');

    // Executar ANALYZE para atualizar estatísticas
    console.log('📈 Executando ANALYZE para atualizar estatísticas...');
    await dbRun('ANALYZE');

    console.log('✅ Otimização do banco concluída com sucesso!');
    console.log('📊 O banco agora está otimizado para melhor performance');

  } catch (error) {
    console.error('❌ Erro durante a otimização:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  optimizeDatabase()
    .then(() => {
      console.log('🎉 Otimização finalizada!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na otimização:', error);
      process.exit(1);
    });
}

export { optimizeDatabase };
