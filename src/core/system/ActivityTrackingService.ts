import { dbAll, dbGet, dbRun } from '../database/connection';
import { logger } from '../../shared/utils/logger';

export interface UserActivity {
  user_id: number;
  user_name: string;
  user_email: string;
  user_role: string;
  last_activity: Date;
  is_online: boolean;
  session_duration: number; // em minutos
  total_sessions_today: number;
  total_sessions_this_week: number;
  total_sessions_this_month: number;
}

export interface AttendantMetrics {
  attendant_id: number;
  attendant_name: string;
  attendant_email: string;
  is_online: boolean;
  last_activity: Date;
  active_tickets: number;
  total_tickets_today: number;
  total_tickets_this_week: number;
  total_tickets_this_month: number;
  avg_resolution_time: number; // em minutos
  tickets_resolved_today: number;
  tickets_resolved_this_week: number;
  tickets_resolved_this_month: number;
  response_time_avg: number; // tempo médio de primeira resposta em minutos
  customer_satisfaction: number; // baseado em tempo de resolução
}

export interface SystemOverview {
  total_users: number;
  online_users: number;
  total_attendants: number;
  online_attendants: number;
  active_tickets: number;
  resolved_today: number;
  created_today: number;
  avg_resolution_time: number;
  system_uptime: number;
  peak_concurrent_users: number;
  peak_concurrent_attendants: number;
  // Dados de compras
  total_solicitacoes: number;
  solicitacoes_pendentes: number;
  solicitacoes_em_cotacao: number;
  solicitacoes_aprovadas: number;
  solicitacoes_criadas_hoje: number;
  valor_total_solicitacoes: number;
  total_orcamentos: number;
  orcamentos_pendentes: number;
  orcamentos_aprovados: number;
}

export class ActivityTrackingService {
  // Rastrear atividade do usuário
  static async trackUserActivity(userId: number, activity: string): Promise<void> {
    try {
      const now = new Date();
      
      // Inserir ou atualizar atividade
      await dbRun(`
        INSERT OR REPLACE INTO user_activity_tracking 
        (user_id, activity, timestamp, session_id) 
        VALUES (?, ?, ?, ?)
      `, [userId, activity, now.toISOString(), `session_${userId}_${Date.now()}`]);
      
      // Atualizar última atividade do usuário
      await dbRun(`
        UPDATE users 
        SET last_activity = ?, updated_at = ? 
        WHERE id = ?
      `, [now.toISOString(), now.toISOString(), userId]);
      
      logger.info(`Atividade rastreada para usuário ${userId}: ${activity}`);
    } catch (error) {
      logger.error('Erro ao rastrear atividade do usuário:', error);
    }
  }

  // Obter métricas de usuários
  static async getUserMetrics(): Promise<UserActivity[]> {
    try {
      const query = `
        SELECT 
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role,
          u.last_activity,
          CASE 
            WHEN u.last_activity > datetime('now', '-5 minutes') THEN 1 
            ELSE 0 
          END as is_online,
          0 as session_duration, // Coluna session_duration não existe no banco
          COALESCE(session_stats.total_sessions_today, 0) as total_sessions_today,
          COALESCE(session_stats.total_sessions_this_week, 0) as total_sessions_this_week,
          COALESCE(session_stats.total_sessions_this_month, 0) as total_sessions_this_month
        FROM users u
        LEFT JOIN (
          SELECT 
            user_id,
            0 as session_duration, // Coluna session_duration não existe no banco
            COUNT(CASE WHEN DATE(timestamp) = DATE('now') THEN 1 END) as total_sessions_today,
            COUNT(CASE WHEN timestamp >= datetime('now', '-7 days') THEN 1 END) as total_sessions_this_week,
            COUNT(CASE WHEN timestamp >= datetime('now', '-30 days') THEN 1 END) as total_sessions_this_month
          FROM user_activity_tracking 
          WHERE activity = 'login'
          GROUP BY user_id
        ) session_stats ON u.id = session_stats.user_id
        WHERE u.is_active = 1
        ORDER BY u.last_activity DESC
      `;
      
      const results = await dbAll(query);
      return results.map(row => ({
        user_id: row.user_id,
        user_name: row.user_name,
        user_email: row.user_email,
        user_role: row.user_role,
        last_activity: new Date(row.last_activity || 0),
        is_online: Boolean(row.is_online),
        session_duration: 0, // Coluna session_duration não existe no banco
        total_sessions_today: row.total_sessions_today || 0,
        total_sessions_this_week: row.total_sessions_this_week || 0,
        total_sessions_this_month: row.total_sessions_this_month || 0
      }));
    } catch (error) {
      logger.error('Erro ao obter métricas de usuários:', error);
      return [];
    }
  }

