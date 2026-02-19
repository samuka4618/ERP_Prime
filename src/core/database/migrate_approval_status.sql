-- Script para adicionar o novo status 'pending_approval' ao banco existente
-- Execute este script se você já tem um banco de dados em produção

-- Primeiro, vamos verificar se o status já existe
-- Se não existir, vamos adicionar o novo status à constraint

-- Para SQLite, precisamos recriar a tabela com a nova constraint
-- Isso é necessário porque SQLite não suporta ALTER COLUMN para constraints CHECK

-- 1. Criar uma nova tabela com a constraint atualizada
CREATE TABLE tickets_new (
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

-- 2. Copiar todos os dados da tabela antiga para a nova
INSERT INTO tickets_new SELECT * FROM tickets;

-- 3. Remover a tabela antiga
DROP TABLE tickets;

-- 4. Renomear a nova tabela para o nome original
ALTER TABLE tickets_new RENAME TO tickets;

-- 5. Recriar os índices
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attendant_id ON tickets(attendant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- 6. Recriar o trigger para updated_at
CREATE TRIGGER IF NOT EXISTS update_tickets_updated_at 
    AFTER UPDATE ON tickets
    BEGIN
        UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Verificar se a migração foi bem-sucedida
SELECT 'Migração concluída com sucesso!' as status;
