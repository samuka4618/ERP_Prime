import { TicketModel } from '../models/Ticket';
import { NotificationService } from './NotificationService';
import { config } from '../config/database';

export class SlaService {
  private static intervalId: NodeJS.Timeout | null = null;

  static startMonitoring(): void {
    if (this.intervalId) {
      console.log('Monitoramento de SLA já está ativo');
      return;
    }

    console.log('Iniciando monitoramento de SLA...');
    
    // Verificar violações a cada 5 minutos
    this.intervalId = setInterval(async () => {
      try {
        await this.checkSlaViolations();
      } catch (error) {
        console.error('Erro ao verificar violações de SLA:', error);
      }
    }, 5 * 60 * 1000); // 5 minutos

    // Verificação inicial
    this.checkSlaViolations();
  }

  static stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Monitoramento de SLA parado');
    }
  }

  static async checkSlaViolations(): Promise<void> {
    const violations = await TicketModel.getSlaViolations();
    
    if (violations.length === 0) {
      return;
    }

    console.log(`Encontradas ${violations.length} violações de SLA`);

    for (const ticket of violations) {
      const now = new Date();
      
      // Verificar SLA de primeira resposta
      if (ticket.status === 'open' && ticket.sla_first_response < now) {
        console.log(`SLA de primeira resposta violado para ticket ${ticket.id}`);
        await NotificationService.notifySlaAlert(ticket.id, 'first_response');
      }
      
      // Verificar SLA de resolução
      if (['in_progress', 'pending_user', 'pending_third_party'].includes(ticket.status) && ticket.sla_resolution < now) {
        console.log(`SLA de resolução violado para ticket ${ticket.id}`);
        await NotificationService.notifySlaAlert(ticket.id, 'resolution');
      }
    }
  }

  static async checkSlaWarnings(): Promise<void> {
    const tickets = await TicketModel.findAll({
      page: 1,
      limit: 1000
    });

    const now = new Date();
    const warningTime = 1 * 60 * 60 * 1000; // 1 hora antes do SLA

    for (const ticket of tickets.data) {
      // Verificar aviso de SLA de primeira resposta
      if (ticket.status === 'open') {
        const timeToSla = new Date(ticket.sla_first_response).getTime() - now.getTime();
        if (timeToSla > 0 && timeToSla <= warningTime) {
          console.log(`Aviso: SLA de primeira resposta próximo para ticket ${ticket.id}`);
          await NotificationService.notifySlaAlert(ticket.id, 'first_response');
        }
      }
      
      // Verificar aviso de SLA de resolução
      if (['in_progress', 'pending_user', 'pending_third_party'].includes(ticket.status)) {
        const timeToSla = new Date(ticket.sla_resolution).getTime() - now.getTime();
        if (timeToSla > 0 && timeToSla <= warningTime) {
          console.log(`Aviso: SLA de resolução próximo para ticket ${ticket.id}`);
          await NotificationService.notifySlaAlert(ticket.id, 'resolution');
        }
      }
    }
  }

  static calculateSlaDates(createdAt: Date): { firstResponse: Date; resolution: Date } {
    const firstResponse = new Date(createdAt.getTime() + (config.sla.firstResponseHours * 60 * 60 * 1000));
    const resolution = new Date(createdAt.getTime() + (config.sla.resolutionHours * 60 * 60 * 1000));
    
    return { firstResponse, resolution };
  }

  static isSlaViolated(ticket: any): { firstResponse: boolean; resolution: boolean } {
    const now = new Date();
    
    return {
      firstResponse: ticket.status === 'open' && ticket.sla_first_response < now,
      resolution: ['in_progress', 'pending_user', 'pending_third_party'].includes(ticket.status) && ticket.sla_resolution < now
    };
  }

  static getSlaStatus(ticket: any): 'ok' | 'warning' | 'violated' {
    const now = new Date();
    const warningTime = 1 * 60 * 60 * 1000; // 1 hora antes do SLA
    
    // Verificar violação
    const violations = this.isSlaViolated(ticket);
    if (violations.firstResponse || violations.resolution) {
      return 'violated';
    }
    
    // Verificar aviso
    let timeToSla = 0;
    if (ticket.status === 'open') {
      timeToSla = ticket.sla_first_response.getTime() - now.getTime();
    } else if (['in_progress', 'pending_user', 'pending_third_party'].includes(ticket.status)) {
      timeToSla = ticket.sla_resolution.getTime() - now.getTime();
    }
    
    if (timeToSla > 0 && timeToSla <= warningTime) {
      return 'warning';
    }
    
    return 'ok';
  }
}