  // Obter métricas de atendentes
  static async getAttendantMetrics(): Promise<AttendantMetrics[]> {
    try {
      const query = `
        SELECT 
          u.id as attendant_id,
          u.name as attendant_name,
          u.email as attendant_email,
          CASE 
            WHEN u.last_activity > datetime('now', '-5 minutes') THEN 1 
            ELSE 0 
          END as is_online,
          u.last_activity,
          COALESCE(ticket_stats.active_tickets, 0) as active_tickets,
          COALESCE(ticket_stats.total_tickets_today, 0) as total_tickets_today,
          COALESCE(ticket_stats.total_tickets_this_week, 0) as total_tickets_this_week,
          COALESCE(ticket_stats.total_tickets_this_month, 0) as total_tickets_this_month,
          COALESCE(ticket_stats.avg_resolution_time, 0) as avg_resolution_time,
          COALESCE(ticket_stats.tickets_resolved_today, 0) as tickets_resolved_today,
          COALESCE(ticket_stats.tickets_resolved_this_week, 0) as tickets_resolved_this_week,
          COALESCE(ticket_stats.tickets_resolved_this_month, 0) as tickets_resolved_this_month,
          COALESCE(ticket_stats.response_time_avg, 0) as response_time_avg,
          COALESCE(ticket_stats.customer_satisfaction, 0) as customer_satisfaction
        FROM users u
        LEFT JOIN (
          SELECT 
            t.attendant_id,
            COUNT(CASE WHEN t.status IN ('open', 'in_progress') THEN 1 END) as active_tickets,
            COUNT(CASE WHEN DATE(t.created_at) = DATE('now') THEN 1 END) as total_tickets_today,
            COUNT(CASE WHEN t.created_at >= datetime('now', '-7 days') THEN 1 END) as total_tickets_this_week,
            COUNT(CASE WHEN t.created_at >= datetime('now', '-30 days') THEN 1 END) as total_tickets_this_month,
            AVG(CASE 
              WHEN t.status = 'resolved' AND t.closed_at IS NOT NULL 
              THEN (julianday(t.closed_at) - julianday(t.created_at)) * 24 * 60 
              ELSE NULL 
            END) as avg_resolution_time,
            COUNT(CASE WHEN t.status = 'resolved' AND DATE(t.closed_at) = DATE('now') THEN 1 END) as tickets_resolved_today,
            COUNT(CASE WHEN t.status = 'resolved' AND t.closed_at >= datetime('now', '-7 days') THEN 1 END) as tickets_resolved_this_week,
            COUNT(CASE WHEN t.status = 'resolved' AND t.closed_at >= datetime('now', '-30 days') THEN 1 END) as tickets_resolved_this_month,
            AVG(CASE 
              WHEN tm.created_at IS NOT NULL 
              THEN (julianday(tm.created_at) - julianday(t.created_at)) * 24 * 60 
              ELSE NULL 
            END) as response_time_avg,
            CASE 
              WHEN AVG(CASE 
                WHEN t.status = 'resolved' AND t.closed_at IS NOT NULL 
                THEN (julianday(t.closed_at) - julianday(t.created_at)) * 24 * 60 
                ELSE NULL 
              END) < 60 THEN 95
              WHEN AVG(CASE 
                WHEN t.status = 'resolved' AND t.closed_at IS NOT NULL 
                THEN (julianday(t.closed_at) - julianday(t.created_at)) * 24 * 60 
                ELSE NULL 
              END) < 240 THEN 85
              WHEN AVG(CASE 
                WHEN t.status = 'resolved' AND t.closed_at IS NOT NULL 
                THEN (julianday(t.closed_at) - julianday(t.created_at)) * 24 * 60 
                ELSE NULL 
              END) < 480 THEN 70
              ELSE 50
            END as customer_satisfaction
          FROM tickets t
          LEFT JOIN ticket_messages tm ON t.id = tm.ticket_id AND tm.user_id = t.attendant_id
          WHERE t.attendant_id IS NOT NULL
          GROUP BY t.attendant_id
        ) ticket_stats ON u.id = ticket_stats.attendant_id
        WHERE u.role = 'attendant' AND u.is_active = 1
        ORDER BY u.last_activity DESC
      `;
      
      const results = await dbAll(query);
      return results.map(row => ({
        attendant_id: row.attendant_id,
        attendant_name: row.attendant_name,
        attendant_email: row.attendant_email,
        is_online: Boolean(row.is_online),
        last_activity: new Date(row.last_activity || 0),
        active_tickets: row.active_tickets || 0,
        total_tickets_today: row.total_tickets_today || 0,
        total_tickets_this_week: row.total_tickets_this_week || 0,
        total_tickets_this_month: row.total_tickets_this_month || 0,
        avg_resolution_time: Math.round(row.avg_resolution_time || 0),
        tickets_resolved_today: row.tickets_resolved_today || 0,
        tickets_resolved_this_week: row.tickets_resolved_this_week || 0,
        tickets_resolved_this_month: row.tickets_resolved_this_month || 0,
        response_time_avg: Math.round(row.response_time_avg || 0),
        customer_satisfaction: row.customer_satisfaction || 0
      }));
    } catch (error) {
      logger.error('Erro ao obter métricas de atendentes:', error);
      return [];
    }
  }

