import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  LoginRequest,
  LoginResponse,
  AuthSession,
  User,
  Ticket,
  TicketHistory,
  Notification,
  DashboardStats,
  CreateTicketRequest,
  CreateTicketHistoryRequest,
  ApiResponse,
  PaginatedResponse,
  AssignmentSummary,
  CategoryAssignment,
  Attachment,
  ClientRegistration,
  ClientRegistrationHistory,
  ClientConfigOptions,
  ClientConfigOption,
  UpdateClientRegistrationStatusRequest,
  ClientRegistrationFilters,
  CreateClientConfigRequest,
  UpdateClientConfigRequest,
  ConfigType,
  AnaliseCredito
} from '../types';
import { logger } from '../utils/logger';
import { getApiBaseUrl } from '../utils/apiUrl';

export interface NotificationTemplateItem {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  enabled: boolean;
  subject_template: string;
  body_html: string;
  updated_at?: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  resource: string | null;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EntraUserListItem {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  alreadyImported: boolean;
}

class ApiService {
  private api: AxiosInstance;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    // Usar VITE_API_URL em produção (ex.: Vercel + Render); em dev usa /api ou hostname:port
    const baseURL = getApiBaseUrl();
    console.log('API Base URL configurada:', baseURL);
    
    // Timeout padrão 10s; rotas pesadas (relatórios, export, integração Atak) sobrescrevem com 30s/60s. Ver docs/PLANO_ACAO_TIMEOUT_LENTIDAO.md e docs/ENDPOINTS_TIMEOUTS.md.
    this.api = axios.create({
      baseURL,
      timeout: 10000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor: envia cookie httpOnly automaticamente (withCredentials).
    // Se ainda existir token no localStorage (compatibilidade), envia também no header.
    this.api.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        (config as any).startTime = startTime;
        
        const token = localStorage.getItem('token');
        const isJwt = token && token !== 'cookie' && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
        if (isJwt) {
          config.headers.Authorization = `Bearer ${token}`;
          logger.debug('Token adicionado ao request (header)', { 
            url: config.url, 
            method: config.method 
          }, 'API');
        }
        
        logger.apiRequest(
          config.method?.toUpperCase() || 'UNKNOWN',
          config.url || 'UNKNOWN',
          config.data
        );
        
        return config;
      },
      (error) => {
        logger.error('Erro no interceptor de request', { error }, 'API');
        return Promise.reject(error);
      }
    );

    // Interceptor para tratar respostas e erros
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        const startTime = (response.config as any).startTime;
        const responseTime = startTime ? Date.now() - startTime : 0;
        
        logger.apiResponse(
          response.config.method?.toUpperCase() || 'UNKNOWN',
          response.config.url || 'UNKNOWN',
          response.status,
          responseTime,
          response.data
        );
        
