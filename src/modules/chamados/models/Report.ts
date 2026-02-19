import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { 
  Report, 
  ReportExecution, 
  ReportSchedule, 
  CreateReportRequest, 
  UpdateReportRequest, 
  CreateReportScheduleRequest,
  ReportType,
  ReportStatus,
  ReportFrequency,
  PaginationParams,
  PaginatedResponse
} from '../types';

export class ReportModel {
  // Métodos para Reports
  static async create(userId: number, reportData: CreateReportRequest): Promise<Report> {
    await dbRun(
      `INSERT INTO reports (name, description, type, parameters, custom_fields, custom_query, created_by, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportData.name, 
        reportData.description || null, 
        reportData.type, 
        JSON.stringify(reportData.parameters), 
        reportData.custom_fields || null,
        reportData.custom_query || null,
        userId, 
        true
      ]
    );

    const lastReport = await dbGet(
      `SELECT r.*, u.name as creator_name, u.email as creator_email
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.name = ? AND r.created_by = ? AND r.type = ?
       ORDER BY r.id DESC
       LIMIT 1`,
      [reportData.name, userId, reportData.type]
    ) as any;

    if (!lastReport) {
      throw new Error('Erro ao buscar relatório criado');
    }

    return {
      id: lastReport.id,
      name: lastReport.name,
      description: lastReport.description,
      type: lastReport.type as ReportType,
      parameters: lastReport.parameters,
      created_by: lastReport.created_by,
      is_active: lastReport.is_active,
      created_at: new Date(lastReport.created_at),
      updated_at: new Date(lastReport.updated_at),
      creator: lastReport.creator_name ? {
        id: lastReport.created_by,
        name: lastReport.creator_name,
        email: lastReport.creator_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  static async findById(id: number): Promise<Report | null> {
    const report = await dbGet(
      `SELECT r.*, u.name as creator_name, u.email as creator_email
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`,
      [id]
    ) as any;

    if (!report) return null;

    return {
      id: report.id,
      name: report.name,
      description: report.description,
      type: report.type as ReportType,
      parameters: report.parameters,
      custom_fields: report.custom_fields,
      custom_query: report.custom_query,
      created_by: report.created_by,
      is_active: report.is_active,
      created_at: new Date(report.created_at),
      updated_at: new Date(report.updated_at),
      creator: report.creator_name ? {
        id: report.created_by,
        name: report.creator_name,
        email: report.creator_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  static async findAll(params: PaginationParams): Promise<PaginatedResponse<Report>> {
    const offset = (params.page - 1) * params.limit;
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.search) {
      whereClause += ' AND (r.name LIKE ? OR r.description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const reports = await dbAll(
      `SELECT r.*, u.name as creator_name, u.email as creator_email
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM reports r ${whereClause}`,
      queryParams
    ) as { count: number };

    const formattedReports = reports.map(report => ({
      id: report.id,
      name: report.name,
      description: report.description,
      type: report.type as ReportType,
      parameters: report.parameters,
      created_by: report.created_by,
      is_active: report.is_active,
      created_at: new Date(report.created_at),
      updated_at: new Date(report.updated_at),
      creator: report.creator_name ? {
        id: report.created_by,
        name: report.creator_name,
        email: report.creator_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    }));

    return {
      data: formattedReports,
      total: totalResult.count,
      page: params.page,
      limit: params.limit,
      total_pages: Math.ceil(totalResult.count / params.limit)
    };
  }

  static async update(id: number, reportData: UpdateReportRequest): Promise<Report | null> {
    const fields = [];
    const values = [];

    if (reportData.name) {
      fields.push('name = ?');
      values.push(reportData.name);
    }

    if (reportData.description !== undefined) {
      fields.push('description = ?');
      values.push(reportData.description);
    }

    if (reportData.parameters) {
      fields.push('parameters = ?');
      values.push(JSON.stringify(reportData.parameters));
    }

    if (reportData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(reportData.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await dbRun(
      `UPDATE reports SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM reports WHERE id = ?', [id]);
  }

  // Métodos para ReportExecutions
  static async createExecution(executionData: {
    report_id: number;
    executed_by: number;
    parameters: Record<string, any>;
  }): Promise<ReportExecution> {
    await dbRun(
      `INSERT INTO report_executions (report_id, executed_by, status, parameters) 
       VALUES (?, ?, ?, ?)`,
      [
        executionData.report_id,
        executionData.executed_by,
        'running',
        JSON.stringify(executionData.parameters)
      ]
    );

    const lastExecution = await dbGet(
      `SELECT re.*, u.name as executor_name, u.email as executor_email
       FROM report_executions re
       LEFT JOIN users u ON re.executed_by = u.id
       WHERE re.report_id = ? AND re.executed_by = ?
       ORDER BY re.id DESC
       LIMIT 1`,
      [executionData.report_id, executionData.executed_by]
    ) as any;

    return {
      id: lastExecution.id,
      report_id: lastExecution.report_id,
      executed_by: lastExecution.executed_by,
      status: lastExecution.status as ReportStatus,
      parameters: lastExecution.parameters,
      started_at: new Date(lastExecution.started_at),
      executor: lastExecution.executor_name ? {
        id: lastExecution.executed_by,
        name: lastExecution.executor_name,
        email: lastExecution.executor_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  static async updateExecution(id: number, updateData: {
    status: ReportStatus;
    result_data?: string;
    file_path?: string;
    error_message?: string;
  }): Promise<void> {
    const fields = ['status = ?'];
    const values: any[] = [updateData.status];

    if (updateData.result_data) {
      fields.push('result_data = ?');
      values.push(updateData.result_data);
    }

    if (updateData.file_path) {
      fields.push('file_path = ?');
      values.push(updateData.file_path);
    }

    if (updateData.error_message) {
      fields.push('error_message = ?');
      values.push(updateData.error_message);
    }

    if (updateData.status === 'completed' || updateData.status === 'failed') {
      fields.push('completed_at = CURRENT_TIMESTAMP');
    }

    values.push(id);

    await dbRun(
      `UPDATE report_executions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  static async findExecutionsByReport(reportId: number, limit: number = 10): Promise<ReportExecution[]> {
    const executions = await dbAll(
      `SELECT re.*, u.name as executor_name, u.email as executor_email
       FROM report_executions re
       LEFT JOIN users u ON re.executed_by = u.id
       WHERE re.report_id = ?
       ORDER BY re.started_at DESC
       LIMIT ?`,
      [reportId, limit]
    ) as any[];

    return executions.map(execution => ({
      id: execution.id,
      report_id: execution.report_id,
      executed_by: execution.executed_by,
      status: execution.status as ReportStatus,
      parameters: execution.parameters,
      result_data: execution.result_data,
      file_path: execution.file_path,
      error_message: execution.error_message,
      started_at: new Date(execution.started_at),
      completed_at: execution.completed_at ? new Date(execution.completed_at) : undefined,
      executor: execution.executor_name ? {
        id: execution.executed_by,
        name: execution.executor_name,
        email: execution.executor_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    }));
  }

  // Buscar execução específica por ID
  static async findExecutionById(id: number): Promise<ReportExecution | null> {
    const execution = await dbGet(
      `SELECT re.*, u.name as executor_name, u.email as executor_email
       FROM report_executions re
       LEFT JOIN users u ON re.executed_by = u.id
       WHERE re.id = ?`,
      [id]
    ) as any;

    if (!execution) return null;

    return {
      id: execution.id,
      report_id: execution.report_id,
      executed_by: execution.executed_by,
      status: execution.status,
      parameters: execution.parameters,
      result_data: execution.result_data,
      file_path: execution.file_path,
      error_message: execution.error_message,
      started_at: new Date(execution.started_at),
      completed_at: execution.completed_at ? new Date(execution.completed_at) : undefined,
      executor: execution.executor_name ? {
        id: execution.executed_by,
        name: execution.executor_name,
        email: execution.executor_email,
        password: '',
        role: 'admin' as any,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  // Excluir execução de relatório
  static async deleteExecution(id: number): Promise<void> {
    await dbRun(
      'DELETE FROM report_executions WHERE id = ?',
      [id]
    );
  }

  // Métodos para ReportSchedules
  static async createSchedule(scheduleData: CreateReportScheduleRequest): Promise<ReportSchedule> {
    // Calcular próxima execução
    const nextExecution = this.calculateNextExecution(
      scheduleData.frequency,
      scheduleData.day_of_week,
      scheduleData.day_of_month,
      scheduleData.time
    );

    await dbRun(
      `INSERT INTO report_schedules (report_id, name, frequency, day_of_week, day_of_month, time, recipients, next_execution) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleData.report_id,
        scheduleData.name,
        scheduleData.frequency,
        scheduleData.day_of_week || null,
        scheduleData.day_of_month || null,
        scheduleData.time,
        JSON.stringify(scheduleData.recipients),
        nextExecution
      ]
    );

    const lastSchedule = await dbGet(
      `SELECT rs.*, r.name as report_name
       FROM report_schedules rs
       LEFT JOIN reports r ON rs.report_id = r.id
       WHERE rs.report_id = ? AND rs.name = ?
       ORDER BY rs.id DESC
       LIMIT 1`,
      [scheduleData.report_id, scheduleData.name]
    ) as any;

    return {
      id: lastSchedule.id,
      report_id: lastSchedule.report_id,
      name: lastSchedule.name,
      frequency: lastSchedule.frequency as ReportFrequency,
      day_of_week: lastSchedule.day_of_week,
      day_of_month: lastSchedule.day_of_month,
      time: lastSchedule.time,
      recipients: lastSchedule.recipients,
      is_active: lastSchedule.is_active,
      last_executed: lastSchedule.last_executed ? new Date(lastSchedule.last_executed) : undefined,
      next_execution: lastSchedule.next_execution ? new Date(lastSchedule.next_execution) : undefined,
      created_at: new Date(lastSchedule.created_at),
      updated_at: new Date(lastSchedule.updated_at),
      report: lastSchedule.report_name ? {
        id: lastSchedule.report_id,
        name: lastSchedule.report_name,
        description: '',
        type: 'custom' as ReportType,
        parameters: '',
        created_by: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  static async findSchedulesByReport(reportId: number): Promise<ReportSchedule[]> {
    const schedules = await dbAll(
      `SELECT rs.*, r.name as report_name
       FROM report_schedules rs
       LEFT JOIN reports r ON rs.report_id = r.id
       WHERE rs.report_id = ?
       ORDER BY rs.next_execution ASC`,
      [reportId]
    ) as any[];

    return schedules.map(schedule => ({
      id: schedule.id,
      report_id: schedule.report_id,
      name: schedule.name,
      frequency: schedule.frequency as ReportFrequency,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      time: schedule.time,
      recipients: schedule.recipients,
      is_active: schedule.is_active,
      last_executed: schedule.last_executed ? new Date(schedule.last_executed) : undefined,
      next_execution: schedule.next_execution ? new Date(schedule.next_execution) : undefined,
      created_at: new Date(schedule.created_at),
      updated_at: new Date(schedule.updated_at),
      report: schedule.report_name ? {
        id: schedule.report_id,
        name: schedule.report_name,
        description: '',
        type: 'custom' as ReportType,
        parameters: '',
        created_by: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    }));
  }

  static async findDueSchedules(): Promise<ReportSchedule[]> {
    const now = new Date().toISOString();
    const schedules = await dbAll(
      `SELECT rs.*, r.name as report_name, r.type as report_type, r.parameters as report_parameters, r.custom_fields as report_custom_fields, r.created_by as report_created_by
       FROM report_schedules rs
       LEFT JOIN reports r ON rs.report_id = r.id
       WHERE rs.is_active = 1 AND rs.next_execution <= ?
       ORDER BY rs.next_execution ASC`,
      [now]
    ) as any[];

    return schedules.map(schedule => ({
      id: schedule.id,
      report_id: schedule.report_id,
      name: schedule.name,
      frequency: schedule.frequency as ReportFrequency,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      time: schedule.time,
      recipients: schedule.recipients,
      is_active: schedule.is_active,
      last_executed: schedule.last_executed ? new Date(schedule.last_executed) : undefined,
      next_execution: schedule.next_execution ? new Date(schedule.next_execution) : undefined,
      created_at: new Date(schedule.created_at),
      updated_at: new Date(schedule.updated_at),
      report: schedule.report_name ? {
        id: schedule.report_id,
        name: schedule.report_name,
        description: '',
        type: schedule.report_type as ReportType,
        parameters: schedule.report_parameters,
        custom_fields: schedule.report_custom_fields,
        created_by: schedule.report_created_by ?? 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    }));
  }

  static async updateScheduleNextExecution(id: number): Promise<void> {
    const schedule = await dbGet(
      'SELECT * FROM report_schedules WHERE id = ?',
      [id]
    ) as any;

    if (!schedule) return;

    const nextExecution = this.calculateNextExecution(
      schedule.frequency,
      schedule.day_of_week,
      schedule.day_of_month,
      schedule.time
    );

    await dbRun(
      'UPDATE report_schedules SET last_executed = CURRENT_TIMESTAMP, next_execution = ? WHERE id = ?',
      [nextExecution, id]
    );
  }

  static async deleteSchedule(id: number): Promise<void> {
    await dbRun('DELETE FROM report_schedules WHERE id = ?', [id]);
  }

  private static calculateNextExecution(
    frequency: ReportFrequency,
    dayOfWeek?: number,
    dayOfMonth?: number,
    time?: string
  ): string {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        if (dayOfWeek !== undefined) {
          const daysUntilTarget = (dayOfWeek - next.getDay() + 7) % 7;
          next.setDate(next.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
        } else {
          next.setDate(next.getDate() + 7);
        }
        break;
      case 'monthly':
        if (dayOfMonth !== undefined) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(dayOfMonth);
        } else {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }

    if (time) {
      const [hours, minutes] = time.split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }

    return next.toISOString();
  }
}
