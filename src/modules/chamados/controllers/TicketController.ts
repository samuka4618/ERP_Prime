import { Request, Response } from 'express';
import { TicketModel } from '../models/Ticket';
import { TicketHistoryModel } from '../models/TicketHistory';
import { NotificationService } from '../services/NotificationService';
import { realtimeService } from '../services/RealtimeService';
import { getWebSocketService } from '../services/WebSocketService';
import { CreateTicketRequest, UpdateTicketRequest, TicketStatus } from '../../../shared/types';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createTicketSchema, updateTicketSchema, addMessageSchema, ticketQuerySchema } from '../schemas/ticket';
import Joi from 'joi';


export class TicketController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    console.log('🔍 DEBUG CREATE TICKET - Body recebido:', req.body);
    console.log('🔍 DEBUG CREATE TICKET - User ID:', userId);

    const { error, value } = createTicketSchema.validate(req.body);
    if (error) {
      console.log('❌ ERRO DE VALIDAÇÃO:', error.details);
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    console.log('✅ Dados validados:', value);

    const ticketData = value as CreateTicketRequest;
    const ticket = await TicketModel.create(userId, ticketData);

    // Notificar sobre novo chamado (não falhar a resposta se notificação der erro)
    try {
      await NotificationService.notifyTicketCreated(ticket.id);
    } catch (err: any) {
      console.error('Erro ao enviar notificações do chamado (chamado foi criado):', err?.message || err);
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
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Atendentes podem ver chamados atribuídos a eles ou sem atendente (para poderem se atribuir)
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

    try {
      await NotificationService.notifyStatusChange(ticketId, oldTicket.status, TicketStatus.CLOSED);
    } catch (err: any) {
      console.error('Erro ao notificar fechamento do chamado:', err?.message || err);
    }

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

    try {
      await NotificationService.notifyTicketReopened(ticketId);
    } catch (err: any) {
      console.error('Erro ao notificar reabertura do chamado:', err?.message || err);
    }

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

    console.log('🔍 DEBUG - Criando mensagem:', { ticketId, userId, message, attachment });
    const history = await TicketHistoryModel.create(ticketId, userId, message, attachment);
    console.log('🔍 DEBUG - Mensagem criada:', history);

    try {
      await NotificationService.notifyNewMessage(ticketId, userId);
    } catch (err: any) {
      console.error('Erro ao notificar nova mensagem (mensagem foi salva):', err?.message || err);
    }

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
      try {
        await NotificationService.notifyStatusChange(ticketId, existingTicket.status as any, updateData.status as any);
      } catch (err: any) {
        console.error('Erro ao notificar mudança de status:', err?.message || err);
      }
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

      try {
        await NotificationService.createNotification(
          ticket.user_id,
          ticketId,
          'status_change',
          'Chamado assumido',
          `Seu chamado #${ticket.id} foi assumido por um técnico e está sendo atendido.`
        );
      } catch (notifErr: any) {
        console.error('Erro ao notificar chamado assumido:', notifErr?.message || notifErr);
      }

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

    // Verificar se o atendente está atribuído ao chamado
    if (req.user?.role === 'attendant' && existingTicket.attendant_id !== userId) {
      res.status(403).json({ error: 'Você não está atribuído a este chamado' });
      return;
    }

    // Atualizar status para aguardando aprovação
    const updatedTicket = await TicketModel.update(ticketId, { status: TicketStatus.PENDING_APPROVAL });

    if (!updatedTicket) {
      res.status(500).json({ error: 'Erro ao atualizar chamado' });
      return;
    }

    // Adicionar entrada no histórico
    await TicketHistoryModel.create(ticketId, userId, 'Chamado finalizado pelo atendente - aguardando aprovação do solicitante para encerramento');

    try {
      await NotificationService.notifyApprovalRequired(ticketId);
    } catch (err: any) {
      console.error('Erro ao notificar solicitação de aprovação:', err?.message || err);
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
      try {
        await NotificationService.notifyApprovalReceived(ticketId, true);
      } catch (err: any) {
        console.error('Erro ao notificar aprovação recebida:', err?.message || err);
      }
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
      try {
        await NotificationService.notifyApprovalReceived(ticketId, false);
      } catch (err: any) {
        console.error('Erro ao notificar rejeição recebida:', err?.message || err);
      }
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
}
