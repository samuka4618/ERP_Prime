/**
 * Remove ou renomeia o arquivo do banco SQLite para permitir recriação (ex.: após SQLITE_CORRUPT).
 * Uso: npm run db:reset
 */
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/database/chamados.db');

if (!fs.existsSync(dbPath)) {
  console.log('Nenhum arquivo de banco encontrado em:', dbPath);
  process.exit(0);
}

const backupPath = dbPath + '.corrupt.' + Date.now();
try {
  fs.renameSync(dbPath, backupPath);
  console.log('Banco atual renomeado para backup:');
  console.log('  ', backupPath);
  console.log('\nReinicie o servidor (npm start ou npm run dev:all) para criar um novo banco.');
} catch (err) {
  console.error('Erro ao renomear:', err.message);
  process.exit(1);
}
