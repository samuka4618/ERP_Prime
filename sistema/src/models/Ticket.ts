import { dbRun, dbGet, dbAll, db } from '../database/connection';
import { Ticket, TicketStatus, CreateTicketRequest, UpdateTicketRequest, PaginationParams, PaginatedResponse } from '../types';
import { config } from '../config/database';
import { CategoryAssignmentModel } from './CategoryAssignment';
import { formatSystemDate } from '../utils/dateUtils';

// Função auxiliar para fazer parse do custom_data
const parseCustomData = (customDataStr: string | null | undefined): Record<string, any> | undefined => {
  if (!customDataStr) return undefined;
  
  // Se já for um objeto, retornar diretamente
  if (typeof customDataStr === 'object' && !Array.isArray(customDataStr)) {
    return customDataStr as Record<string, any>;
  }
  
  // Se não for string, retornar undefined
  if (typeof customDataStr !== 'string') {
    return undefined;
  }
  
  try {
    const parsed = JSON.parse(customDataStr);
    // Validar se é um objeto válido
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch (e) {
    console.error('Erro ao fazer parse de custom_data:', e);
    return undefined;
  }
};

export class TicketModel {
  static async create(userId: number, ticketData: CreateTicketRequest): Promise<Ticket> {
    const now = new Date();
    
    // Buscar a categoria para obter os SLAs específicos
    const category = await dbGet(
      'SELECT * FROM ticket_categories WHERE id = ? AND is_active = 1',
      [ticketData.category_id]
    ) as any;

    if (!category) {
      throw new Error('Categoria não encontrada ou inativa');
    }

    const slaFirstResponse = new Date(now.getTime() + (category.sla_first_response_hours * 60 * 60 * 1000));
    const slaResolution = new Date(now.getTime() + (category.sla_resolution_hours * 60 * 60 * 1000));

    // Verificar se há atribuições automáticas para esta categoria
    const assignments = await CategoryAssignmentModel.findByCategory(ticketData.category_id);
    let assignedAttendantId = null;

    if (assignments.length > 0) {
      // Se há apenas um técnico atribuído, atribuir automaticamente
      if (assignments.length === 1) {
        assignedAttendantId = assignments[0].attendant_id;
      }
      // Se há múltiplos técnicos, deixar sem atribuição para que escolham
      // (o ticket ficará disponível para todos os técnicos atribuídos)
    }

    // Converter custom_data para JSON
    const customDataJson = ticketData.custom_data 
      ? JSON.stringify(ticketData.custom_data) 
      : null;

    // Inserir o ticket
    await dbRun(
      `INSERT INTO tickets (user_id, category_id, subject, description, status, priority, sla_first_response, sla_resolution, attendant_id, custom_data) 
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      [userId, ticketData.category_id, ticketData.subject, ticketData.description, ticketData.priority || 'medium', slaFirstResponse, slaResolution, assignedAttendantId, customDataJson]
    );

    // Buscar o último ticket inserido
    const lastTicket = await dbGet(
      `SELECT t.*, u.name as user_name, u.email as user_email, u.role as user_role
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.user_id = ? AND t.subject = ? AND t.description = ?
       ORDER BY t.id DESC
       LIMIT 1`,
      [userId, ticketData.subject, ticketData.description]
    ) as any;

    if (!lastTicket) {
      throw new Error('Erro ao buscar chamado criado');
    }

    // Criar entrada no histórico
    await dbRun(
      'INSERT INTO ticket_history (ticket_id, author_id, message) VALUES (?, ?, ?)',
      [lastTicket.id, userId, 'Chamado criado']
    );

    const ticket: Ticket = {
      id: lastTicket.id,
      user_id: lastTicket.user_id,
      attendant_id: lastTicket.attendant_id,
      category_id: lastTicket.category_id,
      category: lastTicket.category,
      subject: lastTicket.subject,
      description: lastTicket.description,
      status: lastTicket.status,
      priority: lastTicket.priority,
      sla_first_response: new Date(lastTicket.sla_first_response),
      sla_resolution: new Date(lastTicket.sla_resolution),
      custom_data: parseCustomData(lastTicket.custom_data),
      created_at: new Date(lastTicket.created_at),
      updated_at: new Date(lastTicket.updated_at),
      closed_at: lastTicket.closed_at ? new Date(lastTicket.closed_at) : undefined,
      reopened_at: lastTicket.reopened_at ? new Date(lastTicket.reopened_at) : undefined,
      user: lastTicket.user_name ? {
        id: lastTicket.user_id,
        name: lastTicket.user_name,
        email: lastTicket.user_email,
        password: '',
        role: lastTicket.user_role,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      } : undefined
    };

    return ticket;
  }

  static async findById(id: number): Promise<Ticket | null> {
    const ticket = await dbGet(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       WHERE t.id = ?`,
      [id]
    ) as any;

    if (!ticket) return null;

    return {
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: await formatSystemDate(ticket.sla_first_response),
      sla_resolution: await formatSystemDate(ticket.sla_resolution),
      custom_data: parseCustomData(ticket.custom_data),
      created_at: await formatSystemDate(ticket.created_at),
      updated_at: await formatSystemDate(ticket.updated_at),
      closed_at: ticket.closed_at ? await formatSystemDate(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? await formatSystemDate(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    };
  }

  static async findByUser(userId: number, params: PaginationParams): Promise<PaginatedResponse<Ticket>> {
    const offset = (params.page - 1) * params.limit;
    let whereClause = 'WHERE t.user_id = ?';
    const queryParams: any[] = [userId];

    if (params.status) {
      whereClause += ' AND t.status = ?';
      queryParams.push(params.status);
    }

    if (params.category_id) {
      whereClause += ' AND t.category_id = ?';
      queryParams.push(params.category_id);
    }

    if (params.priority) {
      whereClause += ' AND t.priority = ?';
      queryParams.push(params.priority);
    }

    if (params.search) {
      whereClause += ' AND (t.subject LIKE ? OR t.description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const tickets = await dbAll(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM tickets t ${whereClause}`,
      queryParams
    ) as { count: number };

    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: new Date(ticket.sla_first_response),
      sla_resolution: new Date(ticket.sla_resolution),
      custom_data: parseCustomData(ticket.custom_data),
      created_at: new Date(ticket.created_at),
      updated_at: new Date(ticket.updated_at),
      closed_at: ticket.closed_at ? new Date(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? new Date(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    }));

    return {
      data: formattedTickets,
      total: totalResult.count,
      page: params.page,
      limit: params.limit,
      total_pages: Math.ceil(totalResult.count / params.limit)
    };
  }

  static async findByAttendant(attendantId: number, params: PaginationParams): Promise<PaginatedResponse<Ticket>> {
    const offset = (params.page - 1) * params.limit;
    
    // Buscar categorias atribuídas ao técnico
    const assignedCategories = await CategoryAssignmentModel.findByAttendant(attendantId);
    const assignedCategoryIds = assignedCategories.map(cat => cat.category_id);
    
    // Atendentes veem:
    // 1. Chamados atribuídos diretamente a eles
    // 2. Chamados sem atendente das categorias que eles são responsáveis
    // 3. Chamados sem atendente da categoria "Outros" (se não há atribuição específica)
    let whereClause = 'WHERE (t.attendant_id = ? OR (t.attendant_id IS NULL AND (';
    
    if (assignedCategoryIds.length > 0) {
      whereClause += `t.category_id IN (${assignedCategoryIds.map(() => '?').join(',')}) OR `;
    }
    
    // Adicionar categoria "Outros" (assumindo que tem ID específico ou nome)
    whereClause += 't.category_id IN (SELECT id FROM ticket_categories WHERE name = "Outros" OR id NOT IN (SELECT DISTINCT category_id FROM category_assignments WHERE is_active = 1))';
    whereClause += ')))';
    
    const queryParams: any[] = [attendantId, ...assignedCategoryIds];

    if (params.status) {
      whereClause += ' AND t.status = ?';
      queryParams.push(params.status);
    }

    if (params.category_id) {
      whereClause += ' AND t.category_id = ?';
      queryParams.push(params.category_id);
    }

    if (params.priority) {
      whereClause += ' AND t.priority = ?';
      queryParams.push(params.priority);
    }

    if (params.search) {
      whereClause += ' AND (t.subject LIKE ? OR t.description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const tickets = await dbAll(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM tickets t ${whereClause}`,
      queryParams
    ) as { count: number };

    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: new Date(ticket.sla_first_response),
      sla_resolution: new Date(ticket.sla_resolution),
      custom_data: parseCustomData(ticket.custom_data),
      created_at: new Date(ticket.created_at),
      updated_at: new Date(ticket.updated_at),
      closed_at: ticket.closed_at ? new Date(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? new Date(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    }));

    return {
      data: formattedTickets,
      total: totalResult.count,
      page: params.page,
      limit: params.limit,
      total_pages: Math.ceil(totalResult.count / params.limit)
    };
  }

  static async findAll(params: PaginationParams): Promise<PaginatedResponse<Ticket>> {
    const offset = (params.page - 1) * params.limit;
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.status) {
      whereClause += ' AND t.status = ?';
      queryParams.push(params.status);
    }

    if (params.category_id) {
      whereClause += ' AND t.category_id = ?';
      queryParams.push(params.category_id);
    }

    if (params.priority) {
      whereClause += ' AND t.priority = ?';
      queryParams.push(params.priority);
    }

    if (params.search) {
      whereClause += ' AND (t.subject LIKE ? OR t.description LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const tickets = await dbAll(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, params.limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM tickets t ${whereClause}`,
      queryParams
    ) as { count: number };

    const formattedTickets = tickets.map(ticket => ({
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: new Date(ticket.sla_first_response),
      sla_resolution: new Date(ticket.sla_resolution),
      custom_data: parseCustomData(ticket.custom_data),
      created_at: new Date(ticket.created_at),
      updated_at: new Date(ticket.updated_at),
      closed_at: ticket.closed_at ? new Date(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? new Date(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    }));

    return {
      data: formattedTickets,
      total: totalResult.count,
      page: params.page,
      limit: params.limit,
      total_pages: Math.ceil(totalResult.count / params.limit)
    };
  }


  static async assignToAttendant(id: number, attendantId: number): Promise<Ticket | null> {
    await dbRun(
      'UPDATE tickets SET attendant_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [attendantId, 'in_progress', id]
    );

    return this.findById(id);
  }

  static async close(id: number): Promise<Ticket | null> {
    await dbRun(
      'UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['closed', id]
    );

    return this.findById(id);
  }

  static async reopen(id: number): Promise<Ticket | null> {
    await dbRun(
      'UPDATE tickets SET status = ?, reopened_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['open', id]
    );

    return this.findById(id);
  }

  static async getOpenTickets(): Promise<Ticket[]> {
    const tickets = await dbAll(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       WHERE t.status = 'open'
       ORDER BY t.created_at ASC`
    ) as any[];

    return tickets.map(ticket => ({
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: new Date(ticket.sla_first_response),
      sla_resolution: new Date(ticket.sla_resolution),
      created_at: new Date(ticket.created_at),
      updated_at: new Date(ticket.updated_at),
      closed_at: ticket.closed_at ? new Date(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? new Date(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    }));
  }

  static async getSlaViolations(): Promise<Ticket[]> {
    const now = new Date();
    const tickets = await dbAll(
      `SELECT t.*, 
              u.name as user_name, u.email as user_email,
              a.name as attendant_name, a.email as attendant_email,
              c.name as category_name, c.description as category_description,
              c.sla_first_response_hours, c.sla_resolution_hours
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN users a ON t.attendant_id = a.id
       LEFT JOIN ticket_categories c ON t.category_id = c.id
       WHERE (t.status = 'open' AND t.sla_first_response < ?) 
          OR (t.status IN ('in_progress', 'pending_user', 'pending_third_party') AND t.sla_resolution < ?)
       ORDER BY t.created_at ASC`,
      [now, now]
    ) as any[];

    return tickets.map(ticket => ({
      id: ticket.id,
      user_id: ticket.user_id,
      attendant_id: ticket.attendant_id,
      category_id: ticket.category_id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      sla_first_response: new Date(ticket.sla_first_response),
      sla_resolution: new Date(ticket.sla_resolution),
      created_at: new Date(ticket.created_at),
      updated_at: new Date(ticket.updated_at),
      closed_at: ticket.closed_at ? new Date(ticket.closed_at) : undefined,
      reopened_at: ticket.reopened_at ? new Date(ticket.reopened_at) : undefined,
      user: ticket.user_name ? {
        id: ticket.user_id,
        name: ticket.user_name,
        email: ticket.user_email,
        password: '',
        role: 'user' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      attendant: ticket.attendant_name ? {
        id: ticket.attendant_id,
        name: ticket.attendant_name,
        email: ticket.attendant_email,
        password: '',
        role: 'attendant' as any,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined,
      category: ticket.category_name ? {
        id: ticket.category_id,
        name: ticket.category_name,
        description: ticket.category_description,
        sla_first_response_hours: ticket.sla_first_response_hours,
        sla_resolution_hours: ticket.sla_resolution_hours,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : undefined
    }));
  }

  static async countByStatus(startDate?: string, endDate?: string): Promise<Record<TicketStatus, number>> {
    let query = 'SELECT status, COUNT(*) as count FROM tickets';
    const params: any[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate + ' 23:59:59');
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    query += ' GROUP BY status';

    const result = await dbAll(query, params) as Array<{ status: TicketStatus; count: number }>;

    const counts: Record<TicketStatus, number> = {
      [TicketStatus.OPEN]: 0,
      [TicketStatus.IN_PROGRESS]: 0,
      [TicketStatus.PENDING_USER]: 0,
      [TicketStatus.PENDING_THIRD_PARTY]: 0,
      [TicketStatus.PENDING_APPROVAL]: 0,
      [TicketStatus.RESOLVED]: 0,
      [TicketStatus.CLOSED]: 0,
      [TicketStatus.OVERDUE_FIRST_RESPONSE]: 0,
      [TicketStatus.OVERDUE_RESOLUTION]: 0
    };

    result.forEach(row => {
      counts[row.status] = row.count;
    });

    return counts;
  }

  static async countByCategory(startDate?: string, endDate?: string): Promise<Array<{ category_id: number; category_name: string; count: number }>> {
    let query = `SELECT t.category_id, c.name as category_name, COUNT(*) as count 
       FROM tickets t
       LEFT JOIN ticket_categories c ON t.category_id = c.id`;
    const params: any[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push('t.created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('t.created_at <= ?');
        params.push(endDate + ' 23:59:59');
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    query += ' GROUP BY t.category_id, c.name';

    const result = await dbAll(query, params) as Array<{ category_id: number; category_name: string; count: number }>;

    return result;
  }

  static async countByPriority(startDate?: string, endDate?: string): Promise<Record<string, number>> {
    let query = 'SELECT priority, COUNT(*) as count FROM tickets';
    const params: any[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate + ' 23:59:59');
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    query += ' GROUP BY priority';

    const result = await dbAll(query, params) as Array<{ priority: string; count: number }>;

    const counts: Record<string, number> = {};

    result.forEach(row => {
      counts[row.priority] = row.count;
    });

    return counts;
  }

  static async getAverageResolutionTime(startDate?: string, endDate?: string): Promise<number> {
    let query = `SELECT AVG(julianday(closed_at) - julianday(created_at)) * 24 as avg_hours
       FROM tickets 
       WHERE status = 'closed' AND closed_at IS NOT NULL`;
    const params: any[] = [];

    if (startDate || endDate) {
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate + ' 23:59:59');
      }
    }

    const result = await dbGet(query, params) as { avg_hours: number };

    return result.avg_hours || 0;
  }

  static async count(startDate?: string, endDate?: string): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM tickets';
    const params: any[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push('created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('created_at <= ?');
        params.push(endDate + ' 23:59:59');
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
    }

    const result = await dbGet(query, params) as { count: number };
    return result.count;
  }



  static async delete(id: number): Promise<void> {
    // Excluir dependências primeiro
    await dbRun('DELETE FROM ticket_history WHERE ticket_id = ?', [id]);
    await dbRun('DELETE FROM notifications WHERE ticket_id = ?', [id]);
    
    // Excluir o chamado
    await dbRun('DELETE FROM tickets WHERE id = ?', [id]);
  }

  static async update(id: number, data: Partial<UpdateTicketRequest>): Promise<Ticket | null> {
    const fields = [];
    const values = [];

    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (data.attendantId) {
      fields.push('attendant_id = ?');
      values.push(data.attendantId);
    }

    if (data.priority) {
      fields.push('priority = ?');
      values.push(data.priority);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await dbRun(
      `UPDATE tickets SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async addHistoryEntry(ticketId: number, authorId: number, message: string): Promise<void> {
    await dbRun(
      'INSERT INTO ticket_history (ticket_id, author_id, message, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [ticketId, authorId, message]
    );
  }

  static async claimTicket(ticketId: number, attendantId: number): Promise<Ticket> {
    // Verificar se o ticket existe e está disponível para atribuição
    const ticket = await dbGet(
      'SELECT * FROM tickets WHERE id = ? AND attendant_id IS NULL',
      [ticketId]
    ) as any;

    if (!ticket) {
      throw new Error('Ticket não encontrado ou já atribuído');
    }

    // Verificar se o técnico tem permissão para assumir tickets desta categoria
    const assignments = await CategoryAssignmentModel.findByAttendant(attendantId);
    const assignedCategoryIds = assignments.map(cat => cat.category_id);
    
    // Verificar se é categoria "Outros" (sem atribuição específica) ou se o técnico está atribuído
    const isOthersCategory = await dbGet(
      'SELECT id FROM ticket_categories WHERE id = ? AND (name = "Outros" OR id NOT IN (SELECT DISTINCT category_id FROM category_assignments WHERE is_active = 1))',
      [ticket.category_id]
    ) as any;

    const canClaim = assignedCategoryIds.includes(ticket.category_id) || isOthersCategory;

    if (!canClaim) {
      throw new Error('Você não tem permissão para assumir tickets desta categoria');
    }

    // Atribuir o ticket ao técnico
    await dbRun(
      'UPDATE tickets SET attendant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [attendantId, ticketId]
    );

    // Adicionar entrada no histórico
    await this.addHistoryEntry(ticketId, attendantId, 'Ticket assumido pelo técnico');

    // Retornar o ticket atualizado
    const updatedTicket = await this.findById(ticketId);
    if (!updatedTicket) {
      throw new Error('Ticket não encontrado');
    }
    return updatedTicket;
  }

  static async getRecentActivity(): Promise<Array<{
    id: number;
    type: 'ticket_created' | 'ticket_updated' | 'ticket_resolved' | 'ticket_reopened' | 'ticket_closed';
    title: string;
    description: string;
    timestamp: Date;
    user_name: string;
    ticket_id: number;
    ticket_subject: string;
  }>> {
    // Buscar tickets criados nos últimos 7 dias
    const recentTickets = await dbAll(
      `SELECT 
        t.id as ticket_id,
        t.subject as ticket_subject,
        t.status,
        t.created_at,
        t.updated_at,
        t.closed_at,
        t.reopened_at,
        u.name as user_name
       FROM tickets t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.created_at >= datetime('now', '-7 days')
       ORDER BY t.created_at DESC
       LIMIT 10`,
      []
    ) as any[];

    const activities: Array<{
      id: number;
      type: 'ticket_created' | 'ticket_updated' | 'ticket_resolved' | 'ticket_reopened' | 'ticket_closed';
      title: string;
      description: string;
      timestamp: Date;
      user_name: string;
      ticket_id: number;
      ticket_subject: string;
    }> = [];

    recentTickets.forEach((ticket) => {
      // Adicionar atividade de criação
      activities.push({
        id: ticket.ticket_id * 1000 + 1, // ID único para criação
        type: 'ticket_created',
        title: 'Novo chamado criado',
        description: `Chamado #${ticket.ticket_id} - ${ticket.ticket_subject}`,
        timestamp: new Date(ticket.created_at),
        user_name: ticket.user_name,
        ticket_id: ticket.ticket_id,
        ticket_subject: ticket.ticket_subject
      });

      // Se foi resolvido, adicionar atividade de resolução
      if (ticket.status === 'resolved' && ticket.closed_at) {
        activities.push({
          id: ticket.ticket_id * 1000 + 2, // ID único para resolução
          type: 'ticket_resolved',
          title: 'Chamado resolvido',
          description: `Chamado #${ticket.ticket_id} - ${ticket.ticket_subject}`,
          timestamp: new Date(ticket.closed_at),
          user_name: ticket.user_name,
          ticket_id: ticket.ticket_id,
          ticket_subject: ticket.ticket_subject
        });
      }

      // Se foi fechado, adicionar atividade de fechamento
      if (ticket.status === 'closed' && ticket.closed_at) {
        activities.push({
          id: ticket.ticket_id * 1000 + 3, // ID único para fechamento
          type: 'ticket_closed',
          title: 'Chamado fechado',
          description: `Chamado #${ticket.ticket_id} - ${ticket.ticket_subject}`,
          timestamp: new Date(ticket.closed_at),
          user_name: ticket.user_name,
          ticket_id: ticket.ticket_id,
          ticket_subject: ticket.ticket_subject
        });
      }

      // Se foi reaberto, adicionar atividade de reabertura
      if (ticket.reopened_at) {
        activities.push({
          id: ticket.ticket_id * 1000 + 4, // ID único para reabertura
          type: 'ticket_reopened',
          title: 'Chamado reaberto',
          description: `Chamado #${ticket.ticket_id} - ${ticket.ticket_subject}`,
          timestamp: new Date(ticket.reopened_at),
          user_name: ticket.user_name,
          ticket_id: ticket.ticket_id,
          ticket_subject: ticket.ticket_subject
        });
      }
    });

    // Ordenar por timestamp (mais recente primeiro) e limitar a 10 atividades
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }
}
