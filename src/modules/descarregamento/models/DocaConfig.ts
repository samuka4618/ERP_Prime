import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface DocaConfig {
  id: number;
  numero: string;
  nome?: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateDocaConfigRequest {
  numero: string;
  nome?: string;
  is_active?: boolean;
}

export interface UpdateDocaConfigRequest {
  numero?: string;
  nome?: string;
  is_active?: boolean;
}

export class DocaConfigModel {
  static async create(data: CreateDocaConfigRequest): Promise<DocaConfig> {
    await dbRun(
      `INSERT INTO docas_config (numero, nome, is_active)
       VALUES (?, ?, ?)`,
      [data.numero, data.nome || null, data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1]
    );

    const doca = await dbGet(
      'SELECT * FROM docas_config WHERE numero = ? ORDER BY id DESC LIMIT 1',
      [data.numero]
    ) as any;

    return {
      id: doca.id,
      numero: doca.numero,
      nome: doca.nome || undefined,
      is_active: Boolean(doca.is_active),
      created_at: await formatSystemDate(doca.created_at),
      updated_at: await formatSystemDate(doca.updated_at)
    };
  }

  static async findById(id: number): Promise<DocaConfig | null> {
    const doca = await dbGet(
      'SELECT * FROM docas_config WHERE id = ?',
      [id]
    ) as any;

    if (!doca) return null;

    return {
      id: doca.id,
      numero: doca.numero,
      nome: doca.nome || undefined,
      is_active: Boolean(doca.is_active),
      created_at: await formatSystemDate(doca.created_at),
      updated_at: await formatSystemDate(doca.updated_at)
    };
  }

  static async findAll(activeOnly: boolean = false): Promise<DocaConfig[]> {
    let query = 'SELECT * FROM docas_config';
    const params: any[] = [];

    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }

    query += ' ORDER BY CAST(numero AS INTEGER), numero';

    const docas = await dbAll(query, params) as any[];

    return Promise.all(
      docas.map(async (d) => ({
        id: d.id,
        numero: d.numero,
        nome: d.nome || undefined,
        is_active: Boolean(d.is_active),
        created_at: await formatSystemDate(d.created_at),
        updated_at: await formatSystemDate(d.updated_at)
      }))
    );
  }

  static async update(id: number, data: UpdateDocaConfigRequest): Promise<DocaConfig | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.numero) {
      fields.push('numero = ?');
      values.push(data.numero);
    }
    if (data.nome !== undefined) {
      fields.push('nome = ?');
      values.push(data.nome || null);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE docas_config SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM docas_config WHERE id = ?', [id]);
  }
}
