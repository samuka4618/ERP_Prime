import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface Comprador {
  id: number;
  user_id: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateCompradorRequest {
  user_id: number;
}

export interface UpdateCompradorRequest {
  is_active?: boolean;
}

export class CompradorModel {
  static async create(data: CreateCompradorRequest): Promise<Comprador> {
    await dbRun(
      'INSERT INTO compradores (user_id) VALUES (?)',
      [data.user_id]
    );

    const comprador = await dbGet(
      'SELECT * FROM compradores WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [data.user_id]
    ) as any;

    const result = await this.findById(comprador.id);
    if (!result) {
      throw new Error('Erro ao buscar comprador criado');
    }
    return result;
  }

  static async findById(id: number): Promise<Comprador | null> {
    const comprador = await dbGet(
      `SELECT c.*, u.name as usuario_name, u.email as usuario_email
       FROM compradores c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    ) as any;

    if (!comprador) return null;

    return {
      id: comprador.id,
      user_id: comprador.user_id,
      is_active: Boolean(comprador.is_active),
      created_at: await formatSystemDate(comprador.created_at),
      updated_at: await formatSystemDate(comprador.updated_at),
      usuario: {
        id: comprador.user_id,
        name: comprador.usuario_name,
        email: comprador.usuario_email
      }
    };
  }

  static async findAll(): Promise<Comprador[]> {
    const compradores = await dbAll(
      `SELECT c.*, u.name as usuario_name, u.email as usuario_email
       FROM compradores c
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY u.name`
    ) as any[];

    return Promise.all(
      compradores.map(async (c) => ({
        id: c.id,
        user_id: c.user_id,
        is_active: Boolean(c.is_active),
        created_at: await formatSystemDate(c.created_at),
        updated_at: await formatSystemDate(c.updated_at),
        usuario: {
          id: c.user_id,
          name: c.usuario_name,
          email: c.usuario_email
        }
      }))
    );
  }

  static async findByUserId(userId: number): Promise<Comprador | null> {
    const comprador = await dbGet(
      `SELECT c.*, u.name as usuario_name, u.email as usuario_email
       FROM compradores c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.user_id = ? AND c.is_active = 1`,
      [userId]
    ) as any;

    if (!comprador) return null;

    return {
      id: comprador.id,
      user_id: comprador.user_id,
      is_active: Boolean(comprador.is_active),
      created_at: await formatSystemDate(comprador.created_at),
      updated_at: await formatSystemDate(comprador.updated_at),
      usuario: {
        id: comprador.user_id,
        name: comprador.usuario_name,
        email: comprador.usuario_email
      }
    };
  }

  static async update(id: number, data: UpdateCompradorRequest): Promise<Comprador | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE compradores SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM compradores WHERE id = ?', [id]);
  }
}

