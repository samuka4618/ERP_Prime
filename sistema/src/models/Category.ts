import { dbRun, dbGet, dbAll } from '../database/connection';
import { Category, CreateCategoryRequest, UpdateCategoryRequest, PaginationParams, PaginatedResponse } from '../types';

export class CategoryModel {
  static async create(categoryData: CreateCategoryRequest): Promise<Category> {
    // Converter custom_fields para JSON
    const customFieldsJson = categoryData.custom_fields 
      ? JSON.stringify(categoryData.custom_fields) 
      : null;

    // Inserir a categoria
    await dbRun(
      `INSERT INTO ticket_categories (name, description, sla_first_response_hours, sla_resolution_hours, is_active, custom_fields) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        categoryData.name, 
        categoryData.description, 
        categoryData.sla_first_response_hours, 
        categoryData.sla_resolution_hours, 
        categoryData.is_active ?? true,
        customFieldsJson
      ]
    );

    // Buscar a última categoria inserida
    const lastCategory = await dbGet(
      `SELECT * FROM ticket_categories 
       WHERE name = ? AND description = ?
       ORDER BY id DESC
       LIMIT 1`,
      [categoryData.name, categoryData.description]
    ) as any;

    if (!lastCategory) {
      throw new Error('Erro ao buscar categoria criada');
    }

    // Parse custom_fields se existir
    let customFields = undefined;
    if (lastCategory.custom_fields && typeof lastCategory.custom_fields === 'string') {
      try {
        const parsed = JSON.parse(lastCategory.custom_fields);
        if (Array.isArray(parsed)) {
          customFields = parsed;
        }
      } catch (e) {
        console.error('Erro ao fazer parse de custom_fields:', e);
      }
    } else if (Array.isArray(lastCategory.custom_fields)) {
      customFields = lastCategory.custom_fields;
    }

    return {
      id: lastCategory.id,
      name: lastCategory.name,
      description: lastCategory.description,
      sla_first_response_hours: lastCategory.sla_first_response_hours,
      sla_resolution_hours: lastCategory.sla_resolution_hours,
      is_active: lastCategory.is_active,
      custom_fields: customFields,
      created_at: new Date(lastCategory.created_at),
      updated_at: new Date(lastCategory.updated_at)
    };
  }

  static async findById(id: number): Promise<Category | null> {
    const category = await dbGet(
      'SELECT * FROM ticket_categories WHERE id = ?',
      [id]
    ) as any;

    if (!category) return null;

    // Parse custom_fields se existir
    let customFields = undefined;
    if (category.custom_fields && typeof category.custom_fields === 'string') {
      try {
        const parsed = JSON.parse(category.custom_fields);
        if (Array.isArray(parsed)) {
          customFields = parsed;
        }
      } catch (e) {
        console.error('Erro ao fazer parse de custom_fields:', e);
      }
    } else if (Array.isArray(category.custom_fields)) {
      customFields = category.custom_fields;
    }

    return {
      id: category.id,
      name: category.name,
      description: category.description,
      sla_first_response_hours: category.sla_first_response_hours,
      sla_resolution_hours: category.sla_resolution_hours,
      is_active: category.is_active,
      custom_fields: customFields,
      created_at: new Date(category.created_at),
      updated_at: new Date(category.updated_at)
    };
  }

  static async findAll(params: PaginationParams): Promise<PaginatedResponse<Category>> {
    const offset = (params.page - 1) * params.limit;
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const categories = await dbAll(
      `SELECT * FROM ticket_categories 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    ) as Category[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM ticket_categories ${whereClause}`,
      queryParams
    ) as { count: number };

    const formattedCategories = categories.map((category: any) => {
      // Parse custom_fields se existir
      let customFields = undefined;
      if (category.custom_fields && typeof category.custom_fields === 'string') {
        try {
          const parsed = JSON.parse(category.custom_fields);
          if (Array.isArray(parsed)) {
            customFields = parsed;
          }
        } catch (e) {
          console.error('Erro ao fazer parse de custom_fields:', e);
        }
      } else if (Array.isArray(category.custom_fields)) {
        customFields = category.custom_fields;
      }

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        sla_first_response_hours: category.sla_first_response_hours,
        sla_resolution_hours: category.sla_resolution_hours,
        is_active: category.is_active,
        custom_fields: customFields,
        created_at: new Date(category.created_at),
        updated_at: new Date(category.updated_at)
      };
    });

    return {
      data: formattedCategories,
      total: totalResult.count,
      page: params.page,
      limit: params.limit,
      total_pages: Math.ceil(totalResult.count / params.limit)
    };
  }

  static async findActive(): Promise<Category[]> {
    const categories = await dbAll(
      'SELECT * FROM ticket_categories WHERE is_active = 1 ORDER BY name ASC'
    ) as Category[];

    return categories.map((category: any) => {
      // Parse custom_fields se existir
      let customFields = undefined;
      if (category.custom_fields && typeof category.custom_fields === 'string') {
        try {
          const parsed = JSON.parse(category.custom_fields);
          // Validar se é um array válido
          if (Array.isArray(parsed)) {
            customFields = parsed;
          }
        } catch (e) {
          console.error('Erro ao fazer parse de custom_fields:', e);
          // Se falhar, deixar como undefined
        }
      } else if (Array.isArray(category.custom_fields)) {
        // Se já for um array (caso raro), usar diretamente
        customFields = category.custom_fields;
      }

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        sla_first_response_hours: category.sla_first_response_hours,
        sla_resolution_hours: category.sla_resolution_hours,
        is_active: category.is_active,
        custom_fields: customFields,
        created_at: new Date(category.created_at),
        updated_at: new Date(category.updated_at)
      };
    });
  }

  static async update(id: number, categoryData: UpdateCategoryRequest): Promise<Category | null> {
    const fields = [];
    const values = [];

    if (categoryData.name) {
      fields.push('name = ?');
      values.push(categoryData.name);
    }

    if (categoryData.description !== undefined) {
      fields.push('description = ?');
      values.push(categoryData.description);
    }

    if (categoryData.sla_first_response_hours !== undefined) {
      fields.push('sla_first_response_hours = ?');
      values.push(categoryData.sla_first_response_hours);
    }

    if (categoryData.sla_resolution_hours !== undefined) {
      fields.push('sla_resolution_hours = ?');
      values.push(categoryData.sla_resolution_hours);
    }

    if (categoryData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(categoryData.is_active);
    }

    if (categoryData.custom_fields !== undefined) {
      const customFieldsJson = categoryData.custom_fields 
        ? JSON.stringify(categoryData.custom_fields) 
        : null;
      fields.push('custom_fields = ?');
      values.push(customFieldsJson);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await dbRun(
      `UPDATE ticket_categories SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    // Verificar se há chamados usando esta categoria
    const ticketsCount = await dbGet(
      'SELECT COUNT(*) as count FROM tickets WHERE category_id = ?',
      [id]
    ) as { count: number };

    if (ticketsCount.count > 0) {
      throw new Error('Não é possível excluir categoria que possui chamados associados');
    }

    // Excluir a categoria
    await dbRun('DELETE FROM ticket_categories WHERE id = ?', [id]);
  }

  static async count(): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as count FROM ticket_categories') as { count: number };
    return result.count;
  }

  static async countActive(): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as count FROM ticket_categories WHERE is_active = 1') as { count: number };
    return result.count;
  }
}
