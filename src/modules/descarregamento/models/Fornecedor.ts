import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface Fornecedor {
  id: number;
  name: string;
  category: string;
  plate?: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateFornecedorRequest {
  name: string;
  category: string;
  plate?: string;
}

export interface UpdateFornecedorRequest {
  name?: string;
  category?: string;
  plate?: string;
}

export class FornecedorModel {
  static async create(data: CreateFornecedorRequest): Promise<Fornecedor> {
    await dbRun(
      `INSERT INTO fornecedores_descarga (name, category, plate)
       VALUES (?, ?, ?)`,
      [data.name, data.category, data.plate || null]
    );

    const fornecedor = await dbGet(
      'SELECT * FROM fornecedores_descarga WHERE name = ? ORDER BY id DESC LIMIT 1',
      [data.name]
    ) as any;

    return {
      id: fornecedor.id,
      name: fornecedor.name,
      category: fornecedor.category,
      plate: fornecedor.plate || undefined,
      created_at: await formatSystemDate(fornecedor.created_at),
      updated_at: await formatSystemDate(fornecedor.updated_at)
    };
  }

  static async findById(id: number): Promise<Fornecedor | null> {
    const fornecedor = await dbGet(
      'SELECT * FROM fornecedores_descarga WHERE id = ?',
      [id]
    ) as any;

    if (!fornecedor) return null;

    return {
      id: fornecedor.id,
      name: fornecedor.name,
      category: fornecedor.category,
      plate: fornecedor.plate || undefined,
      created_at: await formatSystemDate(fornecedor.created_at),
      updated_at: await formatSystemDate(fornecedor.updated_at)
    };
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  }): Promise<{
    data: Fornecedor[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.search) {
      whereClause += ' AND (name LIKE ? OR plate LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    if (params.category) {
      whereClause += ' AND category = ?';
      queryParams.push(params.category);
    }

    const fornecedores = await dbAll(
      `SELECT * FROM fornecedores_descarga ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM fornecedores_descarga ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      fornecedores.map(async (f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        plate: f.plate || undefined,
        created_at: await formatSystemDate(f.created_at),
        updated_at: await formatSystemDate(f.updated_at)
      }))
    );

    return {
      data,
      total: totalResult.count,
      page,
      limit,
      total_pages: Math.ceil(totalResult.count / limit)
    };
  }

  static async update(id: number, data: UpdateFornecedorRequest): Promise<Fornecedor | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.category) {
      fields.push('category = ?');
      values.push(data.category);
    }
    if (data.plate !== undefined) {
      fields.push('plate = ?');
      values.push(data.plate || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE fornecedores_descarga SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM fornecedores_descarga WHERE id = ?', [id]);
  }

  static async getCategories(): Promise<string[]> {
    const categories = await dbAll(
      'SELECT DISTINCT category FROM fornecedores_descarga ORDER BY category'
    ) as any[];

    return categories.map(c => c.category);
  }
}
