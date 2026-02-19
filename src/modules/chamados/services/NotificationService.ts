import nodemailer from 'nodemailer';
import { NotificationModel } from '../models/Notification';
import { UserModel } from '../../../core/users/User';
import { TicketModel } from '../models/Ticket';
import { config } from '../../../config/database';
import { Notification, TicketStatus } from '../../../shared/types';
import { PushNotificationService } from './PushNotificationService';

export class NotificationService {
  private static transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.pass
    }
  });

  static async createNotification(
    userId: number,
    ticketId: number,
    type: 'status_change' | 'new_message' | 'sla_alert' | 'ticket_reopened',
    title: string,
    message: string
  ): Promise<Notification> {
    const notification = await NotificationModel.create(userId, ticketId, type, title, message);
    
    // Enviar push notification em background (não bloquear a criação)
    PushNotificationService.sendPushNotification(
      userId,
      title,
      message,
      {
        notificationId: notification.id,
        ticketId,
        type,
      }
    ).catch(error => {
      console.error('Erro ao enviar push notification:', error);
    });
    
    return notification;
  }

  // Notificações para cadastros de clientes (sem ticketId)
  static async createClientRegistrationNotification(
    userId: number,
    type: string,
    title: string,
    message: string
  ): Promise<void> {
    try {
      // Salvar no banco com ticket_id = 0 (indica notificação de cadastro)
      const notification = await NotificationModel.create(userId, 0, type as any, title, message);
      
      // Enviar push notification
      PushNotificationService.sendPushNotification(
        userId,
        title,
        message,
        {
          notificationId: notification.id,
          ticketId: 0,
          type,
        }
      ).catch(error => {
        console.error('Erro ao enviar push notification:', error);
      });
    } catch (error) {
      console.error('Erro ao criar notificação de cadastro:', error);
    }
  }

  static async notifyClientRegistrationCreated(registrationId: number, userId: number): Promise<void> {
    // Criar notificação para administradores
    const admins = await UserModel.findByRole('admin' as any);
    
    for (const admin of admins) {
      await this.createClientRegistrationNotification(
        admin.id,
        'new_message',
        'Novo Cadastro de Cliente',
        `Um novo cadastro de cliente foi enviado e está aguardando análise.`
      );
    }

    // Notificar o próprio usuário que enviou
    await this.createClientRegistrationNotification(
      userId,
      'new_message',
      'Cadastro Enviado',
      'Seu cadastro de cliente foi enviado com sucesso e está aguardando análise.'
    );
  }

  static async notifyClientRegistrationStatusChange(
    registrationId: number,
    userId: number,
    oldStatus: string,
    newStatus: string,
    statusDescription: string
  ): Promise<void> {
    // Notificar o usuário que criou o cadastro
    await this.createClientRegistrationNotification(
      userId,
      'status_change',
      'Status do Cadastro Alterado',
      `O status do seu cadastro foi alterado de "${statusDescription}" para "${this.getStatusDescription(newStatus)}".`
    );

    // Enviar email se configurado
    const user = await UserModel.findById(userId);
    if (config.email.user && user) {
      await this.sendEmail(
        user.email,
        'Status do Cadastro Alterado',
        `O status do seu cadastro foi alterado:\n\n` +
        `Status anterior: ${statusDescription}\n` +
        `Novo status: ${this.getStatusDescription(newStatus)}\n\n` +
        `Acesse o sistema para mais detalhes.`
      );
    }
  }

  private static getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      'cadastro_enviado': 'Cadastro Enviado',
      'aguardando_analise_credito': 'Aguardando Análise de Crédito',
      'cadastro_finalizado': 'Cadastro Finalizado'
    };
    return descriptions[status] || status;
  }

  static async notifyTicketCreated(ticketId: number): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    // Notificar administradores
    const admins = await UserModel.findByRole('admin' as any);
    
    for (const admin of admins) {
      await this.createNotification(
        admin.id,
        ticketId,
        'new_message',
        'Novo Chamado Criado',
        `Um novo chamado foi criado: "${ticket.subject}"`
      );

      // Enviar email se configurado
      if (config.email.user) {
        await this.sendEmail(
          admin.email,
          'Novo Chamado Criado',
          `Um novo chamado foi criado no sistema:\n\n` +
          `Assunto: ${ticket.subject}\n` +
          `Categoria: ${ticket.category?.name || 'N/A'}\n` +
          `Prioridade: ${ticket.priority}\n` +
          `Criado por: ${ticket.user?.name}\n\n` +
          `Acesse o sistema para visualizar o chamado.`
        );
      }
    }

    // Notificar atendentes (para chamados de alta/urgente prioridade)
    const attendants = await UserModel.findByRole('attendant' as any);
    
    for (const attendant of attendants) {
      if (ticket.priority === 'urgent' || ticket.priority === 'high') {
        await this.createNotification(
          attendant.id,
          ticketId,
          'new_message',
          'Novo Chamado - Alta Prioridade',
          `Um novo chamado de alta prioridade foi criado: "${ticket.subject}"`
        );

        // Enviar email para atendentes em casos de urgência
        if (config.email.user) {
          await this.sendEmail(
            attendant.email,
            'Novo Chamado - Alta Prioridade',
            `Um novo chamado de alta prioridade foi criado no sistema:\n\n` +
            `Assunto: ${ticket.subject}\n` +
            `Categoria: ${ticket.category?.name || 'N/A'}\n` +
            `Prioridade: ${ticket.priority}\n` +
            `Criado por: ${ticket.user?.name}\n\n` +
            `Acesse o sistema para visualizar o chamado.`
          );
        }
      }
    }
  }

  static async notifyStatusChange(ticketId: number, oldStatus: TicketStatus, newStatus: TicketStatus): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    const statusNames: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'Aberto',
      [TicketStatus.IN_PROGRESS]: 'Em Atendimento',
      [TicketStatus.PENDING_USER]: 'Pendente Usuário',
      [TicketStatus.PENDING_THIRD_PARTY]: 'Pendente Terceiros',
      [TicketStatus.PENDING_APPROVAL]: 'Aguardando Aprovação do Solicitante',
      [TicketStatus.RESOLVED]: 'Resolvido',
      [TicketStatus.CLOSED]: 'Fechado',
      [TicketStatus.OVERDUE_FIRST_RESPONSE]: 'Atrasado - Primeira Resposta',
      [TicketStatus.OVERDUE_RESOLUTION]: 'Atrasado - Resolução'
    };

    // Notificar o usuário do chamado
    await this.createNotification(
      ticket.user_id,
      ticketId,
      'status_change',
      'Status do Chamado Alterado',
      `O status do seu chamado "${ticket.subject}" foi alterado de "${statusNames[oldStatus]}" para "${statusNames[newStatus]}".`
    );

    // Enviar email se configurado
    if (config.email.user && ticket.user) {
      await this.sendEmail(
        ticket.user.email,
        'Status do Chamado Alterado',
        `O status do seu chamado foi alterado:\n\n` +
        `Assunto: ${ticket.subject}\n` +
        `Status anterior: ${statusNames[oldStatus]}\n` +
        `Novo status: ${statusNames[newStatus]}\n\n` +
        `Acesse o sistema para mais detalhes.`
      );
    }
  }

  static async notifyNewMessage(ticketId: number, authorId: number): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    // Determinar quem deve ser notificado
    const notifyUserId = ticket.user_id === authorId ? (ticket.attendant_id || 0) : ticket.user_id;
    
    if (notifyUserId === 0) return;

    const user = await UserModel.findById(notifyUserId);
    if (!user) return;

    await this.createNotification(
      notifyUserId,
      ticketId,
      'new_message',
      'Nova Mensagem no Chamado',
      `Há uma nova mensagem no chamado "${ticket.subject}".`
    );

    // Enviar email se configurado
    if (config.email.user) {
      await this.sendEmail(
        user.email,
        'Nova Mensagem no Chamado',
        `Há uma nova mensagem no chamado:\n\n` +
        `Assunto: ${ticket.subject}\n\n` +
        `Acesse o sistema para visualizar a mensagem.`
      );
    }
  }

  static async notifySlaAlert(ticketId: number, slaType: 'first_response' | 'resolution'): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    const alertType = slaType === 'first_response' ? 'Primeira Resposta' : 'Resolução';
    
    // Notificar atendente se atribuído
    if (ticket.attendant_id) {
      await this.createNotification(
        ticket.attendant_id,
        ticketId,
        'sla_alert',
        `Alerta de SLA - ${alertType}`,
        `O chamado "${ticket.subject}" está próximo de violar o SLA de ${alertType.toLowerCase()}.`
      );
    }

    // Notificar administradores
    const admins = await UserModel.findByRole('admin' as any);
    
    for (const admin of admins) {
      await this.createNotification(
        admin.id,
        ticketId,
        'sla_alert',
        `Alerta de SLA - ${alertType}`,
        `O chamado "${ticket.subject}" está próximo de violar o SLA de ${alertType.toLowerCase()}.`
      );
    }
  }

  static async notifyTicketReopened(ticketId: number): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    // Notificar atendente se atribuído
    if (ticket.attendant_id) {
      await this.createNotification(
        ticket.attendant_id,
        ticketId,
        'ticket_reopened',
        'Chamado Reaberto',
        `O chamado "${ticket.subject}" foi reaberto pelo usuário.`
      );
    }

    // Notificar administradores
    const admins = await UserModel.findByRole('admin' as any);
    
    for (const admin of admins) {
      await this.createNotification(
        admin.id,
        ticketId,
        'ticket_reopened',
        'Chamado Reaberto',
        `O chamado "${ticket.subject}" foi reaberto pelo usuário.`
      );
    }
  }

  private static emailErrorLogged = false; // Flag para evitar logs repetidos

  static async sendEmail(to: string, subject: string, text: string): Promise<void> {
    if (!config.email.user) {
      // Só loga uma vez se email não estiver configurado
      if (!this.emailErrorLogged) {
        console.log('⚠️ [EMAIL] Email não configurado. Notificações por email serão ignoradas.');
        this.emailErrorLogged = true;
      }
      return;
    }

    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject: `[ERP PRIME] ${subject}`,
        text
      });
      
      // Reset da flag em caso de sucesso
      this.emailErrorLogged = false;
    } catch (error: any) {
      // Trata erros de autenticação de forma específica
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        // Só loga o erro de autenticação uma vez para evitar spam nos logs
        if (!this.emailErrorLogged) {
          console.error('[BACKEND] ⚠️ Erro de autenticação ao enviar email.');
          console.error('[BACKEND] ⚠️ Verifique as credenciais SMTP no arquivo .env:');
          console.error('[BACKEND]    - SMTP_USER: usuário do Gmail');
          console.error('[BACKEND]    - SMTP_PASS: use "App Password" do Gmail (não a senha normal)');
          console.error('[BACKEND]    - Para criar App Password: https://myaccount.google.com/apppasswords');
          console.error('[BACKEND] 📧 Chamados continuarão sendo criados normalmente, mas emails não serão enviados.');
          this.emailErrorLogged = true;
        }
      } else {
        // Outros erros são logados normalmente, mas não bloqueiam
        console.error(`[BACKEND] ⚠️ Erro ao enviar email para ${to}:`, error.message || error);
      }
      
      // Não propaga o erro - permite que o sistema continue funcionando
      // O chamado já foi criado, apenas o email falhou
    }
  }

  static async notifyAdmins(ticketId: number, type: string, title: string, message: string): Promise<void> {
    try {
      const admins = await UserModel.findByRole('admin' as any);
      
      for (const admin of admins) {
        await this.createNotification(
          admin.id,
          ticketId,
          type as any,
          title,
          message
        );
      }
    } catch (error) {
      console.error('Erro ao notificar administradores:', error);
    }
  }

  static async checkSlaViolations(): Promise<void> {
    const violations = await TicketModel.getSlaViolations();
    
    for (const ticket of violations) {
      const now = new Date();
      
      // Verificar SLA de primeira resposta
      if (ticket.status === 'open' && ticket.sla_first_response < now) {
        await this.notifySlaAlert(ticket.id, 'first_response');
      }
      
      // Verificar SLA de resolução
      if (['in_progress', 'pending_user', 'pending_third_party', 'pending_approval'].includes(ticket.status) && ticket.sla_resolution < now) {
        await this.notifySlaAlert(ticket.id, 'resolution');
      }
    }
  }

  // Notificar solicitante sobre necessidade de aprovação
  static async notifyApprovalRequired(ticketId: number): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    await this.createNotification(
      ticket.user_id,
      ticketId,
      'status_change',
      'Chamado Finalizado - Confirmação Necessária',
      `Seu chamado "${ticket.subject}" foi finalizado pelo atendente. Por favor, confirme se o problema foi realmente resolvido.`
    );

    // Enviar email se configurado
    if (config.email.user && ticket.user) {
      await this.sendEmail(
        ticket.user.email,
        'Chamado Finalizado - Confirmação Necessária',
        `Seu chamado foi finalizado pelo atendente e precisa da sua confirmação:\n\n` +
        `Assunto: ${ticket.subject}\n` +
        `Status: Aguardando Sua Aprovação\n\n` +
        `Por favor, acesse o sistema para confirmar se o problema foi realmente resolvido.`
      );
    }
  }

  // Notificar atendente sobre aprovação do solicitante
  static async notifyApprovalReceived(ticketId: number, approved: boolean): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket || !ticket.attendant_id) return;

    const action = approved ? 'aprovado' : 'rejeitado';
    const status = approved ? 'confirmado como resolvido' : 'rejeitado - problema ainda não resolvido';

    await this.createNotification(
      ticket.attendant_id,
      ticketId,
      'status_change',
      `Chamado ${action.charAt(0).toUpperCase() + action.slice(1)} pelo Solicitante`,
      `O chamado "${ticket.subject}" foi ${action} pelo solicitante - ${status}.`
    );

    // Enviar email se configurado
    if (config.email.user && ticket.attendant) {
      await this.sendEmail(
        ticket.attendant.email,
        `Chamado ${action.charAt(0).toUpperCase() + action.slice(1)} pelo Solicitante`,
        `O chamado foi ${action} pelo solicitante:\n\n` +
        `Assunto: ${ticket.subject}\n` +
        `Status: ${status}\n\n` +
        `Acesse o sistema para mais detalhes.`
      );
    }
  }

}