  // Obter visão geral do sistema
  static async getSystemOverview(): Promise<SystemOverview> {
    try {
      const queries = {
        total_users: `SELECT COUNT(*) as count FROM users WHERE is_active = 1`,
        online_users: `SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND last_activity > datetime('now', '-5 minutes')`,
        total_attendants: `SELECT COUNT(*) as count FROM users WHERE role = 'attendant' AND is_active = 1`,
        online_attendants: `SELECT COUNT(*) as count FROM users WHERE role = 'attendant' AND is_active = 1 AND last_activity > datetime('now', '-5 minutes')`,
        active_tickets: `SELECT COUNT(*) as count FROM tickets WHERE status IN ('open', 'in_progress')`,
        resolved_today: `SELECT COUNT(*) as count FROM tickets WHERE status = 'resolved' AND DATE(closed_at) = DATE('now')`,
        created_today: `SELECT COUNT(*) as count FROM tickets WHERE DATE(created_at) = DATE('now')`,
        avg_resolution_time: `
          SELECT AVG((julianday(closed_at) - julianday(created_at)) * 24 * 60) as avg_time 
          FROM tickets 
          WHERE status = 'resolved' AND closed_at IS NOT NULL
        `,
        peak_concurrent_users: `SELECT MAX(concurrent_count) as peak FROM (SELECT COUNT(*) as concurrent_count FROM user_activity_tracking WHERE timestamp >= datetime('now', '-1 day') GROUP BY strftime('%H', timestamp))`,
        peak_concurrent_attendants: `SELECT MAX(concurrent_count) as peak FROM (SELECT COUNT(*) as concurrent_count FROM user_activity_tracking WHERE timestamp >= datetime('now', '-1 day') AND user_id IN (SELECT id FROM users WHERE role = 'attendant') GROUP BY strftime('%H', timestamp))`,
        // Dados de compras
        total_solicitacoes: `SELECT COUNT(*) as count FROM solicitacoes_compra`,
        solicitacoes_pendentes: `SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'pendente_aprovacao'`,
        solicitacoes_em_cotacao: `SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'em_cotacao'`,
        solicitacoes_aprovadas: `SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'aprovada'`,
        solicitacoes_criadas_hoje: `SELECT COUNT(*) as count FROM solicitacoes_compra WHERE DATE(created_at) = DATE('now')`,
        valor_total_solicitacoes: `SELECT COALESCE(SUM(valor_total), 0) as total FROM solicitacoes_compra`,
        total_orcamentos: `SELECT COUNT(*) as count FROM orcamentos`,
        orcamentos_pendentes: `SELECT COUNT(*) as count FROM orcamentos WHERE status = 'pendente'`,
        orcamentos_aprovados: `SELECT COUNT(*) as count FROM orcamentos WHERE status = 'aprovado'`
      };

      const results: any = {};
      
      for (const [key, query] of Object.entries(queries)) {
        const result = await dbGet(query);
        results[key] = result?.count || result?.avg_time || result?.peak || 0;
      }

      return {
        total_users: results.total_users,
        online_users: results.online_users,
        total_attendants: results.total_attendants,
        online_attendants: results.online_attendants,
        active_tickets: results.active_tickets,
        resolved_today: results.resolved_today,
        created_today: results.created_today,
        avg_resolution_time: Math.round(results.avg_resolution_time || 0),
        system_uptime: 99.9, // Placeholder - implementar cálculo real
        peak_concurrent_users: results.peak_concurrent_users,
        peak_concurrent_attendants: results.peak_concurrent_attendants,
        // Dados de compras
        total_solicitacoes: results.total_solicitacoes || 0,
        solicitacoes_pendentes: results.solicitacoes_pendentes || 0,
        solicitacoes_em_cotacao: results.solicitacoes_em_cotacao || 0,
        solicitacoes_aprovadas: results.solicitacoes_aprovadas || 0,
        solicitacoes_criadas_hoje: results.solicitacoes_criadas_hoje || 0,
        valor_total_solicitacoes: parseFloat(results.valor_total_solicitacoes || 0),
        total_orcamentos: results.total_orcamentos || 0,
        orcamentos_pendentes: results.orcamentos_pendentes || 0,
        orcamentos_aprovados: results.orcamentos_aprovados || 0
      };
    } catch (error) {
      logger.error('Erro ao obter visão geral do sistema:', error);
      return {
        total_users: 0,
        online_users: 0,
        total_attendants: 0,
        online_attendants: 0,
        active_tickets: 0,
        resolved_today: 0,
        created_today: 0,
        avg_resolution_time: 0,
        system_uptime: 0,
        peak_concurrent_users: 0,
        peak_concurrent_attendants: 0,
        // Dados de compras
        total_solicitacoes: 0,
        solicitacoes_pendentes: 0,
        solicitacoes_em_cotacao: 0,
        solicitacoes_aprovadas: 0,
        solicitacoes_criadas_hoje: 0,
        valor_total_solicitacoes: 0,
        total_orcamentos: 0,
        orcamentos_pendentes: 0,
        orcamentos_aprovados: 0
      };
    }
  }

