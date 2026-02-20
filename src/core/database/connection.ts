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
    // Tabela de rastreamento de atividade (métricas) - criar se não existir
    const activityTable = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_activity_tracking'");
    if (!activityTable) {
      await dbRun(`
        CREATE TABLE user_activity_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          activity VARCHAR(100) NOT NULL,
          timestamp DATETIME NOT NULL,
          session_id VARCHAR(255),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id ON user_activity_tracking(user_id)');
      await dbRun('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_timestamp ON user_activity_tracking(timestamp)');
      console.log('Migração: tabela user_activity_tracking criada');
    }

    // Coluna last_activity em users (para rastreamento de atividade)
    const usersCols = await dbAll('PRAGMA table_info(users)') as { name: string }[];
    if (Array.isArray(usersCols) && !usersCols.some((c) => c.name === 'last_activity')) {
      await dbRun('ALTER TABLE users ADD COLUMN last_activity DATETIME');
      console.log('Migração: coluna last_activity adicionada em users');
    }

    // Coluna custom_fields em ticket_categories (campos personalizados do formulário)
    const catCols = await dbAll('PRAGMA table_info(ticket_categories)') as { name: string }[];
    if (Array.isArray(catCols) && !catCols.some((c) => c.name === 'custom_fields')) {
      await dbRun('ALTER TABLE ticket_categories ADD COLUMN custom_fields TEXT');
      console.log('Migração: coluna custom_fields adicionada em ticket_categories');
    }

    // Tabela de regras de atribuição por resposta
    const rulesTable = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'category_assignment_rules'");
    if (!rulesTable) {
      await dbRun(`
        CREATE TABLE category_assignment_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          field_name VARCHAR(100) NOT NULL,
          operator VARCHAR(20) NOT NULL CHECK (operator IN ('equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte')),
          value VARCHAR(500) NOT NULL,
          attendant_id INTEGER NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
          FOREIGN KEY (attendant_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_category_assignment_rules_category ON category_assignment_rules(category_id)');
      console.log('Migração: tabela category_assignment_rules criada');
    }

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

    // --- Módulo Descarregamento: tabelas e permissões ---
    const fornecedoresDescarga = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fornecedores_descarga'");
    if (!fornecedoresDescarga) {
      await dbRun(`
        CREATE TABLE fornecedores_descarga (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          plate VARCHAR(20),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_fornecedores_descarga_category ON fornecedores_descarga(category)');
      console.log('Migração: tabela fornecedores_descarga criada');
    }
    const docasConfig = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'docas_config'");
    if (!docasConfig) {
      await dbRun(`
        CREATE TABLE docas_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero VARCHAR(50) NOT NULL UNIQUE,
          nome VARCHAR(255),
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Migração: tabela docas_config criada');
    }
    const agendamentosDescarga = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agendamentos_descarga'");
    if (!agendamentosDescarga) {
      await dbRun(`
        CREATE TABLE agendamentos_descarga (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fornecedor_id INTEGER NOT NULL,
          scheduled_date DATE NOT NULL,
          scheduled_time VARCHAR(10) NOT NULL,
          dock VARCHAR(50) NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'motorista_pronto', 'em_andamento', 'concluido')),
          notes TEXT,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (fornecedor_id) REFERENCES fornecedores_descarga(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_fornecedor ON agendamentos_descarga(fornecedor_id)');
      await dbRun('CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_date ON agendamentos_descarga(scheduled_date)');
      await dbRun(`
        CREATE TABLE agendamentos_descarga_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agendamento_id INTEGER NOT NULL,
          previous_status VARCHAR(30),
          new_status VARCHAR(30) NOT NULL,
          changed_by INTEGER,
          changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agendamento_id) REFERENCES agendamentos_descarga(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users(id)
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_status_history_ag ON agendamentos_descarga_status_history(agendamento_id)');
      console.log('Migração: tabelas agendamentos_descarga e agendamentos_descarga_status_history criadas');
    }
    const formulariosDescarga = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'formularios_descarga'");
    if (!formulariosDescarga) {
      await dbRun(`
        CREATE TABLE formularios_descarga (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          fields TEXT NOT NULL,
          is_published BOOLEAN DEFAULT 0,
          is_default BOOLEAN DEFAULT 0,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      console.log('Migração: tabela formularios_descarga criada');
    }
    const formResponsesDescarga = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'form_responses_descarga'");
    if (!formResponsesDescarga) {
      await dbRun(`
        CREATE TABLE form_responses_descarga (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          form_id INTEGER,
          responses TEXT NOT NULL,
          driver_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50),
          fornecedor_id INTEGER,
          agendamento_id INTEGER,
          is_in_yard BOOLEAN DEFAULT 1,
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          checked_out_at DATETIME,
          tracking_code VARCHAR(50) UNIQUE,
          FOREIGN KEY (form_id) REFERENCES formularios_descarga(id),
          FOREIGN KEY (fornecedor_id) REFERENCES fornecedores_descarga(id),
          FOREIGN KEY (agendamento_id) REFERENCES agendamentos_descarga(id)
        )
      `);
      await dbRun('CREATE INDEX IF NOT EXISTS idx_form_responses_descarga_agendamento ON form_responses_descarga(agendamento_id)');
      await dbRun('CREATE INDEX IF NOT EXISTS idx_form_responses_descarga_tracking ON form_responses_descarga(tracking_code)');
      console.log('Migração: tabela form_responses_descarga criada');
    }
    const smsTemplatesDescarga = await dbGet("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sms_templates_descarga'");
    if (!smsTemplatesDescarga) {
      await dbRun(`
        CREATE TABLE sms_templates_descarga (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          template_type VARCHAR(20) NOT NULL CHECK (template_type IN ('arrival', 'release')),
          is_default BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Migração: tabela sms_templates_descarga criada');
    }

    // Permissões do módulo Descarregamento
    await dbRun(`
      INSERT OR IGNORE INTO permissions (name, code, module, description) VALUES
      ('Visualizar Agendamentos', 'descarregamento.agendamentos.view', 'descarregamento', 'Permite visualizar agendamentos de descarregamento'),
      ('Criar Agendamentos', 'descarregamento.agendamentos.create', 'descarregamento', 'Permite criar agendamentos'),
      ('Editar Agendamentos', 'descarregamento.agendamentos.edit', 'descarregamento', 'Permite editar agendamentos'),
      ('Excluir Agendamentos', 'descarregamento.agendamentos.delete', 'descarregamento', 'Permite excluir agendamentos'),
      ('Visualizar Fornecedores', 'descarregamento.fornecedores.view', 'descarregamento', 'Permite visualizar fornecedores'),
      ('Criar Fornecedores', 'descarregamento.fornecedores.create', 'descarregamento', 'Permite criar fornecedores'),
      ('Editar Fornecedores', 'descarregamento.fornecedores.edit', 'descarregamento', 'Permite editar fornecedores'),
      ('Excluir Fornecedores', 'descarregamento.fornecedores.delete', 'descarregamento', 'Permite excluir fornecedores'),
      ('Visualizar Docas', 'descarregamento.docas.view', 'descarregamento', 'Permite visualizar docas'),
      ('Gerenciar Docas', 'descarregamento.docas.manage', 'descarregamento', 'Permite criar/editar/excluir docas'),
      ('Visualizar Formulários', 'descarregamento.formularios.view', 'descarregamento', 'Permite visualizar formulários'),
      ('Gerenciar Formulários', 'descarregamento.formularios.manage', 'descarregamento', 'Permite criar/editar formulários'),
      ('Visualizar Respostas', 'descarregamento.form_responses.view', 'descarregamento', 'Permite visualizar respostas de chegada'),
      ('Liberar Motorista', 'descarregamento.form_responses.release', 'descarregamento', 'Permite liberar motorista (checkout)'),
      ('Gerenciar Templates SMS', 'descarregamento.sms_templates.manage', 'descarregamento', 'Permite gerenciar templates de SMS'),
      ('Visualizar Motoristas no Pátio', 'descarregamento.motoristas.view', 'descarregamento', 'Permite visualizar motoristas no pátio'),
      ('Visualizar Respostas de Formulários', 'descarregamento.formularios.view_responses', 'descarregamento', 'Permite visualizar respostas dos formulários'),
      ('Liberar Motoristas', 'descarregamento.motoristas.liberar', 'descarregamento', 'Permite liberar motorista (checkout)')
    `);
    await dbRun(`
      INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
      SELECT 'admin', id, 1 FROM permissions WHERE module = 'descarregamento'
    `);
    await dbRun(`
      INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
      SELECT 'attendant', id, 1 FROM permissions WHERE code IN (
        'descarregamento.agendamentos.view', 'descarregamento.agendamentos.create', 'descarregamento.agendamentos.edit',
        'descarregamento.fornecedores.view', 'descarregamento.fornecedores.create', 'descarregamento.fornecedores.edit',
        'descarregamento.docas.view', 'descarregamento.docas.manage', 'descarregamento.formularios.manage',
        'descarregamento.form_responses.view', 'descarregamento.form_responses.release',
        'descarregamento.motoristas.view', 'descarregamento.formularios.view_responses', 'descarregamento.motoristas.liberar'
      )
    `);
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
