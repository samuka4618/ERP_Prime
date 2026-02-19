-- Migração: Permitir ticket_id NULL ou 0 em notificações
-- Data: 2025

-- Para SQLite
-- Remover foreign key constraint se existir (SQLite não permite ALTER DROP CONSTRAINT)
-- Em vez disso, vamos adicionar suporte para ticket_id = 0

-- Criar nova tabela temporária
CREATE TABLE IF NOT EXISTS notifications_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER DEFAULT 0,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copiar dados existentes
INSERT INTO notifications_new (id, user_id, ticket_id, type, title, message, is_read, created_at)
SELECT id, user_id, ticket_id, type, title, message, is_read, created_at
FROM notifications;

-- Remover tabela antiga
DROP TABLE IF EXISTS notifications;

-- Renomear nova tabela
ALTER TABLE notifications_new RENAME TO notifications;

-- Reconstruir índices se necessário (SQLite cria automaticamente)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id ON notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

