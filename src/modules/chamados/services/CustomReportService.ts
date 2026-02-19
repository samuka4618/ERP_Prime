import { dbAll } from '../../../core/database/connection';
import { logger } from '../../../shared/utils/logger';

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

/** Regra de JOIN: tabela origem -> tabela destino com condição (usa {from} e {to} como aliases) */
interface JoinRule {
  fromTable: string;
  toTable: string;
  condition: string; // ex: "{from}.user_id = {to}.id"
}

export class CustomReportService {
  // Aliases fixos para evitar "ambiguous column name"
  private static readonly TABLE_ALIASES: Record<string, string> = {
    tickets: 't',
    users: 'u',
    ticket_categories: 'tc',
    attendants: 'att',
    ticket_messages: 'tm',
    ticket_history: 'th',
    attachments: 'a',
    notifications: 'n',
    reports: 'r',
    report_executions: 're',
    solicitacoes_compra: 's',
    solicitacoes_compra_itens: 'sci',
    orcamentos: 'o',
    orcamentos_itens: 'oi',
    aprovacoes_solicitacao: 'aps',
    aprovacoes_orcamento: 'apo',
    solicitacoes_compra_historico: 'sch',
    compras_anexos: 'ca',
    compradores: 'c',
    aprovadores: 'ap'
  };

  /** Ordem de prioridade para escolher a tabela principal (primeira que existir nos campos) */
  private static readonly MAIN_TABLE_PRIORITY: string[] = [
    'tickets',
    'solicitacoes_compra',
    'orcamentos',
    'reports',
    'report_executions',
    'users',
    'ticket_categories',
    'ticket_messages',
    'ticket_history',
    'attachments',
    'notifications',
    'solicitacoes_compra_itens',
    'orcamentos_itens',
    'aprovacoes_solicitacao',
    'aprovacoes_orcamento',
    'solicitacoes_compra_historico',
    'compras_anexos',
    'compradores',
    'aprovadores'
  ];

  /** Regras de JOIN: de qual tabela para qual, com condição. Ordem permite multi-hop (ex: s -> aps -> ap). */
  private static readonly JOIN_RULES: JoinRule[] = [
    // Grafo tickets
    { fromTable: 'tickets', toTable: 'users', condition: '{from}.user_id = {to}.id' },
    { fromTable: 'tickets', toTable: 'ticket_categories', condition: '{from}.category_id = {to}.id' },
    { fromTable: 'tickets', toTable: 'attendants', condition: '{from}.attendant_id = {to}.id' },
    { fromTable: 'tickets', toTable: 'ticket_messages', condition: '{from}.id = {to}.ticket_id' },
    { fromTable: 'tickets', toTable: 'ticket_history', condition: '{from}.id = {to}.ticket_id' },
    { fromTable: 'tickets', toTable: 'attachments', condition: '{from}.id = {to}.ticket_id' },
    { fromTable: 'tickets', toTable: 'notifications', condition: '{from}.id = {to}.ticket_id' },
    // Grafo solicitacoes_compra
    { fromTable: 'solicitacoes_compra', toTable: 'users', condition: '{from}.solicitante_id = {to}.id' },
    { fromTable: 'solicitacoes_compra', toTable: 'compradores', condition: '{from}.comprador_id = {to}.id' },
    { fromTable: 'solicitacoes_compra', toTable: 'solicitacoes_compra_itens', condition: '{from}.id = {to}.solicitacao_id' },
    { fromTable: 'solicitacoes_compra', toTable: 'orcamentos', condition: '{from}.id = {to}.solicitacao_id' },
    { fromTable: 'solicitacoes_compra', toTable: 'aprovacoes_solicitacao', condition: '{from}.id = {to}.solicitacao_id' },
    { fromTable: 'solicitacoes_compra', toTable: 'solicitacoes_compra_historico', condition: '{from}.id = {to}.solicitacao_id' },
    { fromTable: 'solicitacoes_compra', toTable: 'compras_anexos', condition: '{from}.id = {to}.solicitacao_id' },
    { fromTable: 'aprovacoes_solicitacao', toTable: 'aprovadores', condition: '{from}.aprovador_id = {to}.id' },
    // Grafo orcamentos
    { fromTable: 'orcamentos', toTable: 'solicitacoes_compra', condition: '{from}.solicitacao_id = {to}.id' },
    { fromTable: 'orcamentos', toTable: 'orcamentos_itens', condition: '{from}.id = {to}.orcamento_id' },
    { fromTable: 'orcamentos', toTable: 'aprovacoes_orcamento', condition: '{from}.id = {to}.orcamento_id' },
    { fromTable: 'orcamentos', toTable: 'compras_anexos', condition: '{from}.id = {to}.orcamento_id' },
    { fromTable: 'orcamentos', toTable: 'users', condition: '{from}.criado_por = {to}.id' },
    { fromTable: 'aprovacoes_orcamento', toTable: 'aprovadores', condition: '{from}.aprovador_id = {to}.id' },
    { fromTable: 'aprovacoes_orcamento', toTable: 'users', condition: '{from}.solicitante_id = {to}.id' },
    // Compradores -> users (para relatórios que têm compradores + users)
    { fromTable: 'compradores', toTable: 'users', condition: '{from}.user_id = {to}.id' },
    { fromTable: 'aprovadores', toTable: 'users', condition: '{from}.user_id = {to}.id' },
    // Grafo reports
    { fromTable: 'reports', toTable: 'users', condition: '{from}.created_by = {to}.id' },
    { fromTable: 'reports', toTable: 'report_executions', condition: '{from}.id = {to}.report_id' },
    { fromTable: 'report_executions', toTable: 'reports', condition: '{from}.report_id = {to}.id' },
    { fromTable: 'report_executions', toTable: 'users', condition: '{from}.executed_by = {to}.id' },
    // solicitacoes_compra_historico -> users
    { fromTable: 'solicitacoes_compra_historico', toTable: 'users', condition: '{from}.usuario_id = {to}.id' }
  ];

