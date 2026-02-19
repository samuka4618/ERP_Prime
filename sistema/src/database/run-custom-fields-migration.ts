import { dbRun, dbGet, closeDatabase } from './connection';

/**
 * Script para executar a migração de campos customizados
 * Adiciona custom_fields na tabela ticket_categories e custom_data na tabela tickets
 */

async function runMigration() {
  try {
    console.log('🚀 Iniciando migração de campos customizados...\n');

    // Tentar adicionar custom_fields na tabela ticket_categories
    try {
      await dbRun(`ALTER TABLE ticket_categories ADD COLUMN custom_fields TEXT`);
      console.log('✅ Campo custom_fields adicionado na tabela ticket_categories');
    } catch (error: any) {
      if (error.message && error.message.includes('duplicate column name')) {
        console.log('ℹ️  Campo custom_fields já existe na tabela ticket_categories');
      } else {
        throw error;
      }
    }

    // Tentar adicionar custom_data na tabela tickets
    try {
      await dbRun(`ALTER TABLE tickets ADD COLUMN custom_data TEXT`);
      console.log('✅ Campo custom_data adicionado na tabela tickets');
    } catch (error: any) {
      if (error.message && error.message.includes('duplicate column name')) {
        console.log('ℹ️  Campo custom_data já existe na tabela tickets');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');
  } catch (error: any) {
    console.error('❌ Erro na migração:', error.message);
    throw error;
  } finally {
    await closeDatabase();
  }
}

runMigration().catch(console.error);
