import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export interface FormResponse {
  id: number;
  form_id?: number;
  responses: any; // JSON
  driver_name: string;
  phone_number?: string;
  fornecedor_id?: number;
  agendamento_id?: number;
  is_in_yard: boolean;
  submitted_at: Date | string;
  checked_out_at?: Date | string;
  tracking_code?: string;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
}

export interface CreateFormResponseRequest {
  form_id?: number;
  responses: any;
  driver_name: string;
  phone_number?: string;
  fornecedor_id: number;
}

export class FormResponseModel {
  private static generateTrackingCode(): string {
    // Gerar código único baseado em timestamp e random
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${timestamp}-${random}`;
  }

  static async create(data: CreateFormResponseRequest): Promise<FormResponse> {
    // Se não houver form_id, buscar formulário padrão
    let formId = data.form_id;
    if (!formId) {
      const defaultForm = await dbGet(
        'SELECT id FROM formularios_descarga WHERE is_default = 1 AND is_published = 1 LIMIT 1'
      ) as any;
      if (defaultForm) {
        formId = defaultForm.id;
      }
    }

    // Gerar código de rastreamento único
    let trackingCode = this.generateTrackingCode();
    
    // Garantir que o código é único
    let exists = await dbGet(
      'SELECT id FROM form_responses_descarga WHERE tracking_code = ?',
      [trackingCode]
    );
    
    while (exists) {
      trackingCode = this.generateTrackingCode();
      exists = await dbGet(
        'SELECT id FROM form_responses_descarga WHERE tracking_code = ?',
        [trackingCode]
      );
    }

    // Buscar agendamento do fornecedor por proximidade de data
    // Janela de busca: 3 dias antes até 1 dia depois (proximidade)
    // Prioriza agendamentos pendentes, mas pode pegar outros status se necessário
    const agendamento = await dbGet(
      `SELECT id, scheduled_date, scheduled_time, status
       FROM agendamentos_descarga 
       WHERE fornecedor_id = ? 
       AND scheduled_date >= DATE('now', '-3 days')
       AND scheduled_date <= DATE('now', '+1 day')
       AND (
         status = 'pendente' 
         OR (status = 'motorista_pronto' AND id NOT IN (
           SELECT agendamento_id FROM form_responses_descarga 
           WHERE agendamento_id IS NOT NULL AND is_in_yard = 1
         ))
       )
       ORDER BY 
         CASE 
           WHEN scheduled_date = DATE('now') THEN 1
           WHEN scheduled_date < DATE('now') THEN 2
           ELSE 3
         END,
         ABS(julianday(scheduled_date) - julianday('now')) ASC,
         scheduled_time ASC
       LIMIT 1`,
      [data.fornecedor_id]
    ) as any;

    if (!agendamento) {
      throw new Error('Não foi encontrado agendamento para este fornecedor. É necessário ter um agendamento para registrar a chegada do motorista.');
    }

    await dbRun(
      `INSERT INTO form_responses_descarga 
       (form_id, responses, driver_name, phone_number, fornecedor_id, agendamento_id, is_in_yard, tracking_code)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        formId || null,
        JSON.stringify(data.responses),
        data.driver_name,
        data.phone_number || null,
        data.fornecedor_id,
        agendamento?.id || null,
        trackingCode
      ]
    );

    const response = await dbGet(
      'SELECT * FROM form_responses_descarga WHERE tracking_code = ?',
      [trackingCode]
    ) as any;

    if (!response) {
      throw new Error('Erro ao buscar registro criado');
    }

    const result = await this.findById(response.id);
    if (!result) {
      throw new Error('Erro ao buscar registro criado');
    }
    return result;
  }

  static async findById(id: number): Promise<FormResponse | null> {
    const response = await dbGet(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       WHERE r.id = ?`,
      [id]
    ) as any;

    if (!response) return null;

    return {
      id: response.id,
      form_id: response.form_id || undefined,
      responses: JSON.parse(response.responses),
      driver_name: response.driver_name,
      phone_number: response.phone_number || undefined,
      fornecedor_id: response.fornecedor_id || undefined,
      agendamento_id: response.agendamento_id || undefined,
      is_in_yard: Boolean(response.is_in_yard),
      submitted_at: response.submitted_at, // Retornar data ISO original para cálculos no frontend
      checked_out_at: response.checked_out_at || undefined,
      tracking_code: response.tracking_code || undefined,
      fornecedor: response.fornecedor_id ? {
        id: response.fornecedor_id,
        name: response.fornecedor_name,
        category: response.fornecedor_category
      } : undefined
    };
  }

  static async findByTrackingCode(trackingCode: string): Promise<FormResponse | null> {
    const response = await dbGet(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       WHERE r.tracking_code = ?`,
      [trackingCode]
    ) as any;

    if (!response) return null;

    return {
      id: response.id,
      form_id: response.form_id || undefined,
      responses: JSON.parse(response.responses),
      driver_name: response.driver_name,
      phone_number: response.phone_number || undefined,
      fornecedor_id: response.fornecedor_id || undefined,
      agendamento_id: response.agendamento_id || undefined,
      is_in_yard: Boolean(response.is_in_yard),
      submitted_at: response.submitted_at, // Retornar data ISO original para cálculos no frontend
      checked_out_at: response.checked_out_at || undefined,
      tracking_code: response.tracking_code || undefined,
      fornecedor: response.fornecedor_id ? {
        id: response.fornecedor_id,
        name: response.fornecedor_name,
        category: response.fornecedor_category
      } : undefined
    };
  }

  static async findInYard(): Promise<FormResponse[]> {
    const responses = await dbAll(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       WHERE r.is_in_yard = 1
       ORDER BY r.submitted_at ASC`
    ) as any[];

    return Promise.all(
      responses.map(async (r) => ({
        id: r.id,
        form_id: r.form_id || undefined,
        responses: JSON.parse(r.responses),
        driver_name: r.driver_name,
        phone_number: r.phone_number || undefined,
        fornecedor_id: r.fornecedor_id || undefined,
        agendamento_id: r.agendamento_id || undefined,
        is_in_yard: Boolean(r.is_in_yard),
        submitted_at: r.submitted_at, // Retornar data ISO original para cálculos no frontend
        checked_out_at: r.checked_out_at || undefined,
        tracking_code: r.tracking_code || undefined,
        fornecedor: r.fornecedor_id ? {
          id: r.fornecedor_id,
          name: r.fornecedor_name,
          category: r.fornecedor_category
        } : undefined
      }))
    );
  }

  static async checkout(id: number): Promise<FormResponse | null> {
    await dbRun(
      `UPDATE form_responses_descarga 
       SET is_in_yard = 0, checked_out_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    // Enviar SMS de liberação (não bloqueante)
    const { DescarregamentoNotificationService } = await import('../services/NotificationService');
    DescarregamentoNotificationService.notifyDriverReleased(id).catch(err => {
      console.error('Erro ao enviar SMS de liberação (não bloqueante):', err);
    });

    return this.findById(id);
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
    fornecedor_id?: number;
    is_in_yard?: boolean;
    search?: string;
  }): Promise<{
    data: FormResponse[];
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

    if (params.start_date) {
      whereClause += ' AND DATE(r.submitted_at) >= ?';
      queryParams.push(params.start_date);
    }

    if (params.end_date) {
      whereClause += ' AND DATE(r.submitted_at) <= ?';
      queryParams.push(params.end_date);
    }

    if (params.fornecedor_id) {
      whereClause += ' AND r.fornecedor_id = ?';
      queryParams.push(params.fornecedor_id);
    }

    if (params.is_in_yard !== undefined) {
      whereClause += ' AND r.is_in_yard = ?';
      queryParams.push(params.is_in_yard ? 1 : 0);
    }

    if (params.search) {
      whereClause += ' AND (r.driver_name LIKE ? OR r.phone_number LIKE ? OR f.name LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    const responses = await dbAll(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       ${whereClause}
       ORDER BY r.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      responses.map(async (r) => ({
        id: r.id,
        form_id: r.form_id || undefined,
        responses: JSON.parse(r.responses),
        driver_name: r.driver_name,
        phone_number: r.phone_number || undefined,
        fornecedor_id: r.fornecedor_id || undefined,
        agendamento_id: r.agendamento_id || undefined,
        is_in_yard: Boolean(r.is_in_yard),
        submitted_at: r.submitted_at, // Retornar data ISO original para cálculos no frontend
        checked_out_at: r.checked_out_at || undefined,
        tracking_code: r.tracking_code || undefined,
        fornecedor: r.fornecedor_id ? {
          id: r.fornecedor_id,
          name: r.fornecedor_name,
          category: r.fornecedor_category
        } : undefined
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
}
