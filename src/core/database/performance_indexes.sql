-- Índices para otimização de performance
-- Estes índices melhoram significativamente a velocidade das consultas

-- Índices para tabela tickets
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attendant_id ON tickets(attendant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_first_response ON tickets(sla_first_response);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_resolution ON tickets(sla_resolution);

-- Índices compostos para consultas complexas
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_attendant_status ON tickets(attendant_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_category_status ON tickets(category_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at);

-- Índices para tabela ticket_history
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_author_id ON ticket_history(author_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_created_at ON ticket_history(created_at);

-- Índices para tabela users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Índices para tabela ticket_categories
CREATE INDEX IF NOT EXISTS idx_ticket_categories_is_active ON ticket_categories(is_active);

-- Índices para tabela notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Índices para tabela ticket_attachments
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message_id ON ticket_attachments(message_id);

-- Índices para tabela category_assignments
CREATE INDEX IF NOT EXISTS idx_category_assignments_category_id ON category_assignments(category_id);
CREATE INDEX IF NOT EXISTS idx_category_assignments_attendant_id ON category_assignments(attendant_id);
CREATE INDEX IF NOT EXISTS idx_category_assignments_is_active ON category_assignments(is_active);

-- Índices para tabela user_activity_tracking
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_activity_type ON user_activity_tracking(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_tracking(created_at);

-- Índices para tabela reports
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_is_active ON reports(is_active);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Índices para tabela report_executions
CREATE INDEX IF NOT EXISTS idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_executions_created_at ON report_executions(created_at);

-- Análise de performance
ANALYZE;
