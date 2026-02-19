import { dbRun, dbGet, dbAll } from '../database/connection';
import { Notification } from '../types';

export class NotificationModel {
  static async create(
    userId: number, 
    ticketId: number, 
    type: 'status_change' | 'new_message' | 'sla_alert' | 'ticket_reopened',
    title: string, 
    message: string
  ): Promise<Notification> {
    const result = await dbRun(
      'INSERT INTO notifications (user_id, ticket_id, type, title, message) VALUES (?, ?, ?, ?, ?)',
      [userId, ticketId, type, title, message]
    );

    // Buscar a última notificação inserida
    const lastNotification = await dbGet(
      `SELECT n.*, u.name as user_name, u.email as user_email
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.user_id = ? AND n.ticket_id = ? AND n.type = ?
       ORDER BY n.id DESC
       LIMIT 1`,
      [userId, ticketId, type]
    ) as any;

    if (!lastNotification) {
      throw new Error('Erro ao buscar notificação criada');
    }

    return {
      id: lastNotification.id,
      user_id: lastNotification.user_id,
      ticket_id: lastNotification.ticket_id,
      type: lastNotification.type,
      title: lastNotification.title,
      message: lastNotification.message,
      is_read: lastNotification.is_read === 1,
      created_at: new Date(lastNotification.created_at),
      user: lastNotification.user_name ? {
        id: lastNotification.user_id,
        name: lastNotification.user_name,
        email: lastNotification.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };
  }

  static async findById(id: number): Promise<Notification | null> {
    const notification = await dbGet(
      `SELECT n.*, u.name as user_name, u.email as user_email,
              t.subject as ticket_subject
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       LEFT JOIN tickets t ON n.ticket_id = t.id
       WHERE n.id = ?`,
      [id]
    ) as any;

    if (!notification) return null;

    return {
      id: notification.id,
      user_id: notification.user_id,
      ticket_id: notification.ticket_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: Boolean(notification.is_read),
      created_at: new Date(notification.created_at),
      user: notification.user_name ? {
        id: notification.user_id,
        name: notification.user_name,
        email: notification.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      ticket: notification.ticket_subject ? {
        id: notification.ticket_id,
        user_id: 0,
        category_id: 0,
        category: 'other' as any,
        subject: notification.ticket_subject,
        description: '',
        status: 'open' as any,
        priority: 'medium' as any,
        sla_first_response: new Date(),
        sla_resolution: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };
  }

  static async findByUser(userId: number, params: { page: number; limit: number }): Promise<Notification[]> {
    const offset = (params.page - 1) * params.limit;
    const notifications = await dbAll(
      `SELECT n.*, u.name as user_name, u.email as user_email,
              t.subject as ticket_subject
       FROM notifications n
       LEFT JOIN users u ON n.user_id = u.id
       LEFT JOIN tickets t ON n.ticket_id = t.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, params.limit, offset]
    ) as any[];

    return notifications.map(notification => ({
      id: notification.id,
      user_id: notification.user_id,
      ticket_id: notification.ticket_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: Boolean(notification.is_read),
      created_at: new Date(notification.created_at),
      user: notification.user_name ? {
        id: notification.user_id,
        name: notification.user_name,
        email: notification.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      ticket: notification.ticket_subject ? {
        id: notification.ticket_id,
        user_id: 0,
        category_id: 0,
        category: 'other' as any,
        subject: notification.ticket_subject,
        description: '',
        status: 'open' as any,
        priority: 'medium' as any,
        sla_first_response: new Date(),
        sla_resolution: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    }));
  }

  static async markAsRead(id: number, userId: number): Promise<void> {
    await dbRun(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  }

  static async markAllAsRead(userId: number): Promise<void> {
    await dbRun(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );
  }

  static async getUnreadCount(userId: number): Promise<number> {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    ) as { count: number };

    return result.count;
  }

  static async countUnread(): Promise<number> {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0',
      []
    ) as { count: number };

    return result.count;
  }

  static async countByUser(userId: number): Promise<number> {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?',
      [userId]
    ) as { count: number };

    return result.count;
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM notifications WHERE id = ?', [id]);
  }

  static async deleteByTicket(ticketId: number): Promise<void> {
    await dbRun('DELETE FROM notifications WHERE ticket_id = ?', [ticketId]);
  }

  static async deleteOld(olderThanDays: number = 30): Promise<void> {
    await dbRun(
      'DELETE FROM notifications WHERE created_at < datetime("now", "-" || ? || " days")',
      [olderThanDays]
    );
  }
}
