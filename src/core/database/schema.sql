-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'attendant', 'admin')),
    is_active BOOLEAN DEFAULT 1,
    last_activity DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de chamados
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    attendant_id INTEGER,
    category_id INTEGER NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval', 'resolved', 'closed', 'overdue_first_response', 'overdue_resolution')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    sla_first_response DATETIME NOT NULL,
    sla_resolution DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    reopened_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (attendant_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
);

-- Tabela de histórico de chamados
CREATE TABLE IF NOT EXISTS ticket_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    attachment VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    path VARCHAR(500) NOT NULL,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER DEFAULT 0,
    type VARCHAR(30) NOT NULL CHECK (type IN ('status_change', 'new_message', 'sla_alert', 'ticket_reopened')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de rastreamento de atividade do usuário (métricas/admin)
CREATE TABLE IF NOT EXISTS user_activity_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity VARCHAR(100) NOT NULL,
    timestamp DATETIME NOT NULL,
    session_id VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id ON user_activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_timestamp ON user_activity_tracking(timestamp);

-- Tabela de categorias de chamados
CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    sla_first_response_hours INTEGER NOT NULL DEFAULT 4,
    sla_resolution_hours INTEGER NOT NULL DEFAULT 24,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de atribuições de categorias para técnicos
CREATE TABLE IF NOT EXISTS category_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    attendant_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
    FOREIGN KEY (attendant_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(category_id, attendant_id)
);

-- Tabela de mensagens de chamados
CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de anexos
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    message_id INTEGER,
    user_id INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attendant_id ON tickets(attendant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON ticket_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tickets_updated_at 
    AFTER UPDATE ON tickets
    BEGIN
        UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ticket_categories_updated_at 
    AFTER UPDATE ON ticket_categories
    BEGIN
        UPDATE ticket_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Inserir configurações padrão do sistema
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('sla_first_response_hours', '4', 'SLA para primeira resposta em horas'),
('sla_resolution_hours', '24', 'SLA para resolução em horas'),
('reopen_days', '7', 'Dias para reabrir chamado após resolução'),
('max_file_size', '10485760', 'Tamanho máximo de arquivo em bytes'),
('allowed_file_types', 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png', 'Tipos de arquivo permitidos'),
('email_notifications', '1', 'Habilitar notificações por email'),
('system_name', 'ERP PRIME', 'Nome do sistema'),
('system_subtitle', 'Sistema de Gestão Empresarial', 'Subtítulo do sistema'),
('system_logo', '', 'Caminho do logo do sistema'),
('system_version', '1.0.0', 'Versão do sistema');

-- Inserir categorias padrão de chamados
INSERT OR IGNORE INTO ticket_categories (name, description, sla_first_response_hours, sla_resolution_hours) VALUES
('Dúvida de Pagamento', 'Dúvidas relacionadas a pagamentos, cobranças e valores', 4, 24),
('Reembolso', 'Solicitações de reembolso e devoluções', 2, 12),
('Nota Fiscal', 'Emissão, correção e consulta de notas fiscais', 4, 48),
('Adiantamento', 'Solicitações de adiantamento e antecipação', 2, 8),
('Outros', 'Outras solicitações não categorizadas', 8, 72);

-- Tabela de relatórios
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sla_performance', 'ticket_volume', 'attendant_performance', 'category_analysis', 'tickets_by_attendant', 'general_tickets', 'compras_solicitacoes', 'compras_orcamentos', 'compras_aprovacoes', 'compras_geral', 'custom')),
    parameters TEXT, -- JSON com parâmetros do relatório
    custom_fields TEXT, -- JSON com campos personalizados para relatórios customizados
    custom_query TEXT, -- SQL query personalizada para relatórios customizados
    created_by INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabela de execuções de relatórios
CREATE TABLE IF NOT EXISTS report_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    executed_by INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    parameters TEXT, -- JSON com parâmetros da execução
    result_data TEXT, -- JSON com os dados do relatório
    file_path VARCHAR(500), -- Caminho do arquivo gerado (PDF/Excel)
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id)
);

-- Tabela de agendamentos de relatórios
CREATE TABLE IF NOT EXISTS report_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    day_of_week INTEGER, -- 0-6 para weekly (0=domingo)
    day_of_month INTEGER, -- 1-31 para monthly
    time VARCHAR(5) NOT NULL, -- HH:MM formato 24h
    recipients TEXT, -- JSON com emails dos destinatários
    is_active BOOLEAN DEFAULT 1,
    last_executed DATETIME,
    next_execution DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Índices para relatórios
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_schedules_frequency ON report_schedules(frequency);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_execution ON report_schedules(next_execution);

-- Triggers para atualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_reports_updated_at 
    AFTER UPDATE ON reports
    BEGIN
        UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_report_schedules_updated_at 
    AFTER UPDATE ON report_schedules
    BEGIN
        UPDATE report_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Tabela de permissões
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de permissões por role
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'attendant', 'admin')),
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role, permission_id)
);

