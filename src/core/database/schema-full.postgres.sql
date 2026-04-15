-- =============================================================================
-- Schema PostgreSQL completo para ERP Prime (USE_POSTGRES=true)
-- Ordem de criação respeitando FKs. Rodar uma vez no banco vazio.
-- Uso: psql -U erp -d erp_prime -f schema-full.postgres.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelas sem dependência de outras tabelas do app
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'attendant', 'admin')),
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    sla_first_response_hours INTEGER NOT NULL DEFAULT 4,
    sla_resolution_hours INTEGER NOT NULL DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    custom_fields TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. Chamados (dependem de users e ticket_categories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    attendant_id INTEGER REFERENCES users(id),
    category_id INTEGER NOT NULL REFERENCES ticket_categories(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval', 'resolved', 'closed', 'overdue_first_response', 'overdue_resolution')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    sla_first_response TIMESTAMP NOT NULL,
    sla_resolution TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    reopened_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_history (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    attachment VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    path VARCHAR(500) NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ticket_id INTEGER DEFAULT 0,
    type VARCHAR(30) NOT NULL CHECK (type IN ('status_change', 'new_message', 'sla_alert', 'ticket_reopened')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_activity_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    activity VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    session_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS category_assignments (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES ticket_categories(id) ON DELETE CASCADE,
    attendant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, attendant_id)
);

CREATE TABLE IF NOT EXISTS category_assignment_rules (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES ticket_categories(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    operator VARCHAR(20) NOT NULL CHECK (operator IN ('equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte')),
    value VARCHAR(500) NOT NULL,
    attendant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES ticket_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. Relatórios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sla_performance', 'ticket_volume', 'attendant_performance', 'category_analysis', 'tickets_by_attendant', 'general_tickets', 'compras_solicitacoes', 'compras_orcamentos', 'compras_aprovacoes', 'compras_geral', 'custom')),
    parameters TEXT,
    custom_fields TEXT,
    custom_query TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_executions (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    executed_by INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    parameters TEXT,
    result_data TEXT,
    file_path VARCHAR(500),
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    day_of_week INTEGER,
    day_of_month INTEGER,
    time VARCHAR(5) NOT NULL,
    recipients TEXT,
    is_active BOOLEAN DEFAULT true,
    last_executed TIMESTAMP,
    next_execution TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 4. Permissões e roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'attendant', 'admin')),
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission_id)
);

-- -----------------------------------------------------------------------------
-- 5. Módulo Compras
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compradores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aprovadores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nivel_aprovacao INTEGER NOT NULL DEFAULT 1,
    valor_minimo DECIMAL(15,2) DEFAULT 0,
    valor_maximo DECIMAL(15,2) DEFAULT 999999999.99,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitacoes_compra (
    id SERIAL PRIMARY KEY,
    numero_solicitacao VARCHAR(50) UNIQUE NOT NULL,
    solicitante_id INTEGER NOT NULL REFERENCES users(id),
    comprador_id INTEGER REFERENCES compradores(id),
    centro_custo VARCHAR(100),
    descricao TEXT NOT NULL,
    justificativa TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovada', 'rejeitada', 'em_cotacao', 'cotacao_recebida', 'orcamento_aprovado', 'orcamento_rejeitado', 'em_compra', 'comprada', 'cancelada', 'devolvida')),
    prioridade VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    valor_total DECIMAL(15,2) DEFAULT 0,
    data_necessidade DATE,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aprovada_em TIMESTAMP,
    rejeitada_em TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitacoes_compra_itens (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    item_numero INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    valor_unitario DECIMAL(15,2) DEFAULT 0,
    valor_total DECIMAL(15,2) DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orcamentos (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    fornecedor_id INTEGER,
    fornecedor_nome VARCHAR(255) NOT NULL,
    fornecedor_cnpj VARCHAR(18),
    fornecedor_contato VARCHAR(255),
    fornecedor_email VARCHAR(255),
    fornecedor_telefone VARCHAR(20),
    numero_orcamento VARCHAR(50),
    data_orcamento DATE,
    data_validade DATE,
    condicoes_pagamento TEXT,
    prazo_entrega VARCHAR(100),
    valor_total DECIMAL(15,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'devolvido', 'cancelado')),
    motivo_rejeicao TEXT,
    observacoes TEXT,
    anexo_path VARCHAR(500),
    entrega_prevista DATE,
    entrega_efetiva DATE,
    status_entrega VARCHAR(20) DEFAULT 'pendente' CHECK (status_entrega IN ('pendente', 'em_transito', 'entregue')),
    confirmado_entrega_solicitante BOOLEAN DEFAULT false,
    confirmado_entrega_comprador BOOLEAN DEFAULT false,
    data_confirmacao_solicitante TIMESTAMP,
    data_confirmacao_comprador TIMESTAMP,
    criado_por INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aprovado_em TIMESTAMP,
    rejeitado_em TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orcamentos_itens (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
    item_solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra_itens(id),
    descricao TEXT NOT NULL,
    quantidade DECIMAL(15,3) NOT NULL,
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    valor_unitario DECIMAL(15,2) NOT NULL,
    valor_total DECIMAL(15,2) NOT NULL,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aprovacoes_solicitacao (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    aprovador_id INTEGER NOT NULL REFERENCES aprovadores(id),
    nivel_aprovacao INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    observacoes TEXT,
    aprovado_em TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS aprovacoes_orcamento (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
    aprovador_id INTEGER REFERENCES aprovadores(id),
    solicitante_id INTEGER REFERENCES users(id),
    nivel_aprovacao INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
    observacoes TEXT,
    aprovado_em TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitacoes_compra_historico (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER NOT NULL REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES users(id),
    acao VARCHAR(50) NOT NULL,
    descricao TEXT,
    dados_anteriores TEXT,
    dados_novos TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compras_anexos (
    id SERIAL PRIMARY KEY,
    solicitacao_id INTEGER REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
    orcamento_id INTEGER REFERENCES orcamentos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('solicitacao', 'orcamento', 'nota_fiscal', 'boleto', 'outro')),
    nome_original VARCHAR(255) NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NOT NULL,
    tamanho INTEGER NOT NULL,
    mime_type VARCHAR(100),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token VARCHAR(255) NOT NULL,
    platform VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, push_token)
);

-- -----------------------------------------------------------------------------
-- 6. Módulo Descarregamento
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedores_descarga (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    plate VARCHAR(20),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS docas_config (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agendamentos_descarga (
    id SERIAL PRIMARY KEY,
    fornecedor_id INTEGER NOT NULL REFERENCES fornecedores_descarga(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(10) NOT NULL,
    dock VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'motorista_pronto', 'em_andamento', 'concluido')),
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agendamentos_descarga_status_history (
    id SERIAL PRIMARY KEY,
    agendamento_id INTEGER NOT NULL REFERENCES agendamentos_descarga(id) ON DELETE CASCADE,
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formularios_descarga (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    fields TEXT NOT NULL,
    is_published BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_responses_descarga (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES formularios_descarga(id),
    responses TEXT NOT NULL,
    driver_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    fornecedor_id INTEGER REFERENCES fornecedores_descarga(id),
    agendamento_id INTEGER REFERENCES agendamentos_descarga(id),
    is_in_yard BOOLEAN DEFAULT true,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMP,
    tracking_code VARCHAR(50) UNIQUE,
    discharge_started_at TIMESTAMP,
    discharge_duration_minutes INTEGER,
    satellite_submission_id VARCHAR(80) UNIQUE
);

CREATE TABLE IF NOT EXISTS sms_templates_descarga (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    template_type VARCHAR(20) NOT NULL CHECK (template_type IN ('arrival', 'release')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, template_type)
);

-- -----------------------------------------------------------------------------
-- 7. Sistema (templates de e-mail, auditoria)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_email_templates (
    notification_key VARCHAR(80) PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    subject_template TEXT NOT NULL,
    body_html TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(255),
    action VARCHAR(120) NOT NULL,
    resource VARCHAR(80),
    resource_id VARCHAR(80),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================
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
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id ON user_activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_timestamp ON user_activity_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_category_assignment_rules_category ON category_assignment_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_execution ON report_schedules(next_execution);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_solicitante ON solicitacoes_compra(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_comprador ON solicitacoes_compra(comprador_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_status ON solicitacoes_compra(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_numero ON solicitacoes_compra(numero_solicitacao);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_itens_solicitacao ON solicitacoes_compra_itens(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_solicitacao ON orcamentos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_itens_orcamento ON orcamentos_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_solicitacao ON aprovacoes_solicitacao(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_orcamento ON aprovacoes_orcamento(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_compra_historico_solicitacao ON solicitacoes_compra_historico(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_anexos_solicitacao ON compras_anexos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_compras_anexos_orcamento ON compras_anexos(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_descarga_category ON fornecedores_descarga(category);
CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_fornecedor ON agendamentos_descarga(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_date ON agendamentos_descarga(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_agendamentos_descarga_status_history_ag ON agendamentos_descarga_status_history(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_descarga_agendamento ON form_responses_descarga(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_descarga_tracking ON form_responses_descarga(tracking_code);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);

-- =============================================================================
-- DADOS INICIAIS (ON CONFLICT para idempotência)
-- =============================================================================
INSERT INTO system_config (key, value, description) VALUES
('sla_first_response_hours', '4', 'SLA para primeira resposta em horas'),
('sla_resolution_hours', '24', 'SLA para resolução em horas'),
('reopen_days', '7', 'Dias para reabrir chamado após resolução'),
('max_file_size', '10485760', 'Tamanho máximo de arquivo em bytes'),
('allowed_file_types', 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png', 'Tipos de arquivo permitidos'),
('email_notifications', '1', 'Habilitar notificações por email'),
('system_name', 'ERP PRIME', 'Nome do sistema'),
('system_subtitle', 'Sistema de Gestão Empresarial', 'Subtítulo do sistema'),
('system_logo', '', 'Caminho do logo do sistema'),
('system_version', '1.0.0', 'Versão do sistema')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ticket_categories (name, description, sla_first_response_hours, sla_resolution_hours) VALUES
('Dúvida de Pagamento', 'Dúvidas relacionadas a pagamentos, cobranças e valores', 4, 24),
('Reembolso', 'Solicitações de reembolso e devoluções', 2, 12),
('Nota Fiscal', 'Emissão, correção e consulta de notas fiscais', 4, 48),
('Adiantamento', 'Solicitações de adiantamento e antecipação', 2, 8),
('Outros', 'Outras solicitações não categorizadas', 8, 72)
ON CONFLICT (name) DO NOTHING;

-- Permissões (insert com ON CONFLICT em code)
INSERT INTO permissions (name, code, module, description) VALUES
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
('Visualizar Notificações', 'notifications.view', 'notifications', 'Permite visualizar notificações'),
('Gerenciar Notificações', 'notifications.manage', 'notifications', 'Permite gerenciar notificações (marcar como lida, excluir)'),
('Gerenciar Configurações de Notificações', 'notifications.settings.manage', 'notifications', 'Permite gerenciar configurações de notificações'),
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
('Criar Backup do Sistema', 'system.backup.create', 'administration', 'Permite gerar arquivo de backup (banco e storage)'),
('Restaurar Backup do Sistema', 'system.backup.restore', 'administration', 'Permite restaurar sistema a partir de arquivo de backup'),
('Manutenção do Sistema', 'system.maintenance', 'administration', 'Permite colocar sistema em manutenção'),
('Visualizar Auditoria', 'system.audit.view', 'administration', 'Permite visualizar auditoria do sistema'),
('Gerenciar Alertas de Monitoramento', 'monitoring.alerts.manage', 'administration', 'Permite gerenciar alertas de monitoramento')
ON CONFLICT (code) DO NOTHING;

-- Compras
INSERT INTO permissions (name, code, module, description) VALUES
('Visualizar Solicitações de Compra', 'compras.solicitacoes.view', 'compras', 'Permite visualizar solicitações de compra'),
('Criar Solicitações de Compra', 'compras.solicitacoes.create', 'compras', 'Permite criar novas solicitações de compra'),
('Editar Solicitações de Compra', 'compras.solicitacoes.edit', 'compras', 'Permite editar solicitações de compra'),
('Excluir Solicitações de Compra', 'compras.solicitacoes.delete', 'compras', 'Permite excluir solicitações de compra'),
('Aprovar Solicitações de Compra', 'compras.solicitacoes.approve', 'compras', 'Permite aprovar solicitações de compra'),
('Rejeitar Solicitações de Compra', 'compras.solicitacoes.reject', 'compras', 'Permite rejeitar solicitações de compra'),
('Atribuir Comprador', 'compras.solicitacoes.assign', 'compras', 'Permite atribuir comprador a solicitações'),
('Cancelar Solicitações', 'compras.solicitacoes.cancel', 'compras', 'Permite cancelar solicitações de compra'),
('Visualizar Histórico de Solicitações', 'compras.solicitacoes.history', 'compras', 'Permite visualizar histórico de solicitações'),
('Visualizar Orçamentos', 'compras.orcamentos.view', 'compras', 'Permite visualizar orçamentos'),
('Criar Orçamentos', 'compras.orcamentos.create', 'compras', 'Permite criar novos orçamentos'),
('Editar Orçamentos', 'compras.orcamentos.edit', 'compras', 'Permite editar orçamentos'),
('Excluir Orçamentos', 'compras.orcamentos.delete', 'compras', 'Permite excluir orçamentos'),
('Aprovar Orçamentos', 'compras.orcamentos.approve', 'compras', 'Permite aprovar orçamentos'),
('Rejeitar Orçamentos', 'compras.orcamentos.reject', 'compras', 'Permite rejeitar orçamentos'),
('Devolver Orçamentos', 'compras.orcamentos.devolver', 'compras', 'Permite devolver orçamentos para correção'),
('Gerenciar Aprovadores', 'compras.aprovadores.manage', 'compras', 'Permite gerenciar aprovadores'),
('Gerenciar Compradores', 'compras.compradores.manage', 'compras', 'Permite gerenciar compradores'),
('Visualizar Aprovadores', 'compras.aprovadores.view', 'compras', 'Permite visualizar lista de aprovadores'),
('Visualizar Compradores', 'compras.compradores.view', 'compras', 'Permite visualizar lista de compradores'),
('Visualizar Anexos de Compras', 'compras.anexos.view', 'compras', 'Permite visualizar anexos de compras'),
('Fazer Upload de Anexos (Compras)', 'compras.anexos.upload', 'compras', 'Permite fazer upload de anexos'),
('Excluir Anexos de Compras', 'compras.anexos.delete', 'compras', 'Permite excluir anexos de compras'),
('Exportar Solicitações', 'compras.export', 'compras', 'Permite exportar solicitações e orçamentos'),
('Visualizar Relatórios de Compras', 'compras.reports.view', 'compras', 'Permite visualizar relatórios de compras'),
('Acompanhar Solicitações', 'compras.acompanhamento.view', 'compras', 'Permite acompanhar status das solicitações')
ON CONFLICT (code) DO NOTHING;

-- Descarregamento
INSERT INTO permissions (name, code, module, description) VALUES
('Visualizar Agendamentos', 'descarregamento.agendamentos.view', 'descarregamento', 'Permite visualizar agendamentos de descarregamento'),
('Criar Agendamentos', 'descarregamento.agendamentos.create', 'descarregamento', 'Permite criar agendamentos'),
('Editar Agendamentos', 'descarregamento.agendamentos.edit', 'descarregamento', 'Permite editar agendamentos'),
('Excluir Agendamentos', 'descarregamento.agendamentos.delete', 'descarregamento', 'Permite excluir agendamentos'),
('Visualizar Fornecedores', 'descarregamento.fornecedores.view', 'descarregamento', 'Permite visualizar fornecedores'),
('Criar Fornecedores', 'descarregamento.fornecedores.create', 'descarregamento', 'Permite criar fornecedores'),
('Editar Fornecedores', 'descarregamento.fornecedores.edit', 'descarregamento', 'Permite editar fornecedores'),
('Excluir Fornecedores', 'descarregamento.fornecedores.delete', 'descarregamento', 'Permite excluir fornecedores'),
('Visualizar Docas', 'descarregamento.docas.view', 'descarregamento', 'Permite visualizar docas'),
('Gerenciar Docas', 'descarregamento.docas.manage', 'descarregamento', 'Permite criar/editar/excluir docas'),
('Visualizar Formulários', 'descarregamento.formularios.view', 'descarregamento', 'Permite visualizar formulários'),
('Gerenciar Formulários', 'descarregamento.formularios.manage', 'descarregamento', 'Permite criar/editar formulários'),
('Visualizar Respostas', 'descarregamento.form_responses.view', 'descarregamento', 'Permite visualizar respostas de chegada'),
('Liberar Motorista', 'descarregamento.form_responses.release', 'descarregamento', 'Permite liberar motorista (checkout)'),
('Gerenciar Templates SMS', 'descarregamento.sms_templates.manage', 'descarregamento', 'Permite gerenciar templates de SMS'),
('Visualizar Motoristas no Pátio', 'descarregamento.motoristas.view', 'descarregamento', 'Permite visualizar motoristas no pátio'),
('Visualizar Respostas de Formulários', 'descarregamento.formularios.view_responses', 'descarregamento', 'Permite visualizar respostas dos formulários'),
('Liberar Motoristas', 'descarregamento.motoristas.liberar', 'descarregamento', 'Permite liberar motorista (checkout)')
ON CONFLICT (code) DO NOTHING;

-- role_permissions: admin tem todas
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'admin', id, true FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- attendant: subset
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'attendant', id, true FROM permissions
WHERE code IN (
  'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.close', 'tickets.reopen',
  'tickets.attachments.view', 'tickets.attachments.upload', 'tickets.messages.view', 'tickets.messages.create',
  'tickets.history.view', 'tickets.sla.view',
  'registrations.view', 'registrations.create', 'registrations.edit', 'registrations.financial.view', 'registrations.history.view',
  'notifications.view', 'notifications.manage', 'reports.view', 'reports.execute', 'reports.export', 'dashboard.view',
  'compras.solicitacoes.view', 'compras.solicitacoes.create', 'compras.solicitacoes.edit', 'compras.orcamentos.view', 'compras.orcamentos.create', 'compras.orcamentos.edit',
  'compras.anexos.view', 'compras.anexos.upload', 'compras.acompanhamento.view',
  'descarregamento.agendamentos.view', 'descarregamento.agendamentos.create', 'descarregamento.agendamentos.edit',
  'descarregamento.fornecedores.view', 'descarregamento.fornecedores.create', 'descarregamento.fornecedores.edit',
  'descarregamento.docas.view', 'descarregamento.docas.manage', 'descarregamento.formularios.manage',
  'descarregamento.form_responses.view', 'descarregamento.form_responses.release', 'descarregamento.motoristas.view',
  'descarregamento.formularios.view_responses', 'descarregamento.motoristas.liberar'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- user: subset
INSERT INTO role_permissions (role, permission_id, granted)
SELECT 'user', id, true FROM permissions
WHERE code IN (
  'tickets.view', 'tickets.create', 'tickets.attachments.view', 'tickets.attachments.upload',
  'tickets.messages.view', 'tickets.messages.create', 'tickets.history.view', 'registrations.view',
  'notifications.view', 'notifications.manage', 'dashboard.view',
  'compras.solicitacoes.view', 'compras.solicitacoes.create', 'compras.solicitacoes.edit', 'compras.orcamentos.view',
  'compras.anexos.view', 'compras.anexos.upload', 'compras.acompanhamento.view'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Templates SMS padrão (descarregamento)
INSERT INTO sms_templates_descarga (name, message, template_type, is_default) VALUES
('Chamado para doca (padrão)', '{{fornecedor_name}}: {{driver_name}}, você foi chamado para descarregamento. Data: {{scheduled_date}} {{scheduled_time}}. Doca: {{dock}}. Código: {{tracking_code}}.', 'arrival', true),
('Liberação (padrão)', '{{fornecedor_name}}: {{driver_name}}, você foi liberado. Código: {{tracking_code}}. Obrigado!', 'release', true)
ON CONFLICT (name, template_type) DO NOTHING;
