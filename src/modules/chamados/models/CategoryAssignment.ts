import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export interface CategoryAssignment {
  id: number;
  category_id: number;
  attendant_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
  attendant_name?: string;
}

export class CategoryAssignmentModel {
  static async create(categoryId: number, attendantId: number): Promise<CategoryAssignment> {
    const result = await dbRun(
      'INSERT INTO category_assignments (category_id, attendant_id) VALUES (?, ?)',
      [categoryId, attendantId]
    );

    const assignment = await this.findById(result.lastID!);
    if (!assignment) {
      throw new Error('Erro ao criar atribuição');
    }
    return assignment;
  }

  static async findById(id: number): Promise<CategoryAssignment | null> {
    const assignment = await dbGet(
      `SELECT ca.*, 
              c.name as category_name,
              u.name as attendant_name
       FROM category_assignments ca
       LEFT JOIN ticket_categories c ON ca.category_id = c.id
       LEFT JOIN users u ON ca.attendant_id = u.id
       WHERE ca.id = ?`,
      [id]
    ) as any;

    if (!assignment) return null;

    return {
      id: assignment.id,
      category_id: assignment.category_id,
      attendant_id: assignment.attendant_id,
      is_active: Boolean(assignment.is_active),
      created_at: new Date(assignment.created_at),
      updated_at: new Date(assignment.updated_at),
      category_name: assignment.category_name,
      attendant_name: assignment.attendant_name
    };
  }

  static async findAll(): Promise<CategoryAssignment[]> {
    const assignments = await dbAll(
      `SELECT ca.*, 
              c.name as category_name,
              u.name as attendant_name
       FROM category_assignments ca
       LEFT JOIN ticket_categories c ON ca.category_id = c.id
       LEFT JOIN users u ON ca.attendant_id = u.id
       WHERE ca.is_active = 1
       ORDER BY c.name, u.name`,
      []
    ) as any[];

    return assignments.map(assignment => ({
      id: assignment.id,
      category_id: assignment.category_id,
      attendant_id: assignment.attendant_id,
      is_active: Boolean(assignment.is_active),
      created_at: new Date(assignment.created_at),
      updated_at: new Date(assignment.updated_at),
      category_name: assignment.category_name,
      attendant_name: assignment.attendant_name
    }));
  }

  static async findByCategory(categoryId: number): Promise<CategoryAssignment[]> {
    const assignments = await dbAll(
      `SELECT ca.*, 
              c.name as category_name,
              u.name as attendant_name
       FROM category_assignments ca
       LEFT JOIN ticket_categories c ON ca.category_id = c.id
       LEFT JOIN users u ON ca.attendant_id = u.id
       WHERE ca.category_id = ? AND ca.is_active = 1
       ORDER BY u.name`,
      [categoryId]
    ) as any[];

    return assignments.map(assignment => ({
      id: assignment.id,
      category_id: assignment.category_id,
      attendant_id: assignment.attendant_id,
      is_active: Boolean(assignment.is_active),
      created_at: new Date(assignment.created_at),
      updated_at: new Date(assignment.updated_at),
      category_name: assignment.category_name,
      attendant_name: assignment.attendant_name
    }));
  }

  static async findByAttendant(attendantId: number): Promise<CategoryAssignment[]> {
    const assignments = await dbAll(
      `SELECT ca.*, 
              c.name as category_name,
              u.name as attendant_name
       FROM category_assignments ca
       LEFT JOIN ticket_categories c ON ca.category_id = c.id
       LEFT JOIN users u ON ca.attendant_id = u.id
       WHERE ca.attendant_id = ? AND ca.is_active = 1
       ORDER BY c.name`,
      [attendantId]
    ) as any[];

    return assignments.map(assignment => ({
      id: assignment.id,
      category_id: assignment.category_id,
      attendant_id: assignment.attendant_id,
      is_active: Boolean(assignment.is_active),
      created_at: new Date(assignment.created_at),
      updated_at: new Date(assignment.updated_at),
      category_name: assignment.category_name,
      attendant_name: assignment.attendant_name
    }));
  }

  static async delete(id: number): Promise<void> {
    await dbRun(
      'UPDATE category_assignments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  static async deleteByCategoryAndAttendant(categoryId: number, attendantId: number): Promise<void> {
    await dbRun(
      'UPDATE category_assignments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE category_id = ? AND attendant_id = ?',
      [categoryId, attendantId]
    );
  }

  static async exists(categoryId: number, attendantId: number): Promise<boolean> {
    const result = await dbGet(
      'SELECT id FROM category_assignments WHERE category_id = ? AND attendant_id = ? AND is_active = 1',
      [categoryId, attendantId]
    ) as { id: number } | null;

    return !!result;
  }

  static async getAvailableAttendantsForCategory(categoryId: number): Promise<Array<{ id: number; name: string; email: string }>> {
    const attendants = await dbAll(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.role = 'attendant' 
       AND u.is_active = 1
       AND u.id NOT IN (
         SELECT attendant_id 
         FROM category_assignments 
         WHERE category_id = ? AND is_active = 1
       )
       ORDER BY u.name`,
      [categoryId]
    ) as any[];

    return attendants.map(attendant => ({
      id: attendant.id,
      name: attendant.name,
      email: attendant.email
    }));
  }

  static async getAssignedAttendantsForCategory(categoryId: number): Promise<Array<{ id: number; name: string; email: string }>> {
    const attendants = await dbAll(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN category_assignments ca ON u.id = ca.attendant_id
       WHERE ca.category_id = ? AND ca.is_active = 1 AND u.is_active = 1
       ORDER BY u.name`,
      [categoryId]
    ) as any[];

    return attendants.map(attendant => ({
      id: attendant.id,
      name: attendant.name,
      email: attendant.email
    }));
  }
}