-- Tabela de permissões por usuário (sobrescreve permissões de role)
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    granted BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(user_id, permission_id)
);

-- Índices para permissões
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_permissions_updated_at 
    AFTER UPDATE ON permissions
    BEGIN
        UPDATE permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Inserir permissões padrão do sistema
INSERT OR IGNORE INTO permissions (name, code, module, description) VALUES
-- Sistema de Chamados
('Visualizar Chamados', 'tickets.view', 'tickets', 'Permite visualizar chamados'),
('Criar Chamados', 'tickets.create', 'tickets', 'Permite criar novos chamados'),
('Editar Chamados', 'tickets.edit', 'tickets', 'Permite editar chamados'),
('Excluir Chamados', 'tickets.delete', 'tickets', 'Permite excluir chamados'),
('Atribuir Chamados', 'tickets.assign', 'tickets', 'Permite atribuir chamados a atendentes'),
('Fechar Chamados', 'tickets.close', 'tickets', 'Permite fechar chamados'),
('Reabrir Chamados', 'tickets.reopen', 'tickets', 'Permite reabrir chamados fechados'),
('Gerenciar Categorias', 'tickets.categories.manage', 'tickets', 'Permite gerenciar categorias de chamados'),
('Gerenciar Status', 'tickets.status.manage', 'tickets', 'Permite gerenciar status de chamados'),
('Gerenciar Atribuições', 'tickets.assignments.manage', 'tickets', 'Permite gerenciar atribuições de categorias'),
('Visualizar Anexos', 'tickets.attachments.view', 'tickets', 'Permite visualizar anexos de chamados'),
('Fazer Upload de Anexos', 'tickets.attachments.upload', 'tickets', 'Permite fazer upload de anexos em chamados'),
('Excluir Anexos', 'tickets.attachments.delete', 'tickets', 'Permite excluir anexos de chamados'),
('Visualizar Mensagens', 'tickets.messages.view', 'tickets', 'Permite visualizar mensagens e comentários em chamados'),
('Criar Mensagens', 'tickets.messages.create', 'tickets', 'Permite criar mensagens e comentários em chamados'),
('Editar Mensagens', 'tickets.messages.edit', 'tickets', 'Permite editar mensagens próprias'),
('Excluir Mensagens', 'tickets.messages.delete', 'tickets', 'Permite excluir mensagens de chamados'),
('Visualizar Histórico', 'tickets.history.view', 'tickets', 'Permite visualizar histórico de alterações de chamados'),
('Exportar Chamados', 'tickets.export', 'tickets', 'Permite exportar chamados (Excel, PDF, CSV)'),
('Ações em Massa', 'tickets.bulk_actions', 'tickets', 'Permite executar ações em massa em chamados'),
('Gerenciar Prioridades', 'tickets.priority.manage', 'tickets', 'Permite gerenciar prioridades de chamados'),
('Visualizar SLA', 'tickets.sla.view', 'tickets', 'Permite visualizar informações de SLA'),
('Gerenciar SLA', 'tickets.sla.manage', 'tickets', 'Permite gerenciar configurações de SLA'),

