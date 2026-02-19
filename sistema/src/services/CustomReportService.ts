import { dbAll } from '../database/connection';
import { logger } from '../utils/logger';

export interface CustomField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  table: string;
  column: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  groupBy?: boolean;
  orderBy?: 'asc' | 'desc';
}

export interface CustomReportConfig {
  fields: CustomField[];
  filters: {
    table: string;
    column: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
    value: any;
  }[];
  groupBy: string[];
  orderBy: {
    column: string;
    direction: 'ASC' | 'DESC';
  }[];
  limit?: number;
}

export class CustomReportService {
  // Gerar query SQL baseada na configuração personalizada
  static generateQuery(config: CustomReportConfig): string {
    const { fields, filters, groupBy, orderBy, limit } = config;
    
    // Validar se fields existe e é um array
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      throw new Error('Nenhum campo foi selecionado para o relatório personalizado');
    }
    
    // Construir SELECT
    const selectFields = fields.map(field => {
      if (field.aggregation) {
        return `${field.aggregation.toUpperCase()}(${field.table}.${field.column}) AS ${field.name}`;
      }
      return `${field.table}.${field.column} AS ${field.name}`;
    }).join(', ');

    // Construir FROM (usar tabela principal)
    const mainTable = fields[0]?.table || 'tickets';
    let fromClause = `FROM ${mainTable}`;

    // Adicionar JOINs necessários
    const tables = new Set(fields.map(f => f.table));
    const joins: string[] = [];

    if (tables.has('tickets') && tables.has('users')) {
      joins.push('LEFT JOIN users ON tickets.user_id = users.id');
    }
    if (tables.has('tickets') && tables.has('ticket_categories')) {
      joins.push('LEFT JOIN ticket_categories ON tickets.category_id = ticket_categories.id');
    }
    if (tables.has('tickets') && tables.has('users') && tables.has('attendants')) {
      joins.push('LEFT JOIN users attendants ON tickets.attendant_id = attendants.id');
    }

    if (joins.length > 0) {
      fromClause += ' ' + joins.join(' ');
    }

    // Construir WHERE
    let whereClause = '';
    if (filters && filters.length > 0) {
      const conditions = filters.map(filter => {
        const { table, column, operator, value } = filter;
        if (operator === 'BETWEEN') {
          return `${table}.${column} BETWEEN '${value[0]}' AND '${value[1]}'`;
        } else if (operator === 'IN') {
          const values = Array.isArray(value) ? value.map(v => `'${v}'`).join(', ') : `'${value}'`;
          return `${table}.${column} IN (${values})`;
        } else if (operator === 'LIKE') {
          return `${table}.${column} LIKE '%${value}%'`;
        } else {
          return `${table}.${column} ${operator} '${value}'`;
        }
      });
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Construir GROUP BY
    let groupByClause = '';
    if (groupBy && groupBy.length > 0) {
      groupByClause = 'GROUP BY ' + groupBy.join(', ');
    }

    // Construir ORDER BY
    let orderByClause = '';
    if (orderBy && orderBy.length > 0) {
      const orderFields = orderBy.map(order => `${order.column} ${order.direction}`);
      orderByClause = 'ORDER BY ' + orderFields.join(', ');
    }

    // Construir LIMIT
    let limitClause = '';
    if (limit && limit > 0) {
      limitClause = `LIMIT ${limit}`;
    }

    // Montar query final
    const query = [
      'SELECT',
      selectFields,
      fromClause,
      whereClause,
      groupByClause,
      orderByClause,
      limitClause
    ].filter(Boolean).join('\n');

    logger.info('Query personalizada gerada:', query);
    return query;
  }

