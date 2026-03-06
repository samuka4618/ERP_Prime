-- Migration: Campos para integração Microsoft Entra ID
-- Adiciona microsoft_id, avatar_url e job_title na tabela users.
-- Usuários apenas Microsoft: usar senha placeholder (não NULL) no app.

-- SQLite: ADD COLUMN (novas colunas nullable)
ALTER TABLE users ADD COLUMN microsoft_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN avatar_url TEXT NULL;
ALTER TABLE users ADD COLUMN job_title VARCHAR(255) NULL;

-- Índice único para microsoft_id (evita duplicatas e acelera busca)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id) WHERE microsoft_id IS NOT NULL;
