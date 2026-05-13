/**
 * Adapter PostgreSQL para o ERP Prime.
 * Usado quando USE_POSTGRES=true e DATABASE_URL está definido (ex.: Railway).
 * Converte placeholders ? para $1, $2, ... e retorna lastID quando a linha retornada tiver coluna id.
 */

import { Pool, type PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/database';
import { PERMISSION_CATALOG } from '../permissions/permission-catalog';

if (!config.database.databaseUrl) {
  throw new Error('DATABASE_URL é obrigatório quando USE_POSTGRES=true');
}

const pool = new Pool({
  connectionString: config.database.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err: Error) => {
  console.error('Erro inesperado no pool PostgreSQL:', err.message);
});

/** Converte SQL com placeholders ? para $1, $2, ... (ordem dos params preservada). */
function toPgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Para INSERT sem RETURNING, adiciona RETURNING * para evitar assumir coluna id. */
function ensureReturning(sql: string): string {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();
  if (!upper.startsWith('INSERT') || /\bRETURNING\b/i.test(trimmed)) {
    return sql;
  }
  // Inserções sem "id" na lista (ex.: ticket_history) geram id no banco; precisamos de RETURNING id.
  // Inserções com "id" na lista também se beneficiam de RETURNING id para lastID no adapter.
  const lastParen = trimmed.lastIndexOf(')');
  if (lastParen === -1) return sql;
  const afterValues = trimmed.slice(lastParen + 1).trim();
  if (afterValues && !afterValues.startsWith(';')) return sql;
  return trimmed.slice(0, lastParen + 1) + ' RETURNING *' + trimmed.slice(lastParen + 1);
}

export type PgTransactionClient = {
  run: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>;
  get: (sql: string, params?: any[]) => Promise<any>;
};

async function queryRunWithClient(
  client: PoolClient,
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> {
  const pgSql = toPgParams(sql);
  const withReturning = ensureReturning(pgSql);
  const res = await client.query(withReturning, params);
  const lastID =
    res.rows && res.rows.length > 0 && res.rows[0].id != null
      ? Number(res.rows[0].id)
      : 0;
  const changes = res.rowCount ?? 0;
  return { lastID, changes };
}

async function queryGetWithClient(
  client: PoolClient,
  sql: string,
  params: any[] = []
): Promise<any> {
  const res = await client.query(toPgParams(sql), params);
  return res.rows && res.rows.length > 0 ? res.rows[0] : undefined;
}

/**
 * Executa um bloco com uma única conexão do pool em transação real (BEGIN/COMMIT).
 * O padrão anterior (dbRun('BEGIN') + dbRun(outros) + dbRun('COMMIT')) quebrava no Postgres
 * porque cada dbRun usava outra conexão — transação aberta vazava e a API travava.
 */
export async function runInTransaction<T>(
  fn: (tx: PgTransactionClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = (sql: string, params: any[] = []) => queryRunWithClient(client, sql, params);
    const get = (sql: string, params: any[] = []) => queryGetWithClient(client, sql, params);
    const result = await fn({ run, get });
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const dbRun = async (
  sql: string,
  params: any[] = []
): Promise<{ lastID: number; changes: number }> => {
  const client = await pool.connect();
  try {
    return await queryRunWithClient(client, sql, params);
  } finally {
    client.release();
  }
};

export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  const client = await pool.connect();
  try {
    return await queryGetWithClient(client, sql, params);
  } finally {
    client.release();
  }
};

export const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  const pgSql = toPgParams(sql);
  const client = await pool.connect();
  try {
    const res = await client.query(pgSql, params);
    return res.rows ?? [];
  } finally {
    client.release();
  }
};

/** Objeto compatível com código que usa db.run/db.get/db.prepare (ex.: TicketHistory). Não usar em novo código. */
export const db = {
  run: (sql: string, params?: any[], callback?: (err: Error | null) => void) => {
    const p = Array.isArray(params) ? params : [];
    pool.query(toPgParams(sql), p)
      .then(() => callback?.(null))
      .catch((err: Error) => callback?.(err));
  },
  get: (sql: string, params: any[], callback: (err: Error | null, row?: any) => void) => {
    dbGet(sql, params)
      .then((row) => callback(null, row))
      .catch((err: Error) => callback(err));
  },
  serialize: (fn: () => void) => fn(),
  prepare: (sql: string) => ({
    run: (params: any[], callback?: (this: { lastID: number }, err: Error | null) => void) => {
      const pgSql = toPgParams(ensureReturning(sql));
      pool.query(pgSql, params)
        .then((res: { rows?: { id?: unknown }[] }) => {
          const lastID = res.rows?.[0]?.id != null ? Number(res.rows[0].id) : 0;
          if (callback) callback.call({ lastID }, null);
        })
        .catch((err: Error) => callback?.call({ lastID: 0 }, err));
    }
  }),
  close: (callback: (err: Error | null) => void) => {
    pool.end().then(() => callback(null)).catch((err: Error) => callback(err));
  }
};

/** Remove linhas de comentário (-- ...) do início do statement, mantendo o SQL. */
function stripLeadingComments(stmt: string): string {
  return stmt.replace(/^(\s*--[^\r\n]*(?:\r?\n)?)+/gm, '').trim();
}

/** Split SQL em statements, sem cortar em ; dentro de strings literais (') */
function splitSqlStatements(schema: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let i = 0;
  const n = schema.length;
  while (i < n) {
    const c = schema[i];
    if (inString) {
      if (c === "'" && schema[i + 1] === "'") {
        current += "''";
        i += 2;
        continue;
      }
      if (c === "'") {
        inString = false;
        current += c;
        i++;
        continue;
      }
      current += c;
      i++;
      continue;
    }
    if (c === "'") {
      inString = true;
      current += c;
      i++;
      continue;
    }
    if (c === ';') {
      const raw = current.trim();
      const stmt = stripLeadingComments(raw);
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = '';
      i++;
      continue;
    }
    current += c;
    i++;
  }
  const rawLast = current.trim();
  const last = stripLeadingComments(rawLast);
  if (last.length > 0) {
    statements.push(last);
  }
  return statements;
}

/** Executa o schema inicial: preferência schema-full.postgres.sql (completo), senão schema.postgres.sql. */
export const executeSchema = async (): Promise<void> => {
  const candidates = [
    path.join(__dirname, 'schema-full.postgres.sql'),
    path.join(process.cwd(), 'src', 'core', 'database', 'schema-full.postgres.sql'),
    path.join(__dirname, 'schema.postgres.sql'),
    path.join(process.cwd(), 'src', 'core', 'database', 'schema.postgres.sql')
  ];
  let schemaPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      schemaPath = p;
      break;
    }
  }
  if (!schemaPath) {
    throw new Error('Nenhum schema PostgreSQL encontrado (schema-full.postgres.sql ou schema.postgres.sql)');
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(schema);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const sql = statement.endsWith(';') ? statement : statement + ';';
      const upper = statement.toUpperCase();
      try {
        if (upper.startsWith('CREATE INDEX')) {
          await client.query(sql);
        } else if (upper.startsWith('CREATE TABLE')) {
          await client.query(sql);
        } else {
          await client.query(sql);
        }
      } catch (e: any) {
        if (e.code === '42P07') {
          // relation already exists (table or index) - ignorar
        } else {
          console.error(`Erro no statement ${i + 1}/${statements.length}:`, sql.slice(0, 150));
          await client.query('ROLLBACK');
          throw e;
        }
      }
    }
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  await runSchemaMigrationsPostgres();
  console.log('Schema PostgreSQL executado com sucesso');
};

