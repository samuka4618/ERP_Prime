import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { sqlBooleanTrue, sqlOrderByDateProximity, sqlOrderByTodayFirstThenPastThenFuture, sqlMinutesDiffFromNow, sqlDialect } from '../../../core/database/sql-dialect';

/** Dados do agendamento vinculado à chegada (quando existe registro em `agendamentos_descarga`). */
export interface FormResponseAgendamentoSnapshot {
  id: number;
  scheduled_date: string;
  scheduled_time: string;
  dock: string;
  status: 'pendente' | 'motorista_pronto' | 'em_andamento' | 'concluido';
  notes?: string;
}

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
  /** Id da submissão no satélite Railway (quando a chegada veio do satélite). */
  satellite_submission_id?: string;
  tracking_code?: string;
  /** Preenchido quando o operador inicia a liberação para doca (status "realizando descarga") */
  discharge_started_at?: Date | string;
  /** Duração da descarga em minutos (preenchido no checkout) */
  discharge_duration_minutes?: number;
  fornecedor?: {
    id: number;
    name: string;
    category: string;
  };
  agendamento?: FormResponseAgendamentoSnapshot;
}

const FORM_RESPONSE_AGENDAMENTO_SELECT = `
  a.id AS ag_join_id,
  a.scheduled_date AS ag_scheduled_date,
  a.scheduled_time AS ag_scheduled_time,
  a.dock AS ag_dock,
  a.status AS ag_status,
  a.notes AS ag_notes
`;

function mapFormResponseRow(r: any): FormResponse {
  let responses: any = {};
  try {
    responses = typeof r.responses === 'string' ? JSON.parse(r.responses) : r.responses ?? {};
  } catch {
    responses = {};
  }

  const agJoinId = r.ag_join_id;
  const agendamento: FormResponseAgendamentoSnapshot | undefined =
    agJoinId != null && agJoinId !== ''
      ? {
          id: Number(agJoinId),
          scheduled_date: r.ag_scheduled_date,
          scheduled_time: r.ag_scheduled_time ?? '',
          dock: r.ag_dock ?? '',
          status: r.ag_status,
          notes: r.ag_notes || undefined
        }
      : undefined;

  return {
    id: r.id,
    form_id: r.form_id || undefined,
    responses,
    driver_name: r.driver_name,
    phone_number: r.phone_number || undefined,
    fornecedor_id: r.fornecedor_id || undefined,
    agendamento_id: r.agendamento_id || undefined,
    is_in_yard: Boolean(r.is_in_yard),
    submitted_at: r.submitted_at,
    checked_out_at: r.checked_out_at || undefined,
    satellite_submission_id: r.satellite_submission_id || undefined,
    tracking_code: r.tracking_code || undefined,
    discharge_started_at: r.discharge_started_at || undefined,
    discharge_duration_minutes:
      r.discharge_duration_minutes != null ? r.discharge_duration_minutes : undefined,
    fornecedor: r.fornecedor_id
      ? {
          id: r.fornecedor_id,
          name: r.fornecedor_name,
          category: r.fornecedor_category
        }
      : undefined,
    agendamento
  };
}