  /** Tabelas que são “alias” de outra no schema (ex: attendants = users) */
  private static readonly PHYSICAL_TABLE: Record<string, string> = {
    attendants: 'users'
  };

  private static aliasFor(table: string): string {
    return this.TABLE_ALIASES[table] ?? table;
  }

  private static physicalTable(table: string): string {
    return this.PHYSICAL_TABLE[table] ?? table;
  }

  // Gerar query SQL baseada na configuração personalizada
  static generateQuery(config: CustomReportConfig): string {
    const { fields, filters, groupBy, orderBy, limit } = config;
    
    if (!fields?.length) {
      throw new Error('Nenhum campo foi selecionado para o relatório personalizado');
    }
    
    const tables = new Set(fields.map(f => f.table));
    const alias = (table: string) => this.aliasFor(table);

    // SELECT com aliases
    const selectFields = fields.map(field => {
      const al = alias(field.table);
      if (field.aggregation) {
        return `${field.aggregation.toUpperCase()}(${al}.${field.column}) AS ${field.name}`;
      }
      return `${al}.${field.column} AS ${field.name}`;
    }).join(', ');

    // Candidatos a tabela principal (ordem de prioridade, só os que existem no relatório)
    const mainCandidates = this.MAIN_TABLE_PRIORITY.filter(t => tables.has(t));
    if (mainCandidates.length === 0) {
      mainCandidates.push(fields[0]!.table ?? 'tickets');
    }

    let mainTable = '';
    let fromClause = '';
    let joins: string[] = [];
    let missingTables: string[] = [];
    let connected = false;

    for (const candidate of mainCandidates) {
      mainTable = candidate;
      const mainAlias = alias(mainTable);
      const mainPhysical = this.physicalTable(mainTable);
      fromClause = `FROM ${mainPhysical} ${mainAlias}`;

      const reachableFromMain = new Set<string>([mainTable]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const rule of this.JOIN_RULES) {
          if (rule.fromTable !== rule.toTable && reachableFromMain.has(rule.fromTable) && !reachableFromMain.has(rule.toTable)) {
            reachableFromMain.add(rule.toTable);
            changed = true;
          }
        }
      }
      const canReachReportTables = new Set(tables);
      changed = true;
      while (changed) {
        changed = false;
        for (const rule of this.JOIN_RULES) {
          if (rule.fromTable !== rule.toTable && canReachReportTables.has(rule.toTable) && !canReachReportTables.has(rule.fromTable)) {
            canReachReportTables.add(rule.fromTable);
            changed = true;
          }
        }
      }
      const requiredTables = new Set<string>();
      for (const t of reachableFromMain) {
        if (canReachReportTables.has(t)) requiredTables.add(t);
      }

      const addedTables = new Set<string>([mainTable]);
      joins = [];
      changed = true;
      while (changed) {
        changed = false;
        for (const rule of this.JOIN_RULES) {
          if (!addedTables.has(rule.fromTable) || addedTables.has(rule.toTable) || !requiredTables.has(rule.toTable)) continue;
          const fromA = alias(rule.fromTable);
          const toA = alias(rule.toTable);
          const onCondition = rule.condition.replace(/\{from\}/g, fromA).replace(/\{to\}/g, toA);
          const physicalTo = this.physicalTable(rule.toTable);
          joins.push(`LEFT JOIN ${physicalTo} ${toA} ON ${onCondition}`);
          addedTables.add(rule.toTable);
          changed = true;
        }
      }

      missingTables = [...tables].filter(t => !addedTables.has(t));
      if (missingTables.length === 0) {
        connected = true;
        break;
      }
    }

