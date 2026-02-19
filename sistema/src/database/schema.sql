-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'attendant', 'admin')),
    is_active BOOLEAN DEFAULT 1,
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
('system_name', 'Sistema de Chamados Financeiro', 'Nome do sistema'),
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
    type VARCHAR(50) NOT NULL CHECK (type IN ('sla_performance', 'ticket_volume', 'attendant_performance', 'category_analysis', 'tickets_by_attendant', 'general_tickets', 'custom')),
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

-- Usuários serão criados através da interface de registro
