import { dbAll, dbGet } from '../database/connection';
import { 
  ReportParameters, 
  SlaPerformanceData, 
  TicketVolumeData, 
  AttendantPerformanceData, 
  CategoryAnalysisData,
  TicketsByAttendantData,
  GeneralTicketsData,
  ReportType 
} from '../types';

export class ReportService {
  static async generateSlaPerformanceReport(params: ReportParameters): Promise<SlaPerformanceData> {
    const { start_date, end_date, category_ids, attendant_ids } = params;
    
    // Construir filtros WHERE
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (category_ids && category_ids.length > 0) {
      whereClause += ' AND t.category_id IN (' + category_ids.map(() => '?').join(',') + ')';
      queryParams.push(...category_ids);
    }

    if (attendant_ids && attendant_ids.length > 0) {
      whereClause += ' AND t.attendant_id IN (' + attendant_ids.map(() => '?').join(',') + ')';
      queryParams.push(...attendant_ids);
    }

    // Dados gerais de SLA
    const slaStats = await dbGet(
      `SELECT 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as sla_first_response_violations,
        SUM(CASE WHEN t.status IN ('in_progress', 'pending_user', 'pending_third_party', 'pending_approval') AND t.sla_resolution < datetime('now') THEN 1 ELSE 0 END) as sla_resolution_violations,
        AVG(CASE WHEN t.status != 'open' THEN 
          (julianday(COALESCE(
            (SELECT MIN(th.created_at) FROM ticket_history th 
             WHERE th.ticket_id = t.id AND th.author_id != t.user_id), 
            t.updated_at
          )) - julianday(t.created_at)) * 24 
        END) as avg_first_response_time,
        AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
          (julianday(t.closed_at) - julianday(t.created_at)) * 24 
        END) as avg_resolution_time
       FROM tickets t
       ${whereClause}`,
      queryParams
    ) as any;

    const totalTickets = slaStats.total_tickets || 0;
    const slaFirstResponseViolations = slaStats.sla_first_response_violations || 0;
    const slaResolutionViolations = slaStats.sla_resolution_violations || 0;
    const avgFirstResponseTime = slaStats.avg_first_response_time || 0;
    const avgResolutionTime = slaStats.avg_resolution_time || 0;

    const slaFirstResponseRate = totalTickets > 0 ? ((totalTickets - slaFirstResponseViolations) / totalTickets) * 100 : 0;
    const slaResolutionRate = totalTickets > 0 ? ((totalTickets - slaResolutionViolations) / totalTickets) * 100 : 0;

    // SLA por categoria
    const slaByCategory = await dbAll(
      `SELECT 
        t.category_id,
        c.name as category_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as sla_violations,
        AVG(CASE WHEN t.status != 'open' THEN 
          (julianday(COALESCE(
            (SELECT MIN(th.created_at) FROM ticket_history th 
             WHERE th.ticket_id = t.id AND th.author_id != t.user_id), 
            t.updated_at
          )) - julianday(t.created_at)) * 24 
        END) as avg_response_time,
        AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
          (julianday(t.closed_at) - julianday(t.created_at)) * 24 
        END) as avg_resolution_time
       FROM tickets t
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       GROUP BY t.category_id, c.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as any[];

    const formattedSlaByCategory = slaByCategory.map(cat => ({
      category_id: cat.category_id,
      category_name: cat.category_name,
      total_tickets: cat.total_tickets,
      sla_violations: cat.sla_violations,
      sla_rate: cat.total_tickets > 0 ? ((cat.total_tickets - cat.sla_violations) / cat.total_tickets) * 100 : 0,
      avg_response_time: cat.avg_response_time || 0,
      avg_resolution_time: cat.avg_resolution_time || 0
    }));

    // SLA por atendente
    const slaByAttendant = await dbAll(
      `SELECT 
        t.attendant_id,
        u.name as attendant_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as sla_violations,
        AVG(CASE WHEN t.status != 'open' THEN 
          (julianday(COALESCE(
            (SELECT MIN(th.created_at) FROM ticket_history th 
             WHERE th.ticket_id = t.id AND th.author_id != t.user_id), 
            t.updated_at
          )) - julianday(t.created_at)) * 24 
        END) as avg_response_time,
        AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
          (julianday(t.closed_at) - julianday(t.created_at)) * 24 
        END) as avg_resolution_time
       FROM tickets t
       LEFT JOIN users u ON t.attendant_id = u.id
       ${whereClause}
       AND t.attendant_id IS NOT NULL
       GROUP BY t.attendant_id, u.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as any[];

    const formattedSlaByAttendant = slaByAttendant.map(att => ({
      attendant_id: att.attendant_id,
      attendant_name: att.attendant_name,
      total_tickets: att.total_tickets,
      sla_violations: att.sla_violations,
      sla_rate: att.total_tickets > 0 ? ((att.total_tickets - att.sla_violations) / att.total_tickets) * 100 : 0,
      avg_response_time: att.avg_response_time || 0,
      avg_resolution_time: att.avg_resolution_time || 0
    }));

    // Tendência de SLA (últimos 30 dias)
    const slaTrend = await dbAll(
      `SELECT 
        DATE(t.created_at) as date,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as violations
       FROM tickets t
       ${whereClause}
       GROUP BY DATE(t.created_at)
       ORDER BY date DESC
       LIMIT 30`,
      queryParams
    ) as any[];

    const formattedSlaTrend = slaTrend.map(trend => ({
      date: trend.date,
      sla_rate: trend.total_tickets > 0 ? ((trend.total_tickets - trend.violations) / trend.total_tickets) * 100 : 0,
      total_tickets: trend.total_tickets,
      violations: trend.violations
    }));

    return {
      total_tickets: totalTickets,
      sla_first_response_violations: slaFirstResponseViolations,
      sla_resolution_violations: slaResolutionViolations,
      sla_first_response_rate: slaFirstResponseRate,
      sla_resolution_rate: slaResolutionRate,
      avg_first_response_time: avgFirstResponseTime,
      avg_resolution_time: avgResolutionTime,
      sla_by_category: formattedSlaByCategory,
      sla_by_attendant: formattedSlaByAttendant,
      sla_trend: formattedSlaTrend
    };
  }

