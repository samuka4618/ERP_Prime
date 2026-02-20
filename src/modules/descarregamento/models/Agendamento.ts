import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';
import { Fornecedor } from './Fornecedor';

export type AgendamentoStatus = 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';

export interface Agendamento {
  id: number;
  fornecedor_id: number;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:MM
  dock: string;
  status: AgendamentoStatus;
  notes?: string;
  created_by: number;
  created_at: Date | string;
  updated_at: Date | string;
  fornecedor?: Fornecedor;
  created_by_user?: {
    id: number;
    name: string;
    email: string;
  };
  motorista?: {
    id: number;
    driver_name: string;
    phone_number?: string;
    submitted_at: Date | string;
  };
}

export interface CreateAgendamentoRequest {
  fornecedor_id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  notes?: string;
}

export interface UpdateAgendamentoRequest {
  fornecedor_id?: number;
  scheduled_date?: string;
  scheduled_time?: string;
  dock?: string;
  status?: AgendamentoStatus;
  notes?: string;
}

export interface AgendamentoStatusHistory {
  id: number;
  agendamento_id: number;
  previous_status: string | null;
  new_status: string;
  changed_by: number | null;
  changed_at: Date | string;
  changed_by_user?: {
    id: number;
    name: string;
    email: string;
  };
}

export class AgendamentoModel {
  static async create(userId: number, data: CreateAgendamentoRequest): Promise<Agendamento> {
    // Validar se a doca existe e está ativa
    const doca = await dbGet(
      'SELECT id FROM docas_config WHERE numero = ? AND is_active = 1',
      [data.dock]
    ) as any;

    if (!doca) {
      throw new Error(`Doca ${data.dock} não encontrada ou inativa`);
    }

    await dbRun(
      `INSERT INTO agendamentos_descarga (fornecedor_id, scheduled_date, scheduled_time, dock, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'pendente', ?, ?)`,
      [
        data.fornecedor_id,
        data.scheduled_date,
        data.scheduled_time,
        data.dock,
        data.notes || null,
        userId
      ]
    );

    const agendamento = await dbGet(
      `SELECT * FROM agendamentos_descarga 
       WHERE fornecedor_id = ? AND scheduled_date = ? AND scheduled_time = ? 
       ORDER BY id DESC LIMIT 1`,
      [data.fornecedor_id, data.scheduled_date, data.scheduled_time]
    ) as any;

    // Registrar histórico inicial
    await dbRun(
      `INSERT INTO agendamentos_descarga_status_history (agendamento_id, previous_status, new_status, changed_by)
       VALUES (?, NULL, 'pendente', ?)`,
      [agendamento.id, userId]
    );

    const result = await this.findById(agendamento.id);
    if (!result) {
      throw new Error('Erro ao buscar agendamento criado');
    }
    return result;
  }

