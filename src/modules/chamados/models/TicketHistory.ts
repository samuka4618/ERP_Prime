import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { TicketHistory } from '../types';
import { UserRole } from '../../../shared/types';
import { formatSystemDate, formatSystemDateOnly } from '../../../shared/utils/dateUtils';

export class TicketHistoryModel {
  static async create(ticketId: number, authorId: number, message: string, attachment?: string): Promise<TicketHistory> {
    const now = new Date();
    const utcTimeString = now.toISOString().replace('T', ' ').replace('Z', '');
    const { lastID: messageId } = await dbRun(
      'INSERT INTO ticket_history (ticket_id, author_id, message, attachment, created_at) VALUES (?, ?, ?, ?, ?)',
      [ticketId, authorId, message, attachment ?? null, utcTimeString]
    );
    const row = await dbGet(
      `SELECT th.*, u.name as author_name, u.email as author_email
       FROM ticket_history th
       LEFT JOIN users u ON th.author_id = u.id
       WHERE th.id = ?`,
      [messageId]
    ) as any;
    if (!row) {
      throw new Error('Erro ao buscar histórico criado');
    }
    return {
      id: row.id,
      ticket_id: row.ticket_id,
      author_id: row.author_id,
      message: row.message,
      attachment: row.attachment,
      created_at: row.created_at,
      author: row.author_name
        ? {
            id: row.author_id,
            name: row.author_name,
            email: row.author_email,
            role: UserRole.USER,
            password: '',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        : undefined
    };
  }

  static async findById(id: number): Promise<TicketHistory | null> {
    const history = await dbGet(
      `SELECT th.*, u.name as author_name, u.email as author_email
       FROM ticket_history th
       LEFT JOIN users u ON th.author_id = u.id
       WHERE th.id = ?`,
      [id]
    ) as any;

    if (!history) return null;

    return {
      id: history.id,
      ticket_id: history.ticket_id,
      author_id: history.author_id,
      message: history.message,
      attachment: history.attachment,
      created_at: new Date(history.created_at).toISOString(),
      author: history.author_name ? {
        id: history.author_id,
        name: history.author_name,
        email: history.author_email,
        password: '',
        role: UserRole.USER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };
  }

  static async findByTicket(ticketId: number): Promise<TicketHistory[]> {
    const histories = await dbAll(
      `SELECT th.*, u.name as author_name, u.email as author_email
       FROM ticket_history th
       LEFT JOIN users u ON th.author_id = u.id
       WHERE th.ticket_id = ?
       ORDER BY th.id ASC`,
      [ticketId]
    ) as any[];

    // Verificar IDs duplicados
    const ids = histories.map(h => h.id);
    const uniqueIds = [...new Set(ids)];
    if (ids.length !== uniqueIds.length) {
      console.warn('⚠️ IDs duplicados encontrados no histórico:', {
        total: ids.length,
        únicos: uniqueIds.length,
        duplicados: ids.filter((id, index) => ids.indexOf(id) !== index)
      });
    }

    // Formatar datas usando o timezone do sistema (apenas data, sem hora)
    const formattedHistories = await Promise.all(histories.map(async (history) => {
      const formattedDate = await formatSystemDateOnly(history.created_at);
      
      // Log removido - sistema funcionando corretamente
      
      return {
        id: history.id,
        ticket_id: history.ticket_id,
        author_id: history.author_id,
        message: history.message,
        attachment: history.attachment,
        created_at: history.created_at, // Manter data original ISO
        formatted_date: formattedDate, // Data formatada com timezone (apenas data)
        author: history.author_name ? {
          id: history.author_id,
          name: history.author_name,
          email: history.author_email,
          password: '',
          role: UserRole.USER,
          is_active: true,
          created_at: await formatSystemDate(new Date()),
          updated_at: await formatSystemDate(new Date())
        } : undefined
      };
    }));

    return formattedHistories;
  }

  static async getLastMessage(ticketId: number): Promise<TicketHistory | null> {
    const history = await dbGet(
      `SELECT th.*, u.name as author_name, u.email as author_email
       FROM ticket_history th
       LEFT JOIN users u ON th.author_id = u.id
       WHERE th.ticket_id = ?
       ORDER BY th.created_at DESC
       LIMIT 1`,
      [ticketId]
    ) as any;

    if (!history) return null;

    return {
      id: history.id,
      ticket_id: history.ticket_id,
      author_id: history.author_id,
      message: history.message,
      attachment: history.attachment,
      created_at: new Date(history.created_at).toISOString(),
      author: history.author_name ? {
        id: history.author_id,
        name: history.author_name,
        email: history.author_email,
        password: '',
        role: UserRole.USER,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };
  }
}
