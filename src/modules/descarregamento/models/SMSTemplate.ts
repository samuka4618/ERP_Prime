import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export type SMSTemplateType = 'arrival' | 'release';

export interface SMSTemplate {
  id: number;
  name: string;
  message: string;
  template_type: SMSTemplateType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSMSTemplateRequest {
  name: string;
  message: string;
  template_type: SMSTemplateType;
  is_default?: boolean;
}

export interface UpdateSMSTemplateRequest {
  name?: string;
  message?: string;
  template_type?: SMSTemplateType;
  is_default?: boolean;
}

export class SMSTemplateModel {
  static async create(data: CreateSMSTemplateRequest): Promise<SMSTemplate> {
    // Se este template for marcado como padrão, remover padrão de outros do mesmo tipo
    if (data.is_default) {
      await dbRun(
        `UPDATE sms_templates_descarga 
         SET is_default = 0 
         WHERE template_type = ?`,
        [data.template_type]
      );
    }

    await dbRun(
      `INSERT INTO sms_templates_descarga (name, message, template_type, is_default)
       VALUES (?, ?, ?, ?)`,
      [data.name, data.message, data.template_type, data.is_default ? 1 : 0]
    );

    const template = await dbGet(
      `SELECT * FROM sms_templates_descarga 
       WHERE id = (SELECT last_insert_rowid())`
    ) as any;

    if (!template) {
      throw new Error('Erro ao buscar template criado');
    }

    return {
      id: template.id,
      name: template.name,
      message: template.message,
      template_type: template.template_type,
      is_default: Boolean(template.is_default),
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }

  static async findById(id: number): Promise<SMSTemplate | null> {
    const template = await dbGet(
      `SELECT * FROM sms_templates_descarga WHERE id = ?`,
      [id]
    ) as any;

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      message: template.message,
      template_type: template.template_type,
      is_default: Boolean(template.is_default),
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }

  static async findAll(templateType?: SMSTemplateType): Promise<SMSTemplate[]> {
    let query = `SELECT * FROM sms_templates_descarga WHERE 1=1`;
    const params: any[] = [];

    if (templateType) {
      query += ` AND template_type = ?`;
      params.push(templateType);
    }

    query += ` ORDER BY is_default DESC, created_at DESC`;

    const templates = await dbAll(query, params) as any[];

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      message: t.message,
      template_type: t.template_type,
      is_default: Boolean(t.is_default),
      created_at: t.created_at,
      updated_at: t.updated_at
    }));
  }

  static async findDefault(templateType: SMSTemplateType): Promise<SMSTemplate | null> {
    const template = await dbGet(
      `SELECT * FROM sms_templates_descarga 
       WHERE template_type = ? AND is_default = 1
       LIMIT 1`,
      [templateType]
    ) as any;

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      message: template.message,
      template_type: template.template_type,
      is_default: Boolean(template.is_default),
      created_at: template.created_at,
      updated_at: template.updated_at
    };
  }

  static async update(id: number, data: UpdateSMSTemplateRequest): Promise<SMSTemplate | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    // Se este template for marcado como padrão, remover padrão de outros do mesmo tipo
    if (data.is_default) {
      await dbRun(
        `UPDATE sms_templates_descarga 
         SET is_default = 0 
         WHERE template_type = ? AND id != ?`,
        [data.template_type || current.template_type, id]
      );
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.message !== undefined) {
      fields.push('message = ?');
      values.push(data.message);
    }
    if (data.template_type !== undefined) {
      fields.push('template_type = ?');
      values.push(data.template_type);
    }
    if (data.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(data.is_default ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await dbRun(
      `UPDATE sms_templates_descarga SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await dbRun(
      `DELETE FROM sms_templates_descarga WHERE id = ?`,
      [id]
    );

    return result.changes > 0;
  }

  static async replaceVariables(
    template: string,
    variables: Record<string, string | number>
  ): Promise<string> {
    let message = template;
    
    // Substituir variáveis no formato {{variable}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      message = message.replace(regex, String(value));
    });

    return message;
  }
}
