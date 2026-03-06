import { dbRun, dbGet, dbAll } from '../database/connection';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '../types';
import bcrypt from 'bcryptjs';

/** Hash de senha placeholder para usuários que só fazem login com Microsoft (nunca usado para comparação). */
const MICROSOFT_PLACEHOLDER_PASSWORD = '$2a$10$MicrosoftEntraIDOnlyUserNoLocalLogin';

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password ?? '',
    role: row.role,
    is_active: row.is_active,
    microsoft_id: row.microsoft_id ?? null,
    avatar_url: row.avatar_url ?? null,
    job_title: row.job_title ?? null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
}

export class UserModel {
  static async create(userData: CreateUserRequest): Promise<User> {
    const passwordToHash = userData.password && userData.password.trim() !== ''
      ? userData.password
      : undefined;
    const hashedPassword = passwordToHash
      ? await bcrypt.hash(passwordToHash, 10)
      : MICROSOFT_PLACEHOLDER_PASSWORD;

    const columns = ['name', 'email', 'password', 'role', 'is_active'];
    const placeholders = ['?', '?', '?', '?', '?'];
    const values: any[] = [userData.name, userData.email, hashedPassword, userData.role, userData.is_active ?? true];

    if (userData.microsoft_id !== undefined && userData.microsoft_id !== null) {
      columns.push('microsoft_id');
      placeholders.push('?');
      values.push(userData.microsoft_id);
    }
    if (userData.avatar_url !== undefined && userData.avatar_url !== null) {
      columns.push('avatar_url');
      placeholders.push('?');
      values.push(userData.avatar_url);
    }
    if (userData.job_title !== undefined && userData.job_title !== null) {
      columns.push('job_title');
      placeholders.push('?');
      values.push(userData.job_title);
    }

    await dbRun(
      `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    );

    const lastUser = await dbGet(
      `SELECT * FROM users WHERE email = ? ORDER BY id DESC LIMIT 1`,
      [userData.email]
    ) as any;

    if (!lastUser) {
      throw new Error('Erro ao buscar usuário criado');
    }

    return mapRowToUser(lastUser);
  }

  static async findById(id: number): Promise<User | null> {
    const row = await dbGet('SELECT * FROM users WHERE id = ?', [id]) as any;
    return row ? mapRowToUser(row) : null;
  }

  static async findByMicrosoftId(microsoftId: string): Promise<User | null> {
    const row = await dbGet('SELECT * FROM users WHERE microsoft_id = ?', [microsoftId]) as any;
    return row ? mapRowToUser(row) : null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const row = await dbGet('SELECT * FROM users WHERE email = ?', [email]) as any;
    return row ? mapRowToUser(row) : null;
  }

  /**
   * Busca um usuário por email, considerando apenas usuários ativos
   * Útil para verificar duplicatas ao criar novos usuários
   */
  static async findByEmailActive(email: string): Promise<User | null> {
    const row = await dbGet('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]) as any;
    return row ? mapRowToUser(row) : null;
  }

  static async findAll(limit: number = 50, offset: number = 0): Promise<User[]> {
    const rows = await dbAll(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    ) as any[];
    return rows.map(mapRowToUser);
  }

  static async findByRole(role: UserRole, limit: number = 50, offset: number = 0): Promise<User[]> {
    const rows = await dbAll(
      'SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [role, limit, offset]
    ) as any[];
    return rows.map(mapRowToUser);
  }

  static async update(id: number, userData: UpdateUserRequest): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (userData.name !== undefined) {
      fields.push('name = ?');
      values.push(userData.name);
    }
    if (userData.email !== undefined) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.role !== undefined) {
      fields.push('role = ?');
      values.push(userData.role);
    }
    if (userData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(userData.is_active);
    }
    if (userData.avatar_url !== undefined) {
      fields.push('avatar_url = ?');
      values.push(userData.avatar_url);
    }
    if (userData.job_title !== undefined) {
      fields.push('job_title = ?');
      values.push(userData.job_title);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await dbRun(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async updatePassword(id: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );
  }

  static async delete(id: number): Promise<void> {
    await dbRun('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password || user.password === MICROSOFT_PLACEHOLDER_PASSWORD) {
      return false; // usuário só-Microsoft não pode login com senha
    }
    return bcrypt.compare(password, user.password);
  }

  static async count(): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as count FROM users') as { count: number };
    return result.count;
  }

  static async countActive(): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as count FROM users WHERE is_active = 1') as { count: number };
    return result.count;
  }

  static async search(searchTerm: string, limit: number = 50, offset: number = 0): Promise<User[]> {
    const rows = await dbAll(
      `SELECT * FROM users 
       WHERE (name LIKE ? OR email LIKE ?) AND is_active = 1 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
    ) as any[];
    return rows.map(mapRowToUser);
  }

  /** Retorna o conjunto de microsoft_id já cadastrados (para marcar "já importado" na listagem Entra). */
  static async getAllMicrosoftIds(): Promise<Set<string>> {
    const rows = await dbAll(
      'SELECT microsoft_id FROM users WHERE microsoft_id IS NOT NULL AND microsoft_id != ?',
      ['']
    ) as Array<{ microsoft_id: string }>;
    return new Set(rows.map((r) => r.microsoft_id));
  }
}