  static async findById(id: number): Promise<Agendamento | null> {
    const agendamento = await dbGet(
      `SELECT a.*, 
              u.name as created_by_name, u.email as created_by_email,
              f.name as fornecedor_name, f.category as fornecedor_category, f.plate as fornecedor_plate,
              r.id as motorista_id, r.driver_name, r.phone_number as motorista_phone, r.submitted_at as motorista_submitted_at
       FROM agendamentos_descarga a
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN fornecedores_descarga f ON a.fornecedor_id = f.id
       LEFT JOIN form_responses_descarga r ON r.agendamento_id = a.id AND r.is_in_yard = 1
       WHERE a.id = ?`,
      [id]
    ) as any;

    if (!agendamento) return null;

    return {
      id: agendamento.id,
      fornecedor_id: agendamento.fornecedor_id,
      scheduled_date: agendamento.scheduled_date,
      scheduled_time: agendamento.scheduled_time,
      dock: agendamento.dock,
      status: agendamento.status,
      notes: agendamento.notes || undefined,
      created_by: agendamento.created_by,
      created_at: await formatSystemDate(agendamento.created_at),
      updated_at: await formatSystemDate(agendamento.updated_at),
      fornecedor: {
        id: agendamento.fornecedor_id,
        name: agendamento.fornecedor_name,
        category: agendamento.fornecedor_category,
        plate: agendamento.fornecedor_plate || undefined,
        created_at: agendamento.created_at,
        updated_at: agendamento.updated_at
      },
      created_by_user: {
        id: agendamento.created_by,
        name: agendamento.created_by_name,
        email: agendamento.created_by_email
      },
      motorista: agendamento.motorista_id ? {
        id: agendamento.motorista_id,
        driver_name: agendamento.driver_name,
        phone_number: agendamento.motorista_phone || undefined,
        submitted_at: await formatSystemDate(agendamento.motorista_submitted_at)
      } : undefined
    };
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
    status?: AgendamentoStatus;
    fornecedor_id?: number;
    dock?: string;
    search?: string;
  }): Promise<{
    data: Agendamento[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.start_date) {
      whereClause += ' AND a.scheduled_date >= ?';
      queryParams.push(params.start_date);
    }

    if (params.end_date) {
      whereClause += ' AND a.scheduled_date <= ?';
      queryParams.push(params.end_date);
    }

    if (params.status) {
      whereClause += ' AND a.status = ?';
      queryParams.push(params.status);
    }

    if (params.fornecedor_id) {
      whereClause += ' AND a.fornecedor_id = ?';
      queryParams.push(params.fornecedor_id);
    }

    if (params.dock) {
      whereClause += ' AND a.dock = ?';
      queryParams.push(params.dock);
    }

    if (params.search) {
      whereClause += ' AND (f.name LIKE ? OR a.dock LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const agendamentos = await dbAll(
      `SELECT a.*, 
              u.name as created_by_name, u.email as created_by_email,
              f.name as fornecedor_name, f.category as fornecedor_category, f.plate as fornecedor_plate,
              r.id as motorista_id, r.driver_name, r.phone_number as motorista_phone, r.submitted_at as motorista_submitted_at
       FROM agendamentos_descarga a
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN fornecedores_descarga f ON a.fornecedor_id = f.id
       LEFT JOIN form_responses_descarga r ON r.agendamento_id = a.id AND r.is_in_yard = 1
       ${whereClause}
       ORDER BY a.scheduled_date ASC, a.scheduled_time ASC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM agendamentos_descarga a
       LEFT JOIN fornecedores_descarga f ON a.fornecedor_id = f.id
       ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      agendamentos.map(async (a) => ({
        id: a.id,
        fornecedor_id: a.fornecedor_id,
        scheduled_date: a.scheduled_date,
        scheduled_time: a.scheduled_time,
        dock: a.dock,
        status: a.status,
        notes: a.notes || undefined,
        created_by: a.created_by,
        created_at: await formatSystemDate(a.created_at),
        updated_at: await formatSystemDate(a.updated_at),
        fornecedor: {
          id: a.fornecedor_id,
          name: a.fornecedor_name,
          category: a.fornecedor_category,
          plate: a.fornecedor_plate || undefined,
          created_at: a.created_at,
          updated_at: a.updated_at
        },
        created_by_user: {
          id: a.created_by,
          name: a.created_by_name,
          email: a.created_by_email
        },
        motorista: a.motorista_id ? {
          id: a.motorista_id,
          driver_name: a.driver_name,
          phone_number: a.motorista_phone || undefined,
          submitted_at: await formatSystemDate(a.motorista_submitted_at)
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

  static async update(id: number, data: UpdateAgendamentoRequest, userId?: number): Promise<Agendamento | null> {
    // Buscar agendamento atual para registrar mudança de status
    const current = await this.findById(id);
    if (!current) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (data.fornecedor_id) {
      fields.push('fornecedor_id = ?');
      values.push(data.fornecedor_id);
    }
    if (data.scheduled_date) {
      fields.push('scheduled_date = ?');
      values.push(data.scheduled_date);
    }
    if (data.scheduled_time) {
      fields.push('scheduled_time = ?');
      values.push(data.scheduled_time);
    }
    if (data.dock) {
      fields.push('dock = ?');
      values.push(data.dock);
    }
    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE agendamentos_descarga SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      // Registrar mudança de status se houver
      if (data.status && data.status !== current.status && userId) {
        await dbRun(
          `INSERT INTO agendamentos_descarga_status_history (agendamento_id, previous_status, new_status, changed_by)
           VALUES (?, ?, ?, ?)`,
          [id, current.status, data.status, userId]
        );

        // Enviar SMS se status mudou para "em_andamento" (motorista chamado)
        if (data.status === 'em_andamento' && current.status !== 'em_andamento') {
          // Importar dinamicamente para evitar dependência circular
          const { DescarregamentoNotificationService } = await import('../services/NotificationService');
          DescarregamentoNotificationService.notifyDriverCalled(id).catch(err => {
            console.error('Erro ao enviar SMS de chamado (não bloqueante):', err);
          });
        }
      }
    }

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    // Excluir histórico primeiro
    await dbRun('DELETE FROM agendamentos_descarga_status_history WHERE agendamento_id = ?', [id]);
    // Excluir agendamento
    await dbRun('DELETE FROM agendamentos_descarga WHERE id = ?', [id]);
  }

  static async getStatusHistory(id: number): Promise<AgendamentoStatusHistory[]> {
    const history = await dbAll(
      `SELECT h.*, u.name as changed_by_name, u.email as changed_by_email
       FROM agendamentos_descarga_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.agendamento_id = ?
       ORDER BY h.changed_at DESC`,
      [id]
    ) as any[];

    return Promise.all(
      history.map(async (h) => ({
        id: h.id,
        agendamento_id: h.agendamento_id,
        previous_status: h.previous_status,
        new_status: h.new_status,
        changed_by: h.changed_by,
        changed_at: await formatSystemDate(h.changed_at),
        changed_by_user: h.changed_by ? {
          id: h.changed_by,
          name: h.changed_by_name,
          email: h.changed_by_email
        } : undefined
      }))
    );
  }

  static async getByDateRange(startDate: string, endDate: string): Promise<Agendamento[]> {
    const agendamentos = await dbAll(
      `SELECT a.*, 
              u.name as created_by_name, u.email as created_by_email,
              f.name as fornecedor_name, f.category as fornecedor_category, f.plate as fornecedor_plate
       FROM agendamentos_descarga a
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN fornecedores_descarga f ON a.fornecedor_id = f.id
       WHERE a.scheduled_date >= ? AND a.scheduled_date <= ?
       ORDER BY a.scheduled_date ASC, a.scheduled_time ASC`,
      [startDate, endDate]
    ) as any[];

    return Promise.all(
      agendamentos.map(async (a) => ({
        id: a.id,
        fornecedor_id: a.fornecedor_id,
        scheduled_date: a.scheduled_date,
        scheduled_time: a.scheduled_time,
        dock: a.dock,
        status: a.status,
        notes: a.notes || undefined,
        created_by: a.created_by,
        created_at: await formatSystemDate(a.created_at),
        updated_at: await formatSystemDate(a.updated_at),
        fornecedor: {
          id: a.fornecedor_id,
          name: a.fornecedor_name,
          category: a.fornecedor_category,
          plate: a.fornecedor_plate || undefined,
          created_at: a.created_at,
          updated_at: a.updated_at
        },
        created_by_user: {
          id: a.created_by,
          name: a.created_by_name,
          email: a.created_by_email
        }
      }))
    );
  }
}
