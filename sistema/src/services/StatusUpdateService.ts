import { TicketModel } from '../models/Ticket';
import { NotificationService } from './NotificationService';

export class StatusUpdateService {
  static async updateTicketStatuses(): Promise<void> {
    try {
      console.log('Iniciando verificação de status de chamados...');
      
      // Buscar todos os chamados abertos e em andamento
      const openTickets = await TicketModel.getOpenTickets();
      const inProgressTickets = await TicketModel.findAll({
        page: 1,
        limit: 1000,
        status: 'in_progress' as any
      });

      const allTickets = [...openTickets, ...inProgressTickets.data];
      const now = new Date();

      for (const ticket of allTickets) {
        await this.checkAndUpdateTicketStatus(ticket, now);
      }

      console.log(`Verificação de status concluída. ${allTickets.length} chamados verificados.`);
    } catch (error) {
      console.error('Erro ao atualizar status dos chamados:', error);
    }
  }

  private static async checkAndUpdateTicketStatus(ticket: any, now: Date): Promise<void> {
    try {
      let newStatus = ticket.status;
      let shouldNotify = false;

      // Verificar SLA de primeira resposta para chamados abertos
      if (ticket.status === 'open') {
        const slaFirstResponse = new Date(ticket.sla_first_response);
        if (now > slaFirstResponse) {
          newStatus = 'overdue_first_response';
          shouldNotify = true;
          console.log(`Chamado ${ticket.id} atrasado na primeira resposta`);
        }
      }

      // Verificar SLA de resolução para chamados em andamento
      if (['in_progress', 'pending_user', 'pending_third_party', 'pending_approval'].includes(ticket.status)) {
        const slaResolution = new Date(ticket.sla_resolution);
        if (now > slaResolution) {
          newStatus = 'overdue_resolution';
          shouldNotify = true;
          console.log(`Chamado ${ticket.id} atrasado na resolução`);
        }
      }

      // Atualizar status se necessário
      if (newStatus !== ticket.status) {
        await this.updateTicketStatus(ticket.id, newStatus);
        
        if (shouldNotify) {
          await this.notifySlaViolation(ticket, newStatus);
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar chamado ${ticket.id}:`, error);
    }
  }

  private static async updateTicketStatus(ticketId: number, newStatus: string): Promise<void> {
    try {
      // Atualizar status do chamado
      await TicketModel.update(ticketId, { status: newStatus as any });
      
      // Adicionar entrada no histórico
      await TicketModel.addHistoryEntry(ticketId, 0, `Status alterado automaticamente para: ${this.getStatusName(newStatus)}`);
      
      console.log(`Chamado ${ticketId} atualizado para status: ${newStatus}`);
    } catch (error) {
      console.error(`Erro ao atualizar status do chamado ${ticketId}:`, error);
    }
  }

  private static async notifySlaViolation(ticket: any, newStatus: string): Promise<void> {
    try {
      const statusName = this.getStatusName(newStatus);
      const message = `Chamado "${ticket.subject}" está atrasado: ${statusName}`;

      // Notificar administradores
      await NotificationService.notifyAdmins(
        ticket.id,
        'sla_alert',
        'SLA Violado',
        message
      );

      // Notificar atendente se atribuído
      if (ticket.attendant_id) {
        await NotificationService.createNotification(
          ticket.attendant_id,
          ticket.id,
          'sla_alert',
          'SLA Violado',
          message
        );
      }
    } catch (error) {
      console.error(`Erro ao notificar violação de SLA para chamado ${ticket.id}:`, error);
    }
  }

  private static getStatusName(status: string): string {
    const statusNames: Record<string, string> = {
      'overdue_first_response': 'Atrasado - Primeira Resposta',
      'overdue_resolution': 'Atrasado - Resolução',
      'open': 'Aberto',
      'in_progress': 'Em Andamento',
      'pending_user': 'Aguardando Usuário',
      'pending_third_party': 'Aguardando Terceiros',
      'resolved': 'Resolvido',
      'closed': 'Fechado'
    };

    return statusNames[status] || status;
  }

  // Método para iniciar o serviço de atualização automática
  static startAutoUpdate(): void {
    // Verificar a cada 5 minutos
    setInterval(() => {
      this.updateTicketStatuses();
    }, 5 * 60 * 1000);

    console.log('Serviço de atualização automática de status iniciado');
  }
}
