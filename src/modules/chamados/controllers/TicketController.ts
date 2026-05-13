import { Request, Response } from 'express';
import { TicketModel } from '../models/Ticket';
import { TicketHistoryModel } from '../models/TicketHistory';
import { NotificationService } from '../services/NotificationService';
import { realtimeService } from '../services/RealtimeService';
import { getWebSocketService } from '../services/WebSocketService';
import { CreateTicketRequest, UpdateTicketRequest, TicketStatus, Ticket } from '../../../shared/types';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createTicketSchema, updateTicketSchema, addMessageSchema, ticketQuerySchema, completeCardSubscriptionSchema } from '../schemas/ticket';
import Joi from 'joi';
import { logger } from '../../../shared/utils/logger';
import { CategoryModel } from '../models/Category';
import { TicketCategoryApproverModel } from '../models/TicketCategoryApprover';
import { CardSubscriptionModel, BillingCycle } from '../models/CardSubscription';
import { AttachmentModel } from '../models/Attachment';
import { valorFromTicketCustomField } from '../utils/approvalAmount';

export class TicketController {
  /** Aprovador financeiro (faixa de valor) pode visualizar o chamado antes da fila de atendentes. */
  private static async userCanViewAsFinanceApprover(ticket: Ticket, userId: number): Promise<boolean> {
    if (ticket.status !== TicketStatus.PENDING_FINANCE_APPROVAL) return false;
    const category = await CategoryModel.findById(ticket.category_id);
    if (!category?.requires_approval) return false;
    const cd = ticket.custom_data || {};
    const field = category.approval_value_field || 'valor_mensal';
    const valor = valorFromTicketCustomField(cd as Record<string, unknown>, field);
    if (valor === null) return false;
    const ap = await TicketCategoryApproverModel.findApproverUserIdForValue(category.id, valor);
    return ap === userId;
  }

  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    logger.debug('CREATE TICKET - Body recebido', req.body, 'TICKET');
    logger.debug('CREATE TICKET - User ID', { userId }, 'TICKET');

