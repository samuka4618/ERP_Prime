-- Migração para adicionar rastreamento de atividade de usuários
-- Criar tabela para rastrear atividade dos usuários

CREATE TABLE IF NOT EXISTS user_activity_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity VARCHAR(50) NOT NULL, -- 'login', 'logout', 'ticket_created', 'ticket_updated', etc.
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Adicionar coluna last_activity na tabela users se não existir
ALTER TABLE users ADD COLUMN last_activity DATETIME;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_timestamp ON user_activity_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_activity_activity ON user_activity_tracking(activity);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);

-- Inserir dados iniciais de atividade para usuários existentes
UPDATE users SET last_activity = created_at WHERE last_activity IS NULL;