-- Sistema de Cadastros
('Visualizar Cadastros', 'registrations.view', 'registrations', 'Permite visualizar cadastros de clientes'),
('Criar Cadastros', 'registrations.create', 'registrations', 'Permite criar novos cadastros'),
('Editar Cadastros', 'registrations.edit', 'registrations', 'Permite editar cadastros'),
('Excluir Cadastros', 'registrations.delete', 'registrations', 'Permite excluir cadastros'),
('Gerenciar Configurações de Cadastros', 'registrations.config.manage', 'registrations', 'Permite gerenciar configurações de cadastros'),
('Exportar Cadastros', 'registrations.export', 'registrations', 'Permite exportar cadastros (Excel, PDF, CSV)'),
('Aprovar Cadastros', 'registrations.approve', 'registrations', 'Permite aprovar cadastros pendentes'),
('Rejeitar Cadastros', 'registrations.reject', 'registrations', 'Permite rejeitar cadastros'),
('Visualizar Análise de Crédito', 'registrations.analise_credito.view', 'registrations', 'Permite visualizar análise de crédito'),
('Gerenciar Análise de Crédito', 'registrations.analise_credito.manage', 'registrations', 'Permite gerenciar análise de crédito'),
('Visualizar Informações Financeiras', 'registrations.financial.view', 'registrations', 'Permite visualizar informações financeiras'),
('Editar Informações Financeiras', 'registrations.financial.edit', 'registrations', 'Permite editar informações financeiras'),
('Visualizar Histórico de Cadastros', 'registrations.history.view', 'registrations', 'Permite visualizar histórico de alterações de cadastros'),

-- Notificações
('Visualizar Notificações', 'notifications.view', 'notifications', 'Permite visualizar notificações'),
('Gerenciar Notificações', 'notifications.manage', 'notifications', 'Permite gerenciar notificações (marcar como lida, excluir)'),
('Gerenciar Configurações de Notificações', 'notifications.settings.manage', 'notifications', 'Permite gerenciar configurações de notificações'),

-- Administração
('Visualizar Usuários', 'users.view', 'administration', 'Permite visualizar lista de usuários'),
('Criar Usuários', 'users.create', 'administration', 'Permite criar novos usuários'),
('Editar Usuários', 'users.edit', 'administration', 'Permite editar usuários'),
('Excluir Usuários', 'users.delete', 'administration', 'Permite excluir usuários'),
('Gerenciar Permissões', 'permissions.manage', 'administration', 'Permite gerenciar permissões do sistema'),
('Visualizar Relatórios', 'reports.view', 'administration', 'Permite visualizar relatórios'),
('Criar Relatórios', 'reports.create', 'administration', 'Permite criar relatórios personalizados'),
('Editar Relatórios', 'reports.edit', 'administration', 'Permite editar relatórios existentes'),
('Excluir Relatórios', 'reports.delete', 'administration', 'Permite excluir relatórios'),
('Executar Relatórios', 'reports.execute', 'administration', 'Permite executar relatórios'),
('Exportar Relatórios', 'reports.export', 'administration', 'Permite exportar relatórios'),
('Gerenciar Agendamento de Relatórios', 'reports.schedule.manage', 'administration', 'Permite gerenciar agendamento de relatórios'),
('Gerenciar Configurações do Sistema', 'system.config.manage', 'administration', 'Permite gerenciar configurações gerais do sistema'),
('Acessar Monitoramento', 'admin.dashboard.view', 'administration', 'Permite acessar a página de monitoramento do sistema'),
('Visualizar Métricas de Performance', 'performance.view', 'administration', 'Permite visualizar métricas de performance'),
('Gerenciar Performance', 'performance.manage', 'administration', 'Permite gerenciar configurações de performance'),
('Acessar Dashboard', 'dashboard.view', 'administration', 'Permite acessar o dashboard principal'),
('Personalizar Dashboard', 'dashboard.customize', 'administration', 'Permite personalizar o dashboard'),
('Fazer Login como Outro Usuário', 'users.impersonate', 'administration', 'Permite fazer login como outro usuário (para suporte)'),
('Exportar Usuários', 'users.export', 'administration', 'Permite exportar lista de usuários'),
('Visualizar Atividade de Usuários', 'users.activity.view', 'administration', 'Permite visualizar atividade de usuários'),
('Redefinir Senhas', 'users.password.reset', 'administration', 'Permite redefinir senhas de usuários'),
('Visualizar Logs do Sistema', 'system.logs.view', 'administration', 'Permite visualizar logs do sistema'),
('Gerenciar Backups', 'system.backup.manage', 'administration', 'Permite gerenciar backups do sistema'),
('Manutenção do Sistema', 'system.maintenance', 'administration', 'Permite colocar sistema em manutenção'),
('Visualizar Auditoria', 'system.audit.view', 'administration', 'Permite visualizar auditoria do sistema'),
('Gerenciar Alertas de Monitoramento', 'monitoring.alerts.manage', 'administration', 'Permite gerenciar alertas de monitoramento');

