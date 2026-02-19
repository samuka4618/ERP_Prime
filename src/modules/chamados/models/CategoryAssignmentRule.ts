import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export type AssignmentRuleOperator = 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';

export interface CategoryAssignmentRule {
  id: number;
  category_id: number;
  field_name: string;
  operator: AssignmentRuleOperator;
  value: string;
  attendant_id: number;
  priority: number;
  created_at: Date;
  attendant_name?: string;
}

export interface CreateAssignmentRuleRequest {
  field_name: string;
  operator: AssignmentRuleOperator;
  value: string;
  attendant_id: number;
  priority?: number;
}

/**
 * Avalia o valor do formulário contra a regra.
 * Retorna true se a regra deve ser aplicada (atribuir ao attendant_id).
 */
export function evaluateRule(
  operator: AssignmentRuleOperator,
  ruleValue: string,
  userValue: string | number | undefined
): boolean {
  if (userValue === undefined || userValue === null || userValue === '') {
    return false;
  }

  const userStr = String(userValue).trim();
  const ruleStr = String(ruleValue).trim();

  // Para operadores numéricos, tentar comparar como número
  const userNum = Number(userValue);
  const ruleNum = Number(ruleValue);
  const bothNumeric = !Number.isNaN(userNum) && !Number.isNaN(ruleNum);

  switch (operator) {
    case 'equals':
      if (bothNumeric) return userNum === ruleNum;
      return userStr.toLowerCase() === ruleStr.toLowerCase();
    case 'not_equals':
      if (bothNumeric) return userNum !== ruleNum;
      return userStr.toLowerCase() !== ruleStr.toLowerCase();
    case 'contains':
      return userStr.toLowerCase().includes(ruleStr.toLowerCase());
    case 'gt':
      return bothNumeric ? userNum > ruleNum : userStr.localeCompare(ruleStr) > 0;
    case 'gte':
      return bothNumeric ? userNum >= ruleNum : userStr.localeCompare(ruleStr) >= 0;
    case 'lt':
      return bothNumeric ? userNum < ruleNum : userStr.localeCompare(ruleStr) < 0;
    case 'lte':
      return bothNumeric ? userNum <= ruleNum : userStr.localeCompare(ruleStr) <= 0;
    default:
      return false;
  }
}

/**
 * Dado custom_data do ticket e lista de regras (ordenadas por priority),
 * retorna o attendant_id da primeira regra que bater, ou null.
 */
export function resolveAttendantFromRules(
  customData: Record<string, any> | undefined,
  rules: CategoryAssignmentRule[]
): number | null {
  if (!customData || !rules.length) return null;

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const userValue = customData[rule.field_name];
    if (evaluateRule(rule.operator, rule.value, userValue)) {
      return rule.attendant_id;
    }
  }
  return null;
}

export class CategoryAssignmentRuleModel {
  static async findByCategory(categoryId: number): Promise<CategoryAssignmentRule[]> {
    const rows = await dbAll(
      `SELECT r.*, u.name as attendant_name
       FROM category_assignment_rules r
       LEFT JOIN users u ON r.attendant_id = u.id
       WHERE r.category_id = ?
       ORDER BY r.priority ASC, r.id ASC`,
      [categoryId]
    ) as any[];

    return rows.map((row) => ({
      id: row.id,
      category_id: row.category_id,
      field_name: row.field_name,
      operator: row.operator,
      value: row.value,
      attendant_id: row.attendant_id,
      priority: row.priority,
      created_at: new Date(row.created_at),
      attendant_name: row.attendant_name
    }));
  }

  static async create(categoryId: number, data: CreateAssignmentRuleRequest): Promise<CategoryAssignmentRule> {
    const priority = data.priority ?? 0;
    const result = await dbRun(
      `INSERT INTO category_assignment_rules (category_id, field_name, operator, value, attendant_id, priority)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [categoryId, data.field_name, data.operator, data.value, data.attendant_id, priority]
    );

    const rule = await this.findById(result.lastID!);
    if (!rule) throw new Error('Erro ao criar regra de atribuição');
    return rule;
  }

  static async findById(id: number): Promise<CategoryAssignmentRule | null> {
    const row = await dbGet(
      `SELECT r.*, u.name as attendant_name
       FROM category_assignment_rules r
       LEFT JOIN users u ON r.attendant_id = u.id
       WHERE r.id = ?`,
      [id]
    ) as any;

    if (!row) return null;

    return {
      id: row.id,
      category_id: row.category_id,
      field_name: row.field_name,
      operator: row.operator,
      value: row.value,
      attendant_id: row.attendant_id,
      priority: row.priority,
      created_at: new Date(row.created_at),
      attendant_name: row.attendant_name
    };
  }

  static async update(id: number, data: Partial<CreateAssignmentRuleRequest>): Promise<CategoryAssignmentRule | null> {
    const rule = await this.findById(id);
    if (!rule) return null;

    const field_name = data.field_name ?? rule.field_name;
    const operator = data.operator ?? rule.operator;
    const value = data.value ?? rule.value;
    const attendant_id = data.attendant_id ?? rule.attendant_id;
    const priority = data.priority !== undefined ? data.priority : rule.priority;

    await dbRun(
      `UPDATE category_assignment_rules SET field_name = ?, operator = ?, value = ?, attendant_id = ?, priority = ? WHERE id = ?`,
      [field_name, operator, value, attendant_id, priority, id]
    );

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM category_assignment_rules WHERE id = ?', [id]);
  }

  static async deleteByCategory(categoryId: number): Promise<void> {
    await dbRun('DELETE FROM category_assignment_rules WHERE category_id = ?', [categoryId]);
  }
}