    const { error, value } = createTicketSchema.validate(req.body);
    if (error) {
      console.log('❌ ERRO DE VALIDAÇÃO:', error.details);
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    logger.debug('Dados validados', value, 'TICKET');

    const ticketData = value as CreateTicketRequest;

    const category = await CategoryModel.findById(ticketData.category_id);
    if (!category) {
      res.status(400).json({ error: 'Categoria não encontrada' });
      return;
    }

    const approvalType = category.approval_type ?? 'none';
    if (category.requires_approval && approvalType === 'finance_card') {
      const field =
        (category.approval_value_field && String(category.approval_value_field).trim()) ||
        'valor_mensal';
      const v = valorFromTicketCustomField(
        ticketData.custom_data as Record<string, unknown> | undefined,
        field
      );
      if (v === null || !Number.isFinite(v) || v < 0) {
        res.status(400).json({
          error: `Esta categoria exige valor numérico não negativo no campo «${field}» na abertura do chamado (valor de referência da assinatura, para definir o aprovador financeiro).`
        });
        return;
      }
    }

    const ticket = await TicketModel.create(userId, ticketData);

    // Notificações em background para não bloquear a resposta (evita timeout no front)
    NotificationService.notifyTicketCreated(ticket.id).catch((err: any) => {
      console.error('Erro ao enviar notificações do chamado (chamado foi criado):', err?.message || err);
    });
    if (ticket.status === TicketStatus.PENDING_FINANCE_APPROVAL) {
      NotificationService.notifyFinanceApprovalRequired(ticket.id).catch((err: any) => {
        console.error('Erro ao notificar aprovação financeira:', err?.message || err);
      });
    }

    res.status(201).json({
      message: 'Chamado criado com sucesso',
      data: { ticket }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = ticketQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const params = value;
    let result;

    // Determinar qual método usar baseado no role do usuário
    if (req.user?.role === 'admin') {
      result = await TicketModel.findAll(params);
    } else if (req.user?.role === 'attendant') {
      result = await TicketModel.findByAttendant(req.user.id, params);
    } else {
      result = await TicketModel.findByUser(req.user!.id, params);
    }

    res.json({
      message: 'Chamados obtidos com sucesso',
      data: result
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Verificar permissões
    if (req.user?.role === 'user' && ticket.user_id !== req.user.id) {
      const fin = await TicketController.userCanViewAsFinanceApprover(ticket, req.user.id);
      if (!fin) {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }
    }

    // Atendentes podem ver chamados atribuídos a eles ou sem atendente (fila)
    if (req.user?.role === 'attendant' && ticket.attendant_id !== req.user.id && ticket.attendant_id !== null) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    res.json({
      message: 'Chamado obtido com sucesso',
      data: { ticket }
    });
  });


  static assign = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const attendantId = req.body.attendantId ?? req.body.attendant_id;

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID do chamado inválido' });
      return;
    }
    if (!attendantId || typeof attendantId !== 'number') {
      res.status(400).json({ error: 'Informe o ID do técnico a ser atribuído (attendantId ou attendant_id)' });
      return;
    }

    const ticket = await TicketModel.assignToAttendant(ticketId, attendantId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    res.json({
      message: 'Chamado atribuído com sucesso',
      data: { ticket }
    });
  });

  static close = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const oldTicket = await TicketModel.findById(ticketId);
    if (!oldTicket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    const ticket = await TicketModel.close(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    NotificationService.notifyStatusChange(ticketId, oldTicket.status, TicketStatus.CLOSED).catch((err: any) => {
      console.error('Erro ao notificar fechamento do chamado:', err?.message || err);
    });

    res.json({
      message: 'Chamado fechado com sucesso',
      data: { ticket }
    });
  });

  static reopen = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const ticket = await TicketModel.reopen(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    NotificationService.notifyTicketReopened(ticketId).catch((err: any) => {
      console.error('Erro ao notificar reabertura do chamado:', err?.message || err);
    });

    res.json({
      message: 'Chamado reaberto com sucesso',
      data: { ticket }
    });
  });

