/**
 * Script principal de migração: executa o schema do banco e migrações embutidas.
 * Migrações específicas: npm run migrate:user-profile, migrate:reports-types, etc.
 */
import { executeSchema, closeDatabase } from '../core/database/connection';

async function migrate() {
  console.log('🔄 Executando migração (schema + migrações embutidas)...\n');
  try {
    await executeSchema();
    console.log('\n✅ Migração concluída com sucesso.');
  } catch (error) {
    console.error('\n❌ Erro ao executar migração:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
