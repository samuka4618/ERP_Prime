import { Request, Response } from 'express';
import { PerformanceMetricsService } from '../../modules/chamados/services/PerformanceMetricsService';
import { logger } from '../../shared/utils/logger';

export class PerformanceController {
  static async getMetrics(req: Request, res: Response) {
    try {
      logger.info('Buscando métricas de performance do sistema');
      
      const metrics = await PerformanceMetricsService.getMetrics();
      
      res.json({
        success: true,
        data: metrics,
        message: 'Métricas de performance obtidas com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas de performance:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  static async getDashboardMetrics(req: Request, res: Response) {
    try {
      logger.info('Buscando métricas para dashboard');
      
      const metrics = await PerformanceMetricsService.getMetrics();
      
      // Formatar para o dashboard
      const dashboardData = {
        uptime: {
          percentage: metrics.uptime.percentage,
          hours: metrics.uptime.hours,
          days: metrics.uptime.days,
          status: metrics.uptime.percentage >= 99 ? 'excellent' : 
                  metrics.uptime.percentage >= 95 ? 'good' : 'warning'
        },
        users: {
          peak: metrics.peakUsers.count,
          peakDate: metrics.peakUsers.date,
          current: metrics.system.activeConnections
        },
        attendants: {
          peak: metrics.peakAttendants.count,
          peakDate: metrics.peakAttendants.date
        },
        tickets: {
          total: metrics.tickets.total,
          open: metrics.tickets.open,
          closed: metrics.tickets.closed,
          avgResolutionTime: metrics.tickets.avgResolutionTime
        },
        messages: {
          total: metrics.messages.total,
          today: metrics.messages.today,
          avgPerTicket: metrics.messages.avgPerTicket
        },
        system: {
          startTime: metrics.system.startTime,
          lastActivity: metrics.system.lastActivity,
          activeConnections: metrics.system.activeConnections
        },
        compras: metrics.compras
      };
      
      res.json({
        success: true,
        data: dashboardData,
        message: 'Métricas do dashboard obtidas com sucesso'
      });
    } catch (error) {
      logger.error('Erro ao buscar métricas do dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }
}
