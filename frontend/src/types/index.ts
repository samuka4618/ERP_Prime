export interface CategoryField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'date' | 'select' | 'file';
  required: boolean;
  placeholder?: string;
  options?: string[];
  description?: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  is_active: boolean;
  custom_fields?: CategoryField[];
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'attendant' | 'admin';
  is_active: boolean;
  // Campos corporativos
  phone?: string;
  department?: string;
  position?: string;
  avatar?: string;
  extension?: string;
  bio?: string;
  linkedin?: string;
  skype?: string;
  hire_date?: string | Date;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  user_id: number;
  attendant_id?: number;
  category_id: number;
  category?: Category;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending_user' | 'pending_third_party' | 'pending_approval' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sla_first_response: string;
  sla_resolution: string;
  custom_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  reopened_at?: string;
  user?: User;
  attendant?: User;
}

export interface TicketHistory {
  id: number;
  ticket_id: number;
  author_id: number;
  message: string;
  attachment?: string;
  created_at: string;
  formatted_date?: string; // Data formatada com timezone do sistema
  author?: User;
}

export interface Notification {
  id: number;
  user_id: number;
  ticket_id: number;
  type: 'status_change' | 'new_message' | 'sla_alert' | 'ticket_reopened';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  ticket?: Ticket;
}

export interface DashboardStats {
  // Estatísticas básicas
  total_tickets: number;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  pending_user_tickets: number;
  pending_third_party_tickets: number;
  pending_approval_tickets: number;
  overdue_first_response_tickets: number;
  overdue_resolution_tickets: number;
  
  // Tempo e SLA
  avg_resolution_time: number;
  sla_violations: number;
  sla_first_response_rate: number;
  sla_resolution_rate: number;
  
  // Usuários e notificações
  total_users: number;
  active_users: number;
  unread_notifications: number;
  
  // Distribuição por categoria e prioridade
  tickets_by_category: Array<{ category_id: number; category_name: string; count: number }>;
  tickets_by_priority: Record<string, number>;
}

export interface CategoryAssignment {
  id: number;
  category_id: number;
  attendant_id: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  category_name?: string;
  attendant_name?: string;
}

export type AssignmentRuleOperator = 'equals' | 'not_equals' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';

export interface AssignmentRuleSummary {
  id: number;
  field_name: string;
  operator: AssignmentRuleOperator;
  value: string;
  attendant_id: number;
  attendant_name?: string;
  priority: number;
}