  // Executar relatório personalizado
  static async executeCustomReport(config: CustomReportConfig): Promise<any[]> {
    try {
      logger.info('=== DEBUG CUSTOM REPORT SERVICE ===');
      logger.info('Config received:', JSON.stringify(config, null, 2));
      logger.info('Config type:', typeof config);
      logger.info('Config keys:', Object.keys(config));
      logger.info('Has fields?', 'fields' in config);
      logger.info('Fields value:', config.fields);
      logger.info('Fields type:', typeof config.fields);
      logger.info('Fields is array?', Array.isArray(config.fields));
      logger.info('Fields length:', config.fields ? config.fields.length : 'undefined');
      
      const query = this.generateQuery(config);
      logger.info('Query generated:', query);
      
      const results = await dbAll(query);
      logger.info(`Relatório personalizado executado: ${results.length} registros encontrados`);
      return results;
    } catch (error) {
      logger.error('Erro ao executar relatório personalizado:', error);
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error('Erro ao executar relatório personalizado: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }

  // Obter campos disponíveis para relatórios personalizados
  static getAvailableFields(): CustomField[] {
    return [
      // ===== CAMPOS DE TICKETS =====
      { name: 'tickets_id', label: 'ID do Chamado', type: 'number', table: 'tickets', column: 'id' },
      { name: 'tickets_subject', label: 'Assunto do Chamado', type: 'string', table: 'tickets', column: 'subject' },
      { name: 'tickets_description', label: 'Descrição do Chamado', type: 'string', table: 'tickets', column: 'description' },
      { name: 'tickets_status', label: 'Status do Chamado', type: 'string', table: 'tickets', column: 'status' },
      { name: 'tickets_priority', label: 'Prioridade do Chamado', type: 'string', table: 'tickets', column: 'priority' },
      { name: 'tickets_created_at', label: 'Data de Criação', type: 'date', table: 'tickets', column: 'created_at' },
      { name: 'tickets_updated_at', label: 'Data de Atualização', type: 'date', table: 'tickets', column: 'updated_at' },
      { name: 'tickets_closed_at', label: 'Data de Fechamento', type: 'date', table: 'tickets', column: 'closed_at' },
      { name: 'tickets_reopened_at', label: 'Data de Reabertura', type: 'date', table: 'tickets', column: 'reopened_at' },
      { name: 'tickets_sla_first_response', label: 'SLA Primeira Resposta', type: 'date', table: 'tickets', column: 'sla_first_response' },
      { name: 'tickets_sla_resolution', label: 'SLA Resolução', type: 'date', table: 'tickets', column: 'sla_resolution' },
      
      // ===== CAMPOS DE USUÁRIOS =====
      { name: 'users_id', label: 'ID do Usuário', type: 'number', table: 'users', column: 'id' },
      { name: 'users_name', label: 'Nome do Usuário', type: 'string', table: 'users', column: 'name' },
      { name: 'users_email', label: 'Email do Usuário', type: 'string', table: 'users', column: 'email' },
      { name: 'users_role', label: 'Função do Usuário', type: 'string', table: 'users', column: 'role' },
      { name: 'users_is_active', label: 'Usuário Ativo', type: 'boolean', table: 'users', column: 'is_active' },
      { name: 'users_created_at', label: 'Data de Criação do Usuário', type: 'date', table: 'users', column: 'created_at' },
      { name: 'users_updated_at', label: 'Data de Atualização do Usuário', type: 'date', table: 'users', column: 'updated_at' },
      
      // ===== CAMPOS DE CATEGORIAS =====
      { name: 'ticket_categories_id', label: 'ID da Categoria', type: 'number', table: 'ticket_categories', column: 'id' },
      { name: 'ticket_categories_name', label: 'Nome da Categoria', type: 'string', table: 'ticket_categories', column: 'name' },
      { name: 'ticket_categories_description', label: 'Descrição da Categoria', type: 'string', table: 'ticket_categories', column: 'description' },
      { name: 'ticket_categories_sla_first_response_hours', label: 'SLA Primeira Resposta (horas)', type: 'number', table: 'ticket_categories', column: 'sla_first_response_hours' },
      { name: 'ticket_categories_sla_resolution_hours', label: 'SLA Resolução (horas)', type: 'number', table: 'ticket_categories', column: 'sla_resolution_hours' },
      { name: 'ticket_categories_is_active', label: 'Categoria Ativa', type: 'boolean', table: 'ticket_categories', column: 'is_active' },
      { name: 'ticket_categories_created_at', label: 'Data de Criação da Categoria', type: 'date', table: 'ticket_categories', column: 'created_at' },
      { name: 'ticket_categories_updated_at', label: 'Data de Atualização da Categoria', type: 'date', table: 'ticket_categories', column: 'updated_at' },
      
      // ===== CAMPOS DE MENSAGENS =====
      { name: 'ticket_messages_id', label: 'ID da Mensagem', type: 'number', table: 'ticket_messages', column: 'id' },
      { name: 'ticket_messages_message', label: 'Conteúdo da Mensagem', type: 'string', table: 'ticket_messages', column: 'message' },
      { name: 'ticket_messages_is_internal', label: 'Mensagem Interna', type: 'boolean', table: 'ticket_messages', column: 'is_internal' },
      { name: 'ticket_messages_created_at', label: 'Data da Mensagem', type: 'date', table: 'ticket_messages', column: 'created_at' },
      
      // ===== CAMPOS DE HISTÓRICO =====
      { name: 'ticket_history_id', label: 'ID do Histórico', type: 'number', table: 'ticket_history', column: 'id' },
      { name: 'ticket_history_message', label: 'Mensagem do Histórico', type: 'string', table: 'ticket_history', column: 'message' },
      { name: 'ticket_history_attachment', label: 'Anexo do Histórico', type: 'string', table: 'ticket_history', column: 'attachment' },
      { name: 'ticket_history_created_at', label: 'Data do Histórico', type: 'date', table: 'ticket_history', column: 'created_at' },
      
      // ===== CAMPOS DE ANEXOS =====
      { name: 'attachments_id', label: 'ID do Anexo', type: 'number', table: 'attachments', column: 'id' },
      { name: 'attachments_original_name', label: 'Nome Original do Arquivo', type: 'string', table: 'attachments', column: 'original_name' },
      { name: 'attachments_file_name', label: 'Nome do Arquivo', type: 'string', table: 'attachments', column: 'file_name' },
      { name: 'attachments_file_size', label: 'Tamanho do Arquivo', type: 'number', table: 'attachments', column: 'file_size' },
      { name: 'attachments_mime_type', label: 'Tipo MIME', type: 'string', table: 'attachments', column: 'mime_type' },
      { name: 'attachments_created_at', label: 'Data do Anexo', type: 'date', table: 'attachments', column: 'created_at' },
      
      // ===== CAMPOS DE NOTIFICAÇÕES =====
      { name: 'notifications_id', label: 'ID da Notificação', type: 'number', table: 'notifications', column: 'id' },
      { name: 'notifications_type', label: 'Tipo da Notificação', type: 'string', table: 'notifications', column: 'type' },
      { name: 'notifications_title', label: 'Título da Notificação', type: 'string', table: 'notifications', column: 'title' },
      { name: 'notifications_message', label: 'Mensagem da Notificação', type: 'string', table: 'notifications', column: 'message' },
      { name: 'notifications_is_read', label: 'Notificação Lida', type: 'boolean', table: 'notifications', column: 'is_read' },
      { name: 'notifications_created_at', label: 'Data da Notificação', type: 'date', table: 'notifications', column: 'created_at' },
      
      // ===== CAMPOS DE RELATÓRIOS =====
      { name: 'reports_id', label: 'ID do Relatório', type: 'number', table: 'reports', column: 'id' },
      { name: 'reports_name', label: 'Nome do Relatório', type: 'string', table: 'reports', column: 'name' },
      { name: 'reports_description', label: 'Descrição do Relatório', type: 'string', table: 'reports', column: 'description' },
      { name: 'reports_type', label: 'Tipo do Relatório', type: 'string', table: 'reports', column: 'type' },
      { name: 'reports_is_active', label: 'Relatório Ativo', type: 'boolean', table: 'reports', column: 'is_active' },
      { name: 'reports_created_at', label: 'Data de Criação do Relatório', type: 'date', table: 'reports', column: 'created_at' },
      
      // ===== CAMPOS DE EXECUÇÕES =====
      { name: 'report_executions_id', label: 'ID da Execução', type: 'number', table: 'report_executions', column: 'id' },
      { name: 'report_executions_status', label: 'Status da Execução', type: 'string', table: 'report_executions', column: 'status' },
      { name: 'report_executions_started_at', label: 'Início da Execução', type: 'date', table: 'report_executions', column: 'started_at' },
      { name: 'report_executions_completed_at', label: 'Conclusão da Execução', type: 'date', table: 'report_executions', column: 'completed_at' },
      { name: 'report_executions_error_message', label: 'Mensagem de Erro', type: 'string', table: 'report_executions', column: 'error_message' },
      
      // ===== CAMPOS AGREGADOS =====
      { name: 'total_tickets', label: 'Total de Chamados', type: 'number', table: 'tickets', column: 'id', aggregation: 'count' },
      { name: 'total_messages', label: 'Total de Mensagens', type: 'number', table: 'ticket_messages', column: 'id', aggregation: 'count' },
      { name: 'total_attachments', label: 'Total de Anexos', type: 'number', table: 'attachments', column: 'id', aggregation: 'count' },
      { name: 'total_notifications', label: 'Total de Notificações', type: 'number', table: 'notifications', column: 'id', aggregation: 'count' },
      { name: 'total_users', label: 'Total de Usuários', type: 'number', table: 'users', column: 'id', aggregation: 'count' },
      { name: 'total_categories', label: 'Total de Categorias', type: 'number', table: 'ticket_categories', column: 'id', aggregation: 'count' },
      { name: 'avg_file_size', label: 'Tamanho Médio dos Arquivos', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'avg' },
      { name: 'max_file_size', label: 'Maior Arquivo', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'max' },
      { name: 'min_file_size', label: 'Menor Arquivo', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'min' }
    ];
  }

  // Obter tabelas disponíveis
  static getAvailableTables(): string[] {
    return [
      'tickets',
      'users', 
      'ticket_categories',
      'ticket_messages',
      'ticket_history',
      'attachments',
      'ticket_attachments',
      'notifications',
      'reports',
      'report_executions',
      'report_schedules',
      'category_assignments',
      'system_config'
    ];
  }

  // Validar configuração do relatório personalizado
  static validateConfig(config: CustomReportConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.fields || config.fields.length === 0) {
      errors.push('Pelo menos um campo deve ser selecionado');
    }

    if (config.fields) {
      const fieldNames = new Set();
      for (const field of config.fields) {
        if (fieldNames.has(field.name)) {
          errors.push(`Campo duplicado: ${field.name}`);
        }
        fieldNames.add(field.name);

        if (!field.table || !field.column) {
          errors.push(`Campo ${field.name} deve ter tabela e coluna definidas`);
        }
      }
    }

    if (config.groupBy && config.groupBy.length > 0) {
      const fieldNames = config.fields.map(f => f.name);
      for (const groupField of config.groupBy) {
        if (!fieldNames.includes(groupField)) {
          errors.push(`Campo de agrupamento ${groupField} não está nos campos selecionados`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
