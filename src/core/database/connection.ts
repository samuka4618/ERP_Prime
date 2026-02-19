import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/database';

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

/**
 * Migrações para adicionar colunas e ajustar constraints em tabelas existentes.
 */
async function runSchemaMigrations(): Promise<void> {
  try {
    const tableInfo = await dbAll('PRAGMA table_info(aprovacoes_orcamento)') as { name: string; notnull: number }[];
    if (!Array.isArray(tableInfo)) return;

    const hasSolicitanteId = tableInfo.some((col) => col.name === 'solicitante_id');
    if (!hasSolicitanteId) {
      await dbRun('ALTER TABLE aprovacoes_orcamento ADD COLUMN solicitante_id INTEGER REFERENCES users(id)');
      console.log('Migração: coluna solicitante_id adicionada em aprovacoes_orcamento');
    }

    const aprovadorCol = tableInfo.find((col) => col.name === 'aprovador_id');
    if (aprovadorCol?.notnull === 1) {
      await dbRun(`CREATE TABLE IF NOT EXISTS aprovacoes_orcamento_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orcamento_id INTEGER NOT NULL,
        aprovador_id INTEGER,
        solicitante_id INTEGER,
        nivel_aprovacao INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
        observacoes TEXT,
        aprovado_em DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
        FOREIGN KEY (aprovador_id) REFERENCES aprovadores(id),
        FOREIGN KEY (solicitante_id) REFERENCES users(id)
      )`);
      await dbRun(`INSERT INTO aprovacoes_orcamento_new (id, orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status, observacoes, aprovado_em, created_at)
        SELECT id, orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status, observacoes, aprovado_em, created_at FROM aprovacoes_orcamento`);
      await dbRun('DROP TABLE aprovacoes_orcamento');
      await dbRun('ALTER TABLE aprovacoes_orcamento_new RENAME TO aprovacoes_orcamento');
      await dbRun('CREATE INDEX IF NOT EXISTS idx_aprovacoes_orcamento ON aprovacoes_orcamento(orcamento_id)');
      await dbRun('CREATE INDEX IF NOT EXISTS idx_aprovacoes_orcamento_aprovador ON aprovacoes_orcamento(aprovador_id)');
      console.log('Migração: aprovador_id em aprovacoes_orcamento alterado para aceitar NULL');
    }

    const orcInfo = await dbAll('PRAGMA table_info(orcamentos)') as { name: string }[];
    const orcHasEntrega = Array.isArray(orcInfo) && orcInfo.some((c) => c.name === 'status_entrega');
    if (!orcHasEntrega) {
      const cols = [
        'entrega_prevista DATE',
        'entrega_efetiva DATE',
        "status_entrega VARCHAR(20) DEFAULT 'pendente'",
        'confirmado_entrega_solicitante BOOLEAN DEFAULT 0',
        'confirmado_entrega_comprador BOOLEAN DEFAULT 0',
        'data_confirmacao_solicitante DATETIME',
        'data_confirmacao_comprador DATETIME'
      ];
      for (const col of cols) {
        const colName = col.split(' ')[0];
        if (!(orcInfo as { name: string }[]).some((c) => c.name === colName)) {
          await dbRun(`ALTER TABLE orcamentos ADD COLUMN ${col}`);
        }
      }
      console.log('Migração: colunas de entrega adicionadas em orcamentos');
    }

    try {
      await dbRun(`INSERT INTO compras_anexos (solicitacao_id, orcamento_id, tipo, nome_original, nome_arquivo, caminho, tamanho, uploaded_by) VALUES (NULL, NULL, 'boleto', '_mig', '_mig', '_mig', 0, 1)`);
      await dbRun(`DELETE FROM compras_anexos WHERE nome_arquivo = '_mig' AND tipo = 'boleto'`);
    } catch (e: any) {
      if (e && String(e.message || '').includes('CHECK')) {
        await dbRun(`CREATE TABLE compras_anexos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          solicitacao_id INTEGER,
          orcamento_id INTEGER,
          tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('solicitacao', 'orcamento', 'nota_fiscal', 'boleto', 'outro')),
          nome_original VARCHAR(255) NOT NULL,
          nome_arquivo VARCHAR(255) NOT NULL,
          caminho VARCHAR(500) NOT NULL,
          tamanho INTEGER NOT NULL,
          mime_type VARCHAR(100),
          uploaded_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
          FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )`);
        await dbRun(`INSERT INTO compras_anexos_new SELECT * FROM compras_anexos`);
        await dbRun('DROP TABLE compras_anexos');
        await dbRun('ALTER TABLE compras_anexos_new RENAME TO compras_anexos');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_compras_anexos_solicitacao ON compras_anexos(solicitacao_id)');
        await dbRun('CREATE INDEX IF NOT EXISTS idx_compras_anexos_orcamento ON compras_anexos(orcamento_id)');
        console.log('Migração: tipo boleto adicionado em compras_anexos');
      }
    }

    // Conceder compras.orcamentos.view ao role 'user' (solicitantes e compradores podem ver orçamentos)
    await dbRun(
      `INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
       SELECT 'user', id, 1 FROM permissions WHERE code = 'compras.orcamentos.view'`
    );
  } catch (err) {
    console.warn('Migração de schema (aprovacoes_orcamento/orcamentos/anexos):', (err as Error).message);
  }
}

// Função para executar queries de schema
export const executeSchema = async (): Promise<void> => {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'core', 'database', 'schema.sql');
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

    // Migrações para tabelas existentes (colunas adicionadas após o schema inicial)
    await runSchemaMigrations();

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
