import { dbRun, dbGet, dbAll } from '../database/connection';
import { sqlBooleanTrue, sqlBooleanFalse } from '../database/sql-dialect';
import { User, UserRole, CreateUserRequest, UpdateUserRequest } from '../../shared/types';
import bcrypt from 'bcryptjs';

// Exportar UserModel como classe
export class UserModel {
  /**
   * Criar um novo usuário
   */
  static async create(userData: CreateUserRequest): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const result = await dbRun(
      `INSERT INTO users (name, email, password, role, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        userData.name,
        userData.email,
        hashedPassword,
        userData.role,
        userData.is_active !== undefined ? (userData.is_active ? 1 : 0) : 1
      ]
    );

    const user = await this.findById(result.lastID);
    if (!user) {
      throw new Error('Erro ao criar usuário');
    }

    return user;
  }

  /**
   * Buscar usuário por ID
   */
  static async findById(id: number): Promise<User | null> {
    // Usar SELECT * para evitar erros se colunas opcionais não existirem
    // SQLite retorna NULL para colunas que não existem
    const user = await dbGet(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    ) as any;

    if (!user) {
      return null;
    }

    // Log para debug - verificar o que vem do banco
    console.log('📸 findById - Dados do banco:', {
      id: user.id,
      avatar: user.avatar,
      avatarType: typeof user.avatar,
      hasAvatar: 'avatar' in user,
      allKeys: Object.keys(user),
      fullRow: JSON.stringify(user, null, 2)
    });

    return this.mapRowToUser(user);
  }

  /**
   * Buscar usuário por email (inclui inativos)
   */
  static async findByEmail(email: string): Promise<User | null> {
    const user = await dbGet(
      'SELECT * FROM users WHERE email = ?',
      [email]
    ) as any;

    if (!user) {
      return null;
    }

    return this.mapRowToUser(user);
  }

  /**
   * Buscar usuário por email (apenas ativos)
   */
  static async findByEmailActive(email: string): Promise<User | null> {
    const user = await dbGet(
      `SELECT * FROM users WHERE email = ? AND is_active = ${sqlBooleanTrue()}`,
      [email]
    ) as any;

    if (!user) {
      return null;
    }

    return this.mapRowToUser(user);
  }

  /**
   * Buscar todos os usuários (paginado)
   */
  static async findAll(limit: number = 20, offset: number = 0): Promise<User[]> {
    const users = await dbAll(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    ) as any[];

    return users.map(user => this.mapRowToUser(user));
  }

  /**
   * Buscar usuários por role
   */
  static async findByRole(role: UserRole, limit: number = 20, offset: number = 0): Promise<User[]> {
    const users = await dbAll(
      `SELECT * FROM users WHERE role = ? AND is_active = ${sqlBooleanTrue()} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [role, limit, offset]
    ) as any[];

