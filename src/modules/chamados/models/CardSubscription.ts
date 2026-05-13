import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { CryptoService } from '../../../core/security/CryptoService';
import { PaginationParams, PaginatedResponse } from '../../../shared/types';
import { Request } from 'express';
import { config } from '../../../config/database';

export type BillingCycle = 'monthly' | 'annual' | 'one_time';
export type SubscriptionStatus = 'active' | 'cancelled' | 'suspended';

export interface CardSubscription {
  id: number;
  ticket_id: number;
  owner_user_id: number;
  platform: string;
  plan?: string | null;
  url?: string | null;
  login_username?: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  currency: string;
  card_last4?: string | null;
  next_renewal_date?: string | null;
  status: SubscriptionStatus;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  owner_email?: string;
  ticket_subject?: string;
  approved_by_name?: string;
}

export interface CreateCardSubscriptionInput {
  platform: string;
  plan?: string;
  url?: string;
  login_username: string;
  plainPassword: string;
  billing_cycle: BillingCycle;
  amount: number;
  currency?: string;
  card_last4?: string;
  next_renewal_date?: string | null;
  notes?: string;
}

function getClientMeta(req: Request) {
  const raw = req.headers['x-forwarded-for'];
  const fwd = Array.isArray(raw) ? raw[0] : (raw?.split(',')[0] || '').trim();
  return {
    ip: fwd || req.ip || null,
    userAgent: req.get('user-agent') || null
  };
}

