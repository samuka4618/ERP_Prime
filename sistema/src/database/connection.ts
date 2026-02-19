import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '../config/database';

// Garantir que o diretório do banco existe
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Criar conexão com o banco
const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite');
  }
});

// Habilitar foreign keys
db.run('PRAGMA foreign_keys = ON');

// Otimizações de performance para SQLite
db.run('PRAGMA journal_mode = WAL'); // Write-Ahead Logging para melhor performance
db.run('PRAGMA synchronous = NORMAL'); // Menos seguro, mais rápido
db.run('PRAGMA cache_size = 10000'); // Cache de 10MB
db.run('PRAGMA temp_store = MEMORY'); // Usar memória para tabelas temporárias
db.run('PRAGMA mmap_size = 268435456'); // 256MB memory mapping
db.run('PRAGMA optimize'); // Otimizar automaticamente

// Promisificar métodos do banco
export const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

export const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Exportar instância do banco para uso direto
export { db };

// Função para executar queries de schema
export const executeSchema = async (): Promise<void> => {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Dividir o schema em statements individuais, tratando triggers
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    const lines = schema.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('--')) continue;
      if (trimmedLine.length === 0) continue;
      
      currentStatement += line + '\n';
      
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
      }
      
      if (trimmedLine.endsWith(';') && !inTrigger) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      } else if (trimmedLine.toUpperCase().includes('END;') && inTrigger) {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inTrigger = false;
      }
    }

    // Executar cada statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await dbRun(statement);
        } catch (error) {
          console.error('Erro ao executar statement:', statement);
          console.error('Erro:', error);
          throw error;
        }
      }
    }
    
    console.log('Schema do banco de dados executado com sucesso');
  } catch (error) {
    console.error('Erro ao executar schema:', error);
    throw error;
  }
};

// Função para fechar conexão
export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Erro ao fechar banco de dados:', err.message);
        reject(err);
      } else {
        console.log('Conexão com banco de dados fechada');
        resolve();
      }
    });
  });
};

export default db;
