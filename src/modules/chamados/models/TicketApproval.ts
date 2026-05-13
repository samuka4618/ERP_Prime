import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export type TicketApprovalDecision = 'approved' | 'rejected';

export interface TicketApprovalRecord {
  id: number;
  ticket_id: number;
  approver_id: number;
  decision: TicketApprovalDecision;
  reason?: string | null;
  valor_referencia?: number | null;
  decided_at: Date;
  approver_name?: string;
}

export class TicketApprovalModel {
  static async create(data: {
    ticket_id: number;
    approver_id: number;
    decision: TicketApprovalDecision;
    reason?: string | null;
    valor_referencia?: number | null;
  }): Promise<void> {
    await dbRun(
      `INSERT INTO ticket_approvals (ticket_id, approver_id, decision, reason, valor_referencia)
       VALUES (?, ?, ?, ?, ?)`,
      [data.ticket_id, data.approver_id, data.decision, data.reason ?? null, data.valor_referencia ?? null]
    );
  }

  static async findByTicket(ticketId: number): Promise<TicketApprovalRecord[]> {
    const rows = (await dbAll(
      `SELECT a.*, u.name as approver_name
       FROM ticket_approvals a
       LEFT JOIN users u ON a.approver_id = u.id
       WHERE a.ticket_id = ?
       ORDER BY a.decided_at DESC`,
      [ticketId]
    )) as any[];

    return rows.map((r) => ({
      id: r.id,
      ticket_id: r.ticket_id,
      approver_id: r.approver_id,
      decision: r.decision,
      reason: r.reason,
      valor_referencia: r.valor_referencia != null ? parseFloat(r.valor_referencia) : null,
      decided_at: new Date(r.decided_at),
      approver_name: r.approver_name
    }));
  }
}