  // Obter estatísticas detalhadas de um usuário específico
  static async getUserDetailedStats(userId: number): Promise<any> {
    try {
      const queries = {
        user_info: `SELECT * FROM users WHERE id = ?`,
        tickets_created: `SELECT COUNT(*) as count FROM tickets WHERE user_id = ?`,
        tickets_created_today: `SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND DATE(created_at) = DATE('now')`,
        tickets_created_this_week: `SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`,
        tickets_created_this_month: `SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`,
        avg_tickets_per_day: `SELECT AVG(daily_count) as avg FROM (SELECT COUNT(*) as daily_count FROM tickets WHERE user_id = ? GROUP BY DATE(created_at))`,
        total_messages: `SELECT COUNT(*) as count FROM ticket_messages WHERE user_id = ?`,
        total_attachments: `SELECT COUNT(*) as count FROM attachments WHERE user_id = ?`,
        session_duration_today: `SELECT 0 as total FROM users WHERE id = ?`, // Coluna session_duration não existe no banco
        last_login: `SELECT MAX(timestamp) as last_login FROM user_activity_tracking WHERE user_id = ? AND activity = 'login'`
      };

      const results: any = {};
      
      for (const [key, query] of Object.entries(queries)) {
        const result = await dbGet(query, [userId]);
        results[key] = result?.count || result?.avg || result?.total || result?.last_login || result;
      }

      return {
        user_info: results.user_info,
        tickets_created: results.tickets_created,
        tickets_created_today: results.tickets_created_today,
        tickets_created_this_week: results.tickets_created_this_week,
        tickets_created_this_month: results.tickets_created_this_month,
        avg_tickets_per_day: Math.round(results.avg_tickets_per_day || 0),
        total_messages: results.total_messages,
        total_attachments: results.total_attachments,
        session_duration_today: 0, // Coluna session_duration não existe no banco
        last_login: results.last_login
      };
    } catch (error) {
      logger.error('Erro ao obter estatísticas detalhadas do usuário:', error);
      return null;
    }
  }
}
