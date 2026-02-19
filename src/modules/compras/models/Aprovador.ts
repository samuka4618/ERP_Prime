import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface Aprovador {
  id: number;
  user_id: number;
  nivel_aprovacao: number;
  valor_minimo: number;
  valor_maximo: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateAprovadorRequest {
  user_id: number;
  nivel_aprovacao: number;
  valor_minimo?: number;
  valor_maximo?: number;
}

export interface UpdateAprovadorRequest {
  nivel_aprovacao?: number;
  valor_minimo?: number;
  valor_maximo?: number;
  is_active?: boolean;
}

export class AprovadorModel {
  static async create(data: CreateAprovadorRequest): Promise<Aprovador> {
    await dbRun(
      `INSERT INTO aprovadores (user_id, nivel_aprovacao, valor_minimo, valor_maximo)
       VALUES (?, ?, ?, ?)`,
      [
        data.user_id,
        data.nivel_aprovacao,
        data.valor_minimo || 0,
        data.valor_maximo || 999999999.99
      ]
    );

    const aprovador = await dbGet(
      'SELECT * FROM aprovadores WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [data.user_id]
    ) as any;

    const result = await this.findById(aprovador.id);
    if (!result) {
      throw new Error('Erro ao buscar aprovador criado');
    }
    return result;
  }

  static async findById(id: number): Promise<Aprovador | null> {
    const aprovador = await dbGet(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM aprovadores a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [id]
    ) as any;

    if (!aprovador) return null;

    return {
      id: aprovador.id,
      user_id: aprovador.user_id,
      nivel_aprovacao: aprovador.nivel_aprovacao,
      valor_minimo: parseFloat(aprovador.valor_minimo),
      valor_maximo: parseFloat(aprovador.valor_maximo),
      is_active: Boolean(aprovador.is_active),
      created_at: await formatSystemDate(aprovador.created_at),
      updated_at: await formatSystemDate(aprovador.updated_at),
      usuario: {
        id: aprovador.user_id,
        name: aprovador.usuario_name,
        email: aprovador.usuario_email
      }
    };
  }

  static async findAll(): Promise<Aprovador[]> {
    const aprovadores = await dbAll(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM aprovadores a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.nivel_aprovacao, a.user_id`
    ) as any[];

    return Promise.all(
      aprovadores.map(async (a) => ({
        id: a.id,
        user_id: a.user_id,
        nivel_aprovacao: a.nivel_aprovacao,
        valor_minimo: parseFloat(a.valor_minimo),
        valor_maximo: parseFloat(a.valor_maximo),
        is_active: Boolean(a.is_active),
        created_at: await formatSystemDate(a.created_at),
        updated_at: await formatSystemDate(a.updated_at),
        usuario: {
          id: a.user_id,
          name: a.usuario_name,
          email: a.usuario_email
        }
      }))
    );
  }

  static async findByUserId(userId: number): Promise<Aprovador | null> {
    const aprovador = await dbGet(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM aprovadores a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.user_id = ? AND a.is_active = 1
       ORDER BY a.nivel_aprovacao DESC LIMIT 1`,
      [userId]
    ) as any;

    if (!aprovador) return null;

    return {
      id: aprovador.id,
      user_id: aprovador.user_id,
      nivel_aprovacao: aprovador.nivel_aprovacao,
      valor_minimo: parseFloat(aprovador.valor_minimo),
      valor_maximo: parseFloat(aprovador.valor_maximo),
      is_active: Boolean(aprovador.is_active),
      created_at: await formatSystemDate(aprovador.created_at),
      updated_at: await formatSystemDate(aprovador.updated_at),
      usuario: {
        id: aprovador.user_id,
        name: aprovador.usuario_name,
        email: aprovador.usuario_email
      }
    };
  }

  static async findByValor(valor: number): Promise<Aprovador[]> {
    const aprovadores = await dbAll(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM aprovadores a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.is_active = 1 
         AND a.valor_minimo <= ? 
         AND a.valor_maximo >= ?
       ORDER BY a.nivel_aprovacao ASC`,
      [valor, valor]
    ) as any[];

    return Promise.all(
      aprovadores.map(async (a) => ({
        id: a.id,
        user_id: a.user_id,
        nivel_aprovacao: a.nivel_aprovacao,
        valor_minimo: parseFloat(a.valor_minimo),
        valor_maximo: parseFloat(a.valor_maximo),
        is_active: Boolean(a.is_active),
        created_at: await formatSystemDate(a.created_at),
        updated_at: await formatSystemDate(a.updated_at),
        usuario: {
          id: a.user_id,
          name: a.usuario_name,
          email: a.usuario_email
        }
      }))
    );
  }

  static async update(id: number, data: UpdateAprovadorRequest): Promise<Aprovador | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.nivel_aprovacao !== undefined) {
      fields.push('nivel_aprovacao = ?');
      values.push(data.nivel_aprovacao);
    }
    if (data.valor_minimo !== undefined) {
      fields.push('valor_minimo = ?');
      values.push(data.valor_minimo);
    }
    if (data.valor_maximo !== undefined) {
      fields.push('valor_maximo = ?');
      values.push(data.valor_maximo);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE aprovadores SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM aprovadores WHERE id = ?', [id]);
  }
}

