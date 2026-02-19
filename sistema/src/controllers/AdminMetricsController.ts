import { Request, Response } from 'express';
import { ActivityTrackingService } from '../services/ActivityTrackingService';
import { tokenCacheService } from '../services/TokenCacheService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

export class AdminMetricsController {
  // Obter visão geral do sistema
  static async getSystemOverview(req: Request, res: Response): Promise<void> {
    try {
      // Obter dados do cache de tokens (usuários online)
      const onlineStats = tokenCacheService.getOnlineStats();
      
      // Obter dados do banco de dados
      const dbOverview = await ActivityTrackingService.getSystemOverview();
      
      // Combinar dados do cache com dados do banco
      const overview = {
        ...dbOverview,
        online_users: onlineStats.total,
        online_attendants: onlineStats.byRole.attendant || 0,
        online_admins: onlineStats.byRole.admin || 0,
        online_regular_users: onlineStats.byRole.user || 0,
        peak_concurrent_users: Math.max(dbOverview.peak_concurrent_users, onlineStats.total),
        peak_concurrent_attendants: Math.max(dbOverview.peak_concurrent_attendants, onlineStats.byRole.attendant || 0)
      };
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Erro ao obter visão geral do sistema:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Obter métricas de usuários
  static async getUserMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Obter usuários online do cache
      const onlineUsers = tokenCacheService.getOnlineUsers();
      
      // Obter métricas do banco de dados
      const dbUserMetrics = await ActivityTrackingService.getUserMetrics();
      
      // Combinar dados: marcar usuários como online se estiverem no cache
      const userMetrics = dbUserMetrics.map(user => {
        const onlineUser = onlineUsers.find(online => online.userId === user.user_id);
        return {
          ...user,
          is_online: !!onlineUser,
          last_activity: onlineUser ? onlineUser.lastSeen : user.last_activity
        };
      });
      
      res.json({
        success: true,
        data: userMetrics
      });
    } catch (error) {
      logger.error('Erro ao obter métricas de usuários:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Obter métricas de atendentes
  static async getAttendantMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Obter atendentes online do cache
      const onlineAttendants = tokenCacheService.getOnlineUsersByRole('attendant');
      
      // Obter métricas do banco de dados
      const dbAttendantMetrics = await ActivityTrackingService.getAttendantMetrics();
      
      // Combinar dados: marcar atendentes como online se estiverem no cache
      const attendantMetrics = dbAttendantMetrics.map(attendant => {
        const onlineAttendant = onlineAttendants.find(online => online.userId === attendant.attendant_id);
        return {
          ...attendant,
          is_online: !!onlineAttendant,
          last_activity: onlineAttendant ? onlineAttendant.lastSeen : attendant.last_activity
        };
      });
      
      res.json({
        success: true,
        data: attendantMetrics
      });
    } catch (error) {
      logger.error('Erro ao obter métricas de atendentes:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Obter estatísticas detalhadas de um usuário específico
  static async getUserDetailedStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId || isNaN(Number(userId))) {
        res.status(400).json({
          success: false,
          message: 'ID do usuário inválido'
        });
        return;
      }

      const userStats = await ActivityTrackingService.getUserDetailedStats(Number(userId));
      
      if (!userStats) {
        res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
        return;
      }

      res.json({
        success: true,
        data: userStats
      });
    } catch (error) {
      logger.error('Erro ao obter estatísticas detalhadas do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Rastrear atividade do usuário
  static async trackActivity(req: Request, res: Response): Promise<void> {
    try {
      const { userId, activity } = req.body;
      
      if (!userId || !activity) {
        res.status(400).json({
          success: false,
          message: 'userId e activity são obrigatórios'
        });
        return;
      }

      await ActivityTrackingService.trackUserActivity(userId, activity);
      
      res.json({
        success: true,
        message: 'Atividade rastreada com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao rastrear atividade:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Obter relatório de performance de atendentes
  static async getAttendantPerformanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const attendantMetrics = await ActivityTrackingService.getAttendantMetrics();
      
      // Filtrar por período se especificado
      let filteredMetrics = attendantMetrics;
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        filteredMetrics = attendantMetrics.filter(metric => {
          const lastActivity = new Date(metric.last_activity);
          return lastActivity >= start && lastActivity <= end;
        });
      }

      // Calcular rankings
      const sortedByTickets = [...filteredMetrics].sort((a, b) => b.total_tickets_this_month - a.total_tickets_this_month);
      const sortedByResolution = [...filteredMetrics].sort((a, b) => a.avg_resolution_time - b.avg_resolution_time);
      const sortedBySatisfaction = [...filteredMetrics].sort((a, b) => b.customer_satisfaction - a.customer_satisfaction);

      const report = {
        summary: {
          total_attendants: filteredMetrics.length,
          online_attendants: filteredMetrics.filter(a => a.is_online).length,
          total_tickets_this_month: filteredMetrics.reduce((sum, a) => sum + a.total_tickets_this_month, 0),
          avg_resolution_time: Math.round(filteredMetrics.reduce((sum, a) => sum + a.avg_resolution_time, 0) / filteredMetrics.length || 0),
          avg_satisfaction: Math.round(filteredMetrics.reduce((sum, a) => sum + a.customer_satisfaction, 0) / filteredMetrics.length || 0)
        },
        rankings: {
          most_tickets: sortedByTickets.slice(0, 5),
          fastest_resolution: sortedByResolution.slice(0, 5),
          highest_satisfaction: sortedBySatisfaction.slice(0, 5)
        },
        detailed_metrics: filteredMetrics
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Erro ao obter relatório de performance:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  // Obter relatório de atividade de usuários
  static async getUserActivityReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const userMetrics = await ActivityTrackingService.getUserMetrics();
      
      // Filtrar por período se especificado
      let filteredMetrics = userMetrics;
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        filteredMetrics = userMetrics.filter(metric => {
          const lastActivity = new Date(metric.last_activity);
          return lastActivity >= start && lastActivity <= end;
        });
      }

      // Calcular estatísticas
      const report = {
        summary: {
          total_users: filteredMetrics.length,
          online_users: filteredMetrics.filter(u => u.is_online).length,
          avg_session_duration: 0, // Coluna session_duration não existe no banco
          most_active_users: filteredMetrics
            .sort((a, b) => b.total_sessions_this_month - a.total_sessions_this_month)
            .slice(0, 10)
        },
        user_breakdown: {
          by_role: filteredMetrics.reduce((acc, user) => {
            acc[user.user_role] = (acc[user.user_role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          online_by_role: filteredMetrics
            .filter(u => u.is_online)
            .reduce((acc, user) => {
              acc[user.user_role] = (acc[user.user_role] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
        },
        detailed_metrics: filteredMetrics
      };

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Erro ao obter relatório de atividade de usuários:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

}
