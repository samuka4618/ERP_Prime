import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { sqlBooleanTrue } from '../../../core/database/sql-dialect';

export interface TicketCategoryApproverRow {
  id: number;
  category_id: number;
  user_id: number;
  valor_minimo: number;
  valor_maximo: number;
  priority: number;
  is_active: boolean;
  created_at: Date;
  user_name?: string;
  user_email?: string;
}

export interface CreateTicketCategoryApproverInput {
  user_id: number;
  valor_minimo?: number;
  valor_maximo?: number;
  priority?: number;
  is_active?: boolean;
}

export class TicketCategoryApproverModel {
  static async findByCategory(categoryId: number): Promise<TicketCategoryApproverRow[]> {
    const rows = (await dbAll(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM ticket_category_approvers r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.category_id = ?
       ORDER BY r.priority ASC, r.id ASC`,
      [categoryId]
    )) as any[];

    return rows.map((r) => ({
      id: r.id,
      category_id: r.category_id,
      user_id: r.user_id,
      valor_minimo: parseFloat(r.valor_minimo),
      valor_maximo: parseFloat(r.valor_maximo),
      priority: r.priority,
      is_active: Boolean(r.is_active),
      created_at: new Date(r.created_at),
      user_name: r.user_name,
      user_email: r.user_email
    }));
  }

  /**
   * Primeiro aprovador cuja faixa [valor_minimo, valor_maximo] contém o valor (ordem priority).
   */
  static async findApproverUserIdForValue(categoryId: number, valor: number): Promise<number | null> {
    const row = (await dbGet(
      `SELECT user_id FROM ticket_category_approvers
       WHERE category_id = ? AND is_active = ${sqlBooleanTrue()}
         AND valor_minimo <= ? AND valor_maximo >= ?
       ORDER BY priority ASC, id ASC
       LIMIT 1`,
      [categoryId, valor, valor]
    )) as { user_id: number } | undefined;
    return row?.user_id ?? null;
  }

  static async create(categoryId: number, data: CreateTicketCategoryApproverInput): Promise<TicketCategoryApproverRow> {
    await dbRun(
      `INSERT INTO ticket_category_approvers (category_id, user_id, valor_minimo, valor_maximo, priority, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        data.user_id,
        data.valor_minimo ?? 0,
        data.valor_maximo ?? 999999999.99,
        data.priority ?? 0,
        data.is_active ?? true
      ]
    );
    const last = (await dbGet(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM ticket_category_approvers r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.category_id = ? AND r.user_id = ?
       ORDER BY r.id DESC LIMIT 1`,
      [categoryId, data.user_id]
    )) as any;
    if (!last) throw new Error('Erro ao criar registro de aprovador');
    return {
      id: last.id,
      category_id: last.category_id,
      user_id: last.user_id,
      valor_minimo: parseFloat(last.valor_minimo),
      valor_maximo: parseFloat(last.valor_maximo),
      priority: last.priority,
      is_active: Boolean(last.is_active),
      created_at: new Date(last.created_at),
      user_name: last.user_name,
      user_email: last.user_email
    };
  }

  static async update(
    id: number,
    data: Partial<CreateTicketCategoryApproverInput>
  ): Promise<TicketCategoryApproverRow | null> {
    const existing = await dbGet(`SELECT * FROM ticket_category_approvers WHERE id = ?`, [id]) as any;
    if (!existing) return null;

    const user_id = data.user_id ?? existing.user_id;
    const valor_minimo = data.valor_minimo ?? existing.valor_minimo;
    const valor_maximo = data.valor_maximo ?? existing.valor_maximo;
    const priority = data.priority ?? existing.priority;
    const is_active = data.is_active !== undefined ? data.is_active : existing.is_active;

    await dbRun(
      `UPDATE ticket_category_approvers SET user_id = ?, valor_minimo = ?, valor_maximo = ?, priority = ?, is_active = ? WHERE id = ?`,
      [user_id, valor_minimo, valor_maximo, priority, is_active ? 1 : 0, id]
    );

    const row = (await dbGet(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM ticket_category_approvers r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    )) as any;
    if (!row) return null;
    return {
      id: row.id,
      category_id: row.category_id,
      user_id: row.user_id,
      valor_minimo: parseFloat(row.valor_minimo),
      valor_maximo: parseFloat(row.valor_maximo),
      priority: row.priority,
      is_active: Boolean(row.is_active),
      created_at: new Date(row.created_at),
      user_name: row.user_name,
      user_email: row.user_email
    };
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM ticket_category_approvers WHERE id = ?', [id]);
  }

  static async deleteByCategory(categoryId: number): Promise<void> {
    await dbRun('DELETE FROM ticket_category_approvers WHERE category_id = ?', [categoryId]);
  }
}
