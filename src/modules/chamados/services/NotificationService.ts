import nodemailer from 'nodemailer';
import { NotificationModel } from '../models/Notification';
import { UserModel } from '../../../core/users/User';
import { TicketModel } from '../models/Ticket';
import { config } from '../../../config/database';
import { Notification, TicketStatus } from '../../../shared/types';
import type { NotificationTemplateKey } from '../../../shared/types';
import { PushNotificationService } from './PushNotificationService';
import { NotificationTemplateModel } from '../../../core/system/NotificationTemplateModel';

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
    const admins = await UserModel.findByRole('admin' as any);
    for (const admin of admins) {
      await this.createClientRegistrationNotification(
        admin.id,
        'new_message',
        'Novo Cadastro de Cliente',
        `Um novo cadastro de cliente foi enviado e está aguardando análise.`
      );
      await this.sendTemplatedEmail('client_registration_created', admin.email, {
        registration_message: 'Um novo cadastro de cliente foi enviado e está aguardando análise.',
      });
    }

    await this.createClientRegistrationNotification(
      userId,
      'new_message',
      'Cadastro Enviado',
      'Seu cadastro de cliente foi enviado com sucesso e está aguardando análise.'
    );
    const user = await UserModel.findById(userId);
    if (user) {
      await this.sendTemplatedEmail('client_registration_created', user.email, {
        registration_message: 'Seu cadastro de cliente foi enviado com sucesso e está aguardando análise.',
      });
    }
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

    const user = await UserModel.findById(userId);
    if (user) {
      await this.sendTemplatedEmail('client_registration_status_change', user.email, {
        old_status: statusDescription,
        new_status: this.getStatusDescription(newStatus),
      });
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

      await this.sendTemplatedEmail('ticket_created_admin', admin.email, {
        'ticket.subject': ticket.subject,
        'ticket.category': ticket.category?.name || 'N/A',
        'ticket.priority': ticket.priority,
        'ticket.user_name': ticket.user?.name || 'N/A',
      });
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

        await this.sendTemplatedEmail('ticket_created_attendant_high_priority', attendant.email, {
          'ticket.subject': ticket.subject,
          'ticket.category': ticket.category?.name || 'N/A',
          'ticket.priority': ticket.priority,
          'ticket.user_name': ticket.user?.name || 'N/A',
        });
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

    if (ticket.user) {
      await this.sendTemplatedEmail('status_change', ticket.user.email, {
        'ticket.subject': ticket.subject,
        old_status: statusNames[oldStatus],
        new_status: statusNames[newStatus],
      });
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

    await this.sendTemplatedEmail('new_message', user.email, {
      'ticket.subject': ticket.subject,
    });
  }

  static async notifySlaAlert(ticketId: number, slaType: 'first_response' | 'resolution'): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;

    const alertType = slaType === 'first_response' ? 'Primeira Resposta' : 'Resolução';
    const templateKey: NotificationTemplateKey = slaType === 'first_response' ? 'sla_alert_first_response' : 'sla_alert_resolution';
    const context = { 'ticket.subject': ticket.subject, 'ticket.category': ticket.category?.name || 'N/A' };

    if (ticket.attendant_id) {
      await this.createNotification(
        ticket.attendant_id,
        ticketId,
        'sla_alert',
        `Alerta de SLA - ${alertType}`,
        `O chamado "${ticket.subject}" está próximo de violar o SLA de ${alertType.toLowerCase()}.`
      );
      const attendant = await UserModel.findById(ticket.attendant_id);
      if (attendant) await this.sendTemplatedEmail(templateKey, attendant.email, context);
    }

    const admins = await UserModel.findByRole('admin' as any);
    for (const admin of admins) {
      await this.createNotification(
        admin.id,
        ticketId,
        'sla_alert',
        `Alerta de SLA - ${alertType}`,
        `O chamado "${ticket.subject}" está próximo de violar o SLA de ${alertType.toLowerCase()}.`
      );
      await this.sendTemplatedEmail(templateKey, admin.email, context);
    }
  }

  static async notifyTicketReopened(ticketId: number): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) return;
    const context = { 'ticket.subject': ticket.subject };

    if (ticket.attendant_id) {
      await this.createNotification(
        ticket.attendant_id,
        ticketId,
        'ticket_reopened',
        'Chamado Reaberto',
        `O chamado "${ticket.subject}" foi reaberto pelo usuário.`
      );
      const attendant = await UserModel.findById(ticket.attendant_id);
      if (attendant) await this.sendTemplatedEmail('ticket_reopened', attendant.email, context);
    }

    const admins = await UserModel.findByRole('admin' as any);
    for (const admin of admins) {
      await this.createNotification(
        admin.id,
        ticketId,
        'ticket_reopened',
        'Chamado Reaberto',
        `O chamado "${ticket.subject}" foi reaberto pelo usuário.`
      );
      await this.sendTemplatedEmail('ticket_reopened', admin.email, context);
    }
  }

  private static emailErrorLogged = false; // Flag para evitar logs repetidos

  /** Substitui placeholders {{key}} no texto pelo valor em context (ex: {{ticket.subject}}, {{old_status}}). */
  private static replacePlaceholders(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => context[key] ?? `{{${key}}}`);
  }

  /**
   * Envia e-mail usando o template configurado para a chave. Se o template estiver desabilitado ou SMTP não configurado, não envia.
   */
  static async sendTemplatedEmail(
    key: NotificationTemplateKey,
    to: string,
    context: Record<string, string>
  ): Promise<void> {
    if (!config.email.user) {
      if (!this.emailErrorLogged) {
        console.log('⚠️ [EMAIL] Email não configurado. Notificações por email serão ignoradas.');
        this.emailErrorLogged = true;
      }
      return;
    }
    const template = await NotificationTemplateModel.getByKey(key);
    if (!template?.enabled) return;
    const subject = this.replacePlaceholders(template.subject_template, context);
    const bodyHtml = this.replacePlaceholders(template.body_html, context);
    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject: `[ERP PRIME] ${subject}`,
        html: bodyHtml,
        text: bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
      this.emailErrorLogged = false;
    } catch (error: any) {
      if (error.code === 'EAUTH' || error.responseCode === 535) {
        if (!this.emailErrorLogged) {
          console.error('[BACKEND] ⚠️ Erro de autenticação ao enviar email.');
          console.error('[BACKEND] ⚠️ Verifique as credenciais SMTP no arquivo .env.');
          this.emailErrorLogged = true;
        }
      } else {
        console.error(`[BACKEND] ⚠️ Erro ao enviar email para ${to}:`, error.message || error);
      }
    }
  }

  /**
   * Envia um e-mail de teste para o destinatário. Retorna sucesso ou mensagem de erro
   * (para uso em "Testar envio" nas configurações do sistema).
   */
  static async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    if (!config.email.user) {
      return { success: false, error: 'E-mail não configurado. Configure SMTP_USER e SMTP_PASS no .env' };
    }
    const subject = 'Teste de envio de e-mail';
    const text = `Esta é uma mensagem de teste do sistema ERP PRIME.\n\nSe você recebeu este e-mail, o envio está configurado corretamente.\n\nEnviado em: ${new Date().toLocaleString('pt-BR')}`;
    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject: `[ERP PRIME] ${subject}`,
        text
      });
      this.emailErrorLogged = false;
      return { success: true };
    } catch (error: any) {
      const msg = error.code === 'EAUTH' || error.responseCode === 535
        ? 'Erro de autenticação SMTP. Verifique SMTP_USER e SMTP_PASS (use Senha de app no Gmail).'
        : (error.message || String(error));
      return { success: false, error: msg };
    }
  }

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

    if (ticket.user) {
      await this.sendTemplatedEmail('approval_required', ticket.user.email, {
        'ticket.subject': ticket.subject,
      });
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

    if (ticket.attendant) {
      await this.sendTemplatedEmail('approval_received', ticket.attendant.email, {
        'ticket.subject': ticket.subject,
        approval_action: action,
        approval_status: status,
      });
    }
  }

}