  static addMessage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(ticketId) || !userId) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = addMessageSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const { message, attachment } = value;

    // Verificar se o chamado existe e se o usuário tem permissão
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    if (req.user?.role === 'user' && ticket.user_id !== userId) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Atendentes podem adicionar mensagens em chamados atribuídos a eles ou sem atendente
    if (req.user?.role === 'attendant' && ticket.attendant_id !== userId && ticket.attendant_id !== null) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    logger.debug('Criando mensagem', { ticketId, userId, message, attachment }, 'TICKET');
    const history = await TicketHistoryModel.create(ticketId, userId, message, attachment);
    logger.debug('Mensagem criada', { id: history.id }, 'TICKET');

    NotificationService.notifyNewMessage(ticketId, userId).catch((err: any) => {
      console.error('Erro ao notificar nova mensagem (mensagem foi salva):', err?.message || err);
    });

    // Enviar evento em tempo real para todos os clientes conectados ao ticket (não falhar a resposta)
    try {
      const messageData = {
        id: history.id,
        ticket_id: ticketId,
        author_id: userId,
        message: history.message,
        attachment: history.attachment,
        created_at: history.created_at,
        author: {
          id: req.user?.id,
          name: req.user?.name,
          email: req.user?.email,
          role: req.user?.role
        }
      };
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.sendMessageToTicket(ticketId, messageData);
      } else {
        realtimeService.sendMessageToTicket(ticketId, messageData);
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem em tempo real (mensagem foi salva):', err?.message || err);
    }

    res.status(201).json({
      message: 'Mensagem adicionada com sucesso',
      data: history
    });
  });

  static getHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe e se o usuário tem permissão
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    if (req.user?.role === 'user' && ticket.user_id !== req.user.id) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Atendentes podem ver histórico de chamados atribuídos a eles ou sem atendente
    if (req.user?.role === 'attendant' && ticket.attendant_id !== req.user.id && ticket.attendant_id !== null) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const history = await TicketHistoryModel.findByTicket(ticketId);

    res.json({
      message: 'Histórico obtido com sucesso',
      data: { history }
    });
  });

  static getOpenTickets = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'attendant') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const tickets = await TicketModel.getOpenTickets();

    res.json({
      message: 'Chamados abertos obtidos com sucesso',
      data: { tickets }
    });
  });

  static getSlaViolations = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const tickets = await TicketModel.getSlaViolations();

    res.json({
      message: 'Violações de SLA obtidas com sucesso',
      data: { tickets }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe
    const existingTicket = await TicketModel.findById(ticketId);
    if (!existingTicket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Verificar permissões
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Atendentes só podem atualizar chamados atribuídos a eles ou sem atendente
    if (userRole === 'attendant' && existingTicket.attendant_id !== userId && existingTicket.attendant_id !== null) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Usuários comuns não podem atualizar chamados
    if (userRole === 'user') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const body = req.body as UpdateTicketRequest & { attendant_id?: number };
    const updateData: UpdateTicketRequest = {
      ...body,
      attendantId: body.attendantId ?? body.attendant_id
    };
    if (updateData.attendantId === undefined) delete updateData.attendantId;
    const updatedTicket = await TicketModel.update(ticketId, updateData);

    if (!updatedTicket) {
      res.status(500).json({ error: 'Erro ao atualizar chamado' });
      return;
    }

    // Adicionar entrada no histórico se o status mudou
    if (updateData.status && updateData.status !== existingTicket.status) {
      await TicketHistoryModel.create(ticketId, userId!, `Status alterado de "${existingTicket.status}" para "${updateData.status}"`);
      NotificationService.notifyStatusChange(ticketId, existingTicket.status as any, updateData.status as any).catch((err: any) => {
        console.error('Erro ao notificar mudança de status:', err?.message || err);
      });
    }

    // Enviar evento em tempo real para todos os clientes conectados ao ticket
    realtimeService.sendTicketUpdate(ticketId, {
      id: updatedTicket.id,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      attendant_id: updatedTicket.attendant_id,
      updated_at: updatedTicket.updated_at
    }, userId);

    res.json({
      message: 'Chamado atualizado com sucesso',
      data: { ticket: updatedTicket }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const ticketId = parseInt(id);

    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Deletar o chamado
    await TicketModel.delete(ticketId);

    res.json({
      message: 'Chamado excluído com sucesso',
      data: { success: true }
    });
  });

  // Assumir ticket (para técnicos)
  static claimTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const attendantId = (req as any).user.id;

    if (!id || isNaN(Number(id))) {
      res.status(400).json({ error: 'ID do ticket inválido' });
    }

    const ticketId = Number(id);

    try {
      const ticket = await TicketModel.claimTicket(ticketId, attendantId);

      NotificationService.createNotification(
        ticket.user_id,
        ticketId,
        'status_change',
        'Chamado assumido',
        `Seu chamado #${ticket.id} foi assumido por um técnico e está sendo atendido.`
      ).catch((notifErr: any) => {
        console.error('Erro ao notificar chamado assumido:', notifErr?.message || notifErr);
      });

      res.json({
        message: 'Ticket assumido com sucesso',
        data: ticket
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Solicitar aprovação do solicitante (para técnicos)
  static requestApproval = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(ticketId) || !userId) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe
    const existingTicket = await TicketModel.findById(ticketId);
    if (!existingTicket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Verificar permissões - apenas atendentes podem solicitar aprovação
    if (req.user?.role !== 'attendant' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Verificar se o atendente pode atuar (designado no chamado ou fila por categoria)
    if (req.user?.role === 'attendant') {
      const canAct = await TicketModel.attendantCanActWithCategoryPool(userId, {
        attendant_id: existingTicket.attendant_id,
        category_id: existingTicket.category_id
      });
      if (!canAct) {
        res.status(403).json({ error: 'Você não está autorizado a atuar neste chamado' });
        return;
      }
    }

    // Atualizar status para aguardando aprovação
    const updatedTicket = await TicketModel.update(ticketId, { status: TicketStatus.PENDING_APPROVAL });

    if (!updatedTicket) {
      res.status(500).json({ error: 'Erro ao atualizar chamado' });
      return;
    }

    // Adicionar entrada no histórico
    await TicketHistoryModel.create(ticketId, userId, 'Chamado finalizado pelo atendente - aguardando aprovação do solicitante para encerramento');

    NotificationService.notifyApprovalRequired(ticketId).catch((err: any) => {
      console.error('Erro ao notificar solicitação de aprovação:', err?.message || err);
    });

    // Enviar evento em tempo real
    realtimeService.sendTicketUpdate(ticketId, {
      id: updatedTicket.id,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      attendant_id: updatedTicket.attendant_id,
      updated_at: updatedTicket.updated_at
    }, userId);

    res.json({
      message: 'Solicitação de aprovação enviada com sucesso',
      data: { ticket: updatedTicket }
    });
  });

  // Aprovar chamado (para solicitantes)
  static approveTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(ticketId) || !userId) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe
    const existingTicket = await TicketModel.findById(ticketId);
    if (!existingTicket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Verificar se o usuário é o solicitante
    if (existingTicket.user_id !== userId) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Verificar se o chamado está aguardando aprovação
    if (existingTicket.status !== 'pending_approval') {
      res.status(400).json({ error: 'Este chamado não está aguardando aprovação' });
      return;
    }

    // Fechar o chamado
    const updatedTicket = await TicketModel.close(ticketId);

    if (!updatedTicket) {
      res.status(500).json({ error: 'Erro ao fechar chamado' });
      return;
    }

    // Adicionar entrada no histórico
    await TicketHistoryModel.create(ticketId, userId, 'Chamado aprovado pelo solicitante - problema confirmado como resolvido');

    if (existingTicket.attendant_id) {
      NotificationService.notifyApprovalReceived(ticketId, true).catch((err: any) => {
        console.error('Erro ao notificar aprovação recebida:', err?.message || err);
      });
    }

    // Enviar evento em tempo real
    realtimeService.sendTicketUpdate(ticketId, {
      id: updatedTicket.id,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      attendant_id: updatedTicket.attendant_id,
      updated_at: updatedTicket.updated_at
    }, userId);

    res.json({
      message: 'Chamado aprovado e finalizado com sucesso',
      data: { ticket: updatedTicket }
    });
  });

  // Rejeitar chamado (para solicitantes)
  static rejectTicket = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const ticketId = parseInt(id);
    const userId = req.user?.id;
    const { reason } = req.body;

    if (isNaN(ticketId) || !userId) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se o chamado existe
    const existingTicket = await TicketModel.findById(ticketId);
    if (!existingTicket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    // Verificar se o usuário é o solicitante
    if (existingTicket.user_id !== userId) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Verificar se o chamado está aguardando aprovação
    if (existingTicket.status !== 'pending_approval') {
      res.status(400).json({ error: 'Este chamado não está aguardando aprovação' });
      return;
    }

    // Reabrir o chamado
    const updatedTicket = await TicketModel.update(ticketId, { status: TicketStatus.IN_PROGRESS });

    if (!updatedTicket) {
      res.status(500).json({ error: 'Erro ao reabrir chamado' });
      return;
    }

    // Adicionar entrada no histórico
    const historyMessage = reason 
      ? `Chamado rejeitado pelo solicitante - problema ainda não resolvido. Observação: ${reason}`
      : 'Chamado rejeitado pelo solicitante - problema ainda não resolvido, retornado para atendimento';
    
    await TicketHistoryModel.create(ticketId, userId, historyMessage);

    if (existingTicket.attendant_id) {
      NotificationService.notifyApprovalReceived(ticketId, false).catch((err: any) => {
        console.error('Erro ao notificar rejeição recebida:', err?.message || err);
      });
    }

    // Enviar evento em tempo real
    realtimeService.sendTicketUpdate(ticketId, {
      id: updatedTicket.id,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      attendant_id: updatedTicket.attendant_id,
      updated_at: updatedTicket.updated_at
    }, userId);

    res.json({
      message: 'Chamado rejeitado e retornado para atendimento',
      data: { ticket: updatedTicket }
    });
  });

  /** Registra assinatura com credenciais criptografadas e resolve o chamado (categoria finance_card). */
  static completeCardSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const ticketId = parseInt(req.params.id, 10);
    if (isNaN(ticketId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = completeCardSubscriptionSchema.validate(req.body || {});
    if (error) {
      res.status(400).json({ error: error.details[0]?.message || 'Dados inválidos' });
      return;
    }
    const body = value as Record<string, unknown>;

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }
    const category = await CategoryModel.findById(ticket.category_id);
    if (!category || category.approval_type !== 'finance_card') {
      res.status(400).json({ error: 'Categoria sem fluxo de assinatura cartão' });
      return;
    }
    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      res.status(400).json({ error: 'O chamado deve estar em atendimento' });
      return;
    }
    if (req.user?.role !== 'admin' && req.user?.role !== 'attendant') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    if (req.user?.role === 'attendant') {
      const canAct = await TicketModel.attendantCanActWithCategoryPool(userId, {
        attendant_id: ticket.attendant_id,
        category_id: ticket.category_id
      });
      if (!canAct) {
        res.status(403).json({
          error:
            'Apenas o atendente designado no chamado ou um técnico atribuído a esta categoria pode registar a assinatura'
        });
        return;
      }
    }

    const existing = await CardSubscriptionModel.findByTicketId(ticketId);
    if (existing) {
      res.status(400).json({ error: 'Assinatura já registrada para este chamado' });
      return;
    }

    const cd = (ticket.custom_data || {}) as Record<string, unknown>;
    const platform = (body.platform ?? cd.plataforma) as string | undefined;
    const planVal = body.plan ?? cd.plano;
    const urlVal = body.url ?? cd.url;
    const login_username = (body.login_username ?? cd.login_plataforma) as string | undefined;
    const pwd = (body.password_plain ?? cd.senha_plataforma ?? '') as string;
    const amount = (body.amount !== undefined ? Number(body.amount) : Number(cd.valor_mensal)) as number;
    const billingRaw = String(body.billing_cycle ?? cd.ciclo_faturamento ?? 'monthly');

    if (!platform || !login_username || !pwd) {
      res.status(400).json({
        error: 'Informe plataforma, login da plataforma e senha (no corpo ou nos campos customizados do chamado)'
      });
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: 'Valor inválido' });
      return;
    }
    const cycle: BillingCycle =
      billingRaw === 'monthly' || billingRaw === 'annual' || billingRaw === 'one_time'
        ? (billingRaw as BillingCycle)
        : 'monthly';

    await CardSubscriptionModel.createForTicket(ticketId, ticket.user_id, {
      platform: String(platform),
      plan: planVal != null && planVal !== '' ? String(planVal) : undefined,
      url: urlVal != null && urlVal !== '' ? String(urlVal) : undefined,
      login_username: String(login_username),
      plainPassword: String(pwd),
      billing_cycle: cycle,
      amount,
      currency: (body.currency as string) || 'BRL',
      card_last4: body.card_last4 != null ? String(body.card_last4) : undefined,
      next_renewal_date:
        body.next_renewal_date != null && body.next_renewal_date !== ''
          ? String(body.next_renewal_date)
          : undefined,
      notes: body.notes != null ? String(body.notes) : undefined
    });

    if (body.delete_attachments === true) {
      await AttachmentModel.deleteAllForTicketWithFiles(ticketId);
    }

    const updated = await TicketModel.update(ticketId, { status: TicketStatus.RESOLVED });
    await TicketHistoryModel.create(
      ticketId,
      userId,
      'Assinatura digital registrada — chamado resolvido'
    );
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
        userId
      );
    }
    const subscription = await CardSubscriptionModel.findByTicketId(ticketId);
    res.json({
      message: 'Assinatura criada e chamado resolvido',
      data: { ticket: updated, subscription }
    });
  });
}
