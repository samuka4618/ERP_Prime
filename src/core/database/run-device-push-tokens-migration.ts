import { dbRun, closeDatabase, dbGet } from './connection';
import fs from 'fs';
import path from 'path';

/**
 * Script de migração para adicionar tabela de tokens de push notifications
 * Execute este script uma vez para criar a tabela device_push_tokens
 */
async function runMigration() {
  console.log('🔄 Executando migration: Adicionar tabela device_push_tokens...\n');

  const migrationPath = path.join(__dirname, 'migrations', 'add_device_push_tokens_table.sql');
  
  try {
    // Verificar se a tabela já existe
    const tableExists = await dbGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='device_push_tokens'"
    ) as any;

    if (tableExists) {
      console.log('ℹ️  Tabela device_push_tokens já existe. Migration não é necessária.');
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Dividir em comandos individuais, tratando triggers e comandos multi-linha
    const commands: string[] = [];
    let currentCommand = '';
    let inTrigger = false;
    
    const lines = migrationSQL.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Ignorar comentários e linhas vazias
      if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
        continue;
      }
      
      currentCommand += line + '\n';
      
      // Detectar início de trigger
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
      }
      
      // Detectar fim de comando (não trigger)
      if (trimmedLine.endsWith(';') && !inTrigger) {
        const cmd = currentCommand.trim();
        if (cmd.length > 0) {
          commands.push(cmd);
        }
        currentCommand = '';
      }
      
      // Detectar fim de trigger
      if (trimmedLine.toUpperCase().includes('END;') && inTrigger) {
        const cmd = currentCommand.trim();
        if (cmd.length > 0) {
          commands.push(cmd);
        }
        currentCommand = '';
        inTrigger = false;
      }
    }
    
    // Adicionar último comando se houver
    if (currentCommand.trim().length > 0) {
      commands.push(currentCommand.trim());
    }

    console.log(`📝 Executando ${commands.length} comando(s)...\n`);

    for (const command of commands) {
      try {
        await dbRun(command);
        const preview = command.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`✅ Executado: ${preview}...`);
      } catch (error: any) {
        // Ignorar erro se a tabela/índice/trigger já existe
        if (
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate') ||
          error.message?.includes('UNIQUE constraint')
        ) {
          const preview = command.substring(0, 80).replace(/\s+/g, ' ');
          console.log(`ℹ️  Já existe: ${preview}...`);
        } else {
          console.error(`❌ Erro ao executar comando:`, command.substring(0, 80));
          console.error(`   Erro:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration concluída com sucesso!');
    console.log('📱 Tabela device_push_tokens criada e pronta para uso.');
    console.log('🚀 Push notifications podem ser registradas agora.');
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Executar migration se chamado diretamente
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Processo concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Falha na migration:', error);
      process.exit(1);
    });
}

export { runMigration };
