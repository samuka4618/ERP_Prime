/**
 * Builders de contexto para templates de notificação por e-mail.
 *
 * Boas práticas (como em grandes sistemas):
 * - Uma única fonte de verdade: cada tipo de notificação tem um builder que preenche
 *   exatamente as variáveis documentadas no catálogo (notificationTemplateCatalog).
 * - Contexto base (getBaseContext): variáveis disponíveis em todos os e-mails
 *   (system_name, current_year, client.url). Sempre mesclado ao contexto específico.
 * - Ao adicionar um novo placeholder no catálogo, implementar o preenchimento aqui
 *   no builder correspondente ao key.
 */

import type { NotificationTemplateKey } from '../../shared/types';
import { config } from '../../config/database';
import {
  getClientRegistrationStatusTheme,
  getClientRegistrationStatusLabel,
} from '../../modules/cadastros/clientRegistrationStatusConfig';

/** Contexto base disponível em todos os e-mails (variáveis de sistema). */
export function getBaseContext(): Record<string, string> {
  const baseUrl = config.clientUrl?.replace(/\/$/, '') || 'http://localhost:5173';
  return {
    system_name: config.systemName || 'ERP PRIME',
    current_year: String(new Date().getFullYear()),
    'client.url': baseUrl,
  };
}

/** Ticket com relações populadas (subject, category, user, etc.) */
interface TicketPayload {
  subject: string;
  category?: { name?: string };
  priority?: string;
  user?: { name?: string };
}

/** Payload para client_registration_status_change */
interface ClientRegistrationStatusPayload {
  registrationId: number;
  oldStatus: string;
  newStatus: string;
  statusDescription: string; // rótulo do status anterior
}

/** Payload para approval_received */
interface ApprovalReceivedPayload {
  ticket: { subject: string };
  approved: boolean;
  statusLabel: string;
}

/**
 * Constrói o contexto (variáveis) para um tipo de notificação.
 * Cada chave tem um builder que preenche as variáveis documentadas no catálogo.
 * Boas práticas: uma única fonte de verdade por tipo; variáveis sempre preenchidas aqui.
 */
export function buildContextFor(
  key: NotificationTemplateKey,
  payload: unknown
): Record<string, string> {
  const base = getBaseContext();
  let specific: Record<string, string> = {};

  switch (key) {
    case 'ticket_created_admin':
    case 'ticket_created_attendant_high_priority': {
      const t = payload as { ticket: TicketPayload };
      if (!t?.ticket) break;
      specific = {
        'ticket.subject': t.ticket.subject,
        'ticket.category': t.ticket.category?.name || 'N/A',
        'ticket.priority': t.ticket.priority || 'N/A',
        'ticket.user_name': t.ticket.user?.name || 'N/A',
      };
      break;
    }
    case 'status_change': {
      const p = payload as { ticket: TicketPayload; oldStatusLabel: string; newStatusLabel: string };
      if (!p?.ticket) break;
      specific = {
        'ticket.subject': p.ticket.subject,
        old_status: p.oldStatusLabel,
        new_status: p.newStatusLabel,
      };
      break;
    }
    case 'new_message': {
      const p = payload as { ticket: TicketPayload };
      if (!p?.ticket) break;
      specific = { 'ticket.subject': p.ticket.subject };
      break;
    }
    case 'sla_alert_first_response':
    case 'sla_alert_resolution': {
      const t = payload as { ticket: TicketPayload };
      if (!t?.ticket) break;
      specific = {
        'ticket.subject': t.ticket.subject,
        'ticket.category': t.ticket.category?.name || 'N/A',
      };
      break;
    }
    case 'ticket_reopened': {
      const t = payload as { ticket: TicketPayload };
      if (!t?.ticket) break;
      specific = { 'ticket.subject': t.ticket.subject };
      break;
    }
    case 'approval_required': {
      const t = payload as { ticket: TicketPayload };
      if (!t?.ticket) break;
      specific = { 'ticket.subject': t.ticket.subject };
      break;
    }
    case 'approval_received': {
      const p = payload as ApprovalReceivedPayload;
      if (!p?.ticket) break;
      specific = {
        'ticket.subject': p.ticket.subject,
        approval_action: p.approved ? 'aprovado' : 'rejeitado',
        approval_status: p.statusLabel,
      };
      break;
    }
    case 'client_registration_created': {
      const p = payload as { registration_message: string };
      specific = {
        registration_message: p?.registration_message ?? 'Um novo cadastro de cliente foi enviado.',
      };
      break;
    }
    case 'client_registration_status_change': {
      const p = payload as ClientRegistrationStatusPayload;
      if (p == null) break;
      const theme = getClientRegistrationStatusTheme(p.newStatus);
      const newStatusLabel = getClientRegistrationStatusLabel(p.newStatus);
      const baseUrl = config.clientUrl?.replace(/\/$/, '') || 'http://localhost:5173';
      specific = {
        old_status: p.statusDescription,
        new_status: newStatusLabel,
        status_title: theme.status_title,
        status_message: theme.status_message,
        status_color: theme.status_color,
        status_badge_bg: theme.status_badge_bg,
        status_badge_text: theme.status_badge_text,
        'client.url': `${baseUrl}/cadastros/${p.registrationId}`,
      };
      break;
    }
    default:
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        specific = payload as Record<string, string>;
      }
  }

  return { ...base, ...specific };
}