/** Migrações específicas para Postgres (tabelas/colunas adicionais). Por ora no-op; expandir conforme necessário. */
async function runSchemaMigrationsPostgres(): Promise<void> {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_tracking'"
    );
    if (!r.rows?.length) {
      await client.query(`
        CREATE TABLE user_activity_tracking (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          activity VARCHAR(100) NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          session_id VARCHAR(255)
        )
      `);
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id ON user_activity_tracking(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_timestamp ON user_activity_tracking(timestamp)');
      console.log('Migração Postgres: user_activity_tracking criada');
    }
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_activity'"
    );
    if (!cols.rows?.length) {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP');
      console.log('Migração Postgres: coluna last_activity em users');
    }
    await client.query(
      'ALTER TABLE form_responses_descarga ADD COLUMN IF NOT EXISTS satellite_submission_id VARCHAR(80)'
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_form_responses_descarga_satellite
       ON form_responses_descarga(satellite_submission_id) WHERE satellite_submission_id IS NOT NULL`
    );

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_preferences TEXT`);

    await client.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`
    );
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP`);
    await client.query(
      `UPDATE users SET password_changed_at = COALESCE(updated_at, created_at) WHERE password_changed_at IS NULL`
    );

    await client.query(`
      INSERT INTO permissions (name, code, module, description)
      SELECT 'Visualizar métricas de performance (dashboard)', 'performance.view', 'administration',
             'Permite ver métricas agregadas de performance no dashboard'
      WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'performance.view')
    `);

    for (const perm of PERMISSION_CATALOG) {
      await client.query(
        `INSERT INTO permissions (name, code, module, description)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::text
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = $2::varchar)`,
        [perm.name, perm.code, perm.module, perm.description]
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS access_profiles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        slug VARCHAR(120) NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_permissions (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
        permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        granted BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(profile_id, permission_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_access_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, profile_id)
      )
    `);

    await client.query(`
      INSERT INTO access_profiles (name, slug, description, is_system, is_active)
      VALUES
      ('Administrador do Sistema', 'system_admin', 'Perfil administrativo completo', true, true),
      ('Atendente Padrão', 'default_attendant', 'Perfil padrão de atendimento', true, true),
      ('Usuário Padrão', 'default_user', 'Perfil padrão de usuário operacional', true, true)
      ON CONFLICT (slug) DO NOTHING
    `);

    await client.query(`
      INSERT INTO profile_permissions (profile_id, permission_id, granted)
      SELECT ap.id, rp.permission_id, rp.granted
      FROM role_permissions rp
      JOIN access_profiles ap
        ON (rp.role = 'admin' AND ap.slug = 'system_admin')
        OR (rp.role = 'attendant' AND ap.slug = 'default_attendant')
        OR (rp.role = 'user' AND ap.slug = 'default_user')
      ON CONFLICT (profile_id, permission_id) DO NOTHING
    `);

    await client.query(`
      INSERT INTO user_access_profiles (user_id, profile_id, assigned_by)
      SELECT u.id, ap.id, NULL
      FROM users u
      JOIN access_profiles ap
        ON (u.role = 'admin' AND ap.slug = 'system_admin')
        OR (u.role = 'attendant' AND ap.slug = 'default_attendant')
        OR (u.role = 'user' AND ap.slug = 'default_user')
      ON CONFLICT (user_id, profile_id) DO NOTHING
    `);

    await migrateFinanceCardPostgres(client);
  } finally {
    client.release();
  }
}

async function migrateFinanceCardPostgres(client: PoolClient): Promise<void> {
  try {
    await client.query(`ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS approval_value_field VARCHAR(100)`);
    await client.query(`ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS approval_type VARCHAR(30) DEFAULT 'none'`);

    await client.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS custom_data TEXT`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_category_approvers (
        id SERIAL PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES ticket_categories(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        valor_minimo DECIMAL(15,2) DEFAULT 0,
        valor_maximo DECIMAL(15,2) DEFAULT 999999999.99,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tca_category ON ticket_category_approvers(category_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_approvals (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        approver_id INTEGER NOT NULL REFERENCES users(id),
        decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved','rejected')),
        reason TEXT,
        valor_referencia DECIMAL(15,2),
        decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_approvals_ticket ON ticket_approvals(ticket_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_subscriptions (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        platform VARCHAR(255) NOT NULL,
        plan VARCHAR(255),
        url VARCHAR(500),
        login_username VARCHAR(255),
        password_ciphertext TEXT,
        password_iv VARCHAR(64),
        password_auth_tag VARCHAR(64),
        billing_cycle VARCHAR(20),
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'BRL',
        card_last4 VARCHAR(4),
        next_renewal_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cs_status ON card_subscriptions(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cs_renewal ON card_subscriptions(next_renewal_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cs_ticket ON card_subscriptions(ticket_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_subscription_secret_access (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES card_subscriptions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(64),
        user_agent VARCHAR(500)
      )
    `);

    await client.query(`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check`);
    try {
      await client.query(`
        ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
          'open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval', 'pending_finance_approval',
          'resolved', 'closed', 'overdue_first_response', 'overdue_resolution'
        ))
      `);
    } catch {
      /* constraint may already exist with same definition */
    }

    const chamadosPerms: Array<[string, string, string, string]> = [
      ['Aprovar despesas (financeiro)', 'chamados.finance_approval.approve', 'tickets', 'Aprovar ou rejeitar chamados com despesa de cartão/assinatura.'],
      ['Ver catálogo de assinaturas digitais', 'chamados.subscriptions.view', 'tickets', 'Listar todas as assinaturas e despesas recorrentes (visão operacional / atendentes).'],
      ['Ver minhas assinaturas digitais', 'chamados.subscriptions.self', 'tickets', 'Listar apenas assinaturas dos chamados solicitados pelo próprio utilizador.'],
      ['Revelar senha da assinatura', 'chamados.subscriptions.reveal_password', 'tickets', 'Revelar credencial da plataforma (auditado).'],
      ['Gerenciar assinaturas', 'chamados.subscriptions.manage', 'tickets', 'Cancelar ou alterar status de assinaturas.']
    ];
    for (const [name, code, mod, desc] of chamadosPerms) {
      await client.query(
        `INSERT INTO permissions (name, code, module, description)
         SELECT $1::varchar, $2::varchar, $3::varchar, $4::text
         WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = $2::varchar)`,
        [name, code, mod, desc]
      );
    }

    await client.query(`
      INSERT INTO role_permissions (role, permission_id, granted)
      SELECT 'admin', id, true FROM permissions p
      WHERE p.code LIKE 'chamados.%'
      AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp WHERE rp.role = 'admin' AND rp.permission_id = p.id
      )
    `);

    await client.query(`
      INSERT INTO profile_permissions (profile_id, permission_id, granted)
      SELECT ap.id, p.id, true
      FROM access_profiles ap
      CROSS JOIN permissions p
      WHERE ap.slug = 'system_admin' AND p.code LIKE 'chamados.%'
      AND NOT EXISTS (
        SELECT 1 FROM profile_permissions pp
        WHERE pp.profile_id = ap.id AND pp.permission_id = p.id
      )
    `);

    await client.query(
      `UPDATE permissions SET name = $1::varchar, description = $2::text WHERE code = $3::varchar`,
      [
        'Ver catálogo de assinaturas digitais',
        'Listar todas as assinaturas e despesas recorrentes (visão operacional / atendentes).',
        'chamados.subscriptions.view'
      ]
    );

    await client.query(`
      INSERT INTO profile_permissions (profile_id, permission_id, granted)
      SELECT ap.id, p.id, true
      FROM access_profiles ap
      CROSS JOIN permissions p
      WHERE ap.slug = 'default_user' AND p.code = 'chamados.subscriptions.self'
      AND NOT EXISTS (
        SELECT 1 FROM profile_permissions pp
        WHERE pp.profile_id = ap.id AND pp.permission_id = p.id
      )
    `);

    const seedFields = JSON.stringify([
      { id: 'f1', name: 'plataforma', label: 'Plataforma / serviço', type: 'text', required: true, description: 'Ex.: Figma, ChatGPT Enterprise' },
      { id: 'f2', name: 'plano', label: 'Plano desejado', type: 'text', required: true },
      { id: 'f3', name: 'url', label: 'URL de login', type: 'text', required: false, placeholder: 'https://' },
      { id: 'f4', name: 'login_plataforma', label: 'Usuário/e-mail na plataforma', type: 'text', required: true },
      { id: 'f5', name: 'senha_plataforma', label: 'Senha na plataforma', type: 'password', required: true },
      { id: 'f6', name: 'valor_mensal', label: 'Valor (referência para aprovação)', type: 'number', required: true },
      { id: 'f7', name: 'ciclo_faturamento', label: 'Ciclo', type: 'select', required: true, options: ['monthly', 'annual', 'one_time'] },
      { id: 'f8', name: 'justificativa', label: 'Justificativa / necessidade', type: 'textarea', required: true }
    ]);
    await client.query(
      `INSERT INTO ticket_categories (name, description, sla_first_response_hours, sla_resolution_hours, is_active, custom_fields, requires_approval, approval_value_field, approval_type)
       SELECT CAST($1 AS VARCHAR(100)), CAST($2 AS TEXT), 4, 48, CAST(false AS BOOLEAN), CAST($3 AS TEXT), CAST(true AS BOOLEAN), CAST($4 AS VARCHAR(100)), CAST($5 AS VARCHAR(30))
       WHERE NOT EXISTS (SELECT 1 FROM ticket_categories WHERE name = CAST($1 AS VARCHAR(100)))`,
      [
        'Assinatura Digital - Cartão',
        'Solicitação de nova assinatura paga com cartão corporativo.',
        seedFields,
        'valor_mensal',
        'finance_card'
      ]
    );
  } catch (e) {
    console.warn('Migração finance card (Postgres):', (e as Error).message);
  }
}

export const closeDatabase = (): Promise<void> => pool.end();