    return users.map(user => this.mapRowToUser(user));
  }

  /**
   * Buscar usuários por termo de busca
   */
  static async search(searchTerm: string, limit: number = 20, offset: number = 0): Promise<User[]> {
    const users = await dbAll(
      `SELECT * FROM users 
       WHERE (name LIKE ? OR email LIKE ?) AND is_active = ${sqlBooleanTrue()} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [`%${searchTerm}%`, `%${searchTerm}%`, limit, offset]
    ) as any[];

    return users.map(user => this.mapRowToUser(user));
  }

  /**
   * Contar total de usuários (apenas ativos)
   */
  static async count(): Promise<number> {
    const result = await dbGet(
      `SELECT COUNT(*) as total FROM users WHERE is_active = ${sqlBooleanTrue()}`
    ) as any;

    return result?.total || 0;
  }

  /**
   * Contar todos os usuários (ativos e inativos). Usado para saber se o registro está aberto.
   */
  static async countAll(): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as total FROM users') as any;
    return result?.total ?? 0;
  }

  /**
   * Contar usuários ativos (alias para count)
   */
  static async countActive(): Promise<number> {
    return this.count();
  }

  /**
   * Atualizar usuário
   */
  static async update(id: number, userData: UpdateUserRequest): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.name !== undefined) {
      updates.push('name = ?');
      values.push(userData.name);
    }

    if (userData.email !== undefined) {
      updates.push('email = ?');
      values.push(userData.email);
    }

    if (userData.role !== undefined) {
      updates.push('role = ?');
      values.push(userData.role);
    }

    if (userData.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(userData.is_active ? 1 : 0);
    }

    // Campos corporativos
    if (userData.phone !== undefined) {
      updates.push('phone = ?');
      values.push(userData.phone || null);
    }

    if (userData.department !== undefined) {
      updates.push('department = ?');
      values.push(userData.department || null);
    }

    if (userData.position !== undefined) {
      updates.push('position = ?');
      values.push(userData.position || null);
    }

    if (userData.avatar !== undefined) {
      // Só atualizar avatar se for uma string não vazia, caso contrário preservar o valor atual
      if (userData.avatar && userData.avatar.trim() !== '') {
        updates.push('avatar = ?');
        values.push(userData.avatar);
      }
      // Se avatar for undefined ou string vazia, não atualizar (preservar valor atual)
    }

    if (userData.extension !== undefined) {
      updates.push('extension = ?');
      values.push(userData.extension || null);
    }

    if (userData.bio !== undefined) {
      updates.push('bio = ?');
      values.push(userData.bio || null);
    }

    if (userData.linkedin !== undefined) {
      updates.push('linkedin = ?');
      values.push(userData.linkedin || null);
    }

    if (userData.skype !== undefined) {
      updates.push('skype = ?');
      values.push(userData.skype || null);
    }

    if (userData.hire_date !== undefined) {
      updates.push('hire_date = ?');
      values.push(userData.hire_date || null);
    }

    if (userData.extension !== undefined) {
      updates.push('extension = ?');
      values.push(userData.extension || null);
    }

    if (userData.bio !== undefined) {
      updates.push('bio = ?');
      values.push(userData.bio || null);
    }

    if (userData.linkedin !== undefined) {
      updates.push('linkedin = ?');
      values.push(userData.linkedin || null);
    }

    if (userData.skype !== undefined) {
      updates.push('skype = ?');
      values.push(userData.skype || null);
    }

    if (userData.hire_date !== undefined) {
      updates.push('hire_date = ?');
      values.push(userData.hire_date || null);
    }

    if (updates.length === 0) {
      const user = await this.findById(id);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      return user;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await dbRun(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Log para debug - verificar se o avatar está no objeto retornado
    console.log('📸 UserModel.update retornou:', {
      id: user.id,
      avatar: user.avatar,
      hasAvatar: !!user.avatar,
      avatarValue: user.avatar,
      allKeys: Object.keys(user)
    });

    return user;
  }

  /**
   * Atualizar senha do usuário
   */
  static async updatePassword(id: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await dbRun(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );
  }

  /**
   * Verificar senha do usuário
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  /**
   * Deletar usuário (soft delete)
   */
  static async delete(id: number): Promise<void> {
    await dbRun(
      `UPDATE users SET is_active = ${sqlBooleanFalse()}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }

  /**
   * Mapear linha do banco para objeto User
   */
  private static mapRowToUser(row: any): User {
    // Log para debug - verificar o que está sendo mapeado
    console.log('📸 mapRowToUser - Mapeando:', {
      id: row.id,
      avatar: row.avatar,
      avatarType: typeof row.avatar,
      hasAvatar: 'avatar' in row,
      allRowKeys: Object.keys(row)
    });

    const mapped = {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role as UserRole,
      is_active: row.is_active === 1 || row.is_active === true,
      // Campos corporativos - usar nullish coalescing para preservar strings vazias
      phone: row.phone ?? undefined,
      department: row.department ?? undefined,
      position: row.position ?? undefined,
      avatar: row.avatar ?? undefined, // Usar ?? ao invés de || para preservar strings vazias
      extension: row.extension ?? undefined,
      bio: row.bio ?? undefined,
      linkedin: row.linkedin ?? undefined,
      skype: row.skype ?? undefined,
      hire_date: row.hire_date ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    console.log('📸 mapRowToUser - Resultado mapeado:', {
      id: mapped.id,
      avatar: mapped.avatar,
      hasAvatar: !!mapped.avatar,
      allMappedKeys: Object.keys(mapped)
    });

    return mapped;
  }
}

export default UserModel;

// Garantir que o arquivo seja reconhecido como módulo ES6
export {};
