import { executeSchema } from './connection';

async function migrate() {
  try {
    console.log('Iniciando migração do banco de dados...');
    await executeSchema();
    console.log('Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

migrate();