export class CardSubscriptionModel {
  static async createForTicket(
    ticketId: number,
    ownerUserId: number,
    data: CreateCardSubscriptionInput
  ): Promise<CardSubscription> {
    const enc = CryptoService.encrypt(data.plainPassword);
    await dbRun(
      `INSERT INTO card_subscriptions (
        ticket_id, owner_user_id, platform, plan, url, login_username,
        password_ciphertext, password_iv, password_auth_tag,
        billing_cycle, amount, currency, card_last4, next_renewal_date, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        ticketId,
        ownerUserId,
        data.platform,
        data.plan ?? null,
        data.url ?? null,
        data.login_username,
        enc.ciphertext,
        enc.iv,
        enc.authTag,
        data.billing_cycle,
        data.amount,
        data.currency ?? 'BRL',
        data.card_last4 ?? null,
        data.next_renewal_date ?? null,
        data.notes ?? null
      ]
    );
    const row = (await dbGet(
      `SELECT * FROM card_subscriptions WHERE ticket_id = ? ORDER BY id DESC LIMIT 1`,
      [ticketId]
    )) as Record<string, unknown>;
    if (!row) throw new Error('Falha ao criar assinatura');
    return this.mapRow(row);
  }

  static mapRow(row: Record<string, unknown>): CardSubscription {
    return {
      id: row.id as number,
      ticket_id: row.ticket_id as number,
      owner_user_id: row.owner_user_id as number,
      platform: row.platform as string,
      plan: (row.plan as string) ?? null,
      url: (row.url as string) ?? null,
      login_username: (row.login_username as string) ?? null,
      billing_cycle: row.billing_cycle as BillingCycle,
      amount: parseFloat(String(row.amount)),
      currency: (row.currency as string) || 'BRL',
      card_last4: (row.card_last4 as string) ?? null,
      next_renewal_date: (row.next_renewal_date as string) ?? null,
      status: row.status as SubscriptionStatus,
      cancelled_at: (row.cancelled_at as string) ?? null,
      cancellation_reason: (row.cancellation_reason as string) ?? null,
      notes: (row.notes as string) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    };
  }

  static async findById(id: number): Promise<CardSubscription | null> {
    const row = (await dbGet(
      `SELECT cs.*,
              u.name as owner_name, u.email as owner_email,
              t.subject as ticket_subject,
              (SELECT u2.name FROM ticket_approvals ta
               JOIN users u2 ON ta.approver_id = u2.id
               WHERE ta.ticket_id = cs.ticket_id AND ta.decision = 'approved'
               ORDER BY ta.decided_at DESC LIMIT 1) as approved_by_name
       FROM card_subscriptions cs
       LEFT JOIN users u ON cs.owner_user_id = u.id
       LEFT JOIN tickets t ON cs.ticket_id = t.id
       WHERE cs.id = ?`,
      [id]
    )) as Record<string, unknown> | undefined;
    if (!row) return null;
    const s = this.mapRow(row);
    s.owner_name = row.owner_name as string;
    s.owner_email = row.owner_email as string;
    s.ticket_subject = row.ticket_subject as string;
    s.approved_by_name = row.approved_by_name as string;
    return s;
  }

  static async findByTicketId(ticketId: number): Promise<CardSubscription | null> {
    const row = (await dbGet(`SELECT * FROM card_subscriptions WHERE ticket_id = ? ORDER BY id DESC LIMIT 1`, [
      ticketId
    ])) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  static async getOwnerUserId(id: number): Promise<number | null> {
    const row = (await dbGet(`SELECT owner_user_id FROM card_subscriptions WHERE id = ?`, [id])) as
      | { owner_user_id: number }
      | undefined;
    return row ? row.owner_user_id : null;
  }

  static async findAll(
    params: Omit<PaginationParams, 'status'> & {
      subscriptionStatus?: string;
      platform?: string;
      ownerSearch?: string;
      renewalWithinDays?: number;
      /** Quando definido (ex.: utilizador só com permissão próprias), só assinaturas deste solicitante */
      restrictOwnerUserId?: number;
    }
  ): Promise<PaginatedResponse<CardSubscription>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const qParams: unknown[] = [];

    if (params.restrictOwnerUserId != null && params.restrictOwnerUserId >= 1) {
      where += ' AND cs.owner_user_id = ?';
      qParams.push(params.restrictOwnerUserId);
    }

    if (params.subscriptionStatus) {
      where += ' AND cs.status = ?';
      qParams.push(params.subscriptionStatus);
    }
    if (params.platform) {
      where += ' AND cs.platform LIKE ?';
      qParams.push(`%${params.platform}%`);
    }
    if (params.ownerSearch) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      const s = `%${params.ownerSearch}%`;
      qParams.push(s, s);
    }
    if (params.renewalWithinDays != null && params.renewalWithinDays > 0) {
      if (config.database.usePostgres) {
        where += ` AND cs.next_renewal_date IS NOT NULL
          AND (cs.next_renewal_date::date - CURRENT_DATE) >= 0
          AND (cs.next_renewal_date::date - CURRENT_DATE) <= ?`;
      } else {
        where += ` AND cs.next_renewal_date IS NOT NULL
          AND julianday(cs.next_renewal_date) - julianday('now') >= 0
          AND julianday(cs.next_renewal_date) - julianday('now') <= ?`;
      }
      qParams.push(params.renewalWithinDays);
    }

    const rows = (await dbAll(
      `SELECT cs.*,
              u.name as owner_name, u.email as owner_email,
              t.subject as ticket_subject,
              (SELECT u2.name FROM ticket_approvals ta
               JOIN users u2 ON ta.approver_id = u2.id
               WHERE ta.ticket_id = cs.ticket_id AND ta.decision = 'approved'
               ORDER BY ta.decided_at DESC LIMIT 1) as approved_by_name
       FROM card_subscriptions cs
       LEFT JOIN users u ON cs.owner_user_id = u.id
       LEFT JOIN tickets t ON cs.ticket_id = t.id
       ${where}
       ORDER BY cs.created_at DESC
       LIMIT ? OFFSET ?`,
      [...qParams, limit, offset]
    )) as Record<string, unknown>[];

    const totalR = (await dbGet(
      `SELECT COUNT(*) as count FROM card_subscriptions cs
       LEFT JOIN users u ON cs.owner_user_id = u.id
       ${where}`,
      qParams
    )) as { count: number };

    const data = rows.map((row) => {
      const s = this.mapRow(row);
      s.owner_name = row.owner_name as string;
      s.owner_email = row.owner_email as string;
      s.ticket_subject = row.ticket_subject as string;
      s.approved_by_name = row.approved_by_name as string;
      return s;
    });

    return {
      data,
      total: Number(totalR.count),
      page,
      limit,
      total_pages: Math.ceil(Number(totalR.count) / limit)
    };
  }

  static async listActiveWithRenewalDates(): Promise<CardSubscription[]> {
    const rows = (await dbAll(
      `SELECT * FROM card_subscriptions WHERE status = 'active' AND next_renewal_date IS NOT NULL`,
      []
    )) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  static async listRenewalsWithinDays(days: number, restrictOwnerUserId?: number): Promise<CardSubscription[]> {
    let ownerClause = '';
    const params: unknown[] = [days];
    if (restrictOwnerUserId != null && restrictOwnerUserId >= 1) {
      ownerClause = ' AND owner_user_id = ?';
      params.push(restrictOwnerUserId);
    }
    let sql: string;
    if (config.database.usePostgres) {
      sql = `
      SELECT * FROM card_subscriptions
       WHERE status = 'active'
         AND next_renewal_date IS NOT NULL
         AND (next_renewal_date::date - CURRENT_DATE) >= 0
         AND (next_renewal_date::date - CURRENT_DATE) <= ?${ownerClause}
       ORDER BY next_renewal_date ASC`;
    } else {
      sql = `
      SELECT * FROM card_subscriptions
       WHERE status = 'active'
         AND next_renewal_date IS NOT NULL
         AND julianday(next_renewal_date) - julianday('now') >= 0
         AND julianday(next_renewal_date) - julianday('now') <= ?${ownerClause}
       ORDER BY next_renewal_date ASC`;
    }
    const rows = (await dbAll(sql, params)) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  static async revealPassword(subscriptionId: number, userId: number, req: Request): Promise<string> {
    const row = (await dbGet(
      `SELECT password_ciphertext, password_iv, password_auth_tag FROM card_subscriptions WHERE id = ?`,
      [subscriptionId]
    )) as Record<string, unknown> | undefined;
    if (!row?.password_ciphertext) {
      throw new Error('Credencial não armazenada');
    }
    const plain = CryptoService.decrypt({
      ciphertext: row.password_ciphertext as string,
      iv: row.password_iv as string,
      authTag: row.password_auth_tag as string
    });
    const meta = getClientMeta(req);
    await dbRun(
      `INSERT INTO card_subscription_secret_access (subscription_id, user_id, ip_address, user_agent)
       VALUES (?, ?, ?, ?)`,
      [subscriptionId, userId, meta.ip, meta.userAgent]
    );
    return plain;
  }

  static async cancel(id: number, reason: string): Promise<CardSubscription | null> {
    await dbRun(
      `UPDATE card_subscriptions SET status = 'cancelled', cancellation_reason = ?, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, id]
    );
    const row = (await dbGet(`SELECT * FROM card_subscriptions WHERE id = ?`, [id])) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  static async sumActiveMonthlyEquivalent(restrictOwnerUserId?: number): Promise<{
    totalMonthlyApprox: number;
    activeCount: number;
    renewals30d: number;
  }> {
    const ownerFilter =
      restrictOwnerUserId != null && restrictOwnerUserId >= 1 ? ' AND owner_user_id = ?' : '';
    const ownerParams =
      restrictOwnerUserId != null && restrictOwnerUserId >= 1 ? [restrictOwnerUserId] : [];

    const rows = (await dbAll(
      `SELECT billing_cycle, amount FROM card_subscriptions WHERE status = 'active'${ownerFilter}`,
      ownerParams
    )) as Array<{
      billing_cycle: string;
      amount: string | number;
    }>;
    let totalMonthlyApprox = 0;
    for (const r of rows) {
      const amt = parseFloat(String(r.amount));
      if (r.billing_cycle === 'monthly') totalMonthlyApprox += amt;
      else if (r.billing_cycle === 'annual') totalMonthlyApprox += amt / 12;
      else totalMonthlyApprox += amt;
    }
    const activeCount = rows.length;
    const renew30SqlPg = `SELECT COUNT(*) as c FROM card_subscriptions
         WHERE status = 'active' AND next_renewal_date IS NOT NULL
           AND (next_renewal_date::date - CURRENT_DATE) >= 0
           AND (next_renewal_date::date - CURRENT_DATE) <= 30${ownerFilter}`;
    const renew30SqlSq = `SELECT COUNT(*) as c FROM card_subscriptions
         WHERE status = 'active' AND next_renewal_date IS NOT NULL
           AND julianday(next_renewal_date) - julianday('now') >= 0
           AND julianday(next_renewal_date) - julianday('now') <= 30${ownerFilter}`;
    const renew30Sql = config.database.usePostgres ? renew30SqlPg : renew30SqlSq;
    const renewals30d = Number(((await dbGet(renew30Sql, ownerParams)) as { c: number | string }).c);
    return { totalMonthlyApprox, activeCount, renewals30d };
  }
}