-- Atribuir permissões padrão para roles
-- Admin tem todas as permissões
INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
SELECT 'admin', id, 1 FROM permissions;

-- Attendant tem permissões básicas de chamados e visualização
INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
SELECT 'attendant', id, 1 FROM permissions 
WHERE code IN (
    'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.close', 'tickets.reopen',
    'tickets.attachments.view', 'tickets.attachments.upload', 'tickets.messages.view', 'tickets.messages.create',
    'tickets.history.view', 'tickets.sla.view',
    'registrations.view', 'registrations.create', 'registrations.edit',
    'registrations.financial.view', 'registrations.history.view',
    'notifications.view', 'notifications.manage',
    'reports.view', 'reports.execute', 'reports.export',
    'dashboard.view'
);

-- User tem apenas permissões básicas
INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
SELECT 'user', id, 1 FROM permissions 
WHERE code IN (
    'tickets.view', 'tickets.create',
    'tickets.attachments.view', 'tickets.attachments.upload',
    'tickets.messages.view', 'tickets.messages.create',
    'tickets.history.view',
    'registrations.view',
    'notifications.view', 'notifications.manage',
    'dashboard.view'
);

-- ============================================
-- MÓDULO DE COMPRAS
-- ============================================

-- Tabela de compradores (usuários que recebem solicitações)
CREATE TABLE IF NOT EXISTS compradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de aprovadores (usuários que aprovam solicitações)
CREATE TABLE IF NOT EXISTS aprovadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nivel_aprovacao INTEGER NOT NULL DEFAULT 1, -- 1 = primeiro nível, 2 = segundo nível, etc.
    valor_minimo DECIMAL(15,2) DEFAULT 0, -- Valor mínimo que pode aprovar
    valor_maximo DECIMAL(15,2) DEFAULT 999999999.99, -- Valor máximo que pode aprovar
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de solicitações de compra
CREATE TABLE IF NOT EXISTS solicitacoes_compra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_solicitacao VARCHAR(50) UNIQUE NOT NULL, -- Ex: SC-2025-001
    solicitante_id INTEGER NOT NULL,
    comprador_id INTEGER, -- Comprador atribuído
    centro_custo VARCHAR(100),
    descricao TEXT NOT NULL,
    justificativa TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovada', 'rejeitada', 'em_cotacao', 'cotacao_recebida', 'orcamento_aprovado', 'orcamento_rejeitado', 'em_compra', 'comprada', 'cancelada', 'devolvida')),
    prioridade VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    valor_total DECIMAL(15,2) DEFAULT 0,
    data_necessidade DATE,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    aprovada_em DATETIME,
    rejeitada_em DATETIME,
    FOREIGN KEY (solicitante_id) REFERENCES users(id),
    FOREIGN KEY (comprador_id) REFERENCES compradores(id)
);

-- Tabela de itens de solicitação de compra
CREATE TABLE IF NOT EXISTS solicitacoes_compra_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL,
    item_numero INTEGER NOT NULL, -- Número sequencial do item na solicitação
    descricao TEXT NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    valor_unitario DECIMAL(15,2) DEFAULT 0,
    valor_total DECIMAL(15,2) DEFAULT 0,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE
);

-- Tabela de orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL,
    fornecedor_id INTEGER, -- Pode ser NULL se não houver cadastro de fornecedor
    fornecedor_nome VARCHAR(255) NOT NULL, -- Nome do fornecedor
    fornecedor_cnpj VARCHAR(18),
    fornecedor_contato VARCHAR(255),
    fornecedor_email VARCHAR(255),
    fornecedor_telefone VARCHAR(20),
    numero_orcamento VARCHAR(50), -- Número do orçamento do fornecedor
    data_orcamento DATE,
    data_validade DATE,
    condicoes_pagamento TEXT,
    prazo_entrega VARCHAR(100),
    valor_total DECIMAL(15,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'devolvido', 'cancelado')),
    motivo_rejeicao TEXT,
    observacoes TEXT,
    anexo_path VARCHAR(500), -- Caminho do arquivo do orçamento
    -- Rastreio de entrega (orçamentos aprovados)
    entrega_prevista DATE,
    entrega_efetiva DATE,
    status_entrega VARCHAR(20) DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'em_transito', 'entregue')),
    confirmado_entrega_solicitante BOOLEAN DEFAULT 0,
    confirmado_entrega_comprador BOOLEAN DEFAULT 0,
    data_confirmacao_solicitante DATETIME,
    data_confirmacao_comprador DATETIME,
    criado_por INTEGER NOT NULL, -- Quem cadastrou o orçamento
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    aprovado_em DATETIME,
    rejeitado_em DATETIME,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    FOREIGN KEY (criado_por) REFERENCES users(id)
);

