-- Verificar se a tabela attachments existe e tem a estrutura correta
-- Se não existir, criar com a estrutura correta

-- Primeiro, vamos verificar se a tabela existe
-- Se existir, vamos recriar com a estrutura correta

-- Dropar a tabela se existir (CUIDADO: isso vai deletar todos os anexos!)
-- DROP TABLE IF EXISTS attachments;

-- Criar a tabela attachments com a estrutura correta
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    message_id INTEGER, -- Pode ser NULL
    user_id INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES ticket_history(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
