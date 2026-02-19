import { dbRun, closeDatabase } from './connection';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🔄 Executando migration: Adicionar campos corporativos ao perfil...\n');

  const migrationPath = path.join(__dirname, 'migrations', 'add_user_profile_fields.sql');
  
  try {
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Dividir em comandos individuais
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (const command of commands) {
      try {
        await dbRun(command);
        console.log(`✅ Executado: ${command.substring(0, 50)}...`);
      } catch (error: any) {
        // Ignorar erro se a coluna já existe
        if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
          console.log(`ℹ️  Coluna já existe: ${command.substring(0, 50)}...`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migration:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

runMigration().catch(console.error);

