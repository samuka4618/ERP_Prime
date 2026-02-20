import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'radio' | 'checkbox';
  label: string;
  name: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // Para select, radio
  min?: number;
  max?: number;
  default?: any;
}

export interface Formulario {
  id: number;
  title: string;
  description?: string;
  fields: FormField[];
  is_published: boolean;
  is_default: boolean;
  created_by?: number;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateFormularioRequest {
  title: string;
  description?: string;
  fields: FormField[];
  is_published?: boolean;
  is_default?: boolean;
}

export interface UpdateFormularioRequest {
  title?: string;
  description?: string;
  fields?: FormField[];
  is_published?: boolean;
  is_default?: boolean;
}

export class FormularioModel {
  static async create(userId: number, data: CreateFormularioRequest): Promise<Formulario> {
    // Se este formulário for marcado como padrão, desmarcar outros
    if (data.is_default) {
      await dbRun('UPDATE formularios_descarga SET is_default = 0 WHERE is_default = 1');
    }

    await dbRun(
      `INSERT INTO formularios_descarga (title, description, fields, is_published, is_default, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        data.description || null,
        JSON.stringify(data.fields),
        data.is_published ? 1 : 0,
        data.is_default ? 1 : 0,
        userId
      ]
    );

    const formulario = await dbGet(
      'SELECT * FROM formularios_descarga WHERE title = ? ORDER BY id DESC LIMIT 1',
      [data.title]
    ) as any;

    if (!formulario) {
      throw new Error('Erro ao buscar formulário criado');
    }

    const created = await this.findById(formulario.id);
    if (!created) {
      throw new Error('Erro ao buscar formulário criado');
    }

    return created;
  }

  static async findById(id: number): Promise<Formulario | null> {
    const formulario = await dbGet(
      'SELECT * FROM formularios_descarga WHERE id = ?',
      [id]
    ) as any;

    if (!formulario) return null;

    return {
      id: formulario.id,
      title: formulario.title,
      description: formulario.description || undefined,
      fields: JSON.parse(formulario.fields),
      is_published: Boolean(formulario.is_published),
      is_default: Boolean(formulario.is_default),
      created_by: formulario.created_by || undefined,
      created_at: await formatSystemDate(formulario.created_at),
      updated_at: await formatSystemDate(formulario.updated_at)
    };
  }

  static async findDefault(): Promise<Formulario | null> {
    const formulario = await dbGet(
      'SELECT * FROM formularios_descarga WHERE is_default = 1 AND is_published = 1 LIMIT 1'
    ) as any;

    if (!formulario) return null;

    return {
      id: formulario.id,
      title: formulario.title,
      description: formulario.description || undefined,
      fields: JSON.parse(formulario.fields),
      is_published: Boolean(formulario.is_published),
      is_default: Boolean(formulario.is_default),
      created_by: formulario.created_by || undefined,
      created_at: await formatSystemDate(formulario.created_at),
      updated_at: await formatSystemDate(formulario.updated_at)
    };
  }

  static async findPublished(): Promise<Formulario[]> {
    const formularios = await dbAll(
      'SELECT * FROM formularios_descarga WHERE is_published = 1 ORDER BY is_default DESC, created_at DESC'
    ) as any[];

    return Promise.all(
      formularios.map(async (f) => ({
        id: f.id,
        title: f.title,
        description: f.description || undefined,
        fields: JSON.parse(f.fields),
        is_published: Boolean(f.is_published),
        is_default: Boolean(f.is_default),
        created_by: f.created_by || undefined,
        created_at: await formatSystemDate(f.created_at),
        updated_at: await formatSystemDate(f.updated_at)
      }))
    );
  }

  static async findAll(): Promise<Formulario[]> {
    const formularios = await dbAll(
      'SELECT * FROM formularios_descarga ORDER BY is_default DESC, created_at DESC'
    ) as any[];

    return Promise.all(
      formularios.map(async (f) => ({
        id: f.id,
        title: f.title,
        description: f.description || undefined,
        fields: JSON.parse(f.fields),
        is_published: Boolean(f.is_published),
        is_default: Boolean(f.is_default),
        created_by: f.created_by || undefined,
        created_at: await formatSystemDate(f.created_at),
        updated_at: await formatSystemDate(f.updated_at)
      }))
    );
  }

  static async update(id: number, data: UpdateFormularioRequest): Promise<Formulario | null> {
    // Se este formulário for marcado como padrão, desmarcar outros
    if (data.is_default) {
      await dbRun('UPDATE formularios_descarga SET is_default = 0 WHERE is_default = 1 AND id != ?', [id]);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.title) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description || null);
    }
    if (data.fields) {
      fields.push('fields = ?');
      values.push(JSON.stringify(data.fields));
    }
    if (data.is_published !== undefined) {
      fields.push('is_published = ?');
      values.push(data.is_published ? 1 : 0);
    }
    if (data.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(data.is_default ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE formularios_descarga SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM formularios_descarga WHERE id = ?', [id]);
  }
}
