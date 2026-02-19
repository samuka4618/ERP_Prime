export enum UserRole {
  USER = 'user',
  ATTENDANT = 'attendant',
  ADMIN = 'admin'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_USER = 'pending_user',
  PENDING_THIRD_PARTY = 'pending_third_party',
  PENDING_APPROVAL = 'pending_approval',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  OVERDUE_FIRST_RESPONSE = 'overdue_first_response',
  OVERDUE_RESOLUTION = 'overdue_resolution'
}

// Removido enum TicketCategory - agora usamos tabela dinâmica

export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CategoryField {
  id: string; // ID único do campo
  name: string; // Nome interno do campo (ex: 'payment_data', 'client_info')
  label: string; // Label exibido no formulário
  type: 'text' | 'textarea' | 'number' | 'email' | 'date' | 'select' | 'file';
  required: boolean;
  placeholder?: string;
  options?: string[]; // Para campos do tipo select
  description?: string; // Descrição/ajuda do campo
}

export interface Category {
  id: number;
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  is_active: boolean;
  custom_fields?: CategoryField[]; // Campos customizados do formulário
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Ticket {
  id: number;
  user_id: number;
  attendant_id?: number;
  category_id: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sla_first_response: Date | string;
  sla_resolution: Date | string;
  custom_data?: Record<string, any>; // Dados dos campos customizados
  created_at: Date | string;
  updated_at: Date | string;
  closed_at?: Date | string;
  reopened_at?: Date | string;
  user?: User;
  attendant?: User;
  category?: Category;
}

export interface TicketHistory {
  id: number;
  ticket_id: number;
  author_id: number;
  message: string;
  attachment?: string;
  created_at: Date | string;
  formatted_date?: string; // Data formatada com timezone do sistema
  author?: User;
}

export interface TicketAttachment {
  id: number;
  ticket_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  path: string;
  uploaded_by: number;
  created_at: Date;
  uploader?: User;
}

export interface Notification {
  id: number;
  user_id: number;
  ticket_id: number;
  type: 'status_change' | 'new_message' | 'sla_alert' | 'ticket_reopened';
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
  user?: User;
  ticket?: Ticket;
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
  updated_at: Date | string;
  // Propriedades específicas do sistema
  sla_first_response_hours?: number;
  sla_resolution_hours?: number;
  reopen_days?: number;
  max_file_size?: number;
  allowed_file_types?: string;
  email_notifications?: boolean;
  system_name?: string;
  system_version?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateTicketRequest {
  category_id: number;
  subject: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  custom_data?: Record<string, any>; // Dados dos campos customizados
}

export interface CreateCategoryRequest {
  name: string;
  description: string;
  sla_first_response_hours: number;
  sla_resolution_hours: number;
  is_active?: boolean;
  custom_fields?: CategoryField[]; // Campos customizados do formulário
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  sla_first_response_hours?: number;
  sla_resolution_hours?: number;
  is_active?: boolean;
  custom_fields?: CategoryField[]; // Campos customizados do formulário
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  status?: TicketStatus;
  category_id?: number;
  priority?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DashboardStats {
  total_tickets: number;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  avg_resolution_time: number;
  sla_violations: number;
  tickets_by_category: Array<{
    category_id: number;
    category_name: string;
    total_tickets: number;
  }>;
  tickets_by_priority: Record<string, number>;
  tickets_by_attendant: Array<{
    attendant_id: number;
    attendant_name: string;
    total_tickets: number;
    resolved_tickets: number;
  }>;
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
  created_at: Date;
}

export interface CreateAttachmentRequest {
  ticket_id: number;
  message_id?: number;
  user_id: number;
  original_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  attendantId?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

// Tipos para Relatórios
export enum ReportType {
  SLA_PERFORMANCE = 'sla_performance',
  TICKET_VOLUME = 'ticket_volume',
  ATTENDANT_PERFORMANCE = 'attendant_performance',
  CATEGORY_ANALYSIS = 'category_analysis',
  TICKETS_BY_ATTENDANT = 'tickets_by_attendant',
  GENERAL_TICKETS = 'general_tickets',
  CUSTOM = 'custom'
}

export enum ReportFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export enum ReportStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Report {
  id: number;
  name: string;
  description?: string;
  type: ReportType;
  parameters: string; // JSON string
  custom_fields?: string; // JSON string com campos personalizados
  custom_query?: string; // SQL query personalizada
  created_by: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  creator?: User;
}

export interface ReportExecution {
  id: number;
  report_id: number;
  executed_by: number;
  status: ReportStatus;
  parameters: string; // JSON string
  result_data?: string; // JSON string
  file_path?: string;
  error_message?: string;
  started_at: Date | string;
  completed_at?: Date | string;
  report?: Report;
  executor?: User;
}

export interface ReportSchedule {
  id: number;
  report_id: number;
  name: string;
  frequency: ReportFrequency;
  day_of_week?: number; // 0-6 para weekly
  day_of_month?: number; // 1-31 para monthly
  time: string; // HH:MM formato 24h
  recipients: string; // JSON string com emails
  is_active: boolean;
  last_executed?: Date | string;
  next_execution?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  report?: Report;
}

export interface CreateReportRequest {
  name: string;
  description?: string;
  type: ReportType;
  parameters: Record<string, any>;
  custom_fields?: string; // JSON string com campos personalizados
  custom_query?: string; // SQL query personalizada
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  parameters?: Record<string, any>;
  is_active?: boolean;
}

export interface CreateReportScheduleRequest {
  report_id: number;
  name: string;
  frequency: ReportFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time: string;
  recipients: string[];
}

export interface ReportParameters {
  start_date: string;
  end_date: string;
  category_ids?: number[];
  attendant_ids?: number[];
  user_ids?: number[];
  status?: TicketStatus[];
  priority?: string[];
  group_by?: string[];
  include_charts?: boolean;
  export_format?: 'json' | 'csv' | 'pdf' | 'excel';
}

// Interfaces para dados de relatórios específicos
export interface SlaPerformanceData {
  total_tickets: number;
  sla_first_response_violations: number;
  sla_resolution_violations: number;
  sla_first_response_rate: number;
  sla_resolution_rate: number;
  avg_first_response_time: number;
  avg_resolution_time: number;
  sla_by_category: Array<{
    category_id: number;
    category_name: string;
    total_tickets: number;
    sla_violations: number;
    sla_rate: number;
    avg_response_time: number;
    avg_resolution_time: number;
  }>;
  sla_by_attendant: Array<{
    attendant_id: number;
    attendant_name: string;
    total_tickets: number;
    sla_violations: number;
    sla_rate: number;
    avg_response_time: number;
    avg_resolution_time: number;
  }>;
  sla_trend: Array<{
    date: string;
    sla_rate: number;
    total_tickets: number;
    violations: number;
  }>;
}

export interface TicketVolumeData {
  total_tickets: number;
  tickets_by_status: Record<string, number>;
  tickets_by_priority: Record<string, number>;
  tickets_by_category: Array<{
    category_id: number;
    category_name: string;
    total_tickets: number;
    percentage: number;
  }>;
  tickets_by_attendant: Array<{
    attendant_id: number;
    attendant_name: string;
    total_tickets: number;
    resolved_tickets: number;
    pending_tickets: number;
  }>;
  volume_trend: Array<{
    date: string;
    total_tickets: number;
    created_tickets: number;
    resolved_tickets: number;
    closed_tickets: number;
  }>;
  peak_hours: Array<{
    hour: number;
    ticket_count: number;
  }>;
}

export interface AttendantPerformanceData {
  total_attendants: number;
  performance_summary: {
    avg_tickets_per_attendant: number;
    avg_resolution_time: number;
    avg_sla_rate: number;
  };
  attendant_details: Array<{
    attendant_id: number;
    attendant_name: string;
    total_tickets: number;
    resolved_tickets: number;
    pending_tickets: number;
    avg_resolution_time: number;
    sla_violations: number;
    sla_rate: number;
    tickets_by_category: Array<{
      category_id: number;
      category_name: string;
      ticket_count: number;
    }>;
    performance_trend: Array<{
      date: string;
      tickets_resolved: number;
      avg_resolution_time: number;
      sla_rate: number;
    }>;
  }>;
}

export interface CategoryAnalysisData {
  total_categories: number;
  category_summary: Array<{
    category_id: number;
    category_name: string;
    total_tickets: number;
    avg_resolution_time: number;
    sla_violations: number;
    sla_rate: number;
    tickets_by_status: Record<string, number>;
    tickets_by_priority: Record<string, number>;
    tickets_by_attendant: Array<{
      attendant_id: number;
      attendant_name: string;
      ticket_count: number;
    }>;
    trend_data: Array<{
      date: string;
      ticket_count: number;
      sla_rate: number;
    }>;
  }>;
}

export interface TicketsByAttendantData {
  total_attendants: number;
  total_tickets: number;
  attendant_summary: Array<{
    attendant_id: number;
    attendant_name: string;
    attendant_email: string;
    total_tickets: number;
    tickets_by_status: Record<string, number>;
    tickets_by_priority: Record<string, number>;
    tickets_by_category: Array<{
      category_id: number;
      category_name: string;
      ticket_count: number;
    }>;
    avg_resolution_time: number;
    sla_violations: number;
    sla_rate: number;
    first_ticket_date: string;
    last_ticket_date: string;
    performance_trend: Array<{
      date: string;
      tickets_created: number;
      tickets_resolved: number;
      avg_resolution_time: number;
    }>;
  }>;
  performance_ranking: Array<{
    attendant_id: number;
    attendant_name: string;
    score: number;
    position: number;
  }>;
}

export interface GeneralTicketsData {
  total_tickets: number;
  period_summary: {
    start_date: string;
    end_date: string;
    days_analyzed: number;
  };
  tickets_by_status: Record<string, number>;
  tickets_by_priority: Record<string, number>;
  tickets_by_category: Array<{
    category_id: number;
    category_name: string;
    total_tickets: number;
    percentage: number;
    avg_resolution_time: number;
  }>;
  tickets_by_attendant: Array<{
    attendant_id: number;
    attendant_name: string;
    total_tickets: number;
    resolved_tickets: number;
    pending_tickets: number;
    avg_resolution_time: number;
  }>;
  tickets_by_user: Array<{
    user_id: number;
    user_name: string;
    user_email: string;
    total_tickets: number;
    open_tickets: number;
    resolved_tickets: number;
  }>;
  time_analysis: {
    avg_resolution_time: number;
    avg_first_response_time: number;
    sla_violations: number;
    sla_rate: number;
  };
  daily_trend: Array<{
    date: string;
    tickets_created: number;
    tickets_resolved: number;
    tickets_closed: number;
    open_tickets: number;
  }>;
  hourly_distribution: Array<{
    hour: number;
    ticket_count: number;
  }>;
  monthly_summary: Array<{
    month: string;
    total_tickets: number;
    resolved_tickets: number;
    avg_resolution_time: number;
  }>;
}

// Interfaces para Cadastro de Clientes
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
  atak_data_cadastro?: Date;
  atak_erro?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ClientRegistrationHistory {
  id: number;
  client_registration_id: number;
  user_id: number;
  user_name?: string;
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
  created_at: Date;
}

export interface ClientConfigOption {
  id: number;
  nome: string;
  descricao?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ClientConfigOptions {
  ramo_atividade: ClientConfigOption[];
  vendedor: ClientConfigOption[];
  gestor: ClientConfigOption[];
  codigo_carteira: ClientConfigOption[];
  lista_preco: ClientConfigOption[];
  forma_pagamento_desejada: ClientConfigOption[];
}

export interface CreateClientRegistrationRequest {
  user_id: number;
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
  imagem_externa_path: string;
  imagem_interna_path: string;
  anexos_path?: string;
  whatsapp_cliente?: string;
  rede_social?: string;
  link_google_maps?: string;
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
  search?: string;
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

export type ConfigType = 'ramo_atividade' | 'vendedor' | 'gestor' | 'codigo_carteira' | 'lista_preco' | 'forma_pagamento_desejada';