import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { Attachment, CreateAttachmentRequest } from '../../../shared/types';

export class AttachmentModel {
  static async create(attachmentData: CreateAttachmentRequest): Promise<Attachment> {
    const { ticket_id, message_id, user_id, original_name, file_name, file_path, file_size, mime_type } = attachmentData;
    
    const result = await dbRun(
      `INSERT INTO attachments (ticket_id, message_id, user_id, original_name, file_name, file_path, file_size, mime_type) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticket_id, message_id, user_id, original_name, file_name, file_path, file_size, mime_type]
    );
    
    const id = result.lastID;
    if (!id) throw new Error('Failed to create attachment');
    
    return (await this.findById(id))!;
  }

  static async findById(id: number): Promise<Attachment | null> {
    const attachment = await dbGet(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM attachments a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [id]
    ) as any;
    
    return attachment || null;
  }

  static async findByTicketId(ticketId: number): Promise<Attachment[]> {
    const attachments = await dbAll(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM attachments a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.ticket_id = ?
       ORDER BY a.created_at ASC`,
      [ticketId]
    ) as any[];
    
    return attachments.map(this.formatAttachment);
  }

  static async findByMessageId(messageId: number): Promise<Attachment[]> {
    const attachments = await dbAll(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM attachments a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.message_id = ?
       ORDER BY a.created_at ASC`,
      [messageId]
    ) as any[];
    
    return attachments.map(this.formatAttachment);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM attachments WHERE id = ?', [id]);
  }

  static async deleteByTicketId(ticketId: number): Promise<void> {
    await dbRun('DELETE FROM attachments WHERE ticket_id = ?', [ticketId]);
  }

  static async deleteByMessageId(messageId: number): Promise<void> {
    await dbRun('DELETE FROM attachments WHERE message_id = ?', [messageId]);
  }

  static async countByTicketId(ticketId: number): Promise<number> {
    const result = await dbGet('SELECT COUNT(*) as count FROM attachments WHERE ticket_id = ?', [ticketId]) as { count: number };
    return result.count;
  }

  static async getTotalSizeByTicketId(ticketId: number): Promise<number> {
    const result = await dbGet('SELECT SUM(file_size) as total_size FROM attachments WHERE ticket_id = ?', [ticketId]) as { total_size: number };
    return result.total_size || 0;
  }

  private static formatAttachment(attachment: any): Attachment {
    return {
      id: attachment.id,
      ticket_id: attachment.ticket_id,
      message_id: attachment.message_id,
      user_id: attachment.user_id,
      user_name: attachment.user_name,
      user_email: attachment.user_email,
      original_name: attachment.original_name,
      file_name: attachment.file_name,
      file_path: attachment.file_path,
      file_size: attachment.file_size,
      mime_type: attachment.mime_type,
      created_at: new Date(attachment.created_at)
    };
  }
}
