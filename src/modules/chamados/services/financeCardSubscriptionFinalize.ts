import { TicketStatus, Ticket } from '../../../shared/types';
import { CardSubscriptionModel, BillingCycle, CardSubscription } from '../models/CardSubscription';
import { TicketModel } from '../models/Ticket';
import { AttachmentModel } from '../models/Attachment';
import { TicketHistoryModel } from '../models/TicketHistory';
import { realtimeService } from './RealtimeService';
import { extractFinanceCardCredentials } from '../utils/financeCardCustomData';

export type FinanceCardFinalizeInput = {
  ticketId: number;
  ticket: Ticket;
  actorUserId: number;
  billing_cycle: BillingCycle;
  amount: number;
  currency?: string;
  notes?: string | null;
  delete_attachments?: boolean;
};

/** Cria registo de assinatura a partir dos dados já preenchidos no chamado mais ciclo/valor/notas definidos pelo aprovador financeiro e resolve o chamado. */
export async function finalizeFinanceCardSubscription(
  input: FinanceCardFinalizeInput
): Promise<{ updated: Ticket | null; subscription: CardSubscription | null }> {
  const { ticketId, ticket, actorUserId } = input;

  const cd = (ticket.custom_data || {}) as Record<string, unknown>;

  const creds = extractFinanceCardCredentials(cd);
  if (!creds) {
    throw new Error(
      'O chamado deve conter plataforma/serviço, utilizador/login da plataforma e senha nos dados da abertura ' +
        '(campos obrigatórios no formulário de novo chamado). Corrija o chamado ou peça novo pedido ao solicitante.'
    );
  }
  const platform = creds.platform;
  const login_username = creds.login_username;
  const pwd = creds.password;
  const planVal = cd.plano != null && cd.plano !== '' ? String(cd.plano) : undefined;
  const urlVal = cd.url != null && cd.url !== '' ? String(cd.url) : undefined;

  const existing = await CardSubscriptionModel.findByTicketId(ticketId);
  if (existing) {
    throw new Error('Assinatura já registrada para este chamado');
  }

  await CardSubscriptionModel.createForTicket(ticketId, ticket.user_id, {
    platform,
    plan: planVal,
    url: urlVal,
    login_username,
    plainPassword: pwd,
    billing_cycle: input.billing_cycle,
    amount: input.amount,
    currency: input.currency?.trim() || 'BRL',
    notes:
      input.notes != null && String(input.notes).trim() !== '' ? String(input.notes).trim() : undefined
  });

  if (input.delete_attachments === true) {
    await AttachmentModel.deleteAllForTicketWithFiles(ticketId);
  }

  const updated = await TicketModel.update(ticketId, { status: TicketStatus.RESOLVED });
  await TicketHistoryModel.create(ticketId, actorUserId, 'Assinatura digital registrada — chamado resolvido');

  if (updated) {
    realtimeService.sendTicketUpdate(
      ticketId,
      {
        id: updated.id,
        status: updated.status,
        priority: updated.priority,
        attendant_id: updated.attendant_id,
        updated_at: updated.updated_at
      },
      actorUserId
    );
  }

  const subscription = await CardSubscriptionModel.findByTicketId(ticketId);
  return { updated, subscription };
}