        return response;
      },
      async (error) => {
        const startTime = (error.config as any)?.startTime;
        const responseTime = startTime ? Date.now() - startTime : 0;
        
        logger.apiResponse(
          error.config?.method?.toUpperCase() || 'UNKNOWN',
          error.config?.url || 'UNKNOWN',
          error.response?.status || 0,
          responseTime,
          error.response?.data
        );
        
        if (error.response?.status === 401) {
          const originalRequest = error.config as any;
          const requestUrl = String(originalRequest?.url || '');
          const isRefreshRequest = requestUrl.includes('/auth/refresh');
          const isPublicAuthRoute = requestUrl.includes('/auth/login')
            || requestUrl.includes('/auth/register')
            || requestUrl.includes('/auth/registration-open')
            || requestUrl.includes('/auth/providers');
          const isSystemConfig = requestUrl.includes('/system/config');

          if (!originalRequest?._retry && !isRefreshRequest && !isPublicAuthRoute && !isSystemConfig) {
            originalRequest._retry = true;

            try {
              if (!this.refreshPromise) {
                this.refreshPromise = this.refreshSession();
              }
              await this.refreshPromise;
              return this.api(originalRequest);
            } catch (_refreshError) {
              this.handleAuthFailure(requestUrl);
            } finally {
              this.refreshPromise = null;
            }
          } else if (isRefreshRequest || isPublicAuthRoute) {
            this.handleAuthFailure(requestUrl);
          } else if (isSystemConfig) {
            logger.debug('Requisição de configuração do sistema sem autenticação, usando valores padrão', {}, 'API');
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Autenticação
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    logger.info('Iniciando processo de login', { email: credentials.email }, 'AUTH');
    
    try {
      const response = await this.api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
      
      logger.success('Login realizado com sucesso', { 
        userId: response.data.data.user.id,
        email: response.data.data.user.email,
        role: response.data.data.user.role
      }, 'AUTH');
      
      return response.data.data;
    } catch (error) {
      logger.error('Falha no login', { 
        email: credentials.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 'AUTH');
      throw error;
    }
  }

  async logout(): Promise<void> {
    logger.info('Iniciando processo de logout', {}, 'AUTH');
    
    try {
      // Fazer logout no servidor ANTES de limpar o localStorage
      await this.api.post('/auth/logout');
      logger.success('Logout realizado com sucesso no servidor', {}, 'AUTH');
    } catch (error) {
      // Falha silenciosa - mesmo se der erro, continuar
      logger.warn('Erro ao fazer logout no servidor, continuando com limpeza local', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 'AUTH');
    }
    // Limpar localStorage APÓS tentar fazer logout no servidor
    this.clearLocalAuthData();
    logger.info('Dados locais limpos', {}, 'AUTH');
  }

  async refreshSession(): Promise<void> {
    await this.api.post('/auth/refresh');
  }

  private clearLocalAuthData(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  }

  private handleAuthFailure(url?: string): void {
    const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    this.clearLocalAuthData();
    if (!isLoginPage) {
      logger.warn('Sessão expirada. Redirecionando para login', { url }, 'AUTH');
      window.location.href = '/login';
    }
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get<ApiResponse<{ user: User }>>('/auth/profile');
    return response.data.data.user;
  }

  async getMyUiPreferences(): Promise<Record<string, unknown>> {
    const response = await this.api.get<ApiResponse<{ preferences: Record<string, unknown> }>>('/auth/me/preferences');
    return response.data.data.preferences;
  }

  async putMyUiPreferences(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.api.put<ApiResponse<{ preferences: Record<string, unknown> }>>(
      '/auth/me/preferences',
      body
    );
    return response.data.data.preferences;
  }

  async getAuthSessions(): Promise<AuthSession[]> {
    const response = await this.api.get<ApiResponse<{ sessions: AuthSession[] }>>('/auth/sessions');
    return response.data.data.sessions || [];
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await this.api.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
  }

  async revokeOtherAuthSessions(): Promise<number> {
    const response = await this.api.delete<ApiResponse<{ revokedCount: number }>>('/auth/sessions');
    return response.data.data.revokedCount ?? 0;
  }

  /** Provedores de login disponíveis (ex.: Microsoft Entra ID). */
  async getAuthProviders(): Promise<{ microsoft: { enabled: boolean } }> {
    const response = await this.api.get<ApiResponse<{ microsoft: { enabled: boolean } }>>('/auth/providers');
    return response.data.data;
  }

  // Usuários
  async getUsers(page = 1, limit = 10): Promise<PaginatedResponse<User>> {
    const response = await this.api.get<ApiResponse<PaginatedResponse<User>>>(`/users?page=${page}&limit=${limit}`);
    return response.data.data;
  }

  async getUsersSessionsSummary(userIds: number[]): Promise<Record<number, number>> {
    if (!userIds.length) return {};
    const ids = userIds.join(',');
    const response = await this.api.get<ApiResponse<{ summary: Record<number, number> }>>(
      `/users/sessions-summary?ids=${encodeURIComponent(ids)}`
    );
    return response.data.data.summary || {};
  }

  async getUser(id: number): Promise<User> {
    const response = await this.api.get<ApiResponse<{ user: User }>>(`/users/${id}`);
    return response.data.data.user;
  }

  /** Lista usuários do Entra ID (admin). */
  async getEntraUsersList(params: { page?: number; limit?: number; search?: string } = {}): Promise<{ users: EntraUserListItem[]; nextLink?: string }> {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.search) sp.set('search', params.search);
    const response = await this.api.get<ApiResponse<{ users: EntraUserListItem[]; nextLink?: string }>>(`/users/entra/list?${sp.toString()}`);
    const body = response.data as unknown;
    // Backend pode retornar { error: string } (ex.: 4xx/5xx)
    if (body && typeof body === 'object' && 'error' in body && !('data' in body)) {
      const msg = (body as { error: string }).error || 'Erro ao listar usuários do Entra ID.';
      throw Object.assign(new Error(msg), { response: { data: { error: msg } } });
    }
    const data = body && typeof body === 'object' && 'data' in body ? (body as ApiResponse<{ users: EntraUserListItem[]; nextLink?: string }>).data : undefined;
    // Resposta HTML ou null = proxy/CDN serviu SPA ou backend não respondeu em JSON
    if (data == null || typeof data === 'string') {
      const isHtml = typeof body === 'string' && body.trim().toLowerCase().startsWith('<!');
      const baseUrl = this.api.defaults.baseURL || '';
      const isProductionApi = /https?:\/\/api\.|railway|render|vercel|onrender\.com/i.test(baseUrl);
      let msg: string;
      if (isHtml && isProductionApi) {
        msg = 'A resposta veio como página HTML em vez de JSON. Isso costuma ocorrer quando um proxy ou CDN (ex.: Cloudflare, nginx) na frente do backend serve o index.html do frontend para rotas /api/*. Configure o proxy para encaminhar /api/* ao backend Node e não servir SPA para essas rotas; aumente o timeout se o backend demorar (ex.: Microsoft Graph).';
      } else if (isHtml) {
        msg = 'A API retornou uma página em vez de dados. Verifique: (1) Backend na porta correta (ex.: 3004); (2) VITE_BACKEND_PORT no .env do frontend; (3) Ou VITE_API_URL com a URL do backend. Em produção, confira se o proxy encaminha /api/* ao backend.';
      } else {
        msg = 'Resposta inválida da API. Confira se o backend está rodando e se VITE_API_URL (ou VITE_BACKEND_PORT) está correto.';
      }
      throw Object.assign(new Error(msg), { response: { data: { error: msg } } });
    }
    if (!Array.isArray(data.users)) {
      const msg = 'Resposta da API sem lista de usuários. Verifique se o backend está rodando e a URL da API (VITE_API_URL ou VITE_BACKEND_PORT).';
      throw Object.assign(new Error(msg), { response: { data: { error: msg } } });
    }
    return data;
  }

  /** Importa um usuário do Entra ID (admin). */
  async importEntraUser(body: { microsoft_id: string; role: 'user' | 'attendant' | 'admin'; name?: string; email: string; job_title?: string | null }): Promise<User> {
    const response = await this.api.post<ApiResponse<{ user: User }>>('/users/entra/import', body);
    const data = response.data.data as { user: User };
    return data.user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const response = await this.api.post<ApiResponse<User>>('/users', userData);
    return response.data.data;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User> {
    const response = await this.api.put<ApiResponse<User>>(`/users/${id}`, userData);
    return response.data.data;
  }

  async deleteUser(id: number): Promise<void> {
    await this.api.delete(`/users/${id}`);
  }

  /** Exportar usuários (CSV ou JSON). Retorna a URL do blob para download. */
  async exportUsers(format: 'csv' | 'json'): Promise<void> {
    const response = await this.api.get(`/users/export?format=${format}`, {
      responseType: format === 'json' ? 'json' : 'blob'
    });
    const blob = format === 'json'
      ? new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      : response.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.${format === 'json' ? 'json' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Pré-visualizar importação de usuários. Retorna linhas válidas e inválidas. */
  async importUsersPreview(file: File): Promise<{
    total: number;
    valid: number;
    invalid: number;
    validRows: Array<{ rowIndex: number; data: Record<string, unknown> }>;
    invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
  }> {
    const form = new FormData();
    form.append('file', file);
    const response = await this.api.post<ApiResponse<{
      total: number;
      valid: number;
      invalid: number;
      validRows: unknown[];
      invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
    }>>('/users/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const d = response.data.data!;
    return {
      total: d.total,
      valid: d.valid,
      invalid: d.invalid,
      validRows: d.validRows as Array<{ rowIndex: number; data: Record<string, unknown> }>,
      invalidRows: d.invalidRows
    };
  }

  /** Importar usuários. Senha padrão para novos; existentes só atualizam se updateExisting=true (senha nunca alterada). */
  async importUsers(
    file: File,
    defaultPassword: string,
    updateExisting: boolean
  ): Promise<{ created: number; updated: number; invalidCount: number; invalidRows: Array<{ rowIndex: number; errors: string[] }> }> {
    const form = new FormData();
    form.append('file', file);
    form.append('defaultPassword', defaultPassword);
    form.append('updateExisting', String(updateExisting));
    const response = await this.api.post<ApiResponse<{
      created: number;
      updated: number;
      invalidCount: number;
      invalidRows: Array<{ rowIndex: number; errors: string[] }>;
    }>>('/users/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data!;
  }

  /** Exportar categorias (JSON com SLA, perguntas personalizadas e configurações). */
  async exportCategories(): Promise<void> {
    const response = await this.api.get('/categories/export', { responseType: 'json' });
    const data = Array.isArray(response.data) ? response.data : (response.data as any)?.data ?? response.data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categorias-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Pré-visualizar importação de categorias. */
  async importCategoriesPreview(file: File): Promise<{
    total: number;
    valid: number;
    invalid: number;
    validRows: Array<{ rowIndex: number; data: Record<string, unknown> }>;
    invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
  }> {
    const form = new FormData();
    form.append('file', file);
    const response = await this.api.post<ApiResponse<{
      total: number;
      valid: number;
      invalid: number;
      validRows: unknown[];
      invalidRows: Array<{ rowIndex: number; raw: Record<string, unknown>; errors: string[] }>;
    }>>('/categories/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const d = response.data.data!;
    return {
      total: d.total,
      valid: d.valid,
      invalid: d.invalid,
      validRows: (d.validRows || []) as Array<{ rowIndex: number; data: Record<string, unknown> }>,
      invalidRows: d.invalidRows || []
    };
  }

  /** Importar categorias. updateExisting: atualizar categorias existentes (por nome); senão ignora duplicadas. */
  async importCategories(
    file: File,
    updateExisting: boolean
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    invalidCount: number;
    invalidRows: Array<{ rowIndex: number; errors: string[] }>;
  }> {
    const form = new FormData();
    form.append('file', file);
    form.append('updateExisting', String(updateExisting));
    const response = await this.api.post<ApiResponse<{
      created: number;
      updated: number;
      skipped: number;
      invalidCount: number;
      invalidRows: Array<{ rowIndex: number; errors: string[] }>;
    }>>('/categories/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data!;
  }

  // System Configuration
  async getSystemConfig(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/system/config');
    return response.data.data;
  }

  async updateSystemConfig(config: any): Promise<any> {
    const response = await this.api.put<ApiResponse<any>>('/system/config', config);
    return response.data.data;
  }

  async getSystemStats(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/system/stats');
    return response.data.data;
  }

  async testSystemEmail(): Promise<{ message: string }> {
    const response = await this.api.post<{ message?: string; data?: { message: string } }>('/system/test-email');
    const data = response.data as any;
    return { message: data?.data?.message ?? data?.message ?? 'E-mail de teste enviado.' };
  }

  async getNotificationTemplates(): Promise<NotificationTemplateItem[]> {
    const response = await this.api.get<{ data: NotificationTemplateItem[] }>('/system/notification-templates');
    return response.data.data ?? [];
  }

  async updateNotificationTemplates(
    updates: Array<{ notification_key: string; enabled?: boolean; subject_template?: string; body_html?: string }>
  ): Promise<void> {
    await this.api.put('/system/notification-templates', updates);
  }

  // Permissions
  async getPermissions(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/permissions');
    return response.data.data;
  }

  async getPermissionsByModule(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/permissions/modules');
    // A API retorna { data: { module1: [...], module2: [...] } }
    return response.data.data || {};
  }

  async getRolePermissions(role: string): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(`/permissions/role/${role}`);
    // A API retorna { data: [...] }
    return response.data.data || [];
  }

  async getUserPermissions(userId: number): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>(`/permissions/user/${userId}`);
    // Retornar diretamente os dados, que já vêm como array de PermissionWithStatus
    return response.data.data || [];
  }

  async getMyPermissions(): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/permissions/me');
    // A API retorna { data: Permission[] } ou { message, data: Permission[] }
    return response.data.data || response.data || [];
  }

  async checkPermission(permissionCode: string): Promise<boolean> {
    const response = await this.api.post<ApiResponse<{ hasPermission: boolean }>>('/permissions/check', {
      permissionCode
    });
    return response.data.data.hasPermission;
  }

  async updateRolePermissions(role: string, permissions: Array<{ permissionId: number; granted: boolean }>): Promise<void> {
    await this.api.put(`/permissions/role/${role}`, { permissions });
  }

  async updateUserPermissions(userId: number, permissions: Array<{ permissionId: number; granted: boolean | null }>): Promise<void> {
    await this.api.put(`/permissions/user/${userId}`, { permissions });
  }

  async createPermission(permission: { name: string; code: string; module: string; description?: string }): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>('/permissions', permission);
    return response.data.data;
  }

  async updatePermission(id: number, updates: { name?: string; code?: string; module?: string; description?: string }): Promise<any> {
    const response = await this.api.put<ApiResponse<any>>(`/permissions/${id}`, updates);
    return response.data.data;
  }

  async deletePermission(id: number): Promise<void> {
    await this.api.delete(`/permissions/${id}`);
  }

  async getAuditLogs(params?: { page?: number; limit?: number; date_from?: string; date_to?: string; user_id?: number; action?: string; resource?: string }): Promise<{ data: AuditLogListResponse }> {
    const response = await this.api.get<ApiResponse<AuditLogListResponse>>('/system/audit-logs', { params });
    return { data: response.data.data || response.data };
  }

  // Generic methods for API calls
  async get(url: string): Promise<any> {
    const response = await this.api.get(url);
    return response.data;
  }

  async post(url: string, data: any): Promise<any> {
    const response = await this.api.post(url, data);
    return response.data;
  }

  async put(url: string, data: any): Promise<any> {
    const response = await this.api.put(url, data);
    return response.data;
  }

  async delete(url: string): Promise<any> {
    const response = await this.api.delete(url);
    return response.data;
  }

  // Chamados
  async getTickets(page = 1, limit = 10, filters?: any): Promise<PaginatedResponse<Ticket>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    // Adicionar apenas filtros válidos (não undefined, null ou string vazia)
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await this.api.get<ApiResponse<PaginatedResponse<Ticket>>>(`/tickets?${params}`);
    return response.data.data;
  }

  async getTicket(id: number): Promise<Ticket> {
    const response = await this.api.get<ApiResponse<{ticket: Ticket}>>(`/tickets/${id}`);
    return response.data.data.ticket;
  }

  async createTicket(ticketData: CreateTicketRequest): Promise<Ticket> {
    console.log('🔍 API DEBUG - Enviando dados:', ticketData);
    const response = await this.api.post<ApiResponse<Ticket>>('/tickets', ticketData);
    console.log('🔍 API DEBUG - Resposta completa:', response);
    console.log('🔍 API DEBUG - response.data:', response.data);
    console.log('🔍 API DEBUG - response.data.data:', response.data.data);
    
    // Verificar diferentes estruturas possíveis da resposta
    if (response.data && response.data.data) {
      console.log('🔍 API DEBUG - Estrutura: response.data.data');
      return response.data.data;
    } else if (response.data) {
      console.log('🔍 API DEBUG - Estrutura: response.data.data');
      return response.data.data;
    } else {
      console.error('❌ API DEBUG - Estrutura inesperada:', response.data);
      throw new Error('Estrutura de resposta inesperada do servidor');
    }
  }


  async deleteTicket(id: number): Promise<void> {
    await this.api.delete(`/tickets/${id}`);
  }

  // Histórico de chamados
  async getTicketHistory(ticketId: number): Promise<TicketHistory[]> {
    const response = await this.api.get<ApiResponse<{history: TicketHistory[]}>>(`/tickets/${ticketId}/history`);
    return response.data.data.history;
  }

  async addTicketHistory(ticketId: number, historyData: CreateTicketHistoryRequest): Promise<TicketHistory> {
    const response = await this.api.post<{message: string, data: TicketHistory}>(
      `/tickets/${ticketId}/messages`,
      {
        message: historyData.message,
        attachment: historyData.attachment || undefined
      }
    );
    return response.data.data;
  }

  async updateTicket(ticketId: number, data: any): Promise<Ticket> {
    const response = await this.api.put<ApiResponse<Ticket>>(`/tickets/${ticketId}`, data);
    return response.data.data;
  }

  // Notificações
  async getNotifications(page = 1, limit = 10): Promise<PaginatedResponse<Notification>> {
    const response = await this.api.get<ApiResponse<PaginatedResponse<Notification>>>(`/notifications?page=${page}&limit=${limit}`);
    return response.data.data;
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await this.api.put(`/notifications/${id}/read`);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.api.put('/notifications/mark-all-read');
  }

  async deleteNotification(id: number): Promise<void> {
    await this.api.delete(`/notifications/${id}`);
  }

  async getUnreadNotificationCount(): Promise<number> {
    const response = await this.api.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return response.data.data.count;
  }

  // Dashboard
  async getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await this.api.get<ApiResponse<DashboardStats>>('/dashboard/stats', { params });
    return response.data.data;
  }

  async getPerformanceDashboard(): Promise<unknown> {
    const response = await this.api.get<{ success?: boolean; data: unknown }>('/performance/dashboard');
    return response.data.data;
  }

  async getRecentActivity(): Promise<Array<{
    id: number;
    type: 'ticket_created' | 'ticket_updated' | 'ticket_resolved' | 'ticket_reopened' | 'ticket_closed';
    title: string;
    description: string;
    timestamp: Date;
    user_name: string;
    ticket_id: number;
    ticket_subject: string;
  }>> {
    const response = await this.api.get<ApiResponse<{ activities: any[] }>>('/dashboard/recent-activity');
    return response.data.data.activities;
  }

  // Atribuições de categorias
  async getAssignmentSummary(): Promise<{
    categories: AssignmentSummary[];
    all_attendants: Array<{ id: number; name: string; email: string }>;
  }> {
    const response = await this.api.get<ApiResponse<{ categories: AssignmentSummary[]; all_attendants: any[] }>>('/category-assignments/summary');
    return response.data.data;
  }

  async createAssignment(categoryId: number, attendantId: number): Promise<CategoryAssignment> {
    const response = await this.api.post<ApiResponse<CategoryAssignment>>('/category-assignments', {
      category_id: categoryId,
      attendant_id: attendantId
    });
    return response.data.data;
  }

  async deleteAssignment(categoryId: number, attendantId: number): Promise<void> {
    await this.api.delete('/category-assignments', {
      data: {
        category_id: categoryId,
        attendant_id: attendantId
      }
    });
  }

  // Regras de atribuição por resposta
  async createAssignmentRule(
    categoryId: number,
    data: { field_name: string; operator: string; value: string; attendant_id: number; priority?: number }
  ): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>(
      `/category-assignments/category/${categoryId}/rules`,
      data
    );
    return response.data.data;
  }

  async deleteAssignmentRule(ruleId: number): Promise<void> {
    await this.api.delete(`/category-assignments/rules/${ruleId}`);
  }

  // Assumir ticket
  async claimTicket(ticketId: number): Promise<Ticket> {
    const response = await this.api.post<ApiResponse<Ticket>>(`/tickets/${ticketId}/claim`);
    return response.data.data;
  }

  // Fluxo de aprovação
  async requestApproval(ticketId: number): Promise<Ticket> {
    const response = await this.api.post<ApiResponse<{ticket: Ticket}>>(`/tickets/${ticketId}/request-approval`);
    return response.data.data.ticket;
  }

  async approveTicket(ticketId: number): Promise<Ticket> {
    const response = await this.api.post<ApiResponse<{ticket: Ticket}>>(`/tickets/${ticketId}/approve`);
    return response.data.data.ticket;
  }

  async rejectTicket(ticketId: number, reason?: string): Promise<Ticket> {
    const response = await this.api.post<ApiResponse<{ticket: Ticket}>>(`/tickets/${ticketId}/reject`, { reason });
    return response.data.data.ticket;
  }

  // Upload de arquivos
  async uploadFile(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post<ApiResponse<{ url: string; filename: string }>>(
      '/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data;
  }

  // Attachment methods
  async uploadAttachments(ticketId: number, files: File[], messageId?: number): Promise<{ attachments: Attachment[] }> {
    const formData = new FormData();
    formData.append('ticketId', ticketId.toString());
    if (messageId) {
      formData.append('messageId', messageId.toString());
    }
    
    files.forEach(file => {
      formData.append('attachments', file);
    });

    const response = await this.api.post<ApiResponse<{ attachments: Attachment[] }>>('/attachments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  }

  async getTicketAttachments(ticketId: number): Promise<{ attachments: Attachment[] }> {
    const response = await this.api.get<ApiResponse<{ attachments: Attachment[] }>>(`/attachments/ticket/${ticketId}`);
    return response.data.data;
  }

  async getMessageAttachments(messageId: number): Promise<{ attachments: Attachment[] }> {
    const response = await this.api.get<ApiResponse<{ attachments: Attachment[] }>>(`/attachments/message/${messageId}`);
    return response.data.data;
  }

  async downloadAttachment(attachmentId: number): Promise<Blob> {
    const response = await this.api.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async deleteAttachment(attachmentId: number): Promise<void> {
    await this.api.delete(`/attachments/${attachmentId}`);
  }

  async getAttachmentStats(ticketId: number): Promise<{ count: number; total_size: number; total_size_mb: number }> {
    const response = await this.api.get<ApiResponse<{ count: number; total_size: number; total_size_mb: number }>>(`/attachments/ticket/${ticketId}/stats`);
    return response.data.data;
  }

  // Activity tracking methods
  async trackActivity(userId: number, activity: string): Promise<void> {
    await this.api.post('/admin-metrics/track-activity', {
      userId,
      activity
    });
  }

  // Reports methods
  async getReports(): Promise<any> {
    const response = await this.api.get('/reports');
    logger.debug('Resposta da API getReports:', { 
      success: response.data.success, 
      hasData: !!response.data.data,
      dataType: typeof response.data.data,
      isArray: Array.isArray(response.data.data),
      dataKeys: response.data.data ? Object.keys(response.data.data) : 'N/A'
    }, 'API');
    
    // Se a resposta tem data.data (estrutura paginada), retornar data.data
    // Se a resposta tem data direto (array), retornar data
    return response.data.data?.data || response.data.data || [];
  }

  async createReport(reportData: any): Promise<any> {
    const response = await this.api.post('/reports', reportData);
    return response.data.data;
  }

  async deleteReport(id: number): Promise<void> {
    await this.api.delete(`/reports/${id}`);
  }

  async executeReport(id: number, parameters: any): Promise<any> {
    const response = await this.api.post(`/reports/${id}/execute`, parameters);
    return response.data.data;
  }

  async getReportExecutions(id: number): Promise<any> {
    const response = await this.api.get(`/reports/${id}/executions`);
    return response.data.data;
  }

  async getReportSchedules(id: number): Promise<any> {
    const response = await this.api.get(`/reports/${id}/schedules`);
    return response.data.data;
  }

  async exportReportExecution(executionId: number, format: string): Promise<Blob> {
    logger.info('Iniciando exportação via API', { executionId, format }, 'API');
    
    const token = localStorage.getItem('token');
    logger.debug('Token disponível para exportação', { 
      hasToken: !!token, 
      tokenPrefix: token ? token.substring(0, 20) + '...' : 'N/A' 
    }, 'API');
    
    const response = await this.api.get(`/reports/executions/${executionId}/export?format=${format}`, {
      responseType: 'blob'
    });
    
    logger.success('Exportação via API concluída', { 
      executionId, 
      format, 
      blobSize: response.data.size 
    }, 'API');
    
    return response.data;
  }

  async getReportExecution(executionId: number): Promise<any> {
    const response = await this.api.get(`/reports/executions/${executionId}`);
    return response.data.data;
  }

  async updateReport(id: number, reportData: any): Promise<any> {
    const response = await this.api.put(`/reports/${id}`, reportData);
    return response.data.data;
  }

  async getCustomFields(): Promise<any> {
    const response = await this.api.get('/reports/custom/fields');
    return response.data.data;
  }

  async createCustomReport(reportData: any): Promise<any> {
    const response = await this.api.post('/reports/custom', reportData);
    return response.data.data;
  }

  async getSchedules(): Promise<any> {
    const response = await this.api.get('/reports/schedules');
    return response.data.data;
  }

  async deleteReportExecution(executionId: number): Promise<void> {
    await this.api.delete(`/reports/executions/${executionId}`);
  }

  async createSchedule(scheduleData: any): Promise<any> {
    const response = await this.api.post('/reports/schedules', scheduleData);
    return response.data.data;
  }

  async exportReport(executionId: number, format: string): Promise<Blob> {
    const response = await this.api.get(`/reports/executions/${executionId}/export?format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // =============================================
  // MÉTODOS PARA CADASTRO DE CLIENTES
  // =============================================

  // Client Registrations
  async getClientRegistrations(filters?: ClientRegistrationFilters): Promise<PaginatedResponse<ClientRegistration>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const response = await this.api.get(`/client-registrations?${params}`);
    return response.data.data;
  }

  async updateClientRegistration(id: number, data: FormData): Promise<ClientRegistration> {
    const response = await this.api.put(`/client-registrations/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data as ClientRegistration;
  }

  async getMyClientRegistrations(filters?: Omit<ClientRegistrationFilters, 'user_id'>): Promise<ClientRegistration[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const response = await this.api.get(`/client-registrations/my?${params}`);
    return response.data.data;
  }

  async getClientRegistration(id: number): Promise<{ registration: ClientRegistration; history: ClientRegistrationHistory[] }> {
    const response = await this.api.get(`/client-registrations/${id}`);
    return {
      registration: response.data.data,
      history: [] // O histórico será implementado posteriormente
    };
  }

  async createClientRegistration(formData: FormData): Promise<ClientRegistration> {
    const response = await this.api.post('/client-registrations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }

  async updateClientRegistrationStatus(id: number, data: UpdateClientRegistrationStatusRequest): Promise<ClientRegistration> {
    const response = await this.api.put(`/client-registrations/${id}/status`, data);
    return response.data.data;
  }

  async getCondicoesPagamentoAtak(): Promise<Array<{ id: string; nome: string; descricao?: string }>> {
    const response = await this.api.get('/client-registrations/condicoes-pagamento');
    return response.data.data;
  }

  async updateClientFinancialData(id: number, data: { condicao_pagamento_id?: string; limite_credito?: number; codigo_carteira?: string; codigo_forma_cobranca?: string }): Promise<ClientRegistration> {
    // Aumentar timeout para esta requisição específica, pois a integração com Atak pode demorar
    const response = await this.api.put(`/client-registrations/${id}/financial`, data, {
      timeout: 60000 // 60 segundos - suficiente para autenticação e atualização no Atak
    });
    return response.data.data;
  }

  async getAtakCustomerData(id: number): Promise<any> {
    const response = await this.api.get(`/client-registrations/${id}/atak`, {
      timeout: 30000 // 30 segundos
    });
    return response.data.data;
  }

  async reprocessClientRegistration(id: number): Promise<{ registration_id: number; cnpj: string; status: string }> {
    const response = await this.api.post(`/client-registrations/${id}/reprocess`);
    return response.data.data;
  }

  async getClientRegistrationStatistics(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await this.api.get('/client-registrations/statistics', { params });
    return response.data.data;
  }

  async getClientRegistrationRecentHistory(limit?: number): Promise<ClientRegistrationHistory[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await this.api.get(`/client-registrations/recent-history${params}`);
    return response.data.data;
  }

  async getAnaliseCredito(cnpj: string): Promise<AnaliseCredito | null> {
    try {
      // Codificar o CNPJ para URL (trata barras, pontos, etc)
      const encodedCNPJ = encodeURIComponent(cnpj);
      const response = await this.api.get(`/analise-credito/${encodedCNPJ}`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Client Config
  async getClientConfigOptions(): Promise<ClientConfigOptions> {
    const response = await this.api.get('/client-config/options');
    return response.data.data;
  }

  async getClientConfigs(type: ConfigType, includeInactive?: boolean): Promise<ClientConfigOption[]> {
    const params = includeInactive ? '?includeInactive=true' : '';
    const response = await this.api.get(`/client-config/${type}${params}`);
    return response.data.data;
  }

  async getClientConfigById(type: ConfigType, id: number): Promise<ClientConfigOption> {
    const response = await this.api.get(`/client-config/${type}/${id}`);
    return response.data.data;
  }

  async createClientConfig(type: ConfigType, data: CreateClientConfigRequest): Promise<ClientConfigOption> {
    const response = await this.api.post(`/client-config/${type}`, data);
    return response.data.data;
  }

  async updateClientConfig(type: ConfigType, id: number, data: UpdateClientConfigRequest): Promise<ClientConfigOption> {
    const response = await this.api.put(`/client-config/${type}/${id}`, data);
    return response.data.data;
  }

  async deleteClientConfig(type: ConfigType, id: number): Promise<void> {
    await this.api.delete(`/client-config/${type}/${id}`);
  }

  async hardDeleteClientConfig(type: ConfigType, id: number): Promise<void> {
    await this.api.delete(`/client-config/${type}/${id}/hard`);
  }

  async getClientConfigStatistics(): Promise<any> {
    const response = await this.api.get('/client-config/statistics');
    return response.data.data;
  }

  async searchClientConfigs(type: ConfigType, searchTerm: string): Promise<ClientConfigOption[]> {
    const response = await this.api.get(`/client-config/${type}/search?q=${encodeURIComponent(searchTerm)}`);
    return response.data.data;
  }

  // Solicitações de Compra
  async deleteSolicitacaoCompra(id: number): Promise<void> {
    await this.api.delete(`/solicitacoes-compra/${id}`);
  }

  async getComprasStatistics(startDate?: string, endDate?: string): Promise<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    const response = await this.api.get<ApiResponse<any>>('/solicitacoes-compra/statistics', { params });
    return response.data.data;
  }

  /**
   * Configuração pública do sistema (nome, logo, subtítulo).
   * Não requer autenticação - usada na tela de login e globalmente para todos os usuários.
   */
  async getPublicSystemConfig(): Promise<{ system_name: string; system_subtitle: string; system_logo: string; system_version: string }> {
    const response = await this.api.get<{ message: string; data: { system_name: string; system_subtitle: string; system_logo: string; system_version: string } }>('/system/public-config');
    return response.data.data;
  }

  // --- Módulo Descarregamento ---
  async getAgendamentosDescarregamento(params?: { page?: number; limit?: number; start_date?: string; end_date?: string; status?: string; fornecedor_id?: number; dock?: string; search?: string }) {
    const response = await this.api.get<ApiResponse<{ data: any[]; total: number; page: number; limit: number; total_pages: number }>>('/descarregamento/agendamentos', { params });
    return response.data.data;
  }
  async getAgendamentoDescarregamentoById(id: number) {
    const response = await this.api.get<ApiResponse<{ agendamento: any }>>(`/descarregamento/agendamentos/${id}`);
    return response.data.data.agendamento;
  }
  async createAgendamentoDescarregamento(data: { fornecedor_id: number; scheduled_date: string; scheduled_time?: string; dock?: string; notes?: string }) {
    const response = await this.api.post<ApiResponse<{ agendamento: any }>>('/descarregamento/agendamentos', data);
    return response.data.data.agendamento;
  }
  async updateAgendamentoDescarregamento(id: number, data: Partial<{ fornecedor_id: number; scheduled_date: string; scheduled_time: string; dock: string; status: string; notes?: string }>) {
    const response = await this.api.put<ApiResponse<{ agendamento: any }>>(`/descarregamento/agendamentos/${id}`, data);
    return response.data.data.agendamento;
  }
  async deleteAgendamentoDescarregamento(id: number) {
    await this.api.delete(`/descarregamento/agendamentos/${id}`);
  }
  async getFornecedoresDescarregamento(params?: { page?: number; limit?: number; search?: string; category?: string }) {
    const response = await this.api.get<ApiResponse<{ data: any[]; total: number; page: number; limit: number; total_pages: number }>>('/descarregamento/fornecedores', { params });
    return response.data.data;
  }
  async getFornecedoresDescarregamentoPublic(params?: { search?: string; category?: string }) {
    const response = await this.api.get<ApiResponse<{ data: any[]; total: number }>>('/descarregamento/fornecedores/public', { params });
    return response.data.data;
  }
  async getFornecedorDescarregamentoById(id: number) {
    const response = await this.api.get<ApiResponse<{ fornecedor: any }>>(`/descarregamento/fornecedores/${id}`);
    return response.data.data.fornecedor;
  }
  async createFornecedorDescarregamento(data: { name: string; category: string; plate?: string }) {
    const response = await this.api.post<ApiResponse<{ fornecedor: any }>>('/descarregamento/fornecedores', data);
    return response.data.data.fornecedor;
  }
  async updateFornecedorDescarregamento(id: number, data: Partial<{ name: string; category: string; plate?: string }>) {
    const response = await this.api.put<ApiResponse<{ fornecedor: any }>>(`/descarregamento/fornecedores/${id}`, data);
    return response.data.data.fornecedor;
  }
  async deleteFornecedorDescarregamento(id: number) {
    await this.api.delete(`/descarregamento/fornecedores/${id}`);
  }
  async getDocasDescarregamento() {
    const response = await this.api.get<ApiResponse<{ docas: any[] }>>('/descarregamento/docas');
    return (response.data.data as any).docas ?? response.data.data;
  }
  async getDocaDescarregamentoById(id: number) {
    const response = await this.api.get<ApiResponse<{ doca: any }>>(`/descarregamento/docas/${id}`);
    return response.data.data.doca;
  }
  async createDocaDescarregamento(data: { numero: string; nome?: string; is_active?: boolean }) {
    const response = await this.api.post<ApiResponse<{ doca: any }>>('/descarregamento/docas', data);
    return response.data.data.doca;
  }
  async updateDocaDescarregamento(id: number, data: Partial<{ numero: string; nome?: string; is_active?: boolean }>) {
    const response = await this.api.put<ApiResponse<{ doca: any }>>(`/descarregamento/docas/${id}`, data);
    return response.data.data.doca;
  }
  async deleteDocaDescarregamento(id: number) {
    await this.api.delete(`/descarregamento/docas/${id}`);
  }
  async getFormulariosDescarregamento() {
    const response = await this.api.get<ApiResponse<{ formularios: any[] }>>('/descarregamento/formularios');
    return (response.data.data as any)?.formularios ?? [];
  }
  async getSmsTemplatesDescarregamento() {
    const response = await this.api.get<ApiResponse<{ templates: any[] }>>('/descarregamento/sms-templates');
    return (response.data.data as any)?.templates ?? [];
  }
}

export const apiService = new ApiService();
export default apiService;