export interface AssignmentSummary {
  category: {
    id: number;
    name: string;
    description: string;
    custom_fields?: CategoryField[];
  };
  assigned_attendants: Array<{
    id: number;
    name: string;
  }>;
  available_attendants: Array<{
    id: number;
    name: string;
  }>;
  assignment_rules?: AssignmentRuleSummary[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateTicketRequest {
  category_id: number;
  subject: string;
  description: string;
  priority: string;
  custom_data?: Record<string, any>;
}


export interface CreateTicketHistoryRequest {
  message: string;
  attachment?: File;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  message_id?: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// =============================================
// INTERFACES PARA CADASTRO DE CLIENTES
// =============================================

export interface ClientRegistration {
  id: number;
  user_id: number;
  nome_cliente: string;
  nome_fantasia?: string;
  cnpj: string;
  email: string;
  ramo_atividade_id: number;
  ramo_atividade_nome?: string;
  vendedor_id: number;
  vendedor_nome?: string;
  gestor_id: number;
  gestor_nome?: string;
  codigo_carteira_id: number;
  codigo_carteira_nome?: string;
  prazo_desejado?: number;
  periodicidade_pedido?: string;
  valor_estimado_pedido?: number;
  lista_preco_id: number;
  lista_preco_nome?: string;
  forma_contato?: string;
  imagem_externa_path: string;
  imagem_interna_path: string;
  anexos_path?: string;
  whatsapp_cliente?: string;
  rede_social?: string;
  link_google_maps?: string;
  forma_pagamento_desejada_id: number;
  forma_pagamento_desejada_nome?: string;
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
  // Campos do Atak
  atak_cliente_id?: number;
  atak_resposta_json?: string;
  atak_data_cadastro?: string;
  atak_erro?: string;
  // Campos financeiros (definidos após análise)
  condicao_pagamento_id?: string;
  limite_credito?: number;
  dados_financeiros_enviados_atak?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientRegistrationHistory {
  id: number;
  registration_id: number;
  user_id: number;
  user_name?: string;
  status_anterior?: string;
  status_novo: string;
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
  created_at: string;
}

export interface ClientConfigOption {
  id: number;
  nome: string;
  descricao?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientConfigOptions {
  ramo_atividade: ClientConfigOption[];
  vendedor: ClientConfigOption[];
  gestor: ClientConfigOption[];
  codigo_carteira: ClientConfigOption[];
  lista_preco: ClientConfigOption[];
  forma_pagamento_desejada: ClientConfigOption[];
  condicao_pagamento: ClientConfigOption[];
}

export interface CreateClientRegistrationRequest {
  nome_cliente: string;
  nome_fantasia?: string;
  cnpj: string;
  email: string;
  ramo_atividade_id: number;
  vendedor_id: number;
  gestor_id: number;
  codigo_carteira_id: number;
  lista_preco_id: number;
  forma_pagamento_desejada_id: number;
  prazo_desejado?: number;
  periodicidade_pedido?: string;
  valor_estimado_pedido?: number;
  forma_contato?: string;
  whatsapp_cliente?: string;
  rede_social?: string;
  link_google_maps?: string;
  imagem_externa: File;
  imagem_interna: File;
  anexos?: File[];
}

export interface UpdateClientRegistrationStatusRequest {
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
}

export interface ClientRegistrationFilters {
  status?: string;
  user_id?: number;
  cnpj?: string;
  nome_cliente?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export interface CreateClientConfigRequest {
  nome: string;
  descricao?: string;
}

export interface UpdateClientConfigRequest {
  nome?: string;
  descricao?: string;
  is_active?: boolean;
}

export type ConfigType = 'ramo_atividade' | 'vendedor' | 'gestor' | 'codigo_carteira' | 'lista_preco' | 'forma_pagamento_desejada' | 'condicao_pagamento';

// Tipos para análise de crédito
export interface AnaliseCredito {
  empresa_id: number;
  cnpj: string;
  inscricao_estadual?: string;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cnpj?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    longitude?: number;
    latitude?: number;
  };
  contato?: {
    telefones?: string[];
    emails?: string[];
  };
  ocorrencias?: {
    score_pj?: number;
    historico_scr?: number;
    historico_pagamentos_positivo?: number;
    limite_credito_pj?: number;
    quadro_administrativo?: number;
    consultas_realizadas?: number;
    gasto_financeiro_estimado?: number;
    controle_societario?: number;
  };
  score_credito?: {
    score?: number;
    risco?: string;
    probabilidade_inadimplencia?: number;
    limite_credito_valor?: number;
    gasto_financeiro_estimado_valor?: number;
  };
  historico_pagamento?: {
    compromissos_ativos?: string;
    contratos_ativos?: number;
    credores?: number;
    parcelas_a_vencer_percentual?: number;
    parcelas_pagas_percentual?: number;
    parcelas_abertas_percentual?: number;
    contratos_pagos?: string;
    contratos_abertos?: string;
    uso_cheque_especial?: boolean;
  };
  scr?: {
    quantidade_operacoes?: number;
    inicio_relacionamento?: string;
    valor_contratado?: string;
    instituicoes?: number;
    carteira_ativa_total?: string;
    vencimento_ultima_parcela?: string;
    garantias_quantidade_maxima?: number;
    tipos_garantias?: string[];
  };
  socios?: Array<{
    cpf: string;
    nome: string;
    entrada?: string;
    participacao?: number;
    valor_participacao?: number;
    percentual_participacao?: number;
    cargo?: string;
  }>;
  quadro_administrativo?: Array<{
    cpf: string;
    nome: string;
    cargo?: string;
    eleito_em?: string;
  }>;
  consultas_realizadas?: Array<{
    data_hora?: string;
    associado?: string;
    cidade?: string;
    origem?: string;
  }>;
}