    if (!connected && missingTables.length > 0) {
      const chamados = ['tickets', 'ticket_categories', 'ticket_messages', 'ticket_history', 'attachments', 'notifications', 'attendants'];
      const compras = ['solicitacoes_compra', 'solicitacoes_compra_itens', 'orcamentos', 'orcamentos_itens', 'aprovacoes_solicitacao', 'aprovacoes_orcamento', 'solicitacoes_compra_historico', 'compras_anexos', 'compradores', 'aprovadores'];
      const temChamados = [...tables].some(t => chamados.includes(t));
      const temCompras = [...tables].some(t => compras.includes(t));
      if (temChamados && temCompras) {
        throw new Error(
          'Relatório personalizado: este relatório mistura campos de Chamados (tickets, categorias, mensagens, etc.) e de Compras (solicitações, orçamentos, etc.). ' +
          'Não é possível unir os dois em uma única consulta. Remova os campos de um dos grupos ou crie dois relatórios separados (um para Chamados e outro para Compras).'
        );
      }
      throw new Error(
        `Relatório personalizado: a(s) tabela(s) "${missingTables.join('", "')}" não podem ser ligadas à tabela principal "${mainTable}". ` +
        'Use apenas campos de tabelas relacionadas (ex.: tickets + users, ou solicitacoes_compra + orcamentos).'
      );
    }

    if (joins.length > 0) {
      fromClause += ' ' + joins.join(' ');
    }

