import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { TicketModel } from '../models/Ticket';
import { UserModel } from '../models/User';
import { NotificationModel } from '../models/Notification';
import { TicketStatus } from '../types';

export class DashboardController {
  static getStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Obter parâmetros de data da query string
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      // Buscar estatísticas básicas de tickets
      const totalTickets = await TicketModel.count(startDate, endDate);
      const statusCounts = await TicketModel.countByStatus(startDate, endDate);
      const openTickets = statusCounts[TicketStatus.OPEN];
      const inProgressTickets = statusCounts[TicketStatus.IN_PROGRESS];
      const resolvedTickets = statusCounts[TicketStatus.RESOLVED];
      const closedTickets = statusCounts[TicketStatus.CLOSED];
      const pendingUserTickets = statusCounts[TicketStatus.PENDING_USER];
      const pendingThirdPartyTickets = statusCounts[TicketStatus.PENDING_THIRD_PARTY];
      const pendingApprovalTickets = statusCounts[TicketStatus.PENDING_APPROVAL];
      const overdueFirstResponseTickets = statusCounts[TicketStatus.OVERDUE_FIRST_RESPONSE];
      const overdueResolutionTickets = statusCounts[TicketStatus.OVERDUE_RESOLUTION];
      
      // Calcular tempo médio de resolução real
      const avgResolutionTime = await TicketModel.getAverageResolutionTime(startDate, endDate);
      
      // Contar violações de SLA reais
      const slaViolations = overdueFirstResponseTickets + overdueResolutionTickets;
      
      // Buscar estatísticas de usuários
      const totalUsers = await UserModel.count();
      const activeUsers = await UserModel.countActive();
      
      // Buscar estatísticas de notificações
      let unreadNotifications = 0;
      try {
        unreadNotifications = await NotificationModel.countUnread();
      } catch (error) {
        console.log('⚠️ Erro ao buscar notificações, usando valor padrão:', error);
      }
      
      // Buscar estatísticas por categoria
      let ticketsByCategory: Array<{ category_id: number; category_name: string; count: number }> = [];
      try {
        ticketsByCategory = await TicketModel.countByCategory(startDate, endDate);
      } catch (error) {
        console.log('⚠️ Erro ao buscar categorias, usando valor padrão:', error);
      }
      
      // Buscar estatísticas por prioridade
      let ticketsByPriority = {};
      try {
        ticketsByPriority = await TicketModel.countByPriority(startDate, endDate);
      } catch (error) {
        console.log('⚠️ Erro ao buscar prioridades, usando valor padrão:', error);
      }
      
      // Calcular percentuais de SLA
      const totalResolvedTickets = resolvedTickets + closedTickets;
      const slaFirstResponseRate = totalTickets > 0 ? 
        Math.round(((totalTickets - overdueFirstResponseTickets) / totalTickets) * 100) : 0;
      const slaResolutionRate = totalResolvedTickets > 0 ? 
        Math.round(((totalResolvedTickets - overdueResolutionTickets) / totalResolvedTickets) * 100) : 0;

      const stats = {
        // Estatísticas básicas
        total_tickets: totalTickets,
        open_tickets: openTickets,
        in_progress_tickets: inProgressTickets,
        resolved_tickets: resolvedTickets,
        closed_tickets: closedTickets,
        pending_user_tickets: pendingUserTickets,
        pending_third_party_tickets: pendingThirdPartyTickets,
        pending_approval_tickets: pendingApprovalTickets,
        overdue_first_response_tickets: overdueFirstResponseTickets,
        overdue_resolution_tickets: overdueResolutionTickets,
        
        // Tempo e SLA
        avg_resolution_time: Math.round(avgResolutionTime || 0),
        sla_violations: slaViolations,
        sla_first_response_rate: slaFirstResponseRate,
        sla_resolution_rate: slaResolutionRate,
        
        // Usuários e notificações
        total_users: totalUsers,
        active_users: activeUsers,
        unread_notifications: unreadNotifications,
        
        // Distribuição por categoria e prioridade
        tickets_by_category: ticketsByCategory,
        tickets_by_priority: ticketsByPriority
      };

      res.json({
        message: 'Estatísticas obtidas com sucesso',
        data: stats
      });
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  static getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Buscar atividades recentes dos últimos 7 dias
      const activities = await TicketModel.getRecentActivity();
      
      res.json({
        message: 'Atividades recentes obtidas com sucesso',
        data: { activities }
      });
    } catch (error) {
      console.error('Erro ao obter atividades recentes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
}