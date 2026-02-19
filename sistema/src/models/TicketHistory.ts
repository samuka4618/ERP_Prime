import { dbRun, dbGet, dbAll } from '../database/connection';
import db from '../database/connection';
import { TicketHistory } from '../types';
import { formatSystemDate, formatSystemDateOnly } from '../utils/dateUtils';

export class TicketHistoryModel {
  static async create(ticketId: number, authorId: number, message: string, attachment?: string): Promise<TicketHistory> {
    console.log('🔍 DEBUG - Inserindo mensagem no banco:', { ticketId, authorId, message, attachment });
    
    // Usar transação explícita
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Salvar data atual usando UTC para evitar problemas de timezone
        const now = new Date();
        const utcTimeString = now.toISOString().replace('T', ' ').replace('Z', '');
        
        // Log removido - sistema funcionando corretamente
        
        const stmt = db.prepare('INSERT INTO ticket_history (ticket_id, author_id, message, attachment, created_at) VALUES (?, ?, ?, ?, ?)');
        stmt.run([ticketId, authorId, message, attachment || null, utcTimeString], function(err) {
          if (err) {
            console.error('🔍 DEBUG - Erro na inserção:', err);
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          const messageId = this.lastID;
          console.log('🔍 DEBUG - Mensagem inserida com ID:', messageId);
          
          // Buscar o histórico inserido
          db.get(
            `SELECT th.*, u.name as author_name, u.email as author_email
             FROM ticket_history th
             LEFT JOIN users u ON th.author_id = u.id
             WHERE th.id = ?`,
            [messageId],
            (err, row) => {
              if (err) {
                console.error('🔍 DEBUG - Erro ao buscar histórico:', err);
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              if (!row) {
                console.error('🔍 DEBUG - Histórico não encontrado');
                db.run('ROLLBACK');
                reject(new Error('Erro ao buscar histórico criado'));
                return;
              }
              
              console.log('🔍 DEBUG - Histórico encontrado:', row);
              
              db.run('COMMIT', (err) => {
                if (err) {
                  console.error('🔍 DEBUG - Erro no commit:', err);
                  reject(err);
                  return;
                }
                
                console.log('🔍 DEBUG - Transação commitada com sucesso');
                
                const ticketHistory: TicketHistory = {
                  id: (row as any).id,
                  ticket_id: (row as any).ticket_id,
                  author_id: (row as any).author_id,
                  message: (row as any).message,
                  attachment: (row as any).attachment,
                  created_at: (row as any).created_at,
                  author: (row as any).author_name ? {
                    id: (row as any).author_id,
                    name: (row as any).author_name,
                    email: (row as any).author_email,
                    role: 'user' as any,
                    password: '',
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  } : undefined
                };
                
                resolve(ticketHistory);
              });
            }
          );
        });
        
        stmt.finalize();
      });
    });
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
        role: 'user' as any,
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
          role: 'user' as any,
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
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };
  }
}