  static async generateTicketVolumeReport(params: ReportParameters): Promise<TicketVolumeData> {
    const { start_date, end_date, category_ids, attendant_ids } = params;
    
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (category_ids && category_ids.length > 0) {
      whereClause += ' AND t.category_id IN (' + category_ids.map(() => '?').join(',') + ')';
      queryParams.push(...category_ids);
    }

    if (attendant_ids && attendant_ids.length > 0) {
      whereClause += ' AND t.attendant_id IN (' + attendant_ids.map(() => '?').join(',') + ')';
      queryParams.push(...attendant_ids);
    }

    // Total de tickets
    const totalResult = await dbGet(
      `SELECT COUNT(*) as total_tickets FROM tickets t ${whereClause}`,
      queryParams
    ) as { total_tickets: number };

    const totalTickets = totalResult.total_tickets;

    // Tickets por status
    const ticketsByStatus = await dbAll(
      `SELECT status, COUNT(*) as count 
       FROM tickets t ${whereClause}
       GROUP BY status`,
      queryParams
    ) as Array<{ status: string; count: number }>;

    const statusCounts: Record<string, number> = {};
    ticketsByStatus.forEach(row => {
      statusCounts[row.status] = row.count;
    });

    // Tickets por prioridade
    const ticketsByPriority = await dbAll(
      `SELECT priority, COUNT(*) as count 
       FROM tickets t ${whereClause}
       GROUP BY priority`,
      queryParams
    ) as Array<{ priority: string; count: number }>;

    const priorityCounts: Record<string, number> = {};
    ticketsByPriority.forEach(row => {
      priorityCounts[row.priority] = row.count;
    });

    // Tickets por categoria
    const ticketsByCategory = await dbAll(
      `SELECT 
        t.category_id,
        c.name as category_name,
        COUNT(*) as total_tickets
       FROM tickets t
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       GROUP BY t.category_id, c.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as Array<{ category_id: number; category_name: string; total_tickets: number }>;

    const formattedTicketsByCategory = ticketsByCategory.map(cat => ({
      category_id: cat.category_id,
      category_name: cat.category_name,
      total_tickets: cat.total_tickets,
      percentage: totalTickets > 0 ? (cat.total_tickets / totalTickets) * 100 : 0
    }));

    // Tickets por atendente
    const ticketsByAttendant = await dbAll(
      `SELECT 
        t.attendant_id,
        u.name as attendant_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval') THEN 1 ELSE 0 END) as pending_tickets
       FROM tickets t
       LEFT JOIN users u ON t.attendant_id = u.id
       ${whereClause}
       AND t.attendant_id IS NOT NULL
       GROUP BY t.attendant_id, u.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as Array<{ attendant_id: number; attendant_name: string; total_tickets: number; resolved_tickets: number; pending_tickets: number }>;

    // Tendência de volume (últimos 30 dias)
    const volumeTrend = await dbAll(
      `SELECT 
        DATE(t.created_at) as date,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as closed_tickets
       FROM tickets t
       ${whereClause}
       GROUP BY DATE(t.created_at)
       ORDER BY date DESC
       LIMIT 30`,
      queryParams
    ) as Array<{ date: string; total_tickets: number; resolved_tickets: number; closed_tickets: number }>;

    const formattedVolumeTrend = volumeTrend.map(trend => ({
      date: trend.date,
      total_tickets: trend.total_tickets,
      created_tickets: trend.total_tickets,
      resolved_tickets: trend.resolved_tickets,
      closed_tickets: trend.closed_tickets
    }));

    // Horários de pico
    const peakHours = await dbAll(
      `SELECT 
        strftime('%H', t.created_at) as hour,
        COUNT(*) as ticket_count
       FROM tickets t
       ${whereClause}
       GROUP BY strftime('%H', t.created_at)
       ORDER BY ticket_count DESC
       LIMIT 10`,
      queryParams
    ) as Array<{ hour: number; ticket_count: number }>;

    return {
      total_tickets: totalTickets,
      tickets_by_status: statusCounts,
      tickets_by_priority: priorityCounts,
      tickets_by_category: formattedTicketsByCategory,
      tickets_by_attendant: ticketsByAttendant,
      volume_trend: formattedVolumeTrend,
      peak_hours: peakHours
    };
  }

  static async generateAttendantPerformanceReport(params: ReportParameters): Promise<AttendantPerformanceData> {
    const { start_date, end_date, attendant_ids } = params;
    
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (attendant_ids && attendant_ids.length > 0) {
      whereClause += ' AND t.attendant_id IN (' + attendant_ids.map(() => '?').join(',') + ')';
      queryParams.push(...attendant_ids);
    }

    // Resumo geral de performance
    const performanceSummary = await dbGet(
      `SELECT 
        COUNT(DISTINCT t.attendant_id) as total_attendants,
        AVG(attendant_stats.ticket_count) as avg_tickets_per_attendant,
        AVG(attendant_stats.avg_resolution_time) as avg_resolution_time,
        AVG(attendant_stats.sla_rate) as avg_sla_rate
       FROM tickets t
       LEFT JOIN (
         SELECT 
           attendant_id,
           COUNT(*) as ticket_count,
           AVG(CASE WHEN status = 'closed' AND closed_at IS NOT NULL THEN 
             (julianday(closed_at) - julianday(created_at)) * 24 
           END) as avg_resolution_time,
           CASE WHEN COUNT(*) > 0 THEN 
             ((COUNT(*) - SUM(CASE WHEN status = 'open' AND sla_first_response < datetime('now') THEN 1 ELSE 0 END)) / COUNT(*)) * 100 
           ELSE 0 END as sla_rate
         FROM tickets 
         WHERE created_at BETWEEN ? AND ? AND attendant_id IS NOT NULL
         GROUP BY attendant_id
       ) attendant_stats ON t.attendant_id = attendant_stats.attendant_id
       ${whereClause}
       AND t.attendant_id IS NOT NULL`,
      [...queryParams, start_date, end_date]
    ) as any;

    // Detalhes por atendente
    const attendantDetails = await dbAll(
      `SELECT 
        t.attendant_id,
        u.name as attendant_name,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval') THEN 1 ELSE 0 END) as pending_tickets,
        AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
          (julianday(t.closed_at) - julianday(t.created_at)) * 24 
        END) as avg_resolution_time,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as sla_violations
       FROM tickets t
       LEFT JOIN users u ON t.attendant_id = u.id
       ${whereClause}
       AND t.attendant_id IS NOT NULL
       GROUP BY t.attendant_id, u.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as any[];

    const formattedAttendantDetails = await Promise.all(attendantDetails.map(async (att) => {
      // Tickets por categoria para este atendente
      const ticketsByCategory = await dbAll(
        `SELECT 
          t.category_id,
          c.name as category_name,
          COUNT(*) as ticket_count
         FROM tickets t
         LEFT JOIN ticket_categories c ON t.category_id = c.id
         ${whereClause}
         AND t.attendant_id = ?
         GROUP BY t.category_id, c.name
         ORDER BY ticket_count DESC`,
        [...queryParams, att.attendant_id]
      ) as Array<{ category_id: number; category_name: string; ticket_count: number }>;

      // Tendência de performance (últimos 30 dias)
      const performanceTrend = await dbAll(
        `SELECT 
          DATE(t.created_at) as date,
          SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as tickets_resolved,
          AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
            (julianday(t.closed_at) - julianday(t.created_at)) * 24 
          END) as avg_resolution_time,
          CASE WHEN COUNT(*) > 0 THEN 
            ((COUNT(*) - SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END)) / COUNT(*)) * 100 
          ELSE 0 END as sla_rate
         FROM tickets t
         ${whereClause}
         AND t.attendant_id = ?
         GROUP BY DATE(t.created_at)
         ORDER BY date DESC
         LIMIT 30`,
        [...queryParams, att.attendant_id]
      ) as Array<{ date: string; tickets_resolved: number; avg_resolution_time: number; sla_rate: number }>;

      return {
        attendant_id: att.attendant_id,
        attendant_name: att.attendant_name,
        total_tickets: att.total_tickets,
        resolved_tickets: att.resolved_tickets,
        pending_tickets: att.pending_tickets,
        avg_resolution_time: att.avg_resolution_time || 0,
        sla_violations: att.sla_violations,
        sla_rate: att.total_tickets > 0 ? ((att.total_tickets - att.sla_violations) / att.total_tickets) * 100 : 0,
        tickets_by_category: ticketsByCategory,
        performance_trend: performanceTrend
      };
    }));

    return {
      total_attendants: performanceSummary.total_attendants || 0,
      performance_summary: {
        avg_tickets_per_attendant: performanceSummary.avg_tickets_per_attendant || 0,
        avg_resolution_time: performanceSummary.avg_resolution_time || 0,
        avg_sla_rate: performanceSummary.avg_sla_rate || 0
      },
      attendant_details: formattedAttendantDetails
    };
  }

  static async generateCategoryAnalysisReport(params: ReportParameters): Promise<CategoryAnalysisData> {
    const { start_date, end_date, category_ids } = params;
    
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (category_ids && category_ids.length > 0) {
      whereClause += ' AND t.category_id IN (' + category_ids.map(() => '?').join(',') + ')';
      queryParams.push(...category_ids);
    }

    // Análise por categoria
    const categorySummary = await dbAll(
      `SELECT 
        t.category_id,
        c.name as category_name,
        COUNT(*) as total_tickets,
        AVG(CASE WHEN t.status = 'closed' AND t.closed_at IS NOT NULL THEN 
          (julianday(t.closed_at) - julianday(t.created_at)) * 24 
        END) as avg_resolution_time,
        SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END) as sla_violations
       FROM tickets t
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       GROUP BY t.category_id, c.name
       ORDER BY total_tickets DESC`,
      queryParams
    ) as any[];

    const formattedCategorySummary = await Promise.all(categorySummary.map(async (cat) => {
      // Tickets por status para esta categoria
      const ticketsByStatus = await dbAll(
        `SELECT status, COUNT(*) as count 
         FROM tickets t 
         ${whereClause}
         AND t.category_id = ?
         GROUP BY status`,
        [...queryParams, cat.category_id]
      ) as Array<{ status: string; count: number }>;

      const statusCounts: Record<string, number> = {};
      ticketsByStatus.forEach(row => {
        statusCounts[row.status] = row.count;
      });

      // Tickets por prioridade para esta categoria
      const ticketsByPriority = await dbAll(
        `SELECT priority, COUNT(*) as count 
         FROM tickets t 
         ${whereClause}
         AND t.category_id = ?
         GROUP BY priority`,
        [...queryParams, cat.category_id]
      ) as Array<{ priority: string; count: number }>;

      const priorityCounts: Record<string, number> = {};
      ticketsByPriority.forEach(row => {
        priorityCounts[row.priority] = row.count;
      });

      // Tickets por atendente para esta categoria
      const ticketsByAttendant = await dbAll(
        `SELECT 
          t.attendant_id,
          u.name as attendant_name,
          COUNT(*) as ticket_count
         FROM tickets t
         LEFT JOIN users u ON t.attendant_id = u.id
         ${whereClause}
         AND t.category_id = ?
         AND t.attendant_id IS NOT NULL
         GROUP BY t.attendant_id, u.name
         ORDER BY ticket_count DESC`,
        [...queryParams, cat.category_id]
      ) as Array<{ attendant_id: number; attendant_name: string; ticket_count: number }>;

      // Dados de tendência para esta categoria
      const trendData = await dbAll(
        `SELECT 
          DATE(t.created_at) as date,
          COUNT(*) as ticket_count,
          CASE WHEN COUNT(*) > 0 THEN 
            ((COUNT(*) - SUM(CASE WHEN t.status = 'open' AND t.sla_first_response < datetime('now') THEN 1 ELSE 0 END)) / COUNT(*)) * 100 
          ELSE 0 END as sla_rate
         FROM tickets t
         ${whereClause}
         AND t.category_id = ?
         GROUP BY DATE(t.created_at)
         ORDER BY date DESC
         LIMIT 30`,
        [...queryParams, cat.category_id]
      ) as Array<{ date: string; ticket_count: number; sla_rate: number }>;

      return {
        category_id: cat.category_id,
        category_name: cat.category_name,
        total_tickets: cat.total_tickets,
        avg_resolution_time: cat.avg_resolution_time || 0,
        sla_violations: cat.sla_violations,
        sla_rate: cat.total_tickets > 0 ? ((cat.total_tickets - cat.sla_violations) / cat.total_tickets) * 100 : 0,
        tickets_by_status: statusCounts,
        tickets_by_priority: priorityCounts,
        tickets_by_attendant: ticketsByAttendant,
        trend_data: trendData
      };
    }));

    return {
      total_categories: categorySummary.length,
      category_summary: formattedCategorySummary
    };
  }

  // Relatório de Chamados por Atendente
  static async generateTicketsByAttendantReport(params: ReportParameters): Promise<TicketsByAttendantData> {
    const { start_date, end_date, attendant_ids } = params;
    
    // Construir filtros WHERE
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (attendant_ids && attendant_ids.length > 0) {
      whereClause += ' AND t.attendant_id IN (' + attendant_ids.map(() => '?').join(',') + ')';
      queryParams.push(...attendant_ids);
    }

    // Buscar todos os atendentes com tickets
    const attendants = await dbAll(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      INNER JOIN tickets t ON u.id = t.attendant_id
      ${whereClause}
      ORDER BY u.name
    `, queryParams) as Array<{ id: number; name: string; email: string }>;

    const attendant_summary = [];

    for (const attendant of attendants) {
      // Estatísticas gerais do atendente
      const stats = await dbGet(`
        SELECT 
          COUNT(*) as total_tickets,
          AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
            THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
            ELSE NULL END) as avg_resolution_time,
          SUM(CASE WHEN t.status = 'overdue_first_response' OR t.status = 'overdue_resolution' 
            THEN 1 ELSE 0 END) as sla_violations,
          MIN(t.created_at) as first_ticket_date,
          MAX(t.created_at) as last_ticket_date
        FROM tickets t
        WHERE t.attendant_id = ? AND t.created_at BETWEEN ? AND ?
      `, [attendant.id, start_date, end_date]) as any;

      // Tickets por status
      const statusCounts = await dbAll(`
        SELECT status, COUNT(*) as count
        FROM tickets t
        WHERE t.attendant_id = ? AND t.created_at BETWEEN ? AND ?
        GROUP BY status
      `, [attendant.id, start_date, end_date]) as Array<{ status: string; count: number }>;

      const tickets_by_status: Record<string, number> = {};
      statusCounts.forEach(row => {
        tickets_by_status[row.status] = row.count;
      });

      // Tickets por prioridade
      const priorityCounts = await dbAll(`
        SELECT priority, COUNT(*) as count
        FROM tickets t
        WHERE t.attendant_id = ? AND t.created_at BETWEEN ? AND ?
        GROUP BY priority
      `, [attendant.id, start_date, end_date]) as Array<{ priority: string; count: number }>;

      const tickets_by_priority: Record<string, number> = {};
      priorityCounts.forEach(row => {
        tickets_by_priority[row.priority] = row.count;
      });

      // Tickets por categoria
      const categoryCounts = await dbAll(`
        SELECT c.id, c.name, COUNT(*) as count
        FROM tickets t
        LEFT JOIN ticket_categories c ON t.category_id = c.id
        WHERE t.attendant_id = ? AND t.created_at BETWEEN ? AND ?
        GROUP BY c.id, c.name
        ORDER BY count DESC
      `, [attendant.id, start_date, end_date]) as Array<{ id: number; name: string; count: number }>;

      const tickets_by_category = categoryCounts.map(row => ({
        category_id: row.id,
        category_name: row.name,
        ticket_count: row.count
      }));

      // Tendência de performance (últimos 30 dias)
      const trendData = await dbAll(`
        SELECT 
          DATE(t.created_at) as date,
          COUNT(*) as tickets_created,
          SUM(CASE WHEN t.status = 'resolved' OR t.status = 'closed' THEN 1 ELSE 0 END) as tickets_resolved,
          AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
            THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
            ELSE NULL END) as avg_resolution_time
        FROM tickets t
        WHERE t.attendant_id = ? AND t.created_at >= date('now', '-30 days')
        GROUP BY DATE(t.created_at)
        ORDER BY date
      `, [attendant.id]) as Array<{ date: string; tickets_created: number; tickets_resolved: number; avg_resolution_time: number }>;

      const sla_rate = stats.total_tickets > 0 ? 
        ((stats.total_tickets - stats.sla_violations) / stats.total_tickets * 100) : 0;

      attendant_summary.push({
        attendant_id: attendant.id,
        attendant_name: attendant.name,
        attendant_email: attendant.email,
        total_tickets: stats.total_tickets,
        tickets_by_status,
        tickets_by_priority,
        tickets_by_category,
        avg_resolution_time: stats.avg_resolution_time || 0,
        sla_violations: stats.sla_violations,
        sla_rate,
        first_ticket_date: stats.first_ticket_date,
        last_ticket_date: stats.last_ticket_date,
        performance_trend: trendData.map(t => ({
          date: t.date,
          tickets_created: t.tickets_created,
          tickets_resolved: t.tickets_resolved,
          avg_resolution_time: t.avg_resolution_time || 0
        }))
      });
    }

    // Calcular ranking de performance
    const performance_ranking = attendant_summary
      .map(attendant => ({
        attendant_id: attendant.attendant_id,
        attendant_name: attendant.attendant_name,
        score: (attendant.sla_rate * 0.4) + ((100 - attendant.avg_resolution_time) * 0.3) + (attendant.total_tickets * 0.3),
        position: 0
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, position: index + 1 }));

    const total_tickets = attendant_summary.reduce((sum, attendant) => sum + attendant.total_tickets, 0);

    return {
      total_attendants: attendants.length,
      total_tickets,
      attendant_summary,
      performance_ranking
    };
  }

  // Relatório Geral de Chamados
  static async generateGeneralTicketsReport(params: ReportParameters): Promise<GeneralTicketsData> {
    const { start_date, end_date, category_ids, attendant_ids, user_ids } = params;
    
    // Construir filtros WHERE
    let whereClause = 'WHERE t.created_at BETWEEN ? AND ?';
    const queryParams: any[] = [start_date, end_date];

    if (category_ids && category_ids.length > 0) {
      whereClause += ' AND t.category_id IN (' + category_ids.map(() => '?').join(',') + ')';
      queryParams.push(...category_ids);
    }

    if (attendant_ids && attendant_ids.length > 0) {
      whereClause += ' AND t.attendant_id IN (' + attendant_ids.map(() => '?').join(',') + ')';
      queryParams.push(...attendant_ids);
    }

    if (user_ids && user_ids.length > 0) {
      whereClause += ' AND t.user_id IN (' + user_ids.map(() => '?').join(',') + ')';
      queryParams.push(...user_ids);
    }

    // Estatísticas gerais
    const generalStats = await dbGet(`
      SELECT 
        COUNT(*) as total_tickets,
        AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
          ELSE NULL END) as avg_resolution_time,
        AVG(CASE WHEN t.status != 'open' 
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
          ELSE NULL END) as avg_first_response_time,
        SUM(CASE WHEN t.status = 'overdue_first_response' OR t.status = 'overdue_resolution' 
          THEN 1 ELSE 0 END) as sla_violations
      FROM tickets t
      ${whereClause}
    `, queryParams) as any;

    // Tickets por status
    const statusCounts = await dbAll(`
      SELECT status, COUNT(*) as count
      FROM tickets t
      ${whereClause}
      GROUP BY status
    `, queryParams) as Array<{ status: string; count: number }>;

    const tickets_by_status: Record<string, number> = {};
    statusCounts.forEach(row => {
      tickets_by_status[row.status] = row.count;
    });

    // Tickets por prioridade
    const priorityCounts = await dbAll(`
      SELECT priority, COUNT(*) as count
      FROM tickets t
      ${whereClause}
      GROUP BY priority
    `, queryParams) as Array<{ priority: string; count: number }>;

    const tickets_by_priority: Record<string, number> = {};
    priorityCounts.forEach(row => {
      tickets_by_priority[row.priority] = row.count;
    });

    // Tickets por categoria
    const categoryData = await dbAll(`
      SELECT 
        c.id, 
        c.name, 
        COUNT(*) as total_tickets,
        AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
          ELSE NULL END) as avg_resolution_time
      FROM tickets t
      LEFT JOIN ticket_categories c ON t.category_id = c.id
      ${whereClause}
      GROUP BY c.id, c.name
      ORDER BY total_tickets DESC
    `, queryParams) as Array<{ id: number; name: string; total_tickets: number; avg_resolution_time: number }>;

    const tickets_by_category = categoryData.map(row => ({
      category_id: row.id,
      category_name: row.name,
      total_tickets: row.total_tickets,
      percentage: (row.total_tickets / generalStats.total_tickets) * 100,
      avg_resolution_time: row.avg_resolution_time || 0
    }));

    // Tickets por atendente
    const attendantData = await dbAll(`
      SELECT 
        u.id, 
        u.name, 
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'resolved' OR t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval') THEN 1 ELSE 0 END) as pending_tickets,
        AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
          ELSE NULL END) as avg_resolution_time
      FROM tickets t
      LEFT JOIN users u ON t.attendant_id = u.id
      ${whereClause}
      GROUP BY u.id, u.name
      ORDER BY total_tickets DESC
    `, queryParams) as Array<{ id: number; name: string; total_tickets: number; resolved_tickets: number; pending_tickets: number; avg_resolution_time: number }>;

    const tickets_by_attendant = attendantData.map(row => ({
      attendant_id: row.id,
      attendant_name: row.name,
      total_tickets: row.total_tickets,
      resolved_tickets: row.resolved_tickets,
      pending_tickets: row.pending_tickets,
      avg_resolution_time: row.avg_resolution_time || 0
    }));

    // Tickets por usuário
    const userData = await dbAll(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'pending_user', 'pending_third_party') THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN t.status = 'resolved' OR t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      ${whereClause}
      GROUP BY u.id, u.name, u.email
      ORDER BY total_tickets DESC
    `, queryParams) as Array<{ id: number; name: string; email: string; total_tickets: number; open_tickets: number; resolved_tickets: number }>;

    const tickets_by_user = userData.map(row => ({
      user_id: row.id,
      user_name: row.name,
      user_email: row.email,
      total_tickets: row.total_tickets,
      open_tickets: row.open_tickets,
      resolved_tickets: row.resolved_tickets
    }));

    // Tendência diária
    const dailyTrend = await dbAll(`
      SELECT 
        DATE(t.created_at) as date,
        COUNT(*) as tickets_created,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as tickets_resolved,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as tickets_closed,
        SUM(CASE WHEN t.status IN ('open', 'in_progress', 'pending_user', 'pending_third_party') THEN 1 ELSE 0 END) as open_tickets
      FROM tickets t
      ${whereClause}
      GROUP BY DATE(t.created_at)
      ORDER BY date
    `, queryParams) as Array<{ date: string; tickets_created: number; tickets_resolved: number; tickets_closed: number; open_tickets: number }>;

    // Distribuição horária
    const hourlyData = await dbAll(`
      SELECT 
        CAST(strftime('%H', t.created_at) AS INTEGER) as hour,
        COUNT(*) as ticket_count
      FROM tickets t
      ${whereClause}
      GROUP BY strftime('%H', t.created_at)
      ORDER BY hour
    `, queryParams) as Array<{ hour: number; ticket_count: number }>;

    const hourly_distribution = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyData.find(h => h.hour === i);
      return {
        hour: i,
        ticket_count: hourData ? hourData.ticket_count : 0
      };
    });

    // Resumo mensal
    const monthlyData = await dbAll(`
      SELECT 
        strftime('%Y-%m', t.created_at) as month,
        COUNT(*) as total_tickets,
        SUM(CASE WHEN t.status = 'resolved' OR t.status = 'closed' THEN 1 ELSE 0 END) as resolved_tickets,
        AVG(CASE WHEN t.status = 'resolved' OR t.status = 'closed' 
          THEN (julianday(t.updated_at) - julianday(t.created_at)) * 24 
          ELSE NULL END) as avg_resolution_time
      FROM tickets t
      ${whereClause}
      GROUP BY strftime('%Y-%m', t.created_at)
      ORDER BY month
    `, queryParams) as Array<{ month: string; total_tickets: number; resolved_tickets: number; avg_resolution_time: number }>;

    const monthly_summary = monthlyData.map(row => ({
      month: row.month,
      total_tickets: row.total_tickets,
      resolved_tickets: row.resolved_tickets,
      avg_resolution_time: row.avg_resolution_time || 0
    }));

    const sla_rate = generalStats.total_tickets > 0 ? 
      ((generalStats.total_tickets - generalStats.sla_violations) / generalStats.total_tickets * 100) : 0;

    // Calcular dias analisados
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const daysAnalyzed = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      total_tickets: generalStats.total_tickets,
      period_summary: {
        start_date,
        end_date,
        days_analyzed: daysAnalyzed
      },
      tickets_by_status,
      tickets_by_priority,
      tickets_by_category,
      tickets_by_attendant,
      tickets_by_user,
      time_analysis: {
        avg_resolution_time: generalStats.avg_resolution_time || 0,
        avg_first_response_time: generalStats.avg_first_response_time || 0,
        sla_violations: generalStats.sla_violations,
        sla_rate
      },
      daily_trend: dailyTrend.map(row => ({
        date: row.date,
        tickets_created: row.tickets_created,
        tickets_resolved: row.tickets_resolved,
        tickets_closed: row.tickets_closed,
        open_tickets: row.open_tickets
      })),
      hourly_distribution,
      monthly_summary: monthly_summary.map(row => ({
        month: row.month,
        total_tickets: row.total_tickets,
        resolved_tickets: row.resolved_tickets,
        avg_resolution_time: row.avg_resolution_time
      }))
    };
  }

  static async generateReport(type: ReportType, params: ReportParameters): Promise<any> {
    switch (type) {
      case 'sla_performance':
        return this.generateSlaPerformanceReport(params);
      case 'ticket_volume':
        return this.generateTicketVolumeReport(params);
      case 'attendant_performance':
        return this.generateAttendantPerformanceReport(params);
      case 'category_analysis':
        return this.generateCategoryAnalysisReport(params);
      case 'tickets_by_attendant':
        return this.generateTicketsByAttendantReport(params);
      case 'general_tickets':
        return this.generateGeneralTicketsReport(params);
      case 'custom':
        // Para relatórios personalizados, os dados já foram gerados pelo CustomReportService
        // Este método não deve ser chamado para relatórios customizados
        throw new Error('Relatórios personalizados devem ser executados através do CustomReportService');
      default:
        throw new Error('Tipo de relatório não suportado');
    }
  }
}