-- Tabela de itens de orçamento
CREATE TABLE IF NOT EXISTS orcamentos_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orcamento_id INTEGER NOT NULL,
    item_solicitacao_id INTEGER NOT NULL, -- Referência ao item da solicitação
    descricao TEXT NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    valor_unitario DECIMAL(15,2) NOT NULL,
    valor_total DECIMAL(15,2) NOT NULL,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (item_solicitacao_id) REFERENCES solicitacoes_compra_itens(id)
);

-- Tabela de aprovações de solicitação
CREATE TABLE IF NOT EXISTS aprovacoes_solicitacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL,
    aprovador_id INTEGER NOT NULL,
    nivel_aprovacao INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    observacoes TEXT,
    aprovado_em DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    FOREIGN KEY (aprovador_id) REFERENCES aprovadores(id)
);

-- Tabela de aprovações de orçamento
CREATE TABLE IF NOT EXISTS aprovacoes_orcamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orcamento_id INTEGER NOT NULL,
    aprovador_id INTEGER, -- NULL para solicitante, número para aprovador
    solicitante_id INTEGER, -- ID do solicitante quando aprovador_id é NULL
    nivel_aprovacao INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    observacoes TEXT,
    aprovado_em DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (aprovador_id) REFERENCES aprovadores(id),
    FOREIGN KEY (solicitante_id) REFERENCES users(id)
);

-- Tabela de histórico de solicitações de compra
CREATE TABLE IF NOT EXISTS solicitacoes_compra_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    acao VARCHAR(50) NOT NULL, -- Ex: 'criado', 'enviado_aprovacao', 'aprovado', 'rejeitado', 'atribuido_comprador', etc.
    descricao TEXT,
    dados_anteriores TEXT, -- JSON com dados anteriores (se aplicável)
    dados_novos TEXT, -- JSON com dados novos (se aplicável)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);

