-- Migration: Adicionar tabela de tokens de push para dispositivos móveis
-- Data: 2025-01-29
-- Descrição: Cria tabela para armazenar tokens de push notifications dos dispositivos móveis

-- Criar tabela de tokens de push
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

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON device_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_push_token ON device_push_tokens(push_token);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_platform ON device_push_tokens(platform);

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_device_push_tokens_updated_at 
    AFTER UPDATE ON device_push_tokens
    BEGIN
        UPDATE device_push_tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