    // Construir WHERE (usar alias nas colunas)
    let whereClause = '';
    if (filters && filters.length > 0) {
      const conditions = filters.map(filter => {
        const { table, column, operator, value } = filter;
        const al = alias(table);
        if (operator === 'BETWEEN') {
          return `${al}.${column} BETWEEN '${value[0]}' AND '${value[1]}'`;
        } else if (operator === 'IN') {
          const values = Array.isArray(value) ? value.map(v => `'${v}'`).join(', ') : `'${value}'`;
          return `${al}.${column} IN (${values})`;
        } else if (operator === 'LIKE') {
          return `${al}.${column} LIKE '%${value}%'`;
        } else {
          return `${al}.${column} ${operator} '${value}'`;
        }
      });
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Construir GROUP BY: aceita "table.column" ou nome do campo (ex: users_id)
    let groupByClause = '';
    if (groupBy && groupBy.length > 0) {
      const groupByExpressions = groupBy.map(g => {
        if (g.includes('.')) {
          const [table, col] = g.split('.');
          return `${alias(table)}.${col}`;
        }
        const field = fields.find(f => f.name === g);
        if (field) return `${alias(field.table)}.${field.column}`;
        return g;
      });
      groupByClause = 'GROUP BY ' + groupByExpressions.join(', ');
    }

    // Construir ORDER BY: aceita "table.column" ou nome do campo
    let orderByClause = '';
    if (orderBy && orderBy.length > 0) {
      const orderFields = orderBy.map(order => {
        const col = order.column;
        if (col.includes('.')) {
          const [table, colName] = col.split('.');
          return `${alias(table)}.${colName} ${order.direction}`;
        }
        const field = fields.find(f => f.name === col);
        if (field) return `${alias(field.table)}.${field.column} ${order.direction}`;
        return `${col} ${order.direction}`;
      });
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

  /** Tabelas do grupo Chamados (não podem ser misturadas com Compras no mesmo relatório) */
  private static readonly CHAMADOS_TABLES = new Set([
    'tickets', 'ticket_categories', 'ticket_messages', 'ticket_history', 'attachments', 'notifications', 'attendants'
  ]);
  /** Tabelas do grupo Compras */
  private static readonly COMPRAS_TABLES = new Set([
    'solicitacoes_compra', 'solicitacoes_compra_itens', 'orcamentos', 'orcamentos_itens', 'aprovacoes_solicitacao',
    'aprovacoes_orcamento', 'solicitacoes_compra_historico', 'compras_anexos', 'compradores', 'aprovadores'
  ]);

  /**
   * Valida se os campos do relatório não misturam Chamados e Compras.
   * Use na criação/edição do relatório para impedir salvar configuração inválida.
   */
  static validateNoMixedGraphs(fields: CustomField[]): { valid: boolean; message?: string } {
    if (!fields?.length) return { valid: true };
    const tables = new Set(fields.map(f => f.table));
    const temChamados = [...tables].some(t => this.CHAMADOS_TABLES.has(t));
    const temCompras = [...tables].some(t => this.COMPRAS_TABLES.has(t));
    if (temChamados && temCompras) {
      return {
        valid: false,
        message: 'Não é permitido misturar campos de Chamados (tickets, categorias, mensagens, etc.) com campos de Compras (solicitações, orçamentos, etc.) no mesmo relatório. Escolha apenas um grupo de campos ou crie dois relatórios separados.'
      };
    }
    return { valid: true };
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
      
      // ===== CAMPOS DE SOLICITAÇÕES DE COMPRA =====
      { name: 'solicitacoes_compra_id', label: 'ID da Solicitação', type: 'number', table: 'solicitacoes_compra', column: 'id' },
      { name: 'solicitacoes_compra_numero_solicitacao', label: 'Número da Solicitação', type: 'string', table: 'solicitacoes_compra', column: 'numero_solicitacao' },
      { name: 'solicitacoes_compra_descricao', label: 'Descrição da Solicitação', type: 'string', table: 'solicitacoes_compra', column: 'descricao' },
      { name: 'solicitacoes_compra_centro_custo', label: 'Centro de Custo', type: 'string', table: 'solicitacoes_compra', column: 'centro_custo' },
      { name: 'solicitacoes_compra_justificativa', label: 'Justificativa', type: 'string', table: 'solicitacoes_compra', column: 'justificativa' },
      { name: 'solicitacoes_compra_status', label: 'Status da Solicitação', type: 'string', table: 'solicitacoes_compra', column: 'status' },
      { name: 'solicitacoes_compra_prioridade', label: 'Prioridade', type: 'string', table: 'solicitacoes_compra', column: 'prioridade' },
      { name: 'solicitacoes_compra_valor_total', label: 'Valor Total', type: 'number', table: 'solicitacoes_compra', column: 'valor_total' },
      { name: 'solicitacoes_compra_data_necessidade', label: 'Data de Necessidade', type: 'date', table: 'solicitacoes_compra', column: 'data_necessidade' },
      { name: 'solicitacoes_compra_observacoes', label: 'Observações', type: 'string', table: 'solicitacoes_compra', column: 'observacoes' },
      { name: 'solicitacoes_compra_created_at', label: 'Data de Criação', type: 'date', table: 'solicitacoes_compra', column: 'created_at' },
      { name: 'solicitacoes_compra_updated_at', label: 'Data de Atualização', type: 'date', table: 'solicitacoes_compra', column: 'updated_at' },
      { name: 'solicitacoes_compra_aprovada_em', label: 'Data de Aprovação', type: 'date', table: 'solicitacoes_compra', column: 'aprovada_em' },
      { name: 'solicitacoes_compra_rejeitada_em', label: 'Data de Rejeição', type: 'date', table: 'solicitacoes_compra', column: 'rejeitada_em' },
      
      // ===== CAMPOS DE ITENS DE SOLICITAÇÃO =====
      { name: 'solicitacoes_compra_itens_id', label: 'ID do Item', type: 'number', table: 'solicitacoes_compra_itens', column: 'id' },
      { name: 'solicitacoes_compra_itens_item_numero', label: 'Número do Item', type: 'number', table: 'solicitacoes_compra_itens', column: 'item_numero' },
      { name: 'solicitacoes_compra_itens_descricao', label: 'Descrição do Item', type: 'string', table: 'solicitacoes_compra_itens', column: 'descricao' },
      { name: 'solicitacoes_compra_itens_quantidade', label: 'Quantidade', type: 'number', table: 'solicitacoes_compra_itens', column: 'quantidade' },
      { name: 'solicitacoes_compra_itens_unidade_medida', label: 'Unidade de Medida', type: 'string', table: 'solicitacoes_compra_itens', column: 'unidade_medida' },
      { name: 'solicitacoes_compra_itens_valor_unitario', label: 'Valor Unitário', type: 'number', table: 'solicitacoes_compra_itens', column: 'valor_unitario' },
      { name: 'solicitacoes_compra_itens_valor_total', label: 'Valor Total do Item', type: 'number', table: 'solicitacoes_compra_itens', column: 'valor_total' },
      
      // ===== CAMPOS DE ORÇAMENTOS =====
      { name: 'orcamentos_id', label: 'ID do Orçamento', type: 'number', table: 'orcamentos', column: 'id' },
      { name: 'orcamentos_numero_orcamento', label: 'Número do Orçamento', type: 'string', table: 'orcamentos', column: 'numero_orcamento' },
      { name: 'orcamentos_fornecedor_nome', label: 'Nome do Fornecedor', type: 'string', table: 'orcamentos', column: 'fornecedor_nome' },
      { name: 'orcamentos_fornecedor_cnpj', label: 'CNPJ do Fornecedor', type: 'string', table: 'orcamentos', column: 'fornecedor_cnpj' },
      { name: 'orcamentos_fornecedor_contato', label: 'Contato do Fornecedor', type: 'string', table: 'orcamentos', column: 'fornecedor_contato' },
      { name: 'orcamentos_valor_total', label: 'Valor Total do Orçamento', type: 'number', table: 'orcamentos', column: 'valor_total' },
      { name: 'orcamentos_status', label: 'Status do Orçamento', type: 'string', table: 'orcamentos', column: 'status' },
      { name: 'orcamentos_data_validade', label: 'Data de Validade', type: 'date', table: 'orcamentos', column: 'data_validade' },
      { name: 'orcamentos_condicoes_pagamento', label: 'Condições de Pagamento', type: 'string', table: 'orcamentos', column: 'condicoes_pagamento' },
      { name: 'orcamentos_prazo_entrega', label: 'Prazo de Entrega', type: 'string', table: 'orcamentos', column: 'prazo_entrega' },
      { name: 'orcamentos_observacoes', label: 'Observações do Orçamento', type: 'string', table: 'orcamentos', column: 'observacoes' },
      { name: 'orcamentos_created_at', label: 'Data de Criação do Orçamento', type: 'date', table: 'orcamentos', column: 'created_at' },
      { name: 'orcamentos_updated_at', label: 'Data de Atualização do Orçamento', type: 'date', table: 'orcamentos', column: 'updated_at' },
      { name: 'orcamentos_aprovado_em', label: 'Data de Aprovação do Orçamento', type: 'date', table: 'orcamentos', column: 'aprovado_em' },
      { name: 'orcamentos_rejeitado_em', label: 'Data de Rejeição do Orçamento', type: 'date', table: 'orcamentos', column: 'rejeitado_em' },
      
      // ===== CAMPOS DE ITENS DE ORÇAMENTO =====
      { name: 'orcamentos_itens_id', label: 'ID do Item do Orçamento', type: 'number', table: 'orcamentos_itens', column: 'id' },
      { name: 'orcamentos_itens_descricao', label: 'Descrição do Item do Orçamento', type: 'string', table: 'orcamentos_itens', column: 'descricao' },
      { name: 'orcamentos_itens_quantidade', label: 'Quantidade do Item', type: 'number', table: 'orcamentos_itens', column: 'quantidade' },
      { name: 'orcamentos_itens_unidade_medida', label: 'Unidade de Medida do Item', type: 'string', table: 'orcamentos_itens', column: 'unidade_medida' },
      { name: 'orcamentos_itens_valor_unitario', label: 'Valor Unitário do Item', type: 'number', table: 'orcamentos_itens', column: 'valor_unitario' },
      { name: 'orcamentos_itens_valor_total', label: 'Valor Total do Item', type: 'number', table: 'orcamentos_itens', column: 'valor_total' },
      
      // ===== CAMPOS DE APROVAÇÕES =====
      { name: 'aprovacoes_solicitacao_id', label: 'ID da Aprovação de Solicitação', type: 'number', table: 'aprovacoes_solicitacao', column: 'id' },
      { name: 'aprovacoes_solicitacao_nivel_aprovacao', label: 'Nível de Aprovação', type: 'number', table: 'aprovacoes_solicitacao', column: 'nivel_aprovacao' },
      { name: 'aprovacoes_solicitacao_status', label: 'Status da Aprovação', type: 'string', table: 'aprovacoes_solicitacao', column: 'status' },
      { name: 'aprovacoes_solicitacao_observacoes', label: 'Observações da Aprovação', type: 'string', table: 'aprovacoes_solicitacao', column: 'observacoes' },
      { name: 'aprovacoes_solicitacao_aprovado_em', label: 'Data de Aprovação', type: 'date', table: 'aprovacoes_solicitacao', column: 'aprovado_em' },
      { name: 'aprovacoes_solicitacao_created_at', label: 'Data de Criação da Aprovação', type: 'date', table: 'aprovacoes_solicitacao', column: 'created_at' },
      
      { name: 'aprovacoes_orcamento_id', label: 'ID da Aprovação de Orçamento', type: 'number', table: 'aprovacoes_orcamento', column: 'id' },
      { name: 'aprovacoes_orcamento_nivel_aprovacao', label: 'Nível de Aprovação do Orçamento', type: 'number', table: 'aprovacoes_orcamento', column: 'nivel_aprovacao' },
      { name: 'aprovacoes_orcamento_status', label: 'Status da Aprovação do Orçamento', type: 'string', table: 'aprovacoes_orcamento', column: 'status' },
      { name: 'aprovacoes_orcamento_observacoes', label: 'Observações da Aprovação do Orçamento', type: 'string', table: 'aprovacoes_orcamento', column: 'observacoes' },
      { name: 'aprovacoes_orcamento_aprovado_em', label: 'Data de Aprovação do Orçamento', type: 'date', table: 'aprovacoes_orcamento', column: 'aprovado_em' },
      
      // ===== CAMPOS DE HISTÓRICO DE COMPRAS =====
      { name: 'solicitacoes_compra_historico_id', label: 'ID do Histórico', type: 'number', table: 'solicitacoes_compra_historico', column: 'id' },
      { name: 'solicitacoes_compra_historico_acao', label: 'Ação Realizada', type: 'string', table: 'solicitacoes_compra_historico', column: 'acao' },
      { name: 'solicitacoes_compra_historico_descricao', label: 'Descrição do Histórico', type: 'string', table: 'solicitacoes_compra_historico', column: 'descricao' },
      { name: 'solicitacoes_compra_historico_created_at', label: 'Data do Histórico', type: 'date', table: 'solicitacoes_compra_historico', column: 'created_at' },
      
      // ===== CAMPOS DE ANEXOS DE COMPRAS =====
      { name: 'compras_anexos_id', label: 'ID do Anexo de Compra', type: 'number', table: 'compras_anexos', column: 'id' },
      { name: 'compras_anexos_tipo', label: 'Tipo do Anexo', type: 'string', table: 'compras_anexos', column: 'tipo' },
      { name: 'compras_anexos_nome_original', label: 'Nome Original do Arquivo', type: 'string', table: 'compras_anexos', column: 'nome_original' },
      { name: 'compras_anexos_tamanho', label: 'Tamanho do Arquivo', type: 'number', table: 'compras_anexos', column: 'tamanho' },
      { name: 'compras_anexos_mime_type', label: 'Tipo MIME do Anexo', type: 'string', table: 'compras_anexos', column: 'mime_type' },
      { name: 'compras_anexos_created_at', label: 'Data do Anexo', type: 'date', table: 'compras_anexos', column: 'created_at' },
      
      // ===== CAMPOS DE COMPRADORES E APROVADORES =====
      { name: 'compradores_id', label: 'ID do Comprador', type: 'number', table: 'compradores', column: 'id' },
      { name: 'compradores_is_active', label: 'Comprador Ativo', type: 'boolean', table: 'compradores', column: 'is_active' },
      { name: 'compradores_created_at', label: 'Data de Criação do Comprador', type: 'date', table: 'compradores', column: 'created_at' },
      
      { name: 'aprovadores_id', label: 'ID do Aprovador', type: 'number', table: 'aprovadores', column: 'id' },
      { name: 'aprovadores_nivel_aprovacao', label: 'Nível de Aprovação do Aprovador', type: 'number', table: 'aprovadores', column: 'nivel_aprovacao' },
      { name: 'aprovadores_is_active', label: 'Aprovador Ativo', type: 'boolean', table: 'aprovadores', column: 'is_active' },
      { name: 'aprovadores_created_at', label: 'Data de Criação do Aprovador', type: 'date', table: 'aprovadores', column: 'created_at' },
      
      // ===== CAMPOS AGREGADOS =====
      { name: 'total_tickets', label: 'Total de Chamados', type: 'number', table: 'tickets', column: 'id', aggregation: 'count' },
      { name: 'total_messages', label: 'Total de Mensagens', type: 'number', table: 'ticket_messages', column: 'id', aggregation: 'count' },
      { name: 'total_attachments', label: 'Total de Anexos', type: 'number', table: 'attachments', column: 'id', aggregation: 'count' },
      { name: 'total_notifications', label: 'Total de Notificações', type: 'number', table: 'notifications', column: 'id', aggregation: 'count' },
      { name: 'total_users', label: 'Total de Usuários', type: 'number', table: 'users', column: 'id', aggregation: 'count' },
      { name: 'total_categories', label: 'Total de Categorias', type: 'number', table: 'ticket_categories', column: 'id', aggregation: 'count' },
      { name: 'avg_file_size', label: 'Tamanho Médio dos Arquivos', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'avg' },
      { name: 'max_file_size', label: 'Maior Arquivo', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'max' },
      { name: 'min_file_size', label: 'Menor Arquivo', type: 'number', table: 'attachments', column: 'file_size', aggregation: 'min' },
      
      // ===== CAMPOS AGREGADOS DE COMPRAS =====
      { name: 'total_solicitacoes', label: 'Total de Solicitações', type: 'number', table: 'solicitacoes_compra', column: 'id', aggregation: 'count' },
      { name: 'total_orcamentos', label: 'Total de Orçamentos', type: 'number', table: 'orcamentos', column: 'id', aggregation: 'count' },
      { name: 'sum_valor_total_solicitacoes', label: 'Soma do Valor Total das Solicitações', type: 'number', table: 'solicitacoes_compra', column: 'valor_total', aggregation: 'sum' },
      { name: 'sum_valor_total_orcamentos', label: 'Soma do Valor Total dos Orçamentos', type: 'number', table: 'orcamentos', column: 'valor_total', aggregation: 'sum' },
      { name: 'avg_valor_total_solicitacoes', label: 'Valor Médio das Solicitações', type: 'number', table: 'solicitacoes_compra', column: 'valor_total', aggregation: 'avg' },
      { name: 'avg_valor_total_orcamentos', label: 'Valor Médio dos Orçamentos', type: 'number', table: 'orcamentos', column: 'valor_total', aggregation: 'avg' },
      { name: 'max_valor_total_solicitacoes', label: 'Maior Valor de Solicitação', type: 'number', table: 'solicitacoes_compra', column: 'valor_total', aggregation: 'max' },
      { name: 'min_valor_total_solicitacoes', label: 'Menor Valor de Solicitação', type: 'number', table: 'solicitacoes_compra', column: 'valor_total', aggregation: 'min' }
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
      'system_config',
      'solicitacoes_compra',
      'solicitacoes_compra_itens',
      'orcamentos',
      'orcamentos_itens',
      'aprovacoes_solicitacao',
      'aprovacoes_orcamento',
      'solicitacoes_compra_historico',
      'compras_anexos',
      'compradores',
      'aprovadores'
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