-- Tabela de anexos de compras
CREATE TABLE IF NOT EXISTS compras_anexos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER,
    orcamento_id INTEGER,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('solicitacao', 'orcamento', 'nota_fiscal', 'boleto', 'outro')),
    nome_original VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NOT NULL,
    tamanho INTEGER NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Índices para módulo de compras
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_solicitante ON solicitacoes_compra(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_comprador ON solicitacoes_compra(comprador_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_status ON solicitacoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_numero ON solicitacoes_compra(numero_solicitacao);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_created ON solicitacoes_compra(created_at);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_itens_solicitacao ON solicitacoes_compra_itens(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_solicitacao ON orcamentos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_orcamento ON orcamentos_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_solicitacao ON aprovacoes_solicitacao(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_solicitacao_aprovador ON aprovacoes_solicitacao(aprovador_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_orcamento ON aprovacoes_orcamento(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_orcamento_aprovador ON aprovacoes_orcamento(aprovador_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_historico_solicitacao ON solicitacoes_compra_historico(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_anexos_solicitacao ON compras_anexos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_anexos_orcamento ON compras_anexos(orcamento_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_solicitacoes_compra_updated_at 
    AFTER UPDATE ON solicitacoes_compra
    BEGIN
        UPDATE solicitacoes_compra SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_orcamentos_updated_at 
    AFTER UPDATE ON orcamentos
    BEGIN
        UPDATE orcamentos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_compradores_updated_at 
    AFTER UPDATE ON compradores
    BEGIN
        UPDATE compradores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_aprovadores_updated_at 
    AFTER UPDATE ON aprovadores
    BEGIN
        UPDATE aprovadores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Inserir permissões do módulo de compras
INSERT OR IGNORE INTO permissions (name, code, module, description) VALUES
-- Solicitações de Compra
('Visualizar Solicitações de Compra', 'compras.solicitacoes.view', 'compras', 'Permite visualizar solicitações de compra'),
('Criar Solicitações de Compra', 'compras.solicitacoes.create', 'compras', 'Permite criar novas solicitações de compra'),
('Editar Solicitações de Compra', 'compras.solicitacoes.edit', 'compras', 'Permite editar solicitações de compra'),
('Excluir Solicitações de Compra', 'compras.solicitacoes.delete', 'compras', 'Permite excluir solicitações de compra'),
('Aprovar Solicitações de Compra', 'compras.solicitacoes.approve', 'compras', 'Permite aprovar solicitações de compra'),
('Rejeitar Solicitações de Compra', 'compras.solicitacoes.reject', 'compras', 'Permite rejeitar solicitações de compra'),
('Atribuir Comprador', 'compras.solicitacoes.assign', 'compras', 'Permite atribuir comprador a solicitações'),
('Cancelar Solicitações', 'compras.solicitacoes.cancel', 'compras', 'Permite cancelar solicitações de compra'),
('Visualizar Histórico de Solicitações', 'compras.solicitacoes.history', 'compras', 'Permite visualizar histórico de solicitações'),

-- Orçamentos
('Visualizar Orçamentos', 'compras.orcamentos.view', 'compras', 'Permite visualizar orçamentos'),
('Criar Orçamentos', 'compras.orcamentos.create', 'compras', 'Permite criar novos orçamentos'),
('Editar Orçamentos', 'compras.orcamentos.edit', 'compras', 'Permite editar orçamentos'),
('Excluir Orçamentos', 'compras.orcamentos.delete', 'compras', 'Permite excluir orçamentos'),
('Aprovar Orçamentos', 'compras.orcamentos.approve', 'compras', 'Permite aprovar orçamentos'),
('Rejeitar Orçamentos', 'compras.orcamentos.reject', 'compras', 'Permite rejeitar orçamentos'),
('Devolver Orçamentos', 'compras.orcamentos.devolver', 'compras', 'Permite devolver orçamentos para correção'),

-- Aprovadores e Compradores
('Gerenciar Aprovadores', 'compras.aprovadores.manage', 'compras', 'Permite gerenciar aprovadores'),
('Gerenciar Compradores', 'compras.compradores.manage', 'compras', 'Permite gerenciar compradores'),
('Visualizar Aprovadores', 'compras.aprovadores.view', 'compras', 'Permite visualizar lista de aprovadores'),
('Visualizar Compradores', 'compras.compradores.view', 'compras', 'Permite visualizar lista de compradores'),

-- Anexos
('Visualizar Anexos de Compras', 'compras.anexos.view', 'compras', 'Permite visualizar anexos de compras'),
('Fazer Upload de Anexos', 'compras.anexos.upload', 'compras', 'Permite fazer upload de anexos'),
('Excluir Anexos de Compras', 'compras.anexos.delete', 'compras', 'Permite excluir anexos de compras'),

-- Relatórios e Exportação
('Exportar Solicitações', 'compras.export', 'compras', 'Permite exportar solicitações e orçamentos'),
('Visualizar Relatórios de Compras', 'compras.reports.view', 'compras', 'Permite visualizar relatórios de compras'),
('Acompanhar Solicitações', 'compras.acompanhamento.view', 'compras', 'Permite acompanhar status das solicitações');

-- Atualizar permissões de roles para incluir compras
-- Attendant também pode ter algumas permissões de compras
INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
SELECT 'attendant', id, 1 FROM permissions 
WHERE code IN (
    'compras.solicitacoes.view', 'compras.solicitacoes.create', 'compras.solicitacoes.edit',
    'compras.orcamentos.view', 'compras.orcamentos.create', 'compras.orcamentos.edit',
    'compras.anexos.view', 'compras.anexos.upload',
    'compras.acompanhamento.view'
);

-- User pode criar e visualizar suas próprias solicitações e orçamentos (solicitante ou comprador)
INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
SELECT 'user', id, 1 FROM permissions 
WHERE code IN (
    'compras.solicitacoes.view', 'compras.solicitacoes.create', 'compras.solicitacoes.edit',
    'compras.orcamentos.view',
    'compras.anexos.view', 'compras.anexos.upload',
    'compras.acompanhamento.view'
);

-- Tabela de tokens de push para dispositivos móveis
CREATE TABLE IF NOT EXISTS device_push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    push_token VARCHAR(255) NOT NULL,
    platform VARCHAR(20) DEFAULT 'unknown',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, push_token)
);

-- Usuários serão criados através da interface de registro
