import { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { TicketModel } from '../models/Ticket';
import { CategoryModel } from '../models/Category';
import { TicketCategoryApproverModel } from '../models/TicketCategoryApprover';
import { TicketApprovalModel } from '../models/TicketApproval';
import { NotificationService } from '../services/NotificationService';
import { realtimeService } from '../services/RealtimeService';
import { TicketStatus, UserRole } from '../../../shared/types';
import Joi from 'joi';
import { dbAll } from '../../../core/database/connection';
import { valorFromTicketCustomField } from '../utils/approvalAmount';

const parseCustom = (raw: string | null | undefined): Record<string, any> | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const p = JSON.parse(raw);
    return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : undefined;
  } catch {
    return undefined;
  }
};

/** Nome técnico do campo configurado na categoria (ex.: valor_mensal). */
function approvalFieldName(category: Awaited<ReturnType<typeof CategoryModel.findById>>): string {
  return category?.approval_value_field || 'valor_mensal';
}

/** Valor de faixa só pode vir do formulário (`custom_data` na abertura); o aprovador não define valor. */
function valorReferenciaDoChamado(
  category: NonNullable<Awaited<ReturnType<typeof CategoryModel.findById>>>,
  cd: Record<string, any> | undefined
): number {
  const field = approvalFieldName(category);
  const v = valorFromTicketCustomField(cd, field);
  if (v === null || !Number.isFinite(v) || v < 0) {
    throw new Error(
      `Não há valor numérico válido no campo «${field}» deste chamado. O solicitante deve informá-lo ao abrir o chamado ou o chamado deve ser corrigido antes da aprovação financeira.`
    );
  }
  return v;
}

export class FinanceApprovalController {
  static listPending = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const rows = (await dbAll(
      `SELECT id FROM tickets WHERE status = 'pending_finance_approval' ORDER BY created_at ASC`
    )) as { id: number }[];

    const isAdmin = req.user?.role === UserRole.ADMIN;
    const eligibleIds: number[] = [];

    for (const r of rows) {
      const ticket = await TicketModel.findById(r.id);
      if (!ticket) continue;
      const category = await CategoryModel.findById(ticket.category_id);
      if (!category) continue;
      const cd = ticket.custom_data || parseCustom((ticket as any).custom_data as string);
      if (isAdmin) {
        eligibleIds.push(r.id);
        continue;
      }
      try {
        const field = approvalFieldName(category);
        const valor = valorFromTicketCustomField(cd, field);
        if (valor === null) continue;
        const approver = await TicketCategoryApproverModel.findApproverUserIdForValue(category.id, valor);
        if (approver === userId) eligibleIds.push(r.id);
      } catch {
        /* skip invalid */
      }
    }

    const total = eligibleIds.length;
    const offset = (page - 1) * limit;
    const pageIds = eligibleIds.slice(offset, offset + limit);
    const data = [];
    for (const id of pageIds) {
      const t = await TicketModel.findById(id);
      if (t) data.push(t);
    }

    res.json({
      message: 'Pendentes de aprovação financeira',
      data: {
        data,
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit)
      }
    });
  });

  static approve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ticketId = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    if (!userId || isNaN(ticketId)) {
      res.status(400).json({ error: 'Dados inválidos' });
      return;
    }

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket || ticket.status !== TicketStatus.PENDING_FINANCE_APPROVAL) {
      res.status(400).json({ error: 'Chamado não está aguardando aprovação financeira' });
      return;
    }

    const category = await CategoryModel.findById(ticket.category_id);
    if (!category) {
      res.status(500).json({ error: 'Categoria não encontrada' });
      return;
    }

    const cd = ticket.custom_data as Record<string, any> | undefined;
    let valor: number;
    try {
      valor = valorReferenciaDoChamado(category, cd);
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Valor inválido' });
      return;
    }

    const expectedApprover = await TicketCategoryApproverModel.findApproverUserIdForValue(category.id, valor);
    const isAdmin = req.user?.role === UserRole.ADMIN;
    if (!isAdmin && expectedApprover !== userId) {
      res.status(403).json({ error: 'Você não é o aprovador designado para esta faixa de valor' });
      return;
    }

    const attendantId = await TicketModel.resolveAttendantForCategory(ticket.category_id, cd ?? {});

    await TicketApprovalModel.create({
      ticket_id: ticketId,
      approver_id: userId,
      decision: 'approved',
      valor_referencia: valor
    });

    if (attendantId != null) {
      await TicketModel.assignToAttendant(ticketId, attendantId);
    } else {
      await TicketModel.update(ticketId, { status: TicketStatus.IN_PROGRESS });
    }

    const updated = await TicketModel.findById(ticketId);

    NotificationService.notifyFinanceApprovalDecision(ticketId, 'approved').catch(() => {});
    if (updated) {
      realtimeService.sendTicketUpdate(ticketId, {
        id: updated.id,
        status: updated.status,
        priority: updated.priority,
        attendant_id: updated.attendant_id,
        updated_at: updated.updated_at
      }, userId);
    }

    res.json({ message: 'Chamado aprovado', data: { ticket: updated } });
  });

  static reject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const schema = Joi.object({
      reason: Joi.string().min(3).max(2000).required()
    });
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) {
      res.status(400).json({ error: 'Informe o motivo da rejeição (mín. 3 caracteres)' });
      return;
    }

    const ticketId = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    if (!userId || isNaN(ticketId)) {
      res.status(400).json({ error: 'Dados inválidos' });
      return;
    }

    const ticket = await TicketModel.findById(ticketId);
    if (!ticket || ticket.status !== TicketStatus.PENDING_FINANCE_APPROVAL) {
      res.status(400).json({ error: 'Chamado não está aguardando aprovação financeira' });
      return;
    }

    const category = await CategoryModel.findById(ticket.category_id);
    if (!category) {
      res.status(500).json({ error: 'Categoria não encontrada' });
      return;
    }

    const cd = ticket.custom_data as Record<string, any> | undefined;
    let valor: number;
    try {
      valor = valorReferenciaDoChamado(category, cd);
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Valor inválido' });
      return;
    }

    const expectedApprover = await TicketCategoryApproverModel.findApproverUserIdForValue(category.id, valor);
    const isAdmin = req.user?.role === UserRole.ADMIN;
    if (!isAdmin && expectedApprover !== userId) {
      res.status(403).json({ error: 'Você não é o aprovador designado para esta faixa de valor' });
      return;
    }

    await TicketApprovalModel.create({
      ticket_id: ticketId,
      approver_id: userId,
      decision: 'rejected',
      reason: value.reason,
      valor_referencia: valor
    });

    await TicketModel.close(ticketId);

    const updated = await TicketModel.findById(ticketId);

    NotificationService.notifyFinanceApprovalDecision(ticketId, 'rejected').catch(() => {});
    if (updated) {
      realtimeService.sendTicketUpdate(ticketId, {
        id: updated.id,
        status: updated.status,
        priority: updated.priority,
        attendant_id: updated.attendant_id,
        updated_at: updated.updated_at
      }, userId);
    }

    res.json({ message: 'Chamado rejeitado e encerrado', data: { ticket: updated } });
  });
}