export interface CreateFormResponseRequest {
  form_id?: number;
  responses: any;
  driver_name: string;
  phone_number?: string;
  fornecedor_id: number;
  /** Se definido (ex.: importação do satélite), usa este código em vez de gerar um novo. */
  tracking_code?: string;
  satellite_submission_id?: string;
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
        `SELECT id FROM formularios_descarga WHERE is_default = ${sqlBooleanTrue()} AND is_published = ${sqlBooleanTrue()} LIMIT 1`
      ) as any;
      if (defaultForm) {
        formId = defaultForm.id;
      }
    }

    let trackingCode = (data.tracking_code || '').trim() || this.generateTrackingCode();
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
    const dateWindowStartExpr = sqlDialect.isPostgres
      ? "CURRENT_DATE - INTERVAL '3 days'"
      : "DATE('now', '-3 days')";
    const dateWindowEndExpr = sqlDialect.isPostgres
      ? "CURRENT_DATE + INTERVAL '1 day'"
      : "DATE('now', '+1 day')";

    const agendamento = await dbGet(
      `SELECT id, scheduled_date, scheduled_time, status
       FROM agendamentos_descarga 
       WHERE fornecedor_id = ? 
       AND scheduled_date >= ${dateWindowStartExpr}
       AND scheduled_date <= ${dateWindowEndExpr}
       AND (
         status = 'pendente' 
         OR (status = 'motorista_pronto' AND id NOT IN (
           SELECT agendamento_id FROM form_responses_descarga 
           WHERE agendamento_id IS NOT NULL AND is_in_yard = ${sqlBooleanTrue()}
         ))
       )
       ORDER BY 
         ${sqlOrderByTodayFirstThenPastThenFuture('scheduled_date')}, ${sqlOrderByDateProximity('scheduled_date')},
         scheduled_time ASC
       LIMIT 1`,
      [data.fornecedor_id]
    ) as any;

    if (!agendamento) {
      throw new Error('Não foi encontrado agendamento para este fornecedor. É necessário ter um agendamento para registrar a chegada do motorista.');
    }

    await dbRun(
      `INSERT INTO form_responses_descarga 
       (form_id, responses, driver_name, phone_number, fornecedor_id, agendamento_id, is_in_yard, tracking_code, satellite_submission_id)
       VALUES (?, ?, ?, ?, ?, ?, ${sqlBooleanTrue()}, ?, ?)`,
      [
        formId || null,
        JSON.stringify(data.responses),
        data.driver_name,
        data.phone_number || null,
        data.fornecedor_id,
        agendamento?.id || null,
        trackingCode,
        data.satellite_submission_id || null
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
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category,
              ${FORM_RESPONSE_AGENDAMENTO_SELECT}
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       LEFT JOIN agendamentos_descarga a ON r.agendamento_id = a.id
       WHERE r.id = ?`,
      [id]
    ) as any;

    if (!response) return null;

    return mapFormResponseRow(response);
  }

  static async findBySatelliteSubmissionId(satelliteId: string): Promise<FormResponse | null> {
    const response = await dbGet(
      `SELECT r.id
       FROM form_responses_descarga r
       WHERE r.satellite_submission_id = ?`,
      [satelliteId]
    ) as any;
    if (!response) return null;
    return this.findById(response.id);
  }

  static async findByTrackingCode(trackingCode: string): Promise<FormResponse | null> {
    const response = await dbGet(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category,
              ${FORM_RESPONSE_AGENDAMENTO_SELECT}
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       LEFT JOIN agendamentos_descarga a ON r.agendamento_id = a.id
       WHERE r.tracking_code = ?`,
      [trackingCode]
    ) as any;

    if (!response) return null;

    return mapFormResponseRow(response);
  }

  static async findInYard(): Promise<FormResponse[]> {
    const responses = await dbAll(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category,
              ${FORM_RESPONSE_AGENDAMENTO_SELECT}
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       LEFT JOIN agendamentos_descarga a ON r.agendamento_id = a.id
       WHERE r.is_in_yard = ${sqlBooleanTrue()}
       ORDER BY r.submitted_at ASC`
    ) as any[];

    return responses.map((r: any) => mapFormResponseRow(r));
  }

  /**
   * Marca início da descarga (status "realizando descarga"). Só aplica se is_in_yard = 1.
   * @param dockFromOperator Número da doca (docas_config.numero). Obrigatório quando o agendamento vinculado ainda não tem doca.
   */
  static async startDischarge(id: number, dockFromOperator?: string | null): Promise<FormResponse | null> {
    const existing = await this.findById(id);
    if (!existing || !existing.is_in_yard) return null;
    if (existing.discharge_started_at) return existing;

    const currentDock = (existing.agendamento?.dock ?? '').trim();
    const incoming = (dockFromOperator ?? '').trim();
    const resolvedDock = incoming || currentDock;

    if (existing.agendamento_id && !resolvedDock) {
      throw new Error('DOCK_REQUIRED');
    }

    if (incoming && existing.agendamento_id) {
      const doca = await dbGet(
        `SELECT id FROM docas_config WHERE numero = ? AND is_active = ${sqlBooleanTrue()}`,
        [incoming]
      ) as any;
      if (!doca) {
        throw new Error('DOCK_INVALID');
      }
      await dbRun(
        'UPDATE agendamentos_descarga SET dock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [incoming, existing.agendamento_id]
      );
    }

    await dbRun(
      `UPDATE form_responses_descarga SET discharge_started_at = CURRENT_TIMESTAMP WHERE id = ? AND is_in_yard = ${sqlBooleanTrue()}`,
      [id]
    );
    // Enviar SMS "chamado para doca" e atualizar tela do motorista (liberado para descarregamento)
    const { DescarregamentoNotificationService } = await import('../services/NotificationService');
    DescarregamentoNotificationService.notifyDriverCalledToDock(id).catch(err => {
      console.error('Erro ao enviar SMS de chamado para doca (não bloqueante):', err);
    });

    // Atualizar status do agendamento vinculado para "em_andamento" (reflete na grade/tabela de agendamentos)
    const updated = await this.findById(id);
    if (updated?.agendamento_id) {
      const current = await dbGet('SELECT status FROM agendamentos_descarga WHERE id = ?', [updated.agendamento_id]) as any;
      if (current && current.status !== 'em_andamento') {
        await dbRun(
          'UPDATE agendamentos_descarga SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['em_andamento', updated.agendamento_id]
        );
        await dbRun(
          `INSERT INTO agendamentos_descarga_status_history (agendamento_id, previous_status, new_status, changed_by)
           VALUES (?, ?, ?, NULL)`,
          [updated.agendamento_id, current.status, 'em_andamento']
        );
      }
    }
    return updated;
  }

  static async checkout(id: number): Promise<FormResponse | null> {
    await dbRun(
      `UPDATE form_responses_descarga 
       SET is_in_yard = 0, 
           checked_out_at = CURRENT_TIMESTAMP,
           discharge_duration_minutes = CASE 
             WHEN discharge_started_at IS NOT NULL THEN 
               CAST(${sqlMinutesDiffFromNow('discharge_started_at')} AS INTEGER)
             ELSE NULL 
           END
       WHERE id = ?`,
      [id]
    );

    // Enviar SMS de liberação (não bloqueante)
    const { DescarregamentoNotificationService } = await import('../services/NotificationService');
    DescarregamentoNotificationService.notifyDriverReleased(id).catch(err => {
      console.error('Erro ao enviar SMS de liberação (não bloqueante):', err);
    });

    // Atualizar status do agendamento vinculado para "concluido" (reflete na grade/tabela de agendamentos)
    const updated = await this.findById(id);
    if (updated?.agendamento_id) {
      const current = await dbGet('SELECT status FROM agendamentos_descarga WHERE id = ?', [updated.agendamento_id]) as any;
      if (current && current.status !== 'concluido') {
        await dbRun(
          'UPDATE agendamentos_descarga SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['concluido', updated.agendamento_id]
        );
        await dbRun(
          `INSERT INTO agendamentos_descarga_status_history (agendamento_id, previous_status, new_status, changed_by)
           VALUES (?, ?, ?, NULL)`,
          [updated.agendamento_id, current.status, 'concluido']
        );
      }
    }
    return updated;
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    start_date?: string;
    end_date?: string;
    fornecedor_id?: number;
    is_in_yard?: boolean | string;
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

    const yardFilter =
      params.is_in_yard === undefined || params.is_in_yard === ''
        ? undefined
        : typeof params.is_in_yard === 'string'
          ? params.is_in_yard === 'true' || params.is_in_yard === '1'
          : Boolean(params.is_in_yard);

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

    if (yardFilter !== undefined) {
      whereClause += ' AND r.is_in_yard = ?';
      queryParams.push(yardFilter ? 1 : 0);
    }

    if (params.search) {
      whereClause += ' AND (r.driver_name LIKE ? OR r.phone_number LIKE ? OR f.name LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
    }

    const responses = await dbAll(
      `SELECT r.*, f.name as fornecedor_name, f.category as fornecedor_category,
              ${FORM_RESPONSE_AGENDAMENTO_SELECT}
       FROM form_responses_descarga r
       LEFT JOIN fornecedores_descarga f ON r.fornecedor_id = f.id
       LEFT JOIN agendamentos_descarga a ON r.agendamento_id = a.id
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

    const data = responses.map((r) => mapFormResponseRow(r));

    return {
      data,
      total: totalResult.count,
      page,
      limit,
      total_pages: Math.ceil(totalResult.count / limit)
    };
  }
}
