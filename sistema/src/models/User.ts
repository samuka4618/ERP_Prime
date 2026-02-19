import { dbRun, dbGet, dbAll } from '../database/connection';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '../types';
import bcrypt from 'bcryptjs';

export class UserModel {
  static async create(userData: CreateUserRequest): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Inserir o usuário
    await dbRun(
      `INSERT INTO users (name, email, password, role, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [userData.name, userData.email, hashedPassword, userData.role, userData.is_active ?? true]
    );

    // Buscar o último usuário inserido
    const lastUser = await dbGet(
      `SELECT * FROM users 
       WHERE name = ? AND email = ? AND role = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userData.name, userData.email, userData.role]
    ) as any;

    if (!lastUser) {
      throw new Error('Erro ao buscar usuário criado');
    }

    return {
      id: lastUser.id,
      name: lastUser.name,
      email: lastUser.email,
      password: lastUser.password,
      role: lastUser.role,
      is_active: lastUser.is_active,
      created_at: new Date(lastUser.created_at),
      updated_at: new Date(lastUser.updated_at)
    };
  }

  static async findById(id: number): Promise<User | null> {
    const user = await dbGet(
      'SELECT * FROM users WHERE id = ?',
      [id]
    ) as User | undefined;

    return user || null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const user = await dbGet(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as User | undefined;

    return user || null;
  }

  /**
   * Busca um usuário por email, considerando apenas usuários ativos
   * Útil para verificar duplicatas ao criar novos usuários
   */
  static async findByEmailActive(email: string): Promise<User | null> {
    const user = await dbGet(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    ) as User | undefined;

    return user || null;
  }

  static async findAll(limit: number = 50, offset: number = 0): Promise<User[]> {
    const users = await dbAll(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    ) as any[];

    return users.map(user => ({
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    }));
  }

  static async findByRole(role: UserRole, limit: number = 50, offset: number = 0): Promise<User[]> {
    const users = await dbAll(
      'SELECT * FROM users WHERE role = ? AND is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [role, limit, offset]
    ) as any[];

    return users.map(user => ({
      ...user,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at)
    }));
  }

  static async update(id: number, userData: UpdateUserRequest): Promise<User | null> {
    const fields = [];
    const values = [];

    if (userData.name) {
      fields.push('name = ?');
      values.push(userData.name);
    }

    if (userData.email) {
      fields.push('email = ?');
      values.push(userData.email);
    }

    if (userData.role) {
      fields.push('role = ?');
      values.push(userData.role);
    }

    if (userData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(userData.is_active);
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
    const users = await dbAll(
      `SELECT * FROM users 
       WHERE (name LIKE ? OR email LIKE ?) AND is_active = 1 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
    ) as User[];

    return users;
  }
}
